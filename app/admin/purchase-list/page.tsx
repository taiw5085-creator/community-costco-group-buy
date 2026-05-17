import { redirect } from "next/navigation";
import { getDashboardDataAction, requireAdmin } from "@/app/admin/actions";
import { PurchaseList } from "@/components/PurchaseList";

export const dynamic = "force-dynamic";

export default async function PurchaseListPage() {
  if (!(await requireAdmin())) redirect("/admin");
  const data = await getDashboardDataAction();
  return <PurchaseList orders={data.orders} />;
}
