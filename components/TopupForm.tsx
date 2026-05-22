"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Loader2, Send, WalletCards } from "lucide-react";
import { createTopupRequestByPhoneAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function TopupForm() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(1000);
  const [bankLast5, setBankLast5] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    startTransition(async () => {
      const result = await createTopupRequestByPhoneAction({
        phone,
        amount,
        bankLast5
      });

      if (!result.ok) {
        setMessage(result.message ?? "儲值申請送出失敗。");
        return;
      }

      setSuccess(true);
      setMessage("儲值申請已送出，請等待管理員確認。");
      setAmount(1000);
      setBankLast5("");
    });
  }

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-forest-600">
          返回首頁
        </Link>
        <Card className="mt-5">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                <WalletCards className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-black text-forest-600">會員錢包</p>
                <h1 className="text-3xl font-black text-forest-900">會員儲值</h1>
              </div>
            </div>
            <p className="mt-4 font-bold leading-7 text-zinc-500">
              請先完成銀行轉帳，再填寫儲值申請。管理員確認入帳後，系統會更新您的會員餘額。
            </p>

            <div className="mt-5 rounded-3xl bg-forest-50 p-4 font-bold leading-7 text-forest-800">
              <p className="font-black">最低儲值 $1000</p>
              <p className="mt-1 text-sm text-zinc-600">匯款帳號資訊可在這裡設定：銀行 000，帳號 0000-0000-0000。</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <FormField label="手機號碼">
                <Input inputMode="tel" placeholder="0912-345-678" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </FormField>
              <FormField label="儲值金額">
                <Input
                  type="number"
                  min="1000"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </FormField>
              <FormField label="匯款帳號末五碼">
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="例如：12345"
                  value={bankLast5}
                  onChange={(event) => setBankLast5(event.target.value)}
                />
              </FormField>

              {message && (
                <div className={`rounded-3xl p-4 font-black ${success ? "bg-forest-50 text-forest-700" : "bg-rose-50 text-rose-600"}`}>
                  <div className="flex gap-2">
                    {success && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
                    <span>{message}</span>
                  </div>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full text-lg" disabled={isPending}>
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                送出儲值申請
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-zinc-600">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
