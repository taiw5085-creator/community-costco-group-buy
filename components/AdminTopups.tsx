"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { approveTopupAction, rejectTopupAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCurrency,
  formatDateTime
} from "@/lib/calculations";
import type { Topup } from "@/lib/types";

export function AdminTopups({ initialTopups, error }: { initialTopups: Topup[]; error?: string }) {
  const [topups, setTopups] = useState(initialTopups);
  const [searchText, setSearchText] = useState("");
  const [message, setMessage] = useState(error ?? "");
  const [isPending, startTransition] = useTransition();

  const pendingCount = topups.filter((topup) => topup.status === "pending").length;
  const filteredTopups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return topups;
    return topups.filter((topup) => {
      const text = `${topup.member?.name ?? ""} ${topup.phone} ${topup.lineName ?? ""} ${topup.member?.building ?? ""} ${topup.bankLast5 ?? ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [searchText, topups]);

  function approve(topupId: string) {
    if (!window.confirm("確定通過這筆儲值？通過後會增加會員餘額並新增流水帳。")) return;
    startTransition(async () => {
      const result = await approveTopupAction({ topupId });
      if (!result.ok) {
        setMessage(result.message ?? "入帳失敗");
        return;
      }
      window.location.reload();
    });
  }

  function reject(topupId: string) {
    if (!window.confirm("確定拒絕這筆儲值申請？拒絕後不會增加餘額。")) return;
    startTransition(async () => {
      const result = await rejectTopupAction({ topupId });
      if (!result.ok) {
        setMessage(result.message ?? "拒絕失敗");
        return;
      }
      setTopups((current) =>
        current.map((topup) => (topup.id === topupId ? { ...topup, status: "rejected" } : topup))
      );
    });
  }

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-forest-600">Admin</p>
            <h1 className="text-3xl font-black text-forest-900">儲值審核</h1>
            <p className="mt-2 font-bold text-zinc-500">待審核 {pendingCount} 筆。通過後才會入帳。</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/members" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 font-black text-forest-700">
              會員管理
            </Link>
            <Link href="/admin" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 font-black text-forest-700">
              回後台
            </Link>
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-3xl bg-rose-50 p-4 font-black text-rose-600">
            {message}
          </div>
        )}

        <Card className="mt-5">
          <CardContent>
            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-forest-100 px-3">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜尋姓名、電話、LINE、棟別、末五碼"
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </label>

            <div className="mt-5 space-y-3">
              {filteredTopups.map((topup) => (
                <article key={topup.id} className="rounded-3xl border border-forest-100 p-4">
                  <div className="grid gap-4 lg:grid-cols-[140px_1fr_auto]">
                    <ProofImage url={topup.proofImageUrl} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-forest-900">
                          {topup.member?.name ?? "未知會員"} ・ {formatCurrency(topup.amount)}
                        </h2>
                        <StatusPill status={topup.status} />
                      </div>
                      <p className="mt-2 text-sm font-bold text-zinc-500">
                        電話 {topup.phone} ・ LINE {topup.lineName ?? "-"} ・ 棟別 {topup.member?.building ?? "-"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-zinc-500">
                        轉帳末五碼 {topup.bankLast5 ?? "-"} ・ 申請時間 {formatDateTime(topup.createdAt)}
                      </p>
                      {topup.note && <p className="mt-2 text-sm font-bold text-honey-600">備註：{topup.note}</p>}
                      {topup.approvedAt && (
                        <p className="mt-1 text-sm font-bold text-forest-700">
                          入帳時間 {formatDateTime(topup.approvedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      {topup.status === "pending" ? (
                        <>
                          <Button type="button" disabled={isPending} onClick={() => approve(topup.id)}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            通過
                          </Button>
                          <Button type="button" variant="outline" disabled={isPending} onClick={() => reject(topup.id)}>
                            <XCircle className="h-4 w-4" />
                            拒絕
                          </Button>
                        </>
                      ) : (
                        <span className="rounded-2xl bg-forest-50 px-4 py-3 text-sm font-black text-forest-700">
                          已處理
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {filteredTopups.length === 0 && (
                <div className="rounded-3xl border border-dashed border-forest-100 p-8 text-center font-black text-zinc-500">
                  尚無儲值申請
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ProofImage({ url }: { url: string | null }) {
  if (!url) {
    return <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-forest-50 text-sm font-black text-zinc-500">無截圖</div>;
  }
  return <img src={url} alt="轉帳截圖" className="aspect-[4/3] w-full rounded-2xl object-cover lg:w-[140px]" />;
}

function StatusPill({ status }: { status: string }) {
  const label = status === "approved" ? "已通過" : status === "rejected" ? "已拒絕" : "待審核";
  const tone =
    status === "approved"
      ? "bg-forest-50 text-forest-700"
      : status === "rejected"
        ? "bg-rose-50 text-rose-600"
        : "bg-honey-50 text-honey-700";
  return <span className={`rounded-full px-3 py-1 text-sm font-black ${tone}`}>{label}</span>;
}
