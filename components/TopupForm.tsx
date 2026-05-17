"use client";

import Link from "next/link";
import { ChangeEvent, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ImagePlus, Loader2, Send, WalletCards, X } from "lucide-react";
import { createTopupAction, uploadTopupProofAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { topupSchema, type TopupValues } from "@/lib/schemas";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function TopupForm() {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<TopupValues>({
    resolver: zodResolver(topupSchema),
    defaultValues: {
      phone: "",
      lineName: "",
      amount: 1000,
      bankLast5: "",
      proofImageUrl: "",
      note: ""
    },
    mode: "onBlur"
  });

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setSuccess(false);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage("截圖只支援 jpg、png、webp。");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setMessage("截圖不可超過 5MB。");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadTopupProofAction(formData);
    setIsUploading(false);

    if (!result.ok || !result.data) {
      setMessage(result.message ?? "截圖上傳失敗。");
      form.setValue("proofImageUrl", "", { shouldValidate: true });
      return;
    }

    form.setValue("proofImageUrl", result.data.publicUrl, { shouldValidate: true });
  }

  function removeImage() {
    setPreviewUrl("");
    form.setValue("proofImageUrl", "", { shouldValidate: true });
  }

  function onSubmit(values: TopupValues) {
    setMessage("");
    setSuccess(false);
    startTransition(async () => {
      const result = await createTopupAction(values);
      if (!result.ok) {
        setMessage(result.message ?? "儲值申請送出失敗。");
        return;
      }

      setSuccess(true);
      setMessage("儲值申請已送出，目前狀態為待審核。管理員確認入帳後會更新會員餘額。");
      setPreviewUrl("");
      form.reset({ phone: "", lineName: "", amount: 1000, bankLast5: "", proofImageUrl: "", note: "" });
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
              最低建議儲值 $1000。每筆入帳、消費與退款都會留下流水帳，會員可自行查詢。
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <FormField label="手機號碼" error={form.formState.errors.phone?.message}>
                <Input inputMode="tel" placeholder="0912-345-678" {...form.register("phone")} />
              </FormField>
              <FormField label="LINE 名稱" error={form.formState.errors.lineName?.message}>
                <Input placeholder="例如：A棟小林" {...form.register("lineName")} />
              </FormField>
              <FormField label="儲值金額" error={form.formState.errors.amount?.message}>
                <Input type="number" min="1" inputMode="numeric" {...form.register("amount", { valueAsNumber: true })} />
              </FormField>
              <FormField label="轉帳帳號後五碼" error={form.formState.errors.bankLast5?.message}>
                <Input inputMode="numeric" maxLength={5} placeholder="例如：12345" {...form.register("bankLast5")} />
              </FormField>

              <div>
                <span className="text-sm font-black text-zinc-600">轉帳截圖</span>
                <label className="mt-2 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-forest-200 bg-white p-4 text-center transition hover:bg-forest-50">
                  {previewUrl ? (
                    <div className="relative w-full">
                      <img src={previewUrl} alt="轉帳截圖預覽" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          removeImage();
                        }}
                        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-rose-600 shadow-soft"
                        aria-label="移除截圖"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ImagePlus className="h-8 w-8 text-forest-700" />
                      <p className="mt-3 font-black text-forest-900">點擊上傳轉帳截圖</p>
                      <p className="mt-1 text-sm font-bold text-zinc-500">支援 jpg / png / webp，最大 5MB</p>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadImage} />
                </label>
                {isUploading && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-black text-forest-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    截圖上傳中
                  </p>
                )}
                {form.formState.errors.proofImageUrl?.message && (
                  <p className="mt-1 text-sm font-black text-rose-600">
                    {form.formState.errors.proofImageUrl.message}
                  </p>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-black text-zinc-600">備註</span>
                <textarea
                  placeholder="可留空，例如：已轉帳玉山銀行"
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

              <Button type="submit" size="lg" className="w-full text-lg" disabled={isPending || isUploading}>
                {isPending || isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                送出儲值申請
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
