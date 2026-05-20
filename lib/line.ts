import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

type LineApiResult = {
  ok: boolean;
  message?: string;
  status?: number;
};

function getLineAccessToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export function verifyLineSignature(body: string, signature: string | null, channelSecret?: string) {
  if (!channelSecret) return false;
  if (!signature) return false;

  const expected = createHmac("sha256", channelSecret).update(body, "utf8").digest("base64");
  const encoder = new TextEncoder();
  const expectedBuffer = encoder.encode(expected);
  const signatureBuffer = encoder.encode(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function callLineApi(endpoint: string, body: unknown): Promise<LineApiResult> {
  const token = getLineAccessToken();
  if (!token) {
    return {
      ok: false,
      message: "尚未設定 LINE_CHANNEL_ACCESS_TOKEN，無法發送 LINE 訊息。"
    };
  }

  const response = await fetch(`https://api.line.me/v2/bot/message/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      message: `LINE API 錯誤 ${response.status}：${text || response.statusText}`
    };
  }

  return { ok: true, status: response.status };
}

export async function replyLineMessage(replyToken: string, text: string) {
  if (!replyToken) return { ok: false, message: "缺少 LINE replyToken。" };
  return callLineApi("reply", {
    replyToken,
    messages: [{ type: "text", text }]
  });
}

export async function pushLineMessage(userId: string, text: string) {
  if (!userId) return { ok: false, message: "會員尚未綁定 LINE userId。" };
  return callLineApi("push", {
    to: userId,
    messages: [{ type: "text", text }]
  });
}

export async function sendLineMessage(userId: string | null | undefined, message: string) {
  if (!userId) return { ok: false, message: "會員尚未綁定 LINE，無法發送通知。" };
  return pushLineMessage(userId, message);
}
