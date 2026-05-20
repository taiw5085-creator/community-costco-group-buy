import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LineBindPage() {
  const addFriendUrl = process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || "";

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-forest-100 bg-white p-5 shadow-soft sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-100 text-forest-700">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-forest-600">LINE Binding</p>
            <h1 className="text-3xl font-black text-forest-900">LINE 到貨通知綁定</h1>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-forest-50 p-5">
          <p className="font-black text-forest-900">請加入 LINE 官方帳號，並傳送：</p>
          <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-xl font-black text-forest-800">
            綁定 手機號碼 棟別樓號
          </div>
          <p className="mt-4 text-sm font-bold text-zinc-500">範例：</p>
          <div className="mt-2 rounded-2xl border border-forest-100 bg-white px-4 py-3 text-lg font-black text-forest-800">
            綁定 0912345678 416 14F2
          </div>
        </div>

        <div className="mt-5 flex gap-3 rounded-2xl border border-forest-100 bg-white p-4">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest-700" />
          <p className="text-sm font-bold leading-6 text-zinc-600">
            完成綁定後，商品到貨時會自動收到 LINE 通知。手機號碼與棟別樓號需與會員資料一致。
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {addFriendUrl ? (
            <a
              href={addFriendUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-forest-600 px-4 text-lg font-black text-white"
            >
              加入 LINE 官方帳號
            </a>
          ) : (
            <button
              disabled
              className="min-h-14 rounded-2xl bg-zinc-200 px-4 text-lg font-black text-zinc-500"
            >
              尚未設定 LINE 連結
            </button>
          )}
          <Link
            href="/"
            className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-forest-100 bg-white px-4 text-lg font-black text-forest-700"
          >
            返回首頁
          </Link>
        </div>
      </section>
    </main>
  );
}
