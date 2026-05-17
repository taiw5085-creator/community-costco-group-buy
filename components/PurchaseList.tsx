"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminOrder } from "@/lib/types";

export function PurchaseList({ orders }: { orders: AdminOrder[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((order) => order.status === "已付款" || order.status === "採購中")
      .forEach((order) => {
        order.items.forEach((item) => {
          if (!item.productName) return;
          map.set(item.productName, (map.get(item.productName) ?? 0) + item.quantity);
        });
      });

    return Array.from(map.entries()).map(([name, quantity]) => ({ name, quantity }));
  }, [orders]);

  return (
    <main className="min-h-screen bg-forest-50 px-4 py-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-honey-600">採購模式</p>
            <h1 className="text-3xl font-black text-forest-900">好市多現場採買清單</h1>
          </div>
          <Link href="/admin" className="rounded-2xl border border-forest-100 bg-white px-4 py-3 font-black text-forest-700">
            回後台
          </Link>
        </div>

        <section className="mt-5 space-y-3">
          {items.map((item) => (
            <label
              key={item.name}
              className="flex min-h-20 items-center justify-between gap-4 rounded-3xl border border-forest-100 bg-white p-4 shadow-sm"
            >
              <div>
                <h2 className="text-xl font-black text-forest-900">{item.name}</h2>
                <p className="mt-1 font-bold text-zinc-500">總數量 {item.quantity}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(checked[item.name])}
                onChange={() =>
                  setChecked((current) => ({
                    ...current,
                    [item.name]: !current[item.name]
                  }))
                }
                className="h-8 w-8 accent-forest-600"
              />
            </label>
          ))}
          {items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-forest-100 bg-white p-8 text-center font-black text-zinc-500">
              尚無需要採購的商品
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
