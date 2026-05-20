import Link from "next/link";
import type { ReactNode } from "react";
import {
  ClipboardList,
  Home,
  LogOut,
  PackageSearch,
  ShoppingBag,
  Truck,
  UserRoundCog,
  WalletCards
} from "lucide-react";
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
    <main className="min-h-screen bg-[#f4f7fb] text-slate-700">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-6 py-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-forest-600">
              Admin Panel
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">社區代購後台</h1>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <AdminNavLink href="/admin" icon={<Home className="h-5 w-5" />} label="首頁" active />
            <AdminNavLink
              href="/admin#overview"
              icon={<ClipboardList className="h-5 w-5" />}
              label="概觀"
            />
            <AdminNavLink
              href="/admin#products"
              icon={<PackageSearch className="h-5 w-5" />}
              label="商品管理"
            />
            <AdminNavLink
              href="/admin#orders"
              icon={<ShoppingBag className="h-5 w-5" />}
              label="訂單管理"
            />
            <AdminNavLink
              href="/admin/members"
              icon={<UserRoundCog className="h-5 w-5" />}
              label="會員 / 儲值"
            />
            <AdminNavLink
              href="/admin/topups"
              icon={<WalletCards className="h-5 w-5" />}
              label="儲值審核"
            />
            <AdminNavLink
              href="/admin/purchase-list"
              icon={<Truck className="h-5 w-5" />}
              label="採購清單"
            />
            <AdminNavLink
              href="/"
              icon={<PackageSearch className="h-5 w-5" />}
              label="前台商品頁"
            />
          </nav>
          <div className="border-t border-slate-100 p-3">
            <form action={logoutAdminAction}>
              <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="h-5 w-5" />
                登出
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-forest-600 lg:hidden">
              Admin Panel
            </p>
            <h1 className="text-xl font-black text-slate-900 lg:hidden">社區代購後台</h1>
            <p className="hidden text-sm font-black text-slate-500 lg:block">
              營運總覽、商品管理、訂單追蹤集中在同一個工作台。
            </p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <HeaderShortcut href="/admin/members" label="會員" icon={<UserRoundCog className="h-4 w-4" />} />
            <HeaderShortcut href="/admin/topups" label="儲值審核" icon={<WalletCards className="h-4 w-4" />} />
            <HeaderShortcut href="/admin/purchase-list" label="採購" icon={<ClipboardList className="h-4 w-4" />} />
            <HeaderShortcut href="/" label="前台" icon={<ShoppingBag className="h-4 w-4" />} />
            <form action={logoutAdminAction}>
              <Button type="submit" variant="outline" size="icon" aria-label="登出">
                <LogOut className="h-5 w-5" />
              </Button>
            </form>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/admin/members"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-forest-700"
            >
              會員
            </Link>
            <Link
              href="/admin/topups"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-forest-700"
            >
              儲值
            </Link>
            <form action={logoutAdminAction}>
              <Button type="submit" variant="outline" size="icon" aria-label="登出">
                <LogOut className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
          <MobileAdminLink href="/admin" label="首頁" />
          <MobileAdminLink href="/admin#overview" label="概觀" />
          <MobileAdminLink href="/admin#products" label="商品管理" />
          <MobileAdminLink href="/admin#orders" label="訂單管理" />
          <MobileAdminLink href="/admin/members" label="會員 / 儲值" />
          <MobileAdminLink href="/admin/topups" label="儲值審核" />
          <MobileAdminLink href="/admin/purchase-list" label="採購清單" />
          <MobileAdminLink href="/" label="前台" />
        </nav>
      </header>
      <AdminDashboard initialData={data} />
      </div>
    </main>
  );
}

function AdminNavLink({
  href,
  icon,
  label,
  active
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-black transition ${
        active
          ? "bg-forest-50 text-forest-700 ring-1 ring-forest-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function HeaderShortcut({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:border-forest-200 hover:bg-forest-50 hover:text-forest-700"
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileAdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-600"
    >
      {label}
    </Link>
  );
}
