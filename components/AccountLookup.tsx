"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, WalletCards } from "lucide-react";
import { lookupAccountAction } from "@/app/actions";
import { PaymentStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { accountLookupSchema, type AccountLookupValues } from "@/lib/schemas";
import type { AccountLookupResult } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatSignedCurrency,
  getTransactionLabel
} from "@/lib/calculations";

export function AccountLookup() {
  const [result, setResult] = useState<AccountLookupResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<AccountLookupValues>({
    resolver: zodResolver(accountLookupSchema),
    defaultValues: {
      phone: ""
    }
  });

  const unpickedOrders = useMemo(
    () => result?.orders.filter((order) => order.status === "arrived" || order.status === "已到貨") ?? [],
    [result]
  );

  const topupLogs = result?.transactions.filter((tx) => tx.type === "topup") ?? [];
  const purchaseLogs = result?.transactions.filter((tx) => tx.type === "purchase") ?? [];
  const refundLogs = result?.transactions.filter((tx) => tx.type === "refund") ?? [];

  function onSubmit(values: AccountLookupValues) {
    setMessage("");
    startTransition(async () => {
      const response = await lookupAccountAction(values);
      if (!response.ok || !response.data) {
        setResult(null);
        setMessage(response.message ?? "查詢失敗，請稍後再試。");
        return;
      }
      setResult(response.data);
    });
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
              Member Center
            </p>
            <h1 className="text-3xl font-black text-forest-900">會員餘額與明細查詢</h1>
            <p className="mt-2 font-bold leading-7 text-zinc-500">
              輸入手機號碼即可查看自己的餘額、儲值紀錄、消費紀錄與退款紀錄。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-forest-100 bg-white px-4 text-sm font-black text-forest-700"
            >
              加入會員
            </Link>
            <Link
              href="/topup"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-forest-600 px-4 text-sm font-black text-white"
            >
              我要儲值
            </Link>
          </div>
        </div>

        <Card className="mt-5">
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label>
                <span className="text-sm font-black text-zinc-600">手機號碼</span>
                <Input className="mt-2" placeholder="0912-345-678 或 0912345678" inputMode="tel" {...form.register("phone")} />
                {form.formState.errors.phone?.message && (
                  <p className="mt-1 text-sm font-black text-rose-600">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </label>
              <Button type="submit" size="lg" className="self-end" disabled={isPending}>
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                查詢
              </Button>
            </form>

            {message && (
              <div className="mt-4 rounded-3xl bg-honey-50 p-4 font-black leading-7 text-honey-700">
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
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
                    <Info label="社區 / 棟別 / 樓層" value={result.member.addressNote ?? result.member.building ?? "-"} />
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
                    {result.topupRequests.map((request) => (
                      <div key={request.id} className="rounded-3xl border border-forest-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-black text-forest-900">{formatCurrency(request.amount)}</p>
                            <p className="mt-1 text-sm font-bold text-zinc-500">
                              {request.note ?? "儲值申請"} ・ {formatDateTime(request.createdAt)}
                            </p>
                          </div>
                          <TopupStatusPill status={request.status} />
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
                  <h2 className="text-2xl font-black text-forest-900">未領商品</h2>
                  <div className="mt-4 space-y-3">
                    {unpickedOrders.flatMap((order) =>
                      order.items.map((item, index) => (
                        <div key={`${order.id}-${index}`} className="rounded-3xl border border-forest-100 p-4">
                          <p className="font-black text-forest-900">{item.productName}</p>
                          <p className="mt-1 text-sm font-bold text-zinc-500">
                            領貨碼 {order.pickupCode ?? "-"} ・ 預估到貨 {formatDate(order.estimatedArrivalDate)}
                          </p>
                        </div>
                      ))
                    )}
                    {unpickedOrders.length === 0 && <Empty label="目前沒有未領商品" />}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="text-2xl font-black text-forest-900">最近訂單</h2>
                  <div className="mt-4 space-y-3">
                    {result.orders.slice(0, 8).map((order) => (
                      <div key={order.id} className="rounded-3xl border border-forest-100 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-forest-900">{order.orderNo}</p>
                          <div className="flex gap-2">
                            <StatusBadge status={order.status} />
                            <PaymentStatusBadge status={order.paymentStatus} />
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-bold text-zinc-500">
                          {formatDateTime(order.createdAt)} ・ {formatCurrency(order.totalAmount)}
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
        )}
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
  const label =
    status === "approved" || status === "confirmed" || status === "已入帳"
      ? "已入帳"
      : status === "rejected" || status === "cancelled" || status === "已取消"
        ? "已取消"
        : "待審核";
  const tone =
    status === "approved" || status === "confirmed" || status === "已入帳"
      ? "bg-forest-50 text-forest-700"
      : status === "rejected" || status === "cancelled" || status === "已取消"
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
