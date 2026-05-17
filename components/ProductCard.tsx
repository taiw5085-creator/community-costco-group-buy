"use client";

import { Clipboard, Clock, Minus, Plus, ShoppingBasket, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, formatProductTitle } from "@/lib/calculations";
import type { PublicProduct } from "@/lib/types";
import { useCountdown } from "@/hooks/use-countdown";

export function ProductCard({
  product,
  quantity,
  onQuantityChange,
  onCopyLinePost
}: {
  product: PublicProduct;
  quantity: number;
  onQuantityChange: (delta: number) => void;
  onCopyLinePost: () => void;
}) {
  const countdown = useCountdown(product.deadline ?? "");

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-soft">
      <div className="relative aspect-[4/3] bg-forest-100">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-forest-100 text-forest-700">
            <ShoppingBasket className="h-14 w-14" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="default">{product.category ?? "未分類"}</Badge>
          {product.isHot && <Badge variant="hot">🔥 社區熱賣中</Badge>}
        </div>
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs font-black text-zinc-500">{countdown.closeLabel}</p>
          <p className="text-base font-black text-forest-800">
            {countdown.isClosed ? "已結單" : countdown.countdown}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="deal">本週優惠</Badge>
            {product.isHot && <Badge variant="hot">熱門商品</Badge>}
          </div>
          <h3 className="mt-2 text-xl font-black leading-tight text-forest-900">
            {formatProductTitle(product.name, product.spec)}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-500">
            <Clock className="h-4 w-4" />
            <span>結單 {formatDateTime(product.deadline)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-black text-forest-700">
            <UsersRound className="h-4 w-4" />
            <span>已 {product.orderCount} 人下單</span>
          </div>
          <button
            type="button"
            onClick={onCopyLinePost}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-xs font-black text-forest-700"
          >
            <Clipboard className="h-3.5 w-3.5" />
            複製 LINE 貼文
          </button>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-zinc-500">社區代購價</p>
            <p className="text-3xl font-black text-rose-600">
              {formatCurrency(product.price)}
            </p>
          </div>
          <div className="flex min-h-14 overflow-hidden rounded-2xl border border-forest-100 bg-forest-50">
            <button
              type="button"
              onClick={() => onQuantityChange(-1)}
              disabled={quantity === 0 || countdown.isClosed}
              className="grid w-14 place-items-center disabled:opacity-30"
              aria-label={`減少 ${product.name} 數量`}
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="grid w-14 place-items-center bg-white text-xl font-black">
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => onQuantityChange(1)}
              disabled={countdown.isClosed}
              className="grid w-14 place-items-center disabled:opacity-30"
              aria-label={`增加 ${product.name} 數量`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onQuantityChange(1)}
          disabled={countdown.isClosed}
          size="lg"
          className="w-full text-lg"
        >
          {countdown.isClosed ? "已結單" : "加入購物車"}
        </Button>
      </div>
    </article>
  );
}
