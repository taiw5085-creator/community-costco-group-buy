import type {
  AdminProduct,
  CartLine,
  OrderStatus,
  PaymentStatus,
  ShippingSize,
  WalletTransactionType
} from "@/lib/types";

export const shippingFeeBySize: Record<ShippingSize, number> = {
  小件: 10,
  中件: 20,
  大件: 30
};

export function calculateProfit(price: number, cost: number, shippingFee: number) {
  return price - cost - shippingFee;
}

export function calculateProfitRate(price: number, profit: number) {
  if (price <= 0) return 0;
  return (profit / price) * 100;
}

export function getProductProfit(product: AdminProduct) {
  return calculateProfit(product.price, product.cost, product.shippingFee);
}

export function getProductMarginRate(product: AdminProduct) {
  return calculateProfitRate(product.price, getProductProfit(product));
}

export function getCartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
}

export function getCartQuantity(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("zh-TW")}`;
}

export function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
}

export function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function isClosed(deadline: string | null, now = new Date()) {
  if (!deadline) return false;
  const closeTime = new Date(deadline).getTime();
  return Number.isNaN(closeTime) ? false : closeTime <= now.getTime();
}

export function formatDeadline(deadline: string | null, now = new Date()) {
  if (!deadline) return "未設定結單";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "未設定結單";

  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return "已結單";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) return `倒數 ${hours} 小時 ${mins} 分鐘`;

  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} 結單`;
}

export function getSuggestedSalePrice(cost: number, shippingFee: number, targetProfitRate: number) {
  const rate = Math.max(0, Math.min(95, targetProfitRate)) / 100;
  return Math.ceil((cost + shippingFee) / (1 - rate));
}

export function makeOrderNo(date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(
    date.getMinutes()
  ).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `O${stamp}${suffix}`;
}

export function makeLookupCode() {
  return String(Math.floor(Math.random() * 900000 + 100000));
}

export function normalizePhone(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeBuilding(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

export function formatProductTitle(name: string | null | undefined, spec?: string | null) {
  const cleanName = String(name ?? "").trim();
  const cleanSpec = String(spec ?? "").trim();
  return cleanSpec ? `${cleanName} ${cleanSpec}` : cleanName;
}

export function makePickupCode() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${letter}${digits}`;
}

export function getEstimatedArrivalDate(base = new Date()) {
  const next = new Date(base);
  next.setDate(next.getDate() + 2);
  return next.toISOString().slice(0, 10);
}

export function formatDate(value: string | null) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function normalizeOrderStatus(status: string | null | undefined, paymentStatus?: PaymentStatus): OrderStatus {
  if (status === "已下單") return paymentStatus === "已扣款" ? "已付款" : "待付款";
  if (status === "已領取") return "已領貨";
  if (
    status === "待付款" ||
    status === "已付款" ||
    status === "採購中" ||
    status === "已到貨" ||
    status === "已領貨" ||
    status === "已取消" ||
    status === "退款完成"
  ) {
    return status;
  }
  return paymentStatus === "已扣款" ? "已付款" : "待付款";
}

export function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  if (status === "已扣款" || status === "待付款" || status === "已退款") return status;
  return "待付款";
}

export function getTransactionLabel(type: WalletTransactionType | string) {
  const labels: Record<string, string> = {
    deposit: "儲值",
    topup: "儲值",
    refund: "退款",
    purchase: "下單扣款",
    adjustment: "手動調整"
  };
  return labels[type] ?? type;
}
