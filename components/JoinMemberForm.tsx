"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send, UserPlus } from "lucide-react";
import { joinMemberAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinMemberSchema, type JoinMemberValues } from "@/lib/schemas";

export function JoinMemberForm() {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<JoinMemberValues>({
    resolver: zodResolver(joinMemberSchema),
    defaultValues: {
      name: "",
      phone: "",
      lineName: "",
      building: "",
      note: ""
    },
    mode: "onBlur"
  });

  function onSubmit(values: JoinMemberValues) {
    setMessage("");
    setSuccess(false);
    startTransition(async () => {
      const result = await joinMemberAction(values);
      if (!result.ok) {
        setMessage(result.message ?? "會員資料送出失敗，請稍後再試。");
        return;
      }

      setSuccess(true);
      setMessage("會員建立成功，請到 LINE 官方帳號輸入「綁定 手機號碼 棟別樓號」完成通知綁定。");
      form.reset();
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
                <UserPlus className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-black text-forest-600">社區會員</p>
                <h1 className="text-3xl font-black text-forest-900">加入會員</h1>
              </div>
            </div>
            <p className="mt-4 font-bold leading-7 text-zinc-500">
              請填寫基本資料，完成後即可使用社區代購服務。下單、儲值與餘額查詢會以手機號碼與棟別樓號做識別。
            </p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <FormField label="姓名" error={form.formState.errors.name?.message}>
                <Input placeholder="例如：林小姐" {...form.register("name")} />
              </FormField>
              <FormField label="手機號碼" error={form.formState.errors.phone?.message}>
                <Input inputMode="tel" placeholder="0912-345-678" {...form.register("phone")} />
              </FormField>
              <FormField label="LINE 名稱" error={form.formState.errors.lineName?.message}>
                <Input placeholder="例如：A棟小林" {...form.register("lineName")} />
              </FormField>
              <FormField label="棟別樓號" error={form.formState.errors.building?.message}>
                <Input placeholder="例如：416 14F2" {...form.register("building")} />
              </FormField>
              <label className="block">
                <span className="text-sm font-black text-zinc-600">備註</span>
                <textarea
                  placeholder="可留空，例如：晚間較方便領貨"
                  {...form.register("note")}
                  className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-forest-100 bg-white px-4 py-3 text-base font-bold outline-none transition placeholder:text-zinc-400 focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
                />
              </label>

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
                送出會員資料
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function FormField({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-zinc-600">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-sm font-black text-rose-600">{error}</p>}
    </label>
  );
}
