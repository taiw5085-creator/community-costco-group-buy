"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleDollarSign,
  ClipboardCheck,
  Loader2,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  Send,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  UserRound
} from "lucide-react";
import { createOrderAction } from "@/app/actions";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatCurrency,
  formatDeadline,
  formatProductTitle,
  getCartQuantity,
  getCartSubtotal,
  isClosed
} from "@/lib/calculations";
import { checkoutSchema, type CheckoutFormValues } from "@/lib/schemas";
import type { CartItem, CartLine, ProductCategory, PublicProduct } from "@/lib/types";
import { productCategories } from "@/lib/types";

type LastOrder = {
  orderNo: string;
  paymentStatus: "已扣款" | "待付款";
  balanceAfter: number;
  subtotal: number;
};

const defaultCustomer: CheckoutFormValues = {
  name: "",
  building: "",
  phone: "",
  lineName: "",
  note: ""
};

type StorefrontProps = {
  initialProducts?: PublicProduct[];
  initialLoadError?: string;
};

export default function Storefront({ initialProducts = [], initialLoadError = "" }: StorefrontProps) {
  const [products] = useState<PublicProduct[]>(initialProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<"shop" | "checkout" | "success">("shop");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "全部">("全部");
  const [latestOrder, setLatestOrder] = useState<LastOrder | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading] = useState(false);
  const [loadError] = useState(initialLoadError);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(new Date());

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: defaultCustomer,
    mode: "onBlur"
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("community_cart");
      if (raw) setCart(JSON.parse(raw));
    } catch {
      setCart({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("community_cart", JSON.stringify(cart));
  }, [cart]);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === "全部") return products;
    return products.filter((product) => product.category === categoryFilter);
  }, [categoryFilter, products]);

  const cartLines = useMemo<CartLine[]>(() => {
    return products
      .map((product) => ({
        product,
        quantity: cart[product.id] ?? 0
      }))
      .filter((line) => line.quantity > 0);
  }, [cart, products]);

  const subtotal = useMemo(() => getCartSubtotal(cartLines), [cartLines]);
  const totalQuantity = useMemo(() => getCartQuantity(cartLines), [cartLines]);
  const featuredDeadline = products
    .filter((product) => product.deadline && !isClosed(product.deadline, now))
    .sort(
      (a, b) =>
        new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime()
    )[0];

  function changeQuantity(product: PublicProduct, delta: number) {
    if (isClosed(product.deadline, now)) return;

    setCart((current) => {
      const nextQuantity = Math.max(0, (current[product.id] ?? 0) + delta);
      const next = { ...current };
      if (nextQuantity === 0) delete next[product.id];
      else next[product.id] = nextQuantity;
      return next;
    });
  }

  async function copyLinePost(product: PublicProduct) {
    const url = `${window.location.origin}/product/${product.slug}`;
    const text = `🔥 社區好市多代購

${formatProductTitle(product.name, product.spec)}

社區代購價：${formatCurrency(product.price)}

✅ 社區集中代購
✅ 管理室統一領貨
✅ 結單後統一採購

下單連結：
${url}`;

    await navigator.clipboard.writeText(text);
    setToast("商品貼文已複製，可貼到 LINE 社群");
    window.setTimeout(() => setToast(""), 2500);
  }

  function submitOrder(values: CheckoutFormValues) {
    setMessage("");

    if (cartLines.length === 0) {
      setMessage("購物車目前沒有商品。");
      return;
    }

    const closedLine = cartLines.find((line) => isClosed(line.product.deadline, now));
    if (closedLine) {
      setMessage(`${closedLine.product.name} 已結單，請先從購物車移除。`);
      return;
    }

    const confirmed = window.confirm(
      "確認送出訂單？系統會先檢查會員餘額，餘額足夠才會扣款並成立訂單。"
    );
    if (!confirmed) return;

    const cartItems: CartItem[] = cartLines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity
    }));

    startTransition(async () => {
      const result = await createOrderAction(values, cartItems);

      if (!result.ok || !result.data) {
        setMessage(result.message ?? "訂單送出失敗");
        return;
      }

      setLatestOrder({
        ...result.data,
        subtotal
      });
      setCart({});
      window.localStorage.removeItem("community_cart");
      form.reset(defaultCustomer);
      setScreen("success");
    });
  }

  return (
    <div className="min-h-screen bg-forest-50 pb-28 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-forest-100 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => setScreen("shop")} className="text-left">
            <p className="text-xs font-black uppercase tracking-wide text-forest-600">
              Community Group Buy
            </p>
            <h1 className="text-xl font-black text-forest-900 dark:text-zinc-50">
              社區好市多代購
            </h1>
          </button>

          <div className="flex items-center gap-2">
            <Link
              href="#products"
              className="inline-flex rounded-2xl border border-forest-100 bg-white px-3 py-3 text-xs font-black text-forest-700 shadow-sm sm:px-4 sm:text-sm"
            >
              查看商品
            </Link>
            <Link
              href="/member-center"
              className="inline-flex rounded-2xl border border-forest-100 bg-white px-3 py-3 text-xs font-black text-forest-700 shadow-sm sm:px-4 sm:text-sm"
            >
              會員中心
            </Link>
            <Button type="button" variant="outline" size="lg" onClick={() => setScreen("checkout")}>
              <ShoppingCart className="h-5 w-5" />
              {totalQuantity}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {screen === "shop" && (
          <>
            <section className="rounded-[2rem] bg-forest-900 p-5 text-white shadow-soft sm:p-8">
              <p className="text-sm font-bold text-honey-100">社區集中代購・管理室領貨</p>
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 className="text-3xl font-black sm:text-5xl">每週固定採購，不用自己跑好市多</h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/80">
                    選好商品送出訂單，結單後統一採買；到貨後會通知住戶到管理室領取。
                  </p>
                  <div className="mt-5 grid gap-3 sm:max-w-2xl sm:grid-cols-3">
                    <Link
                      href="/signup"
                      className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-4 py-3 text-base font-black text-forest-900"
                    >
                      加入會員
                    </Link>
                    <a
                      href="#products"
                      className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-honey-300 px-4 py-3 text-base font-black text-forest-950"
                    >
                      查看商品
                    </a>
                    <Link
                      href="/member-center"
                      className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-base font-black text-white"
                    >
                      會員中心查餘額
                    </Link>
                  </div>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-sm font-bold text-white/70">最近結單</p>
                  <p className="mt-1 text-2xl font-black">
                    {featuredDeadline ? formatDeadline(featuredDeadline.deadline, now) : "本週結單時間待公告"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-[1.75rem] border border-forest-100 bg-white p-4 shadow-soft">
              <div className="mb-4">
                <p className="text-sm font-black text-forest-600">代購流程</p>
                <h2 className="text-2xl font-black text-forest-900">從加入會員到管理室領貨</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <ProcessStep icon={<UserRound />} step="1" title="加入會員" />
                <ProcessStep icon={<MessageCircle />} step="2" title="LINE 綁定" />
                <ProcessStep icon={<CircleDollarSign />} step="3" title="儲值" />
                <ProcessStep icon={<ShoppingBasket />} step="4" title="下單" />
                <ProcessStep icon={<Truck />} step="5" title="結單採購" />
                <ProcessStep icon={<ClipboardCheck />} step="6" title="到貨通知" />
                <ProcessStep icon={<PackageCheck />} step="7" title="管理室領貨" />
              </div>
            </section>

            <section className="mt-5 rounded-[1.75rem] border border-forest-200 bg-forest-100/70 p-5">
              <div className="flex gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-forest-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-forest-900">信任保證</h2>
                  <div className="mt-3 grid gap-2 font-black leading-7 text-forest-800 sm:grid-cols-2">
                    <p>✅ 商品皆為代購服務，非現貨零售</p>
                    <p>✅ 結單後統一採購</p>
                    <p>✅ 未結單前可取消</p>
                    <p>✅ 結單後即進入採購流程，恕無法取消</p>
                    <p>✅ 缺貨退回會員餘額</p>
                    <p>✅ 到貨後 LINE 通知管理室領貨</p>
                    <p>✅ 每筆儲值、扣款、退款皆有紀錄</p>
                  </div>
                </div>
              </div>
            </section>

            <section id="products" className="mt-6 scroll-mt-24">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-forest-600">今日可代購</p>
                  <h2 className="text-2xl font-black text-forest-900">商品列表</h2>
                </div>
                <Link
                  href="/member-center"
                  className="rounded-2xl bg-forest-100 px-4 py-3 text-sm font-black text-forest-700 sm:hidden"
                >
                  會員中心
                </Link>
              </div>

              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
                {(["全部", ...productCategories] as Array<ProductCategory | "全部">).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`min-h-12 shrink-0 rounded-2xl px-4 text-sm font-black ${
                      categoryFilter === category
                        ? "bg-forest-900 text-white"
                        : "border border-forest-100 bg-white text-forest-700"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {isLoading && <LoadingState label="商品載入中" />}
              {!isLoading && loadError && <ErrorState label="商品暫時無法載入，請稍後再試" />}
              {!isLoading && !loadError && filteredProducts.length === 0 && (
                <EmptyState
                  label={
                    products.length === 0
                      ? "目前尚無可代購商品，請稍後查看"
                      : "此分類目前沒有可代購商品"
                  }
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] ?? 0}
                    onQuantityChange={(delta) => changeQuantity(product, delta)}
                    onCopyLinePost={() => copyLinePost(product)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {screen === "checkout" && (
          <section className="rounded-[2rem] bg-white p-4 shadow-soft sm:p-8">
            <Button type="button" variant="secondary" onClick={() => setScreen("shop")}>
              返回商品列表
            </Button>

            <div className="mt-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black text-forest-600">下單頁</p>
                <h2 className="text-2xl font-black text-forest-900">確認代購內容</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {cartLines.length === 0 ? (
                <EmptyState label="購物車是空的，先回商品列表選商品。" />
              ) : (
                cartLines.map((line) => (
                  <div
                    key={line.product.id}
                    className="grid grid-cols-[72px_1fr] gap-3 rounded-3xl border border-forest-100 p-3"
                  >
                    <ProductImage src={line.product.imageUrl} alt={line.product.name} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-forest-900">
                          {formatProductTitle(line.product.name, line.product.spec)}
                        </h3>
                        <Badge>{line.product.category ?? "未分類"}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-bold text-zinc-500">
                        {formatCurrency(line.product.price)} x {line.quantity}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex overflow-hidden rounded-2xl border border-forest-100 bg-forest-50">
                          <button
                            type="button"
                            onClick={() => changeQuantity(line.product, -1)}
                            className="grid h-11 w-11 place-items-center"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="grid h-11 w-11 place-items-center bg-white font-black">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(line.product, 1)}
                            className="grid h-11 w-11 place-items-center"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-lg font-black text-forest-900">
                          {formatCurrency(line.product.price * line.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 rounded-3xl bg-forest-50 p-4">
              <SummaryRow label="商品件數" value={`${totalQuantity} 件`} />
              <SummaryRow label="商品總額" value={formatCurrency(subtotal)} />
              <SummaryRow label="送出後狀態" value="餘額足夠才會扣款並成立訂單" />
            </div>

            <form onSubmit={form.handleSubmit(submitOrder)} className="mt-6">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-honey-50 text-honey-600">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-honey-600">會員資訊</p>
                  <h2 className="text-2xl font-black text-forest-900">取貨與查詢資料</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <CheckoutField label="姓名" error={form.formState.errors.name?.message}>
                  <Input placeholder="例如：林小姐" {...form.register("name")} />
                </CheckoutField>
                <CheckoutField label="棟別 / 戶號" error={form.formState.errors.building?.message}>
                  <Input placeholder="例如：A棟 8樓 801" {...form.register("building")} />
                </CheckoutField>
                <CheckoutField label="電話" error={form.formState.errors.phone?.message}>
                  <Input placeholder="例如：0912-345-678" {...form.register("phone")} />
                </CheckoutField>
                <CheckoutField label="LINE 名稱" error={form.formState.errors.lineName?.message}>
                  <Input placeholder="例如：A棟小林" {...form.register("lineName")} />
                </CheckoutField>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-black text-zinc-600">備註</span>
                <textarea
                  placeholder="例如：放管理室即可、晚上領貨"
                  {...form.register("note")}
                  className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-forest-100 bg-white px-4 py-3 text-base font-bold outline-none transition placeholder:text-zinc-400 focus:border-forest-500 focus:ring-4 focus:ring-forest-100"
                />
              </label>

              {message && (
                <div className="mt-5 rounded-3xl bg-rose-50 p-4 text-sm font-black text-rose-600">
                  <p>{message}</p>
                  {message.includes("餘額不足") && (
                    <Link
                      href="/topup"
                      className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-forest-600 px-4 text-white"
                    >
                      我要儲值
                    </Link>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending || cartLines.length === 0}
                size="lg"
                className="mt-6 w-full text-xl"
              >
                <Send className="h-5 w-5" />
                {isPending ? "送出中" : "送出訂單"}
              </Button>
            </form>
          </section>
        )}

        {screen === "success" && latestOrder && (
          <section className="rounded-[2rem] bg-white p-6 text-center shadow-soft sm:p-8">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-forest-100 text-forest-700">
              <PackageCheck className="h-10 w-10" />
            </div>
            <h2 className="mt-5 text-3xl font-black text-forest-900">訂單已送出</h2>
            <p className="mt-3 text-lg font-bold text-zinc-600">訂單編號：{latestOrder.orderNo}</p>
            <div className="mx-auto mt-5 max-w-xl rounded-3xl bg-forest-50 p-4 text-left">
              <SummaryRow label="付款狀態" value={latestOrder.paymentStatus} />
              <SummaryRow label="本次金額" value={formatCurrency(latestOrder.subtotal)} />
              <SummaryRow label="扣款後餘額" value={formatCurrency(latestOrder.balanceAfter)} />
              <SummaryRow label="會員查詢" value="手機號碼" />
              <SummaryRow label="LINE 通知" value="到貨通知功能已預留" />
            </div>
            {latestOrder.paymentStatus === "待付款" && (
              <div className="mx-auto mt-4 max-w-xl rounded-3xl bg-honey-50 p-4 text-left font-black text-honey-600">
                餘額不足，訂單已建立但尚未扣款，請聯繫管理員儲值。
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setScreen("shop")}>
                返回首頁
              </Button>
              <Link
                href="/member-center"
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-forest-600 px-4 py-3 text-base font-black text-white"
              >
                會員中心
              </Link>
            </div>
          </section>
        )}
      </main>

      {cartLines.length > 0 && screen === "shop" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-forest-100 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-3xl bg-forest-900 p-3 text-white shadow-soft">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white/70">已選 {totalQuantity} 件</p>
              <p className="text-xl font-black">{formatCurrency(subtotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => setScreen("checkout")}
              className="min-h-12 rounded-2xl bg-white px-5 py-3 text-base font-black text-forest-900 shadow-sm"
            >
              確認下單
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-forest-900 px-5 py-4 text-center font-black text-white shadow-soft">
          {toast}
        </div>
      )}
    </div>
  );
}

export function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-forest-100 text-forest-700">
        <ShoppingBasket className="h-7 w-7" />
      </div>
    );
  }

  return <img src={src} alt={alt} className="h-20 w-20 rounded-2xl object-cover" />;
}

function ProcessStep({ icon, step, title }: { icon: React.ReactNode; step: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-forest-50 p-3 sm:block sm:text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-forest-700 shadow-sm [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
      <div className="sm:mt-2">
        <p className="text-xs font-black text-forest-500">STEP {step}</p>
        <p className="font-black text-forest-900">{title}</p>
      </div>
    </div>
  );
}

function CheckoutField({
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

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-forest-100 py-3 last:border-0">
      <span className="font-bold text-zinc-500">{label}</span>
      <span className="text-right font-black text-forest-900">{value}</span>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2 rounded-3xl bg-white p-8 font-black text-forest-700 shadow-soft">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function ErrorState({ label }: { label: string }) {
  return <div className="mb-4 rounded-3xl bg-rose-50 p-6 font-black text-rose-600">{label}</div>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-3xl border border-dashed border-forest-100 bg-white p-8 text-center font-black text-zinc-500">
      {label}
    </div>
  );
}
