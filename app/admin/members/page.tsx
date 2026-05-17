import { redirect } from "next/navigation";
import { getDashboardDataAction, requireAdmin } from "@/app/admin/actions";
import { AdminMembers } from "@/components/AdminMembers";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  if (!(await requireAdmin())) redirect("/admin");
  const data = await getDashboardDataAction();
  return <AdminMembers initialData={data} />;
}
