"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/line";
import {
  accountLookupSchema,
  cartItemSchema,
  checkoutSchema,
  joinMemberSchema,
  topupRequestSchema,
  topupSchema,
  type CheckoutFormValues,
  type JoinMemberValues,
  type TopupRequestValues,
  type TopupValues
} from "@/lib/schemas";
import {
  calculateProfit,
  formatProductTitle,
  getEstimatedArrivalDate,
  makeLookupCode,
  makeOrderNo,
  makePickupCode,
  normalizeBuilding,
  normalizeOrderStatus,
  normalizePaymentStatus,
  normalizePhone
} from "@/lib/calculations";
import type {
  AccountLookupResult,
  CartItem,
  PublicOrder,
  PublicProduct,
  Topup,
  TopupRequest,
  WalletLog
} from "@/lib/types";

type ActionResult<T> = {
  ok: boolean;
  data?: T;
  message?: string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  category: string | null;
  spec?: string | null;
  price: number | string | null;
  cost?: number | string | null;
  shipping_fee?: number | string | null;
  deadline: string | null;
  is_hot: boolean | null;
  is_active?: boolean | null;
};

const TOPUP_PROOF_BUCKET = "topup-proofs";
const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROOF_MAX_SIZE = 5 * 1024 * 1024;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function isMissingColumn(error: { message?: string; code?: string } | null | undefined, column: string) {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes(column.toLowerCase()) && (text.includes("does not exist") || text.includes("pgrst204"));
}

function isMissingRelation(error: { message?: string; code?: string } | null | undefined, relation: string) {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes(relation.toLowerCase()) && (text.includes("does not exist") || text.includes("could not find"));
}

function mapPublicProduct(row: ProductRow, orderCount = 0): PublicProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url,
    category: row.category,
    spec: row.spec ?? null,
    price: toNumber(row.price),
    deadline: row.deadline,
    isHot: Boolean(row.is_hot),
    orderCount
  };
}

function mapTopupRequest(row: any): TopupRequest {
  return {
    id: row.id,
    memberId: row.member_id,
    amount: toNumber(row.amount),
    paymentMethod: row.payment_method,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at
  };
}

function mapTopup(row: any): Topup {
  return {
    id: row.id,
    memberId: row.member_id,
    member: null,
    phone: row.phone,
    lineName: row.line_name,
    amount: toNumber(row.amount),
    bankLast5: row.bank_last5,
    proofImageUrl: row.proof_image_url,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    approvedAt: row.approved_at
  };
}

function mapWalletLog(row: any): WalletLog {
  return {
    id: row.id,
    memberId: row.member_id,
    orderId: row.order_id ?? null,
    topupId: row.topup_id ?? null,
    type: row.type === "deposit" ? "topup" : row.type,
    amount: toNumber(row.amount),
    balanceAfter: toNumber(row.balance_after),
    note: row.description ?? row.note,
    createdAt: row.created_at
  };
}

async function getOrderCounts(productIds: string[]) {
  const supabase = createAdminSupabaseClient();
  if (!supabase || productIds.length === 0) return new Map<string, number>();

  const { data } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .in("product_id", productIds);

  const counts = new Map<string, number>();
  data?.forEach((row) => {
    if (!row.product_id) return;
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + Number(row.quantity ?? 0));
  });

  return counts;
}

async function insertWalletLedgers(input: {
  memberId: string;
  orderId?: string | null;
  topupId?: string | null;
  type: "topup" | "purchase" | "refund" | "adjustment";
  amount: number;
  balanceAfter: number;
  note: string;
  createdBy?: string;
}) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return;

  const { error: logError } = await supabase.from("wallet_logs").insert({
    member_id: input.memberId,
    order_id: input.orderId ?? null,
    topup_id: input.topupId ?? null,
    type: input.type,
    amount: input.amount,
    balance_after: input.balanceAfter,
    description: input.note,
    note: input.note
  });

  if (logError && !isMissingRelation(logError, "wallet_logs")) {
    throw new Error(logError.message);
  }

  const txType = input.type === "topup" ? "deposit" : input.type;
  const { error: txError } = await supabase.from("wallet_transactions").insert({
    member_id: input.memberId,
    order_id: input.orderId ?? null,
    type: txType,
    amount: input.amount,
    balance_after: input.balanceAfter,
    note: input.note,
    created_by: input.createdBy ?? "system"
  });

  if (txError && !isMissingRelation(txError, "wallet_transactions")) {
    throw new Error(txError.message);
  }
}

async function ensureTopupProofBucket() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };

  const exists = buckets?.some((bucket) => bucket.name === TOPUP_PROOF_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(TOPUP_PROOF_BUCKET, {
      public: true,
      fileSizeLimit: PROOF_MAX_SIZE,
      allowedMimeTypes: PROOF_MIME_TYPES
    });
    if (error) return { ok: false, message: error.message };
  }

  return { ok: true, supabase };
}

export async function uploadTopupProofAction(
  formData: FormData
): Promise<ActionResult<{ publicUrl: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "請選擇轉帳截圖。" };
  if (!PROOF_MIME_TYPES.includes(file.type)) return { ok: false, message: "截圖只支援 jpg、png、webp。" };
  if (file.size > PROOF_MAX_SIZE) return { ok: false, message: "截圖不可超過 5MB。" };

  const bucket = await ensureTopupProofBucket();
  if (!bucket.ok || !bucket.supabase) return { ok: false, message: bucket.message };

  const random = Math.random().toString(36).slice(2, 10);
  const filePath = `topups/${Date.now()}-${random}`;
  const { error } = await bucket.supabase.storage.from(TOPUP_PROOF_BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600"
  });

  if (error) return { ok: false, message: error.message };

  const { data } = bucket.supabase.storage.from(TOPUP_PROOF_BUCKET).getPublicUrl(filePath);
  return { ok: true, data: { publicUrl: data.publicUrl } };
}

export async function listPublicProductsAction(): Promise<ActionResult<PublicProduct[]>> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  let { data, error } = await supabase
    .from("products")
    .select("id,name,slug,image_url,category,spec,price,deadline,is_hot")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error && isMissingColumn(error, "spec")) {
    const fallback = await supabase
      .from("products")
      .select("id,name,slug,image_url,category,price,deadline,is_hot")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) return { ok: false, data: [], message: error.message };

  const rows = data ?? [];
  const counts = await getOrderCounts(rows.map((row) => row.id));
  return {
    ok: true,
    data: rows.map((row) => mapPublicProduct(row, counts.get(row.id) ?? 0))
  };
}

export async function getPublicProductBySlugAction(
  slug: string
): Promise<ActionResult<PublicProduct | null>> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  let { data, error } = await supabase
    .from("products")
    .select("id,name,slug,image_url,category,spec,price,deadline,is_hot")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error && isMissingColumn(error, "spec")) {
    const fallback = await supabase
      .from("products")
      .select("id,name,slug,image_url,category,price,deadline,is_hot")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error || !data) return { ok: true, data: null };

  const counts = await getOrderCounts([data.id]);
  return {
    ok: true,
    data: mapPublicProduct(data, counts.get(data.id) ?? 0)
  };
}

export async function joinMemberAction(input: JoinMemberValues): Promise<ActionResult<{ memberId: string }>> {
  const parsed = joinMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "會員資料格式不正確。" };
  }

  const values = parsed.data;
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "尚未設定 Supabase。請確認 Vercel Environment Variables 有 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。"
    };
  }

  try {
    const phone = normalizePhone(values.phone);
    const { data: members, error: queryError } = await supabase
      .from("members")
      .select("*");

    if (queryError) return { ok: false, message: queryError.message };

    const existing = members?.find((member) => normalizePhone(member.phone) === phone);
    const payload = {
      name: values.name,
      building: values.building,
      note: values.note || null,
      address_note: values.note || null,
      phone,
      line_name: values.lineName,
      lookup_code: existing?.lookup_code ?? makeLookupCode(),
      balance: existing?.balance ?? 0,
      line_bind_status: existing?.line_bind_status ?? "pending",
      is_active: true
    };

    if (existing) {
      let update = await supabase.from("members").update(payload).eq("id", existing.id).select("id").single();
      if (
        update.error &&
        (isMissingColumn(update.error, "address_note") || isMissingColumn(update.error, "note"))
      ) {
        const { address_note: _unusedAddress, note: _unusedNote, ...fallbackPayload } = payload;
        update = await supabase.from("members").update(fallbackPayload).eq("id", existing.id).select("id").single();
      }
      if (update.error) return { ok: false, message: update.error.message };
      revalidatePath("/account");
      revalidatePath("/member-center");
      revalidatePath("/admin");
      revalidatePath("/admin/members");
      return { ok: true, data: { memberId: existing.id } };
    }

    let insert = await supabase.from("members").insert(payload).select("id").single();
    if (
      insert.error &&
      (isMissingColumn(insert.error, "address_note") || isMissingColumn(insert.error, "note"))
    ) {
      const { address_note: _unusedAddress, note: _unusedNote, ...fallbackPayload } = payload;
      insert = await supabase.from("members").insert(fallbackPayload).select("id").single();
    }
    if (insert.error || !insert.data) return { ok: false, message: insert.error?.message ?? "會員建立失敗。" };

    revalidatePath("/account");
    revalidatePath("/member-center");
    revalidatePath("/admin");
    revalidatePath("/admin/members");
    return { ok: true, data: { memberId: insert.data.id } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function createOrderAction(
  input: CheckoutFormValues,
  rawItems: CartItem[]
): Promise<
  ActionResult<{
    orderNo: string;
    paymentStatus: "已扣款" | "待付款";
    balanceAfter: number;
  }>
> {
  const customer = checkoutSchema.parse(input);
  const cartItems = rawItems.map((item) => cartItemSchema.parse(item));
  const supabase = createAdminSupabaseClient();

  if (!supabase) return { ok: false, message: "尚未設定 Supabase，請先完成 .env.local。" };
  if (cartItems.length === 0) return { ok: false, message: "購物車目前沒有商品。" };

  const productIds = cartItems.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,price,cost,shipping_fee,deadline,is_active")
    .in("id", productIds);

  if (productsError) return { ok: false, message: productsError.message };
  if (!products || products.length !== productIds.length) {
    return { ok: false, message: "有商品不存在或已下架，請重新整理後再下單。" };
  }

  const now = Date.now();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = cartItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.is_active) throw new Error("有商品已下架。");
    if (product.deadline && new Date(product.deadline).getTime() <= now) {
      throw new Error(`${product.name} 已結單。`);
    }

    const price = toNumber(product.price);
    const cost = toNumber(product.cost);
    const shippingFee = toNumber(product.shipping_fee);
    const unitProfit = calculateProfit(price, cost, shippingFee);

    return {
      product_id: product.id,
      product_name: formatProductTitle(product.name),
      quantity: item.quantity,
      unit_price: price,
      unit_cost: cost,
      shipping_fee: shippingFee,
      profit: unitProfit * item.quantity,
      subtotal: price * item.quantity
    };
  });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalProfit = orderItems.reduce((sum, item) => sum + item.profit, 0);

  const { data: existingMember, error: memberQueryError } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);

  if (memberQueryError) return { ok: false, message: memberQueryError.message };

  const phone = normalizePhone(customer.phone);
  let member = existingMember?.find((row) => normalizePhone(row.phone) === phone) ?? null;
  const lookupCode = member?.lookup_code || makeLookupCode();

  if (!member) {
    const memberPayload = {
      name: customer.name,
      building: customer.building,
      note: customer.note || null,
      address_note: customer.building,
      phone,
      line_name: customer.lineName,
      lookup_code: lookupCode,
      line_bind_status: "pending"
    };
    let created = await supabase.from("members").insert(memberPayload).select("*").single();
    if (
      created.error &&
      (isMissingColumn(created.error, "address_note") || isMissingColumn(created.error, "note"))
    ) {
      const { address_note: _unusedAddress, note: _unusedNote, ...fallbackPayload } = memberPayload;
      created = await supabase.from("members").insert(fallbackPayload).select("*").single();
    }
    if (created.error) return { ok: false, message: created.error.message };
    member = created.data;
  } else {
    const updatePayload = {
      name: customer.name,
      building: customer.building,
      note: customer.note || null,
      address_note: customer.building,
      phone,
      line_name: customer.lineName
    };
    let updated = await supabase.from("members").update(updatePayload).eq("id", member.id);
    if (
      updated.error &&
      (isMissingColumn(updated.error, "address_note") || isMissingColumn(updated.error, "note"))
    ) {
      const { address_note: _unusedAddress, note: _unusedNote, ...fallbackPayload } = updatePayload;
      updated = await supabase.from("members").update(fallbackPayload).eq("id", member.id);
    }
    if (updated.error) return { ok: false, message: updated.error.message };
  }

  const balance = toNumber(member.balance);
  const canDeduct = balance >= totalAmount;
  if (!canDeduct) {
    return { ok: false, message: "餘額不足，請先儲值" };
  }

  const balanceAfter = balance - totalAmount;
  const orderNo = makeOrderNo();

  let { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_no: orderNo,
      member_id: member.id,
      total_amount: totalAmount,
      total_profit: totalProfit,
      status: "placed",
      payment_status: "已扣款",
      pickup_code: makePickupCode(),
      estimated_arrival_date: getEstimatedArrivalDate(),
      note: customer.note
    })
    .select("id")
    .single();

  if (orderError && `${orderError.message}`.includes("orders_status_check")) {
    const fallback = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        member_id: member.id,
        total_amount: totalAmount,
        total_profit: totalProfit,
        status: "已付款",
        payment_status: "已扣款",
        pickup_code: makePickupCode(),
        estimated_arrival_date: getEstimatedArrivalDate(),
        note: customer.note
      })
      .select("id")
      .single();
    order = fallback.data;
    orderError = fallback.error;
  }

  if (orderError || !order) return { ok: false, message: orderError?.message ?? "訂單建立失敗。" };

  const { error: itemError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      ...item,
      order_id: order.id
    }))
  );

  if (itemError) return { ok: false, message: itemError.message };

  const { error: memberUpdateError } = await supabase
    .from("members")
    .update({
      balance: balanceAfter,
      total_spent: toNumber(member.total_spent) + totalAmount
    })
    .eq("id", member.id);

  if (memberUpdateError) return { ok: false, message: memberUpdateError.message };

  try {
    await insertWalletLedgers({
      memberId: member.id,
      orderId: order.id,
      type: "purchase",
      amount: -totalAmount,
      balanceAfter,
      note: "訂單扣款",
      createdBy: "system"
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "流水帳建立失敗。" };
  }

  if (member.line_user_id) {
    await sendLineMessage(
      member.line_user_id,
      `訂單已建立。\n本次扣款：${totalAmount} 元\n目前餘額：${balanceAfter} 元`
    );
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/member-center");
  revalidatePath("/admin");

  return {
    ok: true,
    data: {
      orderNo,
      paymentStatus: "已扣款",
      balanceAfter
    }
  };
}

export async function lookupAccountAction(input: unknown): Promise<ActionResult<AccountLookupResult>> {
  const values = accountLookupSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: members, error } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);

  if (error) return { ok: false, message: error.message };
  const phone = normalizePhone(values.phone);
  const member = members?.find((row) => normalizePhone(row.phone) === phone);

  if (!member) {
    return {
      ok: false,
      message: "查無會員資料，請確認手機號碼是否和加入會員或下單時相同。"
    };
  }

  return getAccountDataForMember(supabase, member);
}

export async function lookupMemberByLineUserIdAction(lineUserId: string): Promise<ActionResult<AccountLookupResult>> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const safeLineUserId = String(lineUserId ?? "").trim();
  if (!safeLineUserId) return { ok: false, message: "尚未取得 LINE userId。" };

  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("line_user_id", safeLineUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!member) {
    return {
      ok: false,
      message: "找不到已綁定 LINE 的會員資料，請先完成 LINE 綁定。"
    };
  }

  return getAccountDataForMember(supabase, member);
}

export async function bindLineMemberAction(input: {
  lineUserId: string;
  phone: string;
  building: string;
}): Promise<ActionResult<AccountLookupResult>> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const lineUserId = String(input.lineUserId ?? "").trim();
  const phone = normalizePhone(input.phone);
  const building = normalizeBuilding(input.building);

  if (!lineUserId) return { ok: false, message: "尚未取得 LINE 身分，請重新開啟會員中心。" };
  if (!phone || !building) return { ok: false, message: "請填寫手機號碼與棟別樓號。" };

  const { data: members, error } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);

  if (error) return { ok: false, message: error.message };

  const member = members?.find(
    (row) => normalizePhone(row.phone) === phone && normalizeBuilding(row.building) === building
  );

  if (!member) {
    return {
      ok: false,
      message: "找不到會員資料，請確認手機號碼與棟別樓號，或先加入會員。"
    };
  }

  const boundAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("members")
    .update({
      line_user_id: lineUserId,
      line_bind_status: "bound",
      line_bound_at: boundAt
    })
    .eq("id", member.id);

  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/member-center");
  revalidatePath("/account");
  revalidatePath("/admin/members");
  revalidatePath("/admin");

  return getAccountDataForMember(supabase, {
    ...member,
    line_user_id: lineUserId,
    line_bind_status: "bound",
    line_bound_at: boundAt
  });
}

async function getAccountDataForMember(supabase: any, member: any): Promise<ActionResult<AccountLookupResult>> {
  const [ordersResult, walletLogResult, walletTxResult, topupResult, topupRequestResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_no,total_amount,status,payment_status,pickup_code,estimated_arrival_date,note,created_at,order_items(product_name,quantity,unit_price,subtotal)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_logs")
      .select("id,member_id,order_id,topup_id,type,amount,balance_after,description,note,created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_transactions")
      .select("id,member_id,order_id,type,amount,balance_after,note,created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("topups")
      .select("id,member_id,phone,line_name,amount,bank_last5,proof_image_url,status,note,created_at,approved_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("topup_requests")
      .select("id,member_id,amount,payment_method,note,status,created_at,confirmed_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const walletLogs =
    walletLogResult.data && !walletLogResult.error
      ? walletLogResult.data.map(mapWalletLog)
      : walletTxResult.data?.map(mapWalletLog) ?? [];

  return {
    ok: true,
    data: {
      member: {
        id: member.id,
        name: member.name,
        building: member.building,
        addressNote: member.address_note ?? null,
        phone: member.phone,
        lineName: member.line_name,
        lineUserId: member.line_user_id ?? null,
        lineBoundAt: member.line_bound_at ?? null,
        lineBindStatus: member.line_bind_status ?? "未綁定",
        balance: toNumber(member.balance),
        totalDeposit: toNumber(member.total_deposit),
        totalSpent: toNumber(member.total_spent),
        createdAt: member.created_at
      },
      orders:
        ordersResult.data?.map((order: any): PublicOrder => ({
          id: order.id,
          orderNo: order.order_no,
          totalAmount: toNumber(order.total_amount),
          status: normalizeOrderStatus(order.status, normalizePaymentStatus(order.payment_status)),
          paymentStatus: normalizePaymentStatus(order.payment_status),
          pickupCode: order.pickup_code,
          estimatedArrivalDate: order.estimated_arrival_date,
          note: order.note,
          createdAt: order.created_at,
          items:
            order.order_items?.map((item: any) => ({
              productName: item.product_name,
              quantity: Number(item.quantity ?? 0),
              unitPrice: toNumber(item.unit_price),
              subtotal: toNumber(item.subtotal)
            })) ?? []
        })) ?? [],
      transactions: walletLogs,
      topups: topupResult.data && !topupResult.error ? topupResult.data.map(mapTopup) : [],
      topupRequests:
        topupRequestResult.data && !topupRequestResult.error
          ? topupRequestResult.data.map(mapTopupRequest)
          : []
    }
  };
}

export async function createTopupAction(input: TopupValues): Promise<ActionResult<Topup>> {
  const values = topupSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const phone = normalizePhone(values.phone);
  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);

  if (memberError) return { ok: false, message: memberError.message };
  const member = members?.find((row) => normalizePhone(row.phone) === phone);
  if (!member) return { ok: false, message: "查無會員資料，請先加入會員或確認手機號碼。" };

  const { data, error } = await supabase
    .from("topups")
    .insert({
      member_id: member.id,
      phone,
      line_name: values.lineName,
      amount: values.amount,
      bank_last5: values.bankLast5,
      proof_image_url: values.proofImageUrl || null,
      status: "pending",
      note: values.note
    })
    .select("id,member_id,phone,line_name,amount,bank_last5,proof_image_url,status,note,created_at,approved_at")
    .single();

  if (error) {
    if (isMissingRelation(error, "topups")) {
      return { ok: false, message: "資料庫尚未建立 topups，請先執行 supabase/migration_v1_4.sql。" };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/account");
  revalidatePath("/member-center");
  revalidatePath("/admin/topups");
  return { ok: true, data: mapTopup(data) };
}

export async function createTopupRequestByPhoneAction(input: {
  phone: string;
  amount: number;
  bankLast5: string;
}): Promise<ActionResult<TopupRequest>> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const phone = normalizePhone(input.phone);
  const amount = Number(input.amount ?? 0);
  const bankLast5 = String(input.bankLast5 ?? "").trim();

  if (!phone) return { ok: false, message: "請輸入手機號碼。" };
  if (!Number.isFinite(amount) || amount < 1000) return { ok: false, message: "最低儲值金額為 1000 元。" };
  if (!/^\d{5}$/.test(bankLast5)) return { ok: false, message: "請輸入匯款帳號末五碼。" };

  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);

  if (memberError) return { ok: false, message: memberError.message };

  const member = members?.find((row) => normalizePhone(row.phone) === phone);
  if (!member) return { ok: false, message: "查無會員資料，請先加入會員或確認手機號碼。" };

  const payload = {
    member_id: member.id,
    amount,
    last5: bankLast5,
    payment_method: "bank_transfer",
    note: `匯款末五碼：${bankLast5}`,
    status: "pending"
  };

  let { data, error } = await supabase
    .from("topup_requests")
    .insert(payload)
    .select("id,member_id,amount,payment_method,note,status,created_at,confirmed_at")
    .single();

  if (error && (isMissingColumn(error, "last5") || `${error.message}`.includes("topup_requests_status_check"))) {
    const { last5: _unusedLast5, ...fallbackPayload } = {
      ...payload,
      status: "待確認"
    };
    const fallback = await supabase
      .from("topup_requests")
      .insert(fallbackPayload)
      .select("id,member_id,amount,payment_method,note,status,created_at,confirmed_at")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) return { ok: false, message: error?.message ?? "儲值申請建立失敗。" };

  revalidatePath("/topup");
  revalidatePath("/account");
  revalidatePath("/member-center");
  revalidatePath("/admin/members");

  return { ok: true, data: mapTopupRequest(data) };
}

export async function createTopupRequestAction(
  input: TopupRequestValues
): Promise<ActionResult<TopupRequest>> {
  const values = topupRequestSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("id", values.memberId)
    .eq("is_active", true)
    .maybeSingle();

  if (memberError) return { ok: false, message: memberError.message };
  if (!member) return { ok: false, message: "查無會員資料，請重新查詢後再送出儲值申請。" };

  const { data, error } = await supabase
    .from("topup_requests")
    .insert({
      member_id: values.memberId,
      amount: values.amount,
      payment_method: values.paymentMethod,
      note: values.note,
      status: "待確認"
    })
    .select("id,member_id,amount,payment_method,note,status,created_at,confirmed_at")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/account");
  revalidatePath("/member-center");
  revalidatePath("/admin/members");
  return { ok: true, data: mapTopupRequest(data) };
}
