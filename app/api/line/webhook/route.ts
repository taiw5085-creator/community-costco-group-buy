import { NextRequest } from "next/server";
import { normalizeBuilding, normalizePhone } from "@/lib/calculations";
import { replyLineMessage, verifyLineSignature } from "@/lib/line";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LineWebhookEvent = {
  type?: string;
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

type BindMessage = {
  phone: string;
  building: string;
};

function parseBindMessage(text: string): BindMessage | null {
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== "綁定" || parts.length < 3) return null;

  return {
    phone: normalizePhone(parts[1]),
    building: normalizeBuilding(parts.slice(2).join(" "))
  };
}

async function reply(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  const result = await replyLineMessage(replyToken, text);
  if (!result.ok) {
    console.error("[LINE_REPLY_ERROR]", result.message, result.status);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      return Response.json({ error: "LINE_ENV_MISSING" }, { status: 500 });
    }

    const signature = req.headers.get("x-line-signature") || "";
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      return Response.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
    }

    let payload: LineWebhookBody;
    try {
      payload = JSON.parse(rawBody) as LineWebhookBody;
    } catch (error) {
      console.error("[LINE_WEBHOOK_JSON_ERROR]", error);
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    if (!supabase) {
      return Response.json({ error: "SUPABASE_ENV_MISSING" }, { status: 500 });
    }

    for (const event of payload.events ?? []) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userId = event.source?.userId;
      const bindData = parseBindMessage(event.message.text ?? "");
      if (!bindData || !userId) {
        await reply(event.replyToken, "找不到會員資料，請確認手機號碼與棟別樓號。");
        continue;
      }

      const { data: members, error } = await supabase
        .from("members")
        .select("id,name,phone,building")
        .limit(500);

      if (error) {
        console.error("[LINE_MEMBER_LOOKUP_ERROR]", error);
        await reply(event.replyToken, "找不到會員資料，請確認手機號碼與棟別樓號。");
        continue;
      }

      const member = members?.find(
        (row) =>
          normalizePhone(row.phone) === bindData.phone &&
          normalizeBuilding(row.building) === bindData.building
      );

      if (!member) {
        await reply(event.replyToken, "找不到會員資料，請確認手機號碼與棟別樓號。");
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
        console.error("[LINE_MEMBER_BIND_ERROR]", updateError);
        await reply(event.replyToken, "找不到會員資料，請確認手機號碼與棟別樓號。");
        continue;
      }

      await reply(event.replyToken, "綁定成功");
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[LINE_WEBHOOK_ERROR]", error);
    return Response.json({ error: "LINE_WEBHOOK_ERROR" }, { status: 500 });
  }
}
