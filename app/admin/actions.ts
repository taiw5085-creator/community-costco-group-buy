"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, isAdminSessionValid, setAdminSession } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  adminLoginSchema,
  topupRequestStatusSchema,
  topupReviewSchema,
  orderStatusSchema,
  productSchema,
  walletAdjustmentSchema,
  type ProductFormValues,
  type WalletAdjustmentValues
} from "@/lib/schemas";
import {
  calculateProfit,
  calculateProfitRate,
  getEstimatedArrivalDate,
  makePickupCode,
  normalizeOrderStatus,
  normalizePaymentStatus,
  shippingFeeBySize
} from "@/lib/calculations";
import type {
  AdminOrder,
  AdminProduct,
  DashboardData,
  Member,
  OrderStatus,
  PaymentStatus,
  Topup,
  TopupRequest,
  WalletTransaction
} from "@/lib/types";
import { sendLineMessage } from "@/services/line";

type AdminActionResult<T = null> = {
  ok: boolean;
  data?: T;
  message?: string;
};

type BatchOrderAction = "採購中" | "已到貨" | "已領貨" | "cancel" | "refund";

const PRODUCT_IMAGE_BUCKET = "product-images";
const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

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

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "product"}-${Date.now().toString(36)}`;
}

function getStoragePathFromPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = publicUrl.slice(markerIndex + marker.length).split("?")[0];
  return decodeURIComponent(path);
}

async function ensureProductImagesBucket() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };

  const exists = buckets?.some((bucket) => bucket.name === PRODUCT_IMAGE_BUCKET);
  if (exists) return { ok: true, supabase };

  const { error: createError } = await supabase.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: PRODUCT_IMAGE_MAX_SIZE,
    allowedMimeTypes: PRODUCT_IMAGE_MIME_TYPES
  });

  if (createError) return { ok: false, message: createError.message };
  return { ok: true, supabase };
}

async function removeProductImage(publicUrl: string | null | undefined) {
  const path = getStoragePathFromPublicUrl(publicUrl);
  if (!path) return;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return;

  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

function mapProduct(row: any): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url,
    category: row.category,
    spec: row.spec,
    price: toNumber(row.price),
    cost: toNumber(row.cost),
    shippingFee: toNumber(row.shipping_fee),
    shippingType: row.shipping_type || "中件",
    profit: toNumber(row.profit),
    profitRate: toNumber(row.profit_rate),
    deadline: row.deadline,
    isHot: Boolean(row.is_hot),
    isActive: Boolean(row.is_active),
    orderCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMember(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    building: row.building,
    addressNote: row.address_note ?? null,
    phone: row.phone,
    lineName: row.line_name,
    lineUserId: row.line_user_id ?? null,
    lineBoundAt: row.line_bound_at ?? null,
    lineBindStatus: row.line_bind_status ?? "未綁定",
    lookupCode: row.lookup_code,
    balance: toNumber(row.balance),
    totalDeposit: toNumber(row.total_deposit),
    totalSpent: toNumber(row.total_spent),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTransaction(row: any): WalletTransaction {
  return {
    id: row.id,
    memberId: row.member_id,
    orderId: row.order_id,
    type: row.type,
    amount: toNumber(row.amount),
    balanceAfter: toNumber(row.balance_after),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapTopupRequest(row: any): TopupRequest {
  return {
    id: row.id,
    memberId: row.member_id,
    member: row.members ? mapMember(row.members) : null,
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
    member: row.members ? mapMember(row.members) : null,
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
    note: input.note
  });

  if (logError && !isMissingRelation(logError, "wallet_logs")) {
    throw new Error(logError.message);
  }

  const { error: txError } = await supabase.from("wallet_transactions").insert({
    member_id: input.memberId,
    order_id: input.orderId ?? null,
    type: input.type === "topup" ? "deposit" : input.type,
    amount: input.amount,
    balance_after: input.balanceAfter,
    note: input.note,
    created_by: input.createdBy ?? "admin"
  });

  if (txError && !isMissingRelation(txError, "wallet_transactions")) {
    throw new Error(txError.message);
  }
}

function mapOrder(row: any): AdminOrder {
  const paymentStatus = normalizePaymentStatus(row.payment_status);
  return {
    id: row.id,
    orderNo: row.order_no,
    memberId: row.member_id,
    member: row.members ? mapMember(row.members) : null,
    totalAmount: toNumber(row.total_amount),
    totalProfit: toNumber(row.total_profit),
    status: normalizeOrderStatus(row.status, paymentStatus),
    paymentStatus,
    pickupCode: row.pickup_code,
    estimatedArrivalDate: row.estimated_arrival_date,
    lineNotified: Boolean(row.line_notified),
    notifiedAt: row.notified_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items:
      row.order_items?.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: Number(item.quantity ?? 0),
        unitPrice: toNumber(item.unit_price),
        unitCost: toNumber(item.unit_cost),
        shippingFee: toNumber(item.shipping_fee),
        profit: toNumber(item.profit),
        subtotal: toNumber(item.subtotal),
        createdAt: item.created_at
      })) ?? []
  };
}

export async function loginAdminAction(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    password: String(formData.get("password") ?? "")
  });

  if (!parsed.success || parsed.data.password !== process.env.ADMIN_PASSWORD) {
    redirect("/admin?error=invalid");
  }

  await setAdminSession();
  redirect("/admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/admin");
}

export async function requireAdmin() {
  return isAdminSessionValid();
}

export async function getDashboardDataAction(): Promise<DashboardData> {
  if (!(await isAdminSessionValid())) {
    return { products: [], orders: [], members: [], transactions: [], topupRequests: [], topups: [] };
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) return { products: [], orders: [], members: [], transactions: [], topupRequests: [], topups: [] };

  const [productsResult, ordersResult, membersResult, txResult, topupRequestResult, topupResult] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, members(*), order_items(*)")
      .order("created_at", { ascending: false }),
    supabase.from("members").select("*").order("created_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("topup_requests")
      .select("*, members(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("topups")
      .select("*, members(*)")
      .order("created_at", { ascending: false })
  ]);

  return {
    products: productsResult.data?.map(mapProduct) ?? [],
    orders: ordersResult.data?.map(mapOrder) ?? [],
    members: membersResult.data?.map(mapMember) ?? [],
    transactions: txResult.data?.map(mapTransaction) ?? [],
    topupRequests: topupRequestResult.data?.map(mapTopupRequest) ?? [],
    topups: topupResult.data && !topupResult.error ? topupResult.data.map(mapTopup) : []
  };
}

export async function uploadProductImageAction(
  formData: FormData
): Promise<AdminActionResult<{ publicUrl: string }>> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "請選擇商品圖片。" };
  if (!PRODUCT_IMAGE_MIME_TYPES.includes(file.type)) {
    return { ok: false, message: "圖片格式只支援 jpg、png、webp。" };
  }
  if (file.size > PRODUCT_IMAGE_MAX_SIZE) {
    return { ok: false, message: "圖片不可超過 5MB。" };
  }

  const bucket = await ensureProductImagesBucket();
  if (!bucket.ok || !bucket.supabase) return { ok: false, message: bucket.message };

  const random = Math.random().toString(36).slice(2, 10);
  const filePath = `products/${Date.now()}-${random}.webp`;

  const { error } = await bucket.supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600"
    });

  if (error) return { ok: false, message: error.message };

  const { data } = bucket.supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  return { ok: true, data: { publicUrl: data.publicUrl } };
}

export async function deleteProductImageAction(publicUrl: string): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  await removeProductImage(publicUrl);
  return { ok: true };
}

export async function saveProductAction(input: ProductFormValues): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };

  const values = productSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const shippingFee = shippingFeeBySize[values.shippingType];
  const profit = calculateProfit(values.price, values.cost, shippingFee);
  const profitRate = calculateProfitRate(values.price, profit);

  const payload = {
    name: values.name,
    spec: values.spec || null,
    image_url: values.imageUrl || null,
    category: values.category,
    cost: values.cost,
    price: values.price,
    shipping_fee: shippingFee,
    shipping_type: values.shippingType,
    profit,
    profit_rate: profitRate,
    deadline: new Date(values.deadline).toISOString(),
    is_active: values.isActive,
    is_hot: values.isHot
  };

  if (values.id) {
    const { data: existingProduct, error: findError } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", values.id)
      .maybeSingle();
    if (findError) return { ok: false, message: findError.message };

    let { error } = await supabase.from("products").update(payload).eq("id", values.id);
    if (error && isMissingColumn(error, "spec")) {
      const { spec: _unused, ...fallbackPayload } = payload;
      ({ error } = await supabase.from("products").update(fallbackPayload).eq("id", values.id));
    }
    if (error) return { ok: false, message: error.message };

    if (existingProduct?.image_url && existingProduct.image_url !== payload.image_url) {
      await removeProductImage(existingProduct.image_url);
    }
  } else {
    let { error } = await supabase.from("products").insert({
      ...payload,
      slug: slugify(values.name)
    });
    if (error && isMissingColumn(error, "spec")) {
      const { spec: _unused, ...fallbackPayload } = payload;
      ({ error } = await supabase.from("products").insert({
        ...fallbackPayload,
        slug: slugify(values.name)
      }));
    }
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteProductAction(productId: string): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: product, error: findError } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", productId)
    .maybeSingle();
  if (findError) return { ok: false, message: findError.message };

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { ok: false, message: error.message };

  await removeProductImage(product?.image_url);

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateOrderStatusAction(input: unknown): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = orderStatusSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const payload: Record<string, unknown> = { status: values.status };
  if (values.status === "待付款") payload.payment_status = "待付款";
  if (values.status === "已付款") payload.payment_status = "已扣款";
  if (values.status === "退款完成") payload.payment_status = "已退款";

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", values.orderId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateOrderArrivalDateAction(input: {
  orderId: string;
  estimatedArrivalDate: string;
}): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { error } = await supabase
    .from("orders")
    .update({ estimated_arrival_date: input.estimatedArrivalDate || null })
    .eq("id", input.orderId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function notifyOrderReadyAction(orderId: string): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("*, members(*), order_items(*)")
    .eq("id", orderId)
    .single();

  if (findError || !order) return { ok: false, message: findError?.message ?? "找不到訂單。" };

  const member = order.members;
  if (!member) return { ok: false, message: "此訂單尚未綁定會員，無法推播 LINE。" };
  if (!member.line_user_id) {
    return {
      ok: false,
      message: "此會員尚未綁定 LINE，請先請客人加入官方帳號並傳送綁定訊息。"
    };
  }

  const itemsText =
    order.order_items
      ?.map((item: any) => `- ${item.product_name ?? "商品"} x ${Number(item.quantity ?? 0)}`)
      .join("\n") || "- 商品明細請洽管理員";

  const message = [
    "📦 商品到貨通知",
    "",
    `您好，${member.name}：`,
    "",
    "您的商品已到貨。",
    "",
    `訂單編號：${order.order_no}`,
    `領貨碼：${order.pickup_code || "請洽管理員"}`,
    "",
    "商品：",
    itemsText,
    "",
    "請至管理室領取，謝謝。"
  ].join("\n");

  const lineResult = await sendLineMessage(member.line_user_id, message);
  if (!lineResult.ok) return { ok: false, message: lineResult.message ?? "LINE 推播失敗。" };

  const notifiedAt = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ line_notified: true, notified_at: notifiedAt })
    .eq("id", orderId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function cancelOrderAction(orderId: string): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, members(*)")
    .eq("id", orderId)
    .single();
  if (error || !order) return { ok: false, message: error?.message ?? "找不到訂單。" };

  const orderStatus = normalizeOrderStatus(order.status, normalizePaymentStatus(order.payment_status));
  if (orderStatus === "已取消" || orderStatus === "退款完成") return { ok: true };

  if (order.payment_status === "已扣款" && order.member_id) {
    const currentBalance = toNumber(order.members?.balance);
    const refundAmount = toNumber(order.total_amount);
    const balanceAfter = currentBalance + refundAmount;

    const { error: memberError } = await supabase
      .from("members")
      .update({ balance: balanceAfter })
      .eq("id", order.member_id);
    if (memberError) return { ok: false, message: memberError.message };

    try {
      await insertWalletLedgers({
        memberId: order.member_id,
        orderId: order.id,
        type: "refund",
        amount: refundAmount,
        balanceAfter,
        note: "訂單取消退款",
        createdBy: "admin"
      });
    } catch (ledgerError) {
      return { ok: false, message: ledgerError instanceof Error ? ledgerError.message : "流水帳建立失敗。" };
    }
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: order.payment_status === "已扣款" ? "退款完成" : "已取消",
      payment_status: order.payment_status === "已扣款" ? "已退款" : "待付款"
    })
    .eq("id", order.id);
  if (orderError) return { ok: false, message: orderError.message };

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function batchOrderAction(input: {
  orderIds: string[];
  action: BatchOrderAction;
}): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const orderIds = input.orderIds.filter(Boolean);
  if (orderIds.length === 0) return { ok: false, message: "請先勾選訂單。" };

  if (input.action === "cancel" || input.action === "refund") {
    for (const orderId of orderIds) {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) return result;
    }
    return { ok: true };
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const payload: Record<string, unknown> = { status: input.action };
  if (input.action === "已到貨") {
    payload.estimated_arrival_date = getEstimatedArrivalDate(new Date());
  }

  const { error } = await supabase.from("orders").update(payload).in("id", orderIds);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

export async function walletAdjustmentAction(
  input: WalletAdjustmentValues
): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = walletAdjustmentSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", values.memberId)
    .single();
  if (error || !member) return { ok: false, message: error?.message ?? "找不到會員。" };

  const signedAmount =
    values.type === "purchase" ? -Math.abs(values.amount) :
    values.type === "adjustment" ? values.amount :
    Math.abs(values.amount);
  const balanceAfter = toNumber(member.balance) + signedAmount;
  if (values.type === "purchase" && balanceAfter < 0) {
    return { ok: false, message: "扣款後餘額會小於 0，請改用手動調整或先儲值。" };
  }

  const updatePayload: Record<string, number> = { balance: balanceAfter };

  if (values.type === "deposit") {
    updatePayload.total_deposit = toNumber(member.total_deposit) + Math.abs(values.amount);
  }
  if (values.type === "purchase") {
    updatePayload.total_spent = toNumber(member.total_spent) + Math.abs(values.amount);
  }

  const { error: memberError } = await supabase
    .from("members")
    .update(updatePayload)
    .eq("id", member.id);
  if (memberError) return { ok: false, message: memberError.message };

  try {
    await insertWalletLedgers({
      memberId: member.id,
      type: values.type === "deposit" ? "topup" : values.type,
      amount: signedAmount,
      balanceAfter,
      note: values.note,
      createdBy: "admin"
    });
  } catch (ledgerError) {
    return { ok: false, message: ledgerError instanceof Error ? ledgerError.message : "流水帳建立失敗。" };
  }

  revalidatePath("/admin/members");
  revalidatePath("/admin");
  return { ok: true };
}

export async function confirmTopupRequestAction(input: unknown): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = topupRequestStatusSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: request, error } = await supabase
    .from("topup_requests")
    .select("*, members(*)")
    .eq("id", values.requestId)
    .single();

  if (error || !request) return { ok: false, message: error?.message ?? "找不到儲值申請。" };
  if (request.status !== "待確認") return { ok: false, message: "此儲值申請已處理，不能重複入帳。" };
  if (!request.member_id || !request.members) return { ok: false, message: "儲值申請沒有綁定會員。" };

  const amount = Math.abs(toNumber(request.amount));
  if (amount <= 0) return { ok: false, message: "儲值金額需大於 0。" };

  const balanceAfter = toNumber(request.members.balance) + amount;
  const { error: memberError } = await supabase
    .from("members")
    .update({
      balance: balanceAfter,
      total_deposit: toNumber(request.members.total_deposit) + amount
    })
    .eq("id", request.member_id);

  if (memberError) return { ok: false, message: memberError.message };

  try {
    await insertWalletLedgers({
      memberId: request.member_id,
      type: "topup",
      amount,
      balanceAfter,
      note: "儲值申請入帳",
      createdBy: "admin"
    });
  } catch (ledgerError) {
    return { ok: false, message: ledgerError instanceof Error ? ledgerError.message : "流水帳建立失敗。" };
  }

  const { error: requestError } = await supabase
    .from("topup_requests")
    .update({
      status: "已入帳",
      confirmed_at: new Date().toISOString()
    })
    .eq("id", request.id)
    .eq("status", "待確認");

  if (requestError) return { ok: false, message: requestError.message };

  revalidatePath("/admin/members");
  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/member-center");
  return { ok: true };
}

export async function cancelTopupRequestAction(input: unknown): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = topupRequestStatusSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { error } = await supabase
    .from("topup_requests")
    .update({ status: "已取消" })
    .eq("id", values.requestId)
    .eq("status", "待確認");

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/members");
  revalidatePath("/account");
  revalidatePath("/member-center");
  return { ok: true };
}

export async function getTopupsAction(): Promise<AdminActionResult<Topup[]>> {
  if (!(await isAdminSessionValid())) return { ok: false, data: [], message: "尚未登入後台。" };
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, data: [], message: "尚未設定 Supabase。" };

  const { data, error } = await supabase
    .from("topups")
    .select("*, members(*)")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error, "topups")) {
      return { ok: false, data: [], message: "資料庫尚未建立 topups，請先執行 supabase/migration_v1_4.sql。" };
    }
    return { ok: false, data: [], message: error.message };
  }

  return { ok: true, data: data.map(mapTopup) };
}

export async function approveTopupAction(input: unknown): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = topupReviewSchema.parse({ ...(input as object), status: "approved" });
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { data: topup, error } = await supabase
    .from("topups")
    .select("*, members(*)")
    .eq("id", values.topupId)
    .single();

  if (error || !topup) return { ok: false, message: error?.message ?? "找不到儲值申請。" };
  if (topup.status !== "pending") return { ok: false, message: "此儲值申請已處理，不能重複入帳。" };
  if (!topup.member_id || !topup.members) return { ok: false, message: "儲值申請沒有綁定會員。" };

  const amount = Math.abs(toNumber(topup.amount));
  if (amount <= 0) return { ok: false, message: "儲值金額需大於 0。" };

  const balanceAfter = toNumber(topup.members.balance) + amount;
  const { error: memberError } = await supabase
    .from("members")
    .update({
      balance: balanceAfter,
      total_deposit: toNumber(topup.members.total_deposit) + amount
    })
    .eq("id", topup.member_id);

  if (memberError) return { ok: false, message: memberError.message };

  try {
    await insertWalletLedgers({
      memberId: topup.member_id,
      topupId: topup.id,
      type: "topup",
      amount,
      balanceAfter,
      note: "儲值申請入帳",
      createdBy: "admin"
    });
  } catch (ledgerError) {
    return { ok: false, message: ledgerError instanceof Error ? ledgerError.message : "流水帳建立失敗。" };
  }

  const { error: updateError } = await supabase
    .from("topups")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", topup.id)
    .eq("status", "pending");

  if (updateError) return { ok: false, message: updateError.message };

  if (topup.members.line_user_id) {
    await sendLineMessage(topup.members.line_user_id, `✅ 儲值成功
金額：$${amount}
目前餘額：$${balanceAfter}
可至會員查詢頁查看明細。`);
  }

  revalidatePath("/admin/topups");
  revalidatePath("/admin/members");
  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/member-center");
  return { ok: true };
}

export async function rejectTopupAction(input: unknown): Promise<AdminActionResult> {
  if (!(await isAdminSessionValid())) return { ok: false, message: "尚未登入後台。" };
  const values = topupReviewSchema.parse({ ...(input as object), status: "rejected" });
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false, message: "尚未設定 Supabase。" };

  const { error } = await supabase
    .from("topups")
    .update({ status: "rejected" })
    .eq("id", values.topupId)
    .eq("status", "pending");

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/topups");
  revalidatePath("/account");
  revalidatePath("/member-center");
  return { ok: true };
}
