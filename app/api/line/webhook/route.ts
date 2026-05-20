import { NextRequest } from "next/server";
import * as crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LineWebhookPayload = {
  events?: LineWebhookEvent[];
};

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type BindCommand = {
  phone: string;
  building: string;
};

type MemberRow = {
  id: string;
  name: string | null;
  phone: string | null;
  building: string | null;
};

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

function verifyLineSignature(rawBody: string, signature: string, secret: string) {
  const hash = crypto.createHmac("SHA256", secret).update(rawBody).digest("base64");
  return hash === signature;
}

function parseBindCommand(text: string | undefined): BindCommand | null {
  const parts = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3 || parts[0] !== "綁定") return null;

  return {
    phone: parts[1],
    building: parts.slice(2).join(" ")
  };
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeBuilding(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

async function replyLineText(replyToken: string | undefined, text: string, accessToken: string) {
  if (!replyToken) return;

  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("[LINE_REPLY_ERROR]", response.status, await response.text());
  }
}

async function findMember(phone: string, building: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "LINE_ENV_MISSING" as const, member: null };

  const { data, error } = await supabase
    .from("members")
    .select("id,name,phone,building")
    .limit(1000);

  if (error) {
    console.error("[LINE_MEMBER_LOOKUP_ERROR]", error);
    return { error: "INTERNAL_ERROR" as const, member: null };
  }

  const phoneKey = normalizePhone(phone);
  const buildingKey = normalizeBuilding(building);
  const member =
    (data as MemberRow[] | null)?.find(
      (row) =>
        normalizePhone(row.phone) === phoneKey &&
        normalizeBuilding(row.building) === buildingKey
    ) ?? null;

  return { error: null, member };
}

async function bindMember(memberId: string, lineUserId: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return "LINE_ENV_MISSING" as const;

  const { error } = await supabase
    .from("members")
    .update({
      line_user_id: lineUserId,
      line_bind_status: "bound",
      line_bound_at: new Date().toISOString()
    })
    .eq("id", memberId);

  if (error) {
    console.error("[LINE_MEMBER_BIND_ERROR]", error);
    return "INTERNAL_ERROR" as const;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const secret = process.env.LINE_CHANNEL_SECRET;
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!secret || !accessToken) {
      return Response.json({ error: "LINE_ENV_MISSING" }, { status: 500 });
    }

    const signature = req.headers.get("x-line-signature") || "";
    if (!verifyLineSignature(rawBody, signature, secret)) {
      return Response.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
    }

    let payload: LineWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as LineWebhookPayload;
    } catch (error) {
      console.error("[LINE_JSON_ERROR]", error);
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    for (const event of payload.events ?? []) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const lineUserId = event.source?.userId;
      const bindCommand = parseBindCommand(event.message.text);
      if (!lineUserId || !bindCommand) {
        await replyLineText(
          event.replyToken,
          "找不到會員資料，請確認手機號碼與棟別樓號。\n範例：\n綁定 0912345678 416 14F2",
          accessToken
        );
        continue;
      }

      const { error, member } = await findMember(bindCommand.phone, bindCommand.building);
      if (error) {
        return Response.json({ error }, { status: 500 });
      }

      if (!member) {
        await replyLineText(
          event.replyToken,
          "找不到會員資料，請確認手機號碼與棟別樓號。\n範例：\n綁定 0912345678 416 14F2",
          accessToken
        );
        continue;
      }

      const bindError = await bindMember(member.id, lineUserId);
      if (bindError) {
        return Response.json({ error: bindError }, { status: 500 });
      }

      await replyLineText(event.replyToken, "綁定成功", accessToken);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[LINE_WEBHOOK_ERROR]", error);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
