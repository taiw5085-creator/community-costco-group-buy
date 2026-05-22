"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  Loader2,
  PackagePlus,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  UsersRound
} from "lucide-react";
import {
  batchOrderAction,
  cancelOrderAction,
  deleteProductAction,
  notifyOrderReadyAction,
  saveProductAction,
  updateOrderArrivalDateAction,
  updateOrderStatusAction
} from "@/app/admin/actions";
import { ProductImageUpload } from "@/components/admin/product-image-upload";
import { getOrderStatusLabel, PaymentStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculateProfit,
  calculateProfitRate,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatProductTitle,
  formatPercent,
  getSuggestedSalePrice,
  shippingFeeBySize
} from "@/lib/calculations";
import { productSchema, type ProductFormValues } from "@/lib/schemas";
import type { AdminOrder, AdminProduct, DashboardData, OrderStatus, PaymentStatus } from "@/lib/types";
import { orderStatuses, paymentStatuses, productCategories, shippingSizes } from "@/lib/types";

function defaultCloseAtValue() {
  const date = new Date();
  date.setHours(20, 0, 0, 0);
  if (date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 16);
}

const defaultProductValues: ProductFormValues = {
  name: "",
  spec: "",
  imageUrl: "",
  category: "民生用品",
  cost: 0,
  price: 0,
  shippingType: "中件",
  deadline: defaultCloseAtValue(),
  targetProfitRate: 15,
  isActive: true,
  isHot: false
};

export function AdminDashboard({ initialData }: { initialData: DashboardData }) {
  const [products, setProducts] = useState(initialData.products);
  const [orders, setOrders] = useState(initialData.orders);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "全部">("全部");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "全部">("全部");
  const [quickFilter, setQuickFilter] = useState("全部");
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultProductValues,
    mode: "onChange"
  });

  const cost = Number(form.watch("cost") || 0);
  const price = Number(form.watch("price") || 0);
  const shippingType = form.watch("shippingType");
  const shippingFee = shippingFeeBySize[shippingType];
  const profit = calculateProfit(price, cost, shippingFee);
  const profitRate = calculateProfitRate(price, profit);
  const targetRate = Number(form.watch("targetProfitRate") || 0);
  const suggestedPrice = getSuggestedSalePrice(cost, shippingFee, targetRate);
  const suggestedProfit = calculateProfit(suggestedPrice, cost, shippingFee);

  const metrics = useMemo(() => {
    const today = new Date().toLocaleDateString("zh-TW");
    const todayOrders = orders.filter(
      (order) => new Date(order.createdAt).toLocaleDateString("zh-TW") === today
    );
    const revenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const grossProfit = todayOrders.reduce((sum, order) => sum + order.totalProfit, 0);
    const memberBalance = initialData.members.reduce((sum, member) => sum + member.balance, 0);
    const pendingPayments = orders.filter((order) => order.paymentStatus === "待付款").length;
    const unpicked = orders.filter((order) => order.status === "arrived" || order.status === "已到貨").length;
    const arrivedUnpicked = orders.filter((order) => order.status === "arrived" || order.status === "已到貨").length;
    const todayRefundAmount = initialData.transactions
      .filter((tx) => tx.type === "refund" && new Date(tx.createdAt).toLocaleDateString("zh-TW") === today)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const quantities = getProductQuantities(orders);

    return {
      revenue,
      grossProfit,
      profitRate: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      orderCount: todayOrders.length,
      pendingPayments,
      unpicked,
      arrivedUnpicked,
      todayRefundAmount,
      memberBalance,
      hotProduct: quantities[0]?.name ?? "尚無資料"
    };
  }, [initialData.members, initialData.transactions, orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "全部" || order.status === statusFilter;
      const matchesPayment = paymentFilter === "全部" || order.paymentStatus === paymentFilter;
      const matchesQuick =
        quickFilter === "全部" ||
        (quickFilter === "未領貨" && (order.status === "arrived" || order.status === "已到貨")) ||
        (quickFilter === "已到貨" && (order.status === "arrived" || order.status === "已到貨")) ||
        (quickFilter === "今日訂單" && new Date(order.createdAt).toLocaleDateString("zh-TW") === new Date().toLocaleDateString("zh-TW"));
      const text = `${order.orderNo} ${order.member?.name ?? ""} ${order.member?.phone ?? ""} ${
        order.member?.lineName ?? ""
      } ${order.member?.building ?? ""} ${order.pickupCode ?? ""} ${order.note ?? ""} ${order.items
        .map((item) => item.productName)
        .join(" ")}`.toLowerCase();
      return matchesStatus && matchesPayment && matchesQuick && text.includes(searchText.toLowerCase());
    });
  }, [orders, paymentFilter, quickFilter, searchText, statusFilter]);

  const selectedOrderIds = useMemo(
    () => Object.entries(selectedOrders).filter(([, checked]) => checked).map(([id]) => id),
    [selectedOrders]
  );

  function editProduct(product: AdminProduct) {
    form.reset({
      id: product.id,
      name: product.name,
      spec: product.spec ?? "",
      imageUrl: product.imageUrl ?? "",
      category: product.category as ProductFormValues["category"],
      cost: product.cost,
      price: product.price,
      shippingType: product.shippingType,
      deadline: product.deadline ? product.deadline.slice(0, 16) : defaultCloseAtValue(),
      targetProfitRate: 15,
      isActive: product.isActive,
      isHot: product.isHot
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset({ ...defaultProductValues, deadline: defaultCloseAtValue() });
  }

  function submitProduct(values: ProductFormValues) {
    setMessage("");
    startTransition(async () => {
      const result = await saveProductAction(values);
      if (!result.ok) {
        setMessage(result.message ?? "商品儲存失敗");
        return;
      }
      window.location.reload();
    });
  }

  function deleteProduct(productId: string) {
    if (!window.confirm("確定要刪除此商品？")) return;
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        setMessage(result.message ?? "刪除失敗");
        return;
      }
      setProducts((current) => current.filter((product) => product.id !== productId));
    });
  }

  function updateStatus(orderId: string, status: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, status });
      if (!result.ok) setMessage(result.message ?? "狀態更新失敗");
      else {
        setOrders((current) =>
          current.map((order) => {
            if (order.id !== orderId) return order;
            const paymentStatus =
              status === "已付款" ? "已扣款" :
              status === "待付款" ? "待付款" :
              status === "退款完成" ? "已退款" :
              order.paymentStatus;
            const normalizedStatus: OrderStatus = (
              status === "採購中" ? "purchasing" :
              status === "已到貨" ? "arrived" :
              status === "已領貨" ? "picked_up" :
              status === "已取消" || status === "退款完成" ? "cancelled" :
              status === "已付款" || status === "待付款" ? "placed" :
              status
            ) as OrderStatus;
            return { ...order, status: normalizedStatus, paymentStatus };
          })
        );
      }
    });
  }

  function updateArrivalDate(orderId: string, estimatedArrivalDate: string) {
    startTransition(async () => {
      const result = await updateOrderArrivalDateAction({ orderId, estimatedArrivalDate });
      if (!result.ok) setMessage(result.message ?? "預估到貨日更新失敗");
      else {
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, estimatedArrivalDate } : order))
        );
      }
    });
  }

  function notifyOrder(orderId: string) {
    startTransition(async () => {
      const result = await notifyOrderReadyAction(orderId);
      if (!result.ok) setMessage(result.message ?? "通知狀態更新失敗");
      else window.location.reload();
    });
  }

  function cancelOrder(orderId: string) {
    if (!window.confirm("確定取消訂單？若已扣款會自動退款到會員餘額。")) return;
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) setMessage(result.message ?? "取消失敗");
      else window.location.reload();
    });
  }

  function runBatch(action: "採購中" | "已到貨" | "已領貨" | "cancel" | "refund") {
    if (selectedOrderIds.length === 0) {
      setMessage("請先勾選訂單。");
      return;
    }
    if (!window.confirm(`確定批次處理 ${selectedOrderIds.length} 筆訂單？`)) return;
    startTransition(async () => {
      const result = await batchOrderAction({ orderIds: selectedOrderIds, action });
      if (!result.ok) setMessage(result.message ?? "批次操作失敗");
      else window.location.reload();
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
      {message && (
        <div className="mb-5 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-black text-rose-600">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-400">社區代購營運中心</p>
                <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
                  今日工作台
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                營運中
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <ProfileField label="營運日" value={new Date().toLocaleDateString("zh-TW")} />
              <ProfileField label="商品數" value={`${products.length} 件`} />
              <ProfileField label="訂單數" value={`${orders.length} 筆`} />
              <ProfileField label="熱門商品" value={metrics.hotProduct} wide />
              <ProfileField label="管理狀態" value="集中採購 / 管理室領貨" wide />
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-black text-slate-400">今日重點</p>
            <p className="mt-2 text-4xl font-black text-slate-900">{formatCurrency(metrics.revenue)}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat label="今日毛利" value={formatCurrency(metrics.grossProfit)} />
              <MiniStat label="待付款" value={`${metrics.pendingPayments} 筆`} />
              <MiniStat label="未領貨" value={`${metrics.unpicked} 筆`} />
              <MiniStat label="會員餘額" value={formatCurrency(metrics.memberBalance)} />
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="mt-5 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader
          eyebrow="Dashboard"
          title="營運摘要"
          description="把今天最重要的營收、毛利、付款與領貨狀態集中看。"
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard title="今日營業額" value={formatCurrency(metrics.revenue)} icon={<ShoppingBag />} />
          <MetricCard title="今日毛利" value={formatCurrency(metrics.grossProfit)} icon={<BarChart3 />} />
          <MetricCard title="今日毛利率" value={formatPercent(metrics.profitRate)} icon={<BarChart3 />} />
          <MetricCard title="今日訂單數" value={`${metrics.orderCount} 筆`} icon={<ClipboardList />} />
          <MetricCard title="未領貨數量" value={`${metrics.unpicked} 筆`} icon={<ClipboardList />} />
          <MetricCard title="已到貨未領數" value={`${metrics.arrivedUnpicked} 筆`} icon={<ClipboardList />} />
          <MetricCard title="今日退款金額" value={formatCurrency(metrics.todayRefundAmount)} icon={<BarChart3 />} />
          <MetricCard title="待付款數量" value={`${metrics.pendingPayments} 筆`} icon={<ClipboardList />} />
          <MetricCard title="會員總餘額" value={formatCurrency(metrics.memberBalance)} icon={<UsersRound />} />
          <MetricCard title="本週熱門商品" value={metrics.hotProduct} icon={<ShoppingBag />} compact />
        </div>
      </section>

      <section id="products" className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-[440px_1fr]">
        <AdminPanel>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-forest-700">
                <PackagePlus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-400">商品管理 CRUD</p>
                <h2 className="text-2xl font-black text-slate-900">
                  {form.watch("id") ? "編輯商品" : "新增商品"}
                </h2>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(submitProduct)} className="mt-5 space-y-4">
              <ProductField label="商品名稱" error={form.formState.errors.name?.message}>
                <Input placeholder="例如：家庭補貨衛生紙" {...form.register("name")} />
              </ProductField>
              <ProductField label="商品規格" error={form.formState.errors.spec?.message}>
                <Input placeholder="例如：120抽 x 72入，可留空" {...form.register("spec")} />
              </ProductField>
              <ProductField label="商品圖片" error={form.formState.errors.imageUrl?.message}>
                <ProductImageUpload
                  value={form.watch("imageUrl")}
                  onChange={(url) => form.setValue("imageUrl", url, { shouldValidate: true })}
                  disabled={isPending}
                  onUploadingChange={setIsUploadingImage}
                />
              </ProductField>
              <ProductField label="商品分類" error={form.formState.errors.category?.message}>
                <select
                  {...form.register("category")}
                  className="min-h-14 w-full rounded-2xl border border-forest-100 bg-white px-4 font-black outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
                >
                  {productCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </ProductField>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProductField label="成本" error={form.formState.errors.cost?.message}>
                  <Input type="number" {...form.register("cost", { valueAsNumber: true })} />
                </ProductField>
                <ProductField label="售價" error={form.formState.errors.price?.message}>
                  <Input type="number" {...form.register("price", { valueAsNumber: true })} />
                </ProductField>
              </div>
              <ProductField label="運費分類" error={form.formState.errors.shippingType?.message}>
                <div className="grid grid-cols-3 gap-2">
                  {shippingSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => form.setValue("shippingType", size, { shouldValidate: true })}
                      className={`min-h-14 rounded-2xl border px-3 text-sm font-black ${
                        form.watch("shippingType") === size
                          ? "border-forest-600 bg-forest-600 text-white"
                          : "border-forest-100 bg-white text-forest-700"
                      }`}
                    >
                      {size}
                      <br />
                      {formatCurrency(shippingFeeBySize[size])}
                    </button>
                  ))}
                </div>
              </ProductField>
              <ProductField label="目標毛利率" error={form.formState.errors.targetProfitRate?.message}>
                <Input type="number" {...form.register("targetProfitRate", { valueAsNumber: true })} />
              </ProductField>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <SummaryRow label="運費" value={formatCurrency(shippingFee)} />
                <SummaryRow label="毛利" value={formatCurrency(profit)} />
                <SummaryRow label="毛利率" value={formatPercent(profitRate)} />
                <SummaryRow label="建議售價" value={formatCurrency(suggestedPrice)} />
                <SummaryRow label="預估毛利" value={formatCurrency(suggestedProfit)} />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => form.setValue("price", suggestedPrice, { shouldValidate: true })}
                >
                  一鍵套用建議售價
                </Button>
              </div>
              <ProductField label="結單時間" error={form.formState.errors.deadline?.message}>
                <Input type="datetime-local" {...form.register("deadline")} />
              </ProductField>
              <div className="grid gap-3 sm:grid-cols-2">
                <CheckField label="上架中" checked={form.watch("isActive")} onChange={(value) => form.setValue("isActive", value)} />
                <CheckField label="熱門商品" checked={form.watch("isHot")} onChange={(value) => form.setValue("isHot", value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button type="submit" disabled={isPending || isUploadingImage} size="lg">
                  {isPending || isUploadingImage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {isUploadingImage ? "圖片上傳中" : "儲存"}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={resetForm}>
                  清空
                </Button>
              </div>
            </form>
        </AdminPanel>

        <AdminPanel>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-400">商品清單</p>
                <h2 className="text-2xl font-black text-slate-900">價格與毛利</h2>
              </div>
              <Link href="/admin/purchase-list" className="rounded-xl bg-forest-50 px-3 py-2 text-sm font-black text-forest-700">
                採購清單
              </Link>
            </div>
            <div className="space-y-3">
              {products.map((product) => (
                <article key={product.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[88px_1fr_auto]">
                  <ProductThumb src={product.imageUrl} alt={product.name} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        {formatProductTitle(product.name, product.spec)}
                      </h3>
                      <Badge>{product.category ?? "未分類"}</Badge>
                      {product.isHot && <Badge variant="hot">熱門</Badge>}
                      {!product.isActive && <Badge variant="muted">下架</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                      <MiniStat label="成本" value={formatCurrency(product.cost)} />
                      <MiniStat label="運費" value={formatCurrency(product.shippingFee)} />
                      <MiniStat label="售價" value={formatCurrency(product.price)} />
                      <MiniStat label="毛利" value={formatCurrency(product.profit)} />
                      <MiniStat label="毛利率" value={formatPercent(product.profitRate)} />
                    </div>
                    <p className="mt-2 text-sm font-bold text-zinc-500">
                      結單 {formatDateTime(product.deadline)}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    <Button type="button" variant="secondary" size="icon" onClick={() => editProduct(product)}>
                      <Edit3 className="h-5 w-5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => deleteProduct(product.id)}>
                      <Trash2 className="h-5 w-5 text-rose-600" />
                    </Button>
                  </div>
                </article>
              ))}
              {products.length === 0 && <EmptyState label="尚未新增商品" />}
            </div>
        </AdminPanel>
      </section>

      <section id="orders" className="mt-5 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-400">訂單管理</p>
            <h2 className="text-2xl font-black text-slate-900">全部訂單</h2>
          </div>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜尋住戶、電話、LINE、棟別、商品、領貨碼"
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </label>
            <Select value={statusFilter} onChange={(value) => setStatusFilter(value as OrderStatus | "全部")} options={["全部", ...orderStatuses]} />
            <Select value={paymentFilter} onChange={(value) => setPaymentFilter(value as PaymentStatus | "全部")} options={["全部", ...paymentStatuses]} />
            <Select value={quickFilter} onChange={setQuickFilter} options={["全部", "未領貨", "已到貨", "今日訂單"]} />
          </div>
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => runBatch("採購中")}>
            批次改採購中
          </Button>
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => runBatch("已到貨")}>
            批次已到貨
          </Button>
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => runBatch("已領貨")}>
            批次已領貨
          </Button>
          <Button type="button" variant="outline" disabled={isPending} className="text-rose-600" onClick={() => runBatch("cancel")}>
            批次取消
          </Button>
          <Button type="button" variant="outline" disabled={isPending} className="text-blue-600" onClick={() => runBatch("refund")}>
            批次退款
          </Button>
        </div>
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              checked={Boolean(selectedOrders[order.id])}
              onCheckedChange={(checked) =>
                setSelectedOrders((current) => ({ ...current, [order.id]: checked }))
              }
              onStatusChange={(status) => updateStatus(order.id, status)}
              onArrivalDateChange={(value) => updateArrivalDate(order.id, value)}
              onNotify={() => notifyOrder(order.id)}
              onCancel={() => cancelOrder(order.id)}
            />
          ))}
          {filteredOrders.length === 0 && <EmptyState label="尚無訂單" />}
        </div>
      </section>
    </div>
  );
}

function OrderCard({
  order,
  checked,
  onCheckedChange,
  onStatusChange,
  onArrivalDateChange,
  onNotify,
  onCancel
}: {
  order: AdminOrder;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onStatusChange: (status: OrderStatus) => void;
  onArrivalDateChange: (value: string) => void;
  onNotify: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            className="mt-1 h-6 w-6 accent-forest-600"
            aria-label={`勾選訂單 ${order.orderNo}`}
          />
          <div>
          <p className="text-sm font-black text-slate-400">
            訂單 {order.orderNo} ・ 領貨碼 {order.pickupCode ?? "-"}
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {order.member?.name ?? "未綁定會員"} / {order.member?.building ?? "-"}
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {order.member?.phone ?? "-"} ・ LINE {order.member?.lineName ?? "-"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            會員目前餘額 {formatCurrency(order.member?.balance ?? 0)} ・ 預估到貨 {formatDate(order.estimatedArrivalDate)}
          </p>
          {order.lineNotified && (
            <p className="mt-1 text-sm font-bold text-forest-700">
              LINE 通知時間：{formatDateTime(order.notifiedAt)}
            </p>
          )}
          {order.note && <p className="mt-1 text-sm font-bold text-honey-600">備註：{order.note}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
          {order.paymentStatus === "已退款" && <Badge variant="blue">已退款</Badge>}
          {order.lineNotified && <Badge variant="success">已通知</Badge>}
          <select
            value={order.status}
            onChange={(event) => onStatusChange(event.target.value as OrderStatus)}
            className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700 outline-none"
          >
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <span>{item.productName}</span>
            <span>x {item.quantity}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="本單金額" value={formatCurrency(order.totalAmount)} />
        <MiniStat label="毛利" value={formatCurrency(order.totalProfit)} />
        <MiniStat label="毛利率" value={formatPercent(order.totalAmount > 0 ? (order.totalProfit / order.totalAmount) * 100 : 0)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="text-xs font-black text-zinc-500">預估到貨日</span>
          <Input
            type="date"
            defaultValue={order.estimatedArrivalDate ?? ""}
            onBlur={(event) => onArrivalDateChange(event.target.value)}
            className="mt-1"
          />
        </label>
        <Button type="button" variant={order.lineNotified ? "secondary" : "outline"} onClick={onNotify}>
          <Bell className="h-5 w-5" />
          {order.lineNotified ? "已通知" : "通知領貨"}
        </Button>
        {order.status !== "cancelled" && order.status !== "已取消" && order.status !== "退款完成" && (
          <Button type="button" variant="outline" className="text-rose-600" onClick={onCancel}>
            取消訂單 / 退款
          </Button>
        )}
      </div>
    </article>
  );
}

function getProductQuantities(orders: AdminOrder[]) {
  const map = new Map<string, number>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!item.productName) return;
      map.set(item.productName, (map.get(item.productName) ?? 0) + item.quantity);
    });
  });
  return Array.from(map.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 rounded-2xl border border-forest-100 bg-white px-3 text-sm font-black outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function AdminPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-forest-600">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">{title}</h2>
      </div>
      <p className="max-w-xl text-sm font-bold text-slate-500">{description}</p>
    </div>
  );
}

function ProfileField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-slate-50 px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-800">{value}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  compact
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3 text-forest-700">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-forest-700 shadow-sm [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
        <p className="text-sm font-black text-slate-500">{title}</p>
      </div>
      <p className={`mt-4 font-black text-slate-900 ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
    </article>
  );
}

function ProductField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-zinc-600">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-sm font-black text-rose-600">{error}</p>}
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between rounded-2xl border border-forest-100 px-4 font-black text-forest-900">
      {label}
      <input
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-forest-600"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3 last:border-0">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  );
}

function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-24 w-full rounded-xl bg-slate-100 sm:w-24" />;
  return <img src={src} alt={alt} className="h-24 w-full rounded-xl object-cover sm:w-24" />;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center font-black text-slate-500">
      {label}
    </div>
  );
}
