import { NextRequest } from "next/server";
import { normalizeBuilding, normalizePhone } from "@/lib/calculations";
import { replyLineMessage, verifyLineSignature } from "@/lib/line";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function parseBindMessage(text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== "綁定" || parts.length < 3) return null;

  return {
    phone: normalizePhone(parts[1]),
    building: normalizeBuilding(parts.slice(2).join(" "))
  };
}

function bindHelpText() {
  return [
    "找不到會員資料，請確認手機號碼與棟別樓號。",
    "範例：",
    "綁定 0912345678 416 14F2"
  ].join("\n");
}

async function reply(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  const result = await replyLineMessage(replyToken, text);
  if (!result.ok) console.error("[LINE reply failed]", result.message);
}

export async function POST(request: NextRequest) {
  try {
    return await handleLineWebhook(request);
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: String(error)
      },
      { status: 500 }
    );
  }
}

async function handleLineWebhook(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelSecret) {
    return jsonResponse(
      { success: false, message: "尚未設定 LINE_CHANNEL_SECRET，無法驗證 LINE Webhook。" },
      500
    );
  }

  if (!verifyLineSignature(body, signature, channelSecret)) {
    return jsonResponse({ success: false, message: "LINE signature 驗證失敗。" }, 401);
  }

  let payload: LineWebhookBody;
  try {
    payload = JSON.parse(body) as LineWebhookBody;
  } catch {
    return jsonResponse({ success: false, message: "Webhook body JSON 格式錯誤。" }, 400);
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return jsonResponse({ success: false, message: "尚未設定 Supabase service role。" }, 500);
  }

  for (const event of payload.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const text = event.message.text ?? "";
    const userId = event.source?.userId;
    const bindData = parseBindMessage(text);

    if (!bindData || !userId) {
      await reply(event.replyToken, bindHelpText());
      continue;
    }

    const { data: members, error } = await supabase
      .from("members")
      .select("id,name,phone,building")
      .limit(500);

    if (error) {
      await reply(event.replyToken, `綁定失敗：${error.message}`);
      continue;
    }

    const member = members?.find(
      (row) =>
        normalizePhone(row.phone) === bindData.phone &&
        normalizeBuilding(row.building) === bindData.building
    );

    if (!member) {
      await reply(event.replyToken, bindHelpText());
      continue;
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({
        line_user_id: userId,
        line_bound_at: new Date().toISOString(),
        line_bind_status: "已綁定"
      })
      .eq("id", member.id);

    if (updateError) {
      await reply(event.replyToken, `綁定失敗：${updateError.message}`);
      continue;
    }

    await reply(
      event.replyToken,
      [`綁定成功 ✅`, `您好，${member.name}`, "之後商品到貨會透過 LINE 通知您。"].join("\n")
    );
  }

  return jsonResponse({ success: true });
}
