"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, WalletCards } from "lucide-react";
import { lookupMemberByLineUserIdAction } from "@/app/actions";
import { PaymentStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatSignedCurrency,
  getTransactionLabel
} from "@/lib/calculations";
import type { AccountLookupResult } from "@/lib/types";

declare global {
  interface Window {
    liff?: {
      init: (options: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (options?: { redirectUri?: string }) => void;
      getProfile: () => Promise<{ userId: string; displayName?: string }>;
    };
  }
}

const LIFF_SRC = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function loadLiffSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("Window is not available."));
  if (window.liff) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("LIFF SDK 載入失敗。")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LIFF_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("LIFF SDK 載入失敗。"));
    document.head.appendChild(script);
  });
}

export function MemberCenter() {
  const router = useRouter();
  const [result, setResult] = useState<AccountLookupResult | null>(null);
  const [message, setMessage] = useState("正在透過 LINE 自動辨識會員...");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function identifyMember() {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
      if (!liffId) {
        router.replace("/line-bind");
        return;
      }

      try {
        await loadLiffSdk();
        if (!window.liff) throw new Error("LIFF SDK 尚未就緒。");

        await window.liff.init({ liffId });
        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await window.liff.getProfile();
        if (!profile.userId) {
          router.replace("/line-bind");
          return;
        }

        startTransition(async () => {
          const response = await lookupMemberByLineUserIdAction(profile.userId);
          if (cancelled) return;
          if (!response.ok || !response.data) {
            router.replace("/line-bind");
            return;
          }
          setResult(response.data);
          setMessage("");
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) router.replace("/line-bind");
      }
    }

    void identifyMember();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const unpickedOrders = useMemo(
    () => result?.orders.filter((order) => order.status === "已到貨") ?? [],
    [result]
  );
  const topupLogs = result?.transactions.filter((tx) => tx.type === "topup") ?? [];
  const purchaseLogs = result?.transactions.filter((tx) => tx.type === "purchase") ?? [];
  const refundLogs = result?.transactions.filter((tx) => tx.type === "refund") ?? [];

  if (!result) {
    return (
      <main className="min-h-screen bg-forest-50 px-4 py-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-forest-100 bg-white p-6 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest-100 text-forest-700">
            {isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <MessageCircle className="h-7 w-7" />}
          </div>
          <h1 className="mt-4 text-2xl font-black text-forest-900">LINE 會員辨識中</h1>
          <p className="mt-3 font-bold leading-7 text-zinc-500">
            {message || "請稍候，正在載入您的會員資料。"}
          </p>
          <Link
            href="/line-bind"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-forest-600 px-4 font-black text-white"
          >
            查看 LINE 綁定說明
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-black text-forest-600">
              返回首頁
            </Link>
            <p className="mt-4 text-sm font-black uppercase tracking-wide text-forest-600">
              LINE Member Center
            </p>
            <h1 className="text-3xl font-black text-forest-900">我的會員中心</h1>
            <p className="mt-2 font-bold leading-7 text-zinc-500">
              已透過 LINE 自動辨識，只顯示您的餘額、訂單與交易紀錄。
            </p>
          </div>
          <Link
            href="/topup"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-forest-600 px-4 text-sm font-black text-white"
          >
            我要儲值
          </Link>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                    <WalletCards className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-zinc-500">目前餘額</p>
                    <p className="text-3xl font-black text-forest-900">
                      {formatCurrency(result.member.balance)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <Info label="會員姓名" value={result.member.name} />
                  <Info label="LINE 名稱" value={result.member.lineName ?? "-"} />
                  <Info label="棟別樓號" value={result.member.building ?? "-"} />
                  <Info label="LINE 狀態" value={result.member.lineBindStatus ?? "已綁定"} />
                  <Info
                    label="綁定時間"
                    value={result.member.lineBoundAt ? formatDateTime(result.member.lineBoundAt) : "-"}
                  />
                  <Info label="累積儲值" value={formatCurrency(result.member.totalDeposit)} />
                  <Info label="累積消費" value={formatCurrency(result.member.totalSpent)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="text-2xl font-black text-forest-900">儲值申請狀態</h2>
                <div className="mt-4 space-y-3">
                  {result.topups.map((topup) => (
                    <div key={topup.id} className="rounded-3xl border border-forest-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-forest-900">{formatCurrency(topup.amount)}</p>
                          <p className="mt-1 text-sm font-bold text-zinc-500">
                            末五碼 {topup.bankLast5 ?? "-"} ・ {formatDateTime(topup.createdAt)}
                          </p>
                        </div>
                        <TopupStatusPill status={topup.status} />
                      </div>
                    </div>
                  ))}
                  {result.topups.length === 0 && result.topupRequests.length === 0 && (
                    <Empty label="尚無儲值申請" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            {unpickedOrders.length > 0 && (
              <div className="rounded-3xl bg-blue-50 p-5 font-black text-blue-700">
                您有 {unpickedOrders.length} 筆商品已到貨，請至管理室領取。
              </div>
            )}

            <Card>
              <CardContent>
                <h2 className="text-2xl font-black text-forest-900">領貨狀態</h2>
                <div className="mt-4 space-y-3">
                  {result.orders.slice(0, 10).map((order) => (
                    <div key={order.id} className="rounded-3xl border border-forest-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-forest-900">{order.orderNo}</p>
                        <div className="flex gap-2">
                          <StatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-bold text-zinc-500">
                        領貨碼 {order.pickupCode ?? "-"} ・ 預估到貨 {formatDate(order.estimatedArrivalDate)}
                      </p>
                      <div className="mt-3 space-y-2">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between rounded-2xl bg-forest-50 px-3 py-2 text-sm font-bold">
                            <span>{item.productName}</span>
                            <span>x {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {result.orders.length === 0 && <Empty label="尚無訂單" />}
                </div>
              </CardContent>
            </Card>

            <RecordSection title="儲值紀錄" logs={topupLogs} />
            <RecordSection title="消費紀錄" logs={purchaseLogs} />
            <RecordSection title="退款紀錄" logs={refundLogs} />
          </div>
        </div>
      </section>
    </main>
  );
}

function RecordSection({ title, logs }: { title: string; logs: AccountLookupResult["transactions"] }) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-2xl font-black text-forest-900">{title}</h2>
        <div className="mt-4 space-y-3">
          {logs.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-3xl border border-forest-100 p-4">
              <div>
                <p className="font-black text-forest-900">{getTransactionLabel(tx.type)}</p>
                <p className="mt-1 text-sm font-bold text-zinc-500">
                  {tx.note ?? "-"} ・ {formatDateTime(tx.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-black ${tx.amount >= 0 ? "text-forest-700" : "text-rose-600"}`}>
                  {formatSignedCurrency(tx.amount)}
                </p>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  餘額 {formatCurrency(tx.balanceAfter)}
                </p>
              </div>
            </div>
          ))}
          {logs.length === 0 && <Empty label={`尚無${title}`} />}
        </div>
      </CardContent>
    </Card>
  );
}

function TopupStatusPill({ status }: { status: string }) {
  const label = status === "approved" ? "已通過" : status === "rejected" ? "已拒絕" : "待審核";
  const tone =
    status === "approved"
      ? "bg-forest-50 text-forest-700"
      : status === "rejected"
        ? "bg-rose-50 text-rose-600"
        : "bg-honey-50 text-honey-700";
  return <span className={`rounded-full px-3 py-1 text-sm font-black ${tone}`}>{label}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-forest-50 px-4 py-3">
      <span className="font-bold text-zinc-500">{label}</span>
      <span className="text-right font-black text-forest-900">{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-forest-100 p-8 text-center font-black text-zinc-500">
      {label}
    </div>
  );
}
