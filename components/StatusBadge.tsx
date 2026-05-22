import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const statusStyles: Record<OrderStatus, "muted" | "deal" | "success" | "blue" | "danger"> = {
  placed: "muted",
  purchasing: "deal",
  arrived: "blue",
  picked_up: "success",
  cancelled: "danger",
  待付款: "deal",
  已付款: "success",
  採購中: "deal",
  已到貨: "blue",
  已領貨: "success",
  已取消: "danger",
  退款完成: "muted"
};

const statusLabels: Record<string, string> = {
  placed: "已下單",
  purchasing: "採購中",
  arrived: "已到貨",
  picked_up: "已領取",
  cancelled: "已取消"
};

export function getOrderStatusLabel(status: OrderStatus) {
  return statusLabels[status] ?? status;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusStyles[status]}>{statusLabels[status] ?? status}</Badge>;
}

const paymentStyles: Record<PaymentStatus, "deal" | "success" | "blue"> = {
  待付款: "deal",
  已扣款: "success",
  已退款: "blue"
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={paymentStyles[status]}>{status}</Badge>;
}
