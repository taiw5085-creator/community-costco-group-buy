import Link from "next/link";
import { LogOut } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Button } from "@/components/ui/button";
import {
  getDashboardDataAction,
  loginAdminAction,
  logoutAdminAction,
  requireAdmin
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const isAuthed = await requireAdmin();
  const params = await searchParams;

  if (!isAuthed) {
    return (
      <main className="grid min-h-screen place-items-center bg-forest-50 px-4">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-soft">
          <Link href="/" className="text-sm font-black text-forest-600">
            返回前台
          </Link>
          <p className="mt-6 text-sm font-black uppercase tracking-wide text-forest-600">
            Admin Panel
          </p>
          <h1 className="mt-1 text-3xl font-black text-forest-900">管理員登入</h1>
          <form action={loginAdminAction} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-black text-zinc-600">管理員密碼</span>
              <input
                type="password"
                name="password"
                className="mt-2 min-h-14 w-full rounded-2xl border border-forest-100 px-4 font-bold outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
              />
            </label>
            {params.error === "invalid" && (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm font-black text-rose-600">
                管理員密碼錯誤
              </div>
            )}
            <button className="min-h-14 w-full rounded-2xl bg-forest-600 px-4 py-3 text-lg font-black text-white">
              登入後台
            </button>
          </form>
        </section>
      </main>
    );
  }

  const data = await getDashboardDataAction();

  return (
    <main className="min-h-screen bg-forest-50 pb-16">
      <header className="sticky top-0 z-40 border-b border-forest-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-forest-600">Admin Panel</p>
            <h1 className="text-xl font-black text-forest-900">社區代購後台</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/members" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 text-sm font-black text-forest-700">
              會員 / 儲值
            </Link>
            <Link href="/admin/topups" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 text-sm font-black text-forest-700">
              儲值審核
            </Link>
            <Link href="/admin/purchase-list" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 text-sm font-black text-forest-700">
              採購清單
            </Link>
            <Link href="/" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 text-sm font-black text-forest-700">
              前台
            </Link>
            <form action={logoutAdminAction}>
              <Button type="submit" variant="outline" size="icon" aria-label="登出">
                <LogOut className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <AdminDashboard initialData={data} />
    </main>
  );
}
