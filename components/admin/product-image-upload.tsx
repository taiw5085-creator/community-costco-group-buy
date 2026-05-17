"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { uploadProductImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type ProductImageUploadProps = {
  value?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
};

export function ProductImageUpload({
  value,
  disabled,
  onChange,
  onUploadingChange
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const isBusy = disabled || isPending;
  const imageUrl = value ?? "";

  function showError(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 2800);
  }

  function validateFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "圖片格式只支援 jpg、png、webp。";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "圖片不可超過 5MB。";
    }

    return "";
  }

  function uploadFile(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      showError(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    onUploadingChange?.(true);

    startTransition(async () => {
      try {
        const result = await uploadProductImageAction(formData);

        if (!result.ok || !result.data) {
          showError(result.message ?? "圖片上傳失敗。");
          onUploadingChange?.(false);
          return;
        }

        onChange(result.data.publicUrl);
      } catch {
        showError("圖片上傳失敗，請確認 Supabase Storage 設定。");
      } finally {
        onUploadingChange?.(false);
      }
    });
  }

  function removeImage() {
    onChange("");
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) uploadFile(file);
        }}
        className={cn(
          "relative block w-full overflow-hidden rounded-3xl border-2 border-dashed border-forest-100 bg-forest-50 text-left transition",
          "focus:outline-none focus:ring-4 focus:ring-forest-100 disabled:cursor-not-allowed disabled:opacity-60",
          isDragging && "border-forest-500 bg-forest-100"
        )}
      >
        <div className="aspect-[4/3] w-full">
          {imageUrl ? (
            <img src={imageUrl} alt="商品圖片預覽" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center text-forest-700">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                {isPending ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <ImagePlus className="h-7 w-7" />
                )}
              </div>
              <p className="mt-3 text-base font-black">直接上傳商品圖片</p>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                支援 jpg / png / webp，建議使用清晰商品照
              </p>
            </div>
          )}
        </div>
        {isPending && imageUrl && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
            <Loader2 className="h-9 w-9 animate-spin text-forest-700" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) uploadFile(file);
        }}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="h-5 w-5" />
          {imageUrl ? "更換圖片" : "選擇圖片"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy || !imageUrl}
          onClick={removeImage}
          className="text-rose-600"
        >
          <Trash2 className="h-5 w-5" />
          刪除圖片
        </Button>
      </div>

      {message && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600">
          {message}
        </div>
      )}
    </div>
  );
}
