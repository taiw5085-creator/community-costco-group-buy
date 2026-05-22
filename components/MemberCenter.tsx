"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, RefreshCcw, UserRound, WalletCards } from "lucide-react";
import { bindLineMemberAction, lookupMemberByLineUserIdAction } from "@/app/actions";
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
  const [isLoading, setIsLoading] = useState(true);
  const [showBindForm, setShowBindForm] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [bindPhone, setBindPhone] = useState("");
  const [bindBuilding, setBindBuilding] = useState("");
  const [bindMessage, setBindMessage] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [bindSuccess, setBindSuccess] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const hasInitializedRef = useRef(false);
  const hasCalledLoginRef = useRef(false);

  useEffect(() => {
    if (!isLoading) return;

    const timeout = window.setTimeout(() => {
      setHasTimedOut(true);
      setIsLoading(false);
      setMessage("LINE 會員中心載入超過 5 秒，請重新整理再試。");
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    let cancelled = false;

    async function identifyMember() {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
      const isInClient = typeof window !== "undefined";

      console.log("LIFF_ID", liffId);
      console.log("isInClient", isInClient);

      if (!liffId) {
        setIsLoading(false);
        setShowBindForm(false);
        setMessage("尚未設定 LIFF ID");
        return;
      }

      try {
        await loadLiffSdk();
        if (!window.liff) throw new Error("LIFF SDK 尚未就緒。");

        await window.liff.init({ liffId });
        const isLoggedIn = window.liff.isLoggedIn();
        console.log("isLoggedIn", isLoggedIn);

        if (!isLoggedIn) {
          if (!hasCalledLoginRef.current) {
            hasCalledLoginRef.current = true;
            window.liff.login({
              redirectUri: `${window.location.origin}/member-center`
            });
          }
          return;
        }

        const profile = await window.liff.getProfile();
        console.log("profile.userId", profile.userId);
        window.history.replaceState({}, document.title, `${window.location.origin}/member-center`);

        if (!profile.userId) {
          if (!cancelled) {
            setIsLoading(false);
            setShowBindForm(false);
            setMessage("無法取得 LINE 身分，請重新開啟會員中心或確認 LINE 登入狀態。");
          }
          return;
        }

        setLineUserId(profile.userId);
        const response = await lookupMemberByLineUserIdAction(profile.userId);
        if (cancelled) return;
        if (!response.ok || !response.data) {
          setIsLoading(false);
          setShowBindForm(true);
          setMessage("尚未綁定 LINE，請輸入會員資料完成綁定。");
          return;
        }

        setResult(response.data);
        setMessage("");
        setIsLoading(false);
        setShowBindForm(false);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setIsLoading(false);
          setShowBindForm(false);
          setMessage("LINE 會員辨識失敗，請確認 LIFF 設定或稍後再試。");
        }
      }
    }

    void identifyMember();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitBindForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lineUserId) {
      setBindMessage("尚未取得 LINE 身分，請重新整理會員中心。");
      return;
    }

    setIsBinding(true);
    setBindMessage("");
    const response = await bindLineMemberAction({
      lineUserId,
      phone: bindPhone,
      building: bindBuilding
    });
    setIsBinding(false);

    if (!response.ok || !response.data) {
      setBindMessage(response.message ?? "找不到會員資料，請確認手機號碼與棟別樓號，或先加入會員。");
      return;
    }

    setShowBindForm(false);
    setBindSuccess(true);
    setMessage("綁定成功");
    setBindMessage("綁定成功");
    window.setTimeout(() => {
      router.replace("/member-center");
      router.refresh();
    }, 2000);
  }

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
            {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : <MessageCircle className="h-7 w-7" />}
          </div>
          <h1 className="mt-4 text-2xl font-black text-forest-900">
            {isLoading ? "LINE 會員辨識中" : bindSuccess ? "綁定成功" : "會員中心"}
          </h1>
          <p className="mt-3 font-bold leading-7 text-zinc-500">
            {message || "請稍候，正在載入您的會員資料。"}
          </p>
          {hasTimedOut && !showBindForm && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-forest-600 px-4 font-black text-white"
            >
              <RefreshCcw className="h-5 w-5" />
              重新整理
            </button>
          )}
          {showBindForm && (
            <form onSubmit={submitBindForm} className="mt-5 space-y-4 text-left">
              <div className="rounded-2xl bg-forest-50 p-4 font-bold leading-7 text-forest-800">
                <p className="font-black text-forest-900">LINE 綁定表單</p>
                <p className="mt-1 text-sm text-zinc-600">
                  請輸入加入會員時填寫的手機號碼與棟別樓號，系統會把您的 LINE 綁到會員資料。
                </p>
              </div>
              <label className="block">
                <span className="text-sm font-black text-zinc-600">手機號碼</span>
                <input
                  value={bindPhone}
                  onChange={(event) => setBindPhone(event.target.value)}
                  placeholder="例如：0912345678"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-forest-100 bg-white px-4 text-base font-bold outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-zinc-600">棟別樓號</span>
                <input
                  value={bindBuilding}
                  onChange={(event) => setBindBuilding(event.target.value)}
                  placeholder="例如：416 14F2"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-forest-100 bg-white px-4 text-base font-bold outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
                />
              </label>
              {bindMessage && (
                <div
                  className={`rounded-2xl p-4 text-center font-black ${
                    bindMessage === "綁定成功"
                      ? "bg-forest-50 text-forest-700"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {bindMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={isBinding}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-600 px-4 font-black text-white disabled:opacity-60"
              >
                {isBinding ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRound className="h-5 w-5" />}
                {isBinding ? "綁定中" : "確認綁定"}
              </button>
              <Link
                href="/signup"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-forest-100 bg-white px-4 text-center font-black text-forest-700"
              >
                還不是會員？先加入會員
              </Link>
            </form>
          )}
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
