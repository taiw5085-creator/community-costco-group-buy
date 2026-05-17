import { NextResponse } from "next/server";

export async function POST() {
  // Reserved for LINE Bot webhook:
  // - 查餘額
  // - 查訂單
  // - 到貨通知
  // - AI 客服
  return NextResponse.json({ ok: true });
}
