"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBasket, ShoppingCart, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDeadline, formatProductTitle, isClosed } from "@/lib/calculations";
import type { PublicProduct } from "@/lib/types";

export function ProductDetail({ product }: { product: PublicProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [now, setNow] = useState(new Date());
  const [message, setMessage] = useState("");
  const closed = isClosed(product.deadline, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function addToCart() {
    if (closed) return;

    const raw = window.localStorage.getItem("community_cart");
    const cart = raw ? JSON.parse(raw) : {};
    cart[product.id] = Math.max(0, Number(cart[product.id] ?? 0)) + quantity;
    window.localStorage.setItem("community_cart", JSON.stringify(cart));
    setMessage("已加入購物車，返回商品列表即可結帳。");
  }

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-black text-forest-700">
          返回商品列表
        </Link>

        <section className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] bg-forest-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-forest-700">
                  <ShoppingBasket className="h-20 w-20" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{product.category ?? "未分類"}</Badge>
                {product.isHot && <Badge variant="hot">🔥 社區熱賣中</Badge>}
              </div>
              <h1 className="mt-4 text-3xl font-black text-forest-900">
                {formatProductTitle(product.name, product.spec)}
              </h1>
              <div className="mt-4 rounded-3xl bg-forest-50 p-4">
                <p className="text-sm font-black text-zinc-500">社區代購價</p>
                <p className="text-4xl font-black text-rose-600">{formatCurrency(product.price)}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="結單時間" value={formatDeadline(product.deadline, now)} />
                <Info label="已下單" value={`${product.orderCount} 人`} icon={<UsersRound className="h-4 w-4" />} />
              </div>

              <div className="mt-5 flex min-h-14 overflow-hidden rounded-2xl border border-forest-100 bg-forest-50">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="grid w-16 place-items-center"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <div className="grid flex-1 place-items-center bg-white text-2xl font-black">
                  {quantity}
                </div>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => current + 1)}
                  className="grid w-16 place-items-center"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={addToCart}
                disabled={closed}
                className="mt-5 w-full text-lg"
              >
                <ShoppingCart className="h-5 w-5" />
                {closed ? "已結單" : "加入購物車"}
              </Button>

              {message && (
                <div className="mt-4 rounded-3xl bg-forest-50 p-4 font-black text-forest-700">
                  {message}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-forest-100 bg-white p-4">
      <p className="text-sm font-black text-zinc-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-black text-forest-900">
        {icon}
        {value}
      </p>
    </div>
  );
}
