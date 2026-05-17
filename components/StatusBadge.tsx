import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const statusStyles: Record<OrderStatus, "muted" | "deal" | "success" | "blue" | "danger"> = {
  待付款: "deal",
  已付款: "success",
  採購中: "deal",
  已到貨: "blue",
  已領貨: "success",
  已取消: "danger",
  退款完成: "muted"
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusStyles[status]}>{status}</Badge>;
}

const paymentStyles: Record<PaymentStatus, "deal" | "success" | "blue"> = {
  待付款: "deal",
  已扣款: "success",
  已退款: "blue"
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={paymentStyles[status]}>{status}</Badge>;
}
