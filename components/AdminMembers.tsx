"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Search, WalletCards, XCircle } from "lucide-react";
import {
  cancelTopupRequestAction,
  confirmTopupRequestAction,
  walletAdjustmentAction
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatCurrency,
  formatDateTime,
  formatSignedCurrency,
  getTransactionLabel
} from "@/lib/calculations";
import type { DashboardData, Member, WalletTransactionType } from "@/lib/types";

const walletOptions: Array<{
  type: WalletTransactionType;
  label: string;
  hint: string;
}> = [
  { type: "deposit", label: "儲值入帳", hint: "會增加餘額，並增加累積儲值" },
  { type: "refund", label: "退款入帳", hint: "會增加餘額，不增加累積儲值" },
  { type: "adjustment", label: "手動調整", hint: "可增加或減少餘額，不計入統計" },
  { type: "purchase", label: "扣款", hint: "會減少餘額，並增加累積消費" }
];

export function AdminMembers({ initialData }: { initialData: DashboardData }) {
  const [searchText, setSearchText] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(
    initialData.members[0] ?? null
  );
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<WalletTransactionType>("deposit");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedOption = walletOptions.find((option) => option.type === type) ?? walletOptions[0];

  const filteredMembers = useMemo(() => {
    return initialData.members.filter((member) => {
      const text = `${member.name} ${member.phone} ${member.lineName ?? ""} ${member.building ?? ""} ${
        member.lineBindStatus ?? ""
      }`.toLowerCase();
      return text.includes(searchText.toLowerCase());
    });
  }, [initialData.members, searchText]);

  const transactions = useMemo(() => {
    if (!selectedMember) return [];
    return initialData.transactions.filter((tx) => tx.memberId === selectedMember.id);
  }, [initialData.transactions, selectedMember]);

  function submitAdjustment() {
    if (!selectedMember) return;
    setMessage("");
    startTransition(async () => {
      const result = await walletAdjustmentAction({
        memberId: selectedMember.id,
        type,
        amount: Number(amount),
        note
      });

      if (!result.ok) {
        setMessage(result.message ?? "操作失敗");
        return;
      }

      window.location.reload();
    });
  }

  function confirmRequest(requestId: string) {
    if (!window.confirm("確定將此儲值申請入帳？")) return;
    startTransition(async () => {
      const result = await confirmTopupRequestAction({ requestId });
      if (!result.ok) setMessage(result.message ?? "入帳失敗");
      else window.location.reload();
    });
  }

  function cancelRequest(requestId: string) {
    if (!window.confirm("確定取消此儲值申請？")) return;
    startTransition(async () => {
      const result = await cancelTopupRequestAction({ requestId });
      if (!result.ok) setMessage(result.message ?? "取消失敗");
      else window.location.reload();
    });
  }

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-forest-600">Admin</p>
            <h1 className="text-3xl font-black text-forest-900">會員 / 儲值管理</h1>
          </div>
          <Link href="/admin" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 font-black text-forest-700">
            回後台
          </Link>
        </div>

        {message && (
          <div className="mt-5 rounded-3xl bg-rose-50 p-4 font-black text-rose-600">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardContent>
              <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-forest-100 px-3">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜尋姓名、電話、LINE、棟別"
                  className="w-full bg-transparent text-sm font-bold outline-none"
                />
              </label>
              <div className="mt-4 space-y-3">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className={`w-full rounded-3xl border p-4 text-left ${
                      selectedMember?.id === member.id
                        ? "border-forest-600 bg-forest-50"
                        : "border-forest-100 bg-white"
                    }`}
                  >
                    <p className="font-black text-forest-900">{member.name}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-500">{member.phone}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-500">{member.building ?? "-"}</p>
                    <p className="mt-2 text-lg font-black text-forest-700">
                      {formatCurrency(member.balance)}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        member.lineUserId
                          ? "bg-forest-100 text-forest-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      LINE {member.lineUserId ? "已綁定" : "未綁定"}
                    </span>
                  </button>
                ))}
                {filteredMembers.length === 0 && <Empty label="尚無會員資料" />}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardContent>
                {selectedMember ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                        <WalletCards className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-zinc-500">目前餘額</p>
                        <p className="text-3xl font-black text-forest-900">
                          {formatCurrency(selectedMember.balance)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Info label="姓名" value={selectedMember.name} />
                      <Info label="棟別" value={selectedMember.building ?? "-"} />
                      <Info label="LINE" value={selectedMember.lineName ?? "-"} />
                      <Info label="LINE 狀態" value={selectedMember.lineUserId ? "已綁定" : "未綁定"} />
                      <Info
                        label="綁定時間"
                        value={selectedMember.lineBoundAt ? formatDateTime(selectedMember.lineBoundAt) : "-"}
                      />
                      <Info label="累積儲值" value={formatCurrency(selectedMember.totalDeposit)} />
                      <Info label="累積消費" value={formatCurrency(selectedMember.totalSpent)} />
                    </div>
                  </>
                ) : (
                  <Empty label="尚無會員資料" />
                )}
              </CardContent>
            </Card>

            {selectedMember && (
              <Card>
                <CardContent>
                  <h2 className="text-2xl font-black text-forest-900">儲值 / 退款 / 調整</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_1fr_auto]">
                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value as WalletTransactionType)}
                      className="min-h-14 rounded-2xl border border-forest-100 bg-white px-4 font-black"
                    >
                      {walletOptions.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input value={amount} type="number" placeholder={type === "adjustment" ? "可輸入 -100" : "金額"} onChange={(event) => setAmount(event.target.value)} />
                    <Input value={note} placeholder="備註" onChange={(event) => setNote(event.target.value)} />
                    <Button type="button" disabled={isPending} onClick={submitAdjustment}>
                      {isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                      送出
                    </Button>
                  </div>
                  <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-black ${type === "purchase" ? "bg-rose-50 text-rose-600" : "bg-forest-50 text-forest-700"}`}>
                    {selectedOption.hint}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <h2 className="text-2xl font-black text-forest-900">客人儲值申請</h2>
                <div className="mt-4 space-y-3">
                  {initialData.topupRequests.map((request) => (
                    <div key={request.id} className="rounded-3xl border border-forest-100 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-black text-forest-900">
                            {request.member?.name ?? "未知會員"} ・ {formatCurrency(request.amount)}
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-500">
                            {request.member?.phone ?? "-"} ・ {request.member?.building ?? "-"} ・ {request.paymentMethod ?? "-"}
                          </p>
                          {request.note && <p className="mt-1 text-sm font-bold text-honey-600">備註：{request.note}</p>}
                          <p className="mt-1 text-xs font-bold text-zinc-400">{formatDateTime(request.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-forest-50 px-3 py-1 text-sm font-black text-forest-700">
                            {request.status}
                          </span>
                          {["待確認", "pending"].includes(request.status) && (
                            <>
                              <Button type="button" disabled={isPending} onClick={() => confirmRequest(request.id)}>
                                <CheckCircle2 className="h-4 w-4" />
                                確認入帳
                              </Button>
                              <Button type="button" variant="outline" disabled={isPending} onClick={() => cancelRequest(request.id)}>
                                <XCircle className="h-4 w-4" />
                                取消
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {initialData.topupRequests.length === 0 && <Empty label="尚無儲值申請" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="text-2xl font-black text-forest-900">交易紀錄</h2>
                <div className="mt-4 space-y-3">
                  {transactions.map((tx) => (
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
                  {transactions.length === 0 && <Empty label="尚無交易紀錄" />}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-forest-50 px-4 py-3">
      <p className="text-xs font-black text-zinc-500">{label}</p>
      <p className="mt-1 font-black text-forest-900">{value}</p>
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
