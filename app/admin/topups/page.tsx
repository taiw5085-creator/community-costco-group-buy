import { redirect } from "next/navigation";
import { getTopupsAction, requireAdmin } from "@/app/admin/actions";
import { AdminTopups } from "@/components/AdminTopups";

export const dynamic = "force-dynamic";

export default async function AdminTopupsPage() {
  const isAuthed = await requireAdmin();
  if (!isAuthed) redirect("/admin");

  const result = await getTopupsAction();
  return <AdminTopups initialTopups={result.data ?? []} error={result.ok ? undefined : result.message} />;
}
