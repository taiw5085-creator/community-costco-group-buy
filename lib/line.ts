import "server-only";
import { createHmac } from "crypto";

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

  const hash = createHmac("SHA256", channelSecret).update(body).digest("base64");
  return hash === signature;
}

async function callLineApi(endpoint: string, body: unknown): Promise<LineApiResult> {
  const token = getLineAccessToken();
  if (!token) {
    return {
      ok: false,
      message: "LINE_ENV_MISSING"
    };
  }

  const response = await fetch(`https://api.line.me/v2/bot/message/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      message: response.status === 401 ? "LINE_TOKEN_INVALID" : `LINE_API_ERROR_${response.status}:${text}`
    };
  }

  return { ok: true, status: response.status };
}

export async function replyLineMessage(replyToken: string, text: string) {
  if (!replyToken) return { ok: false, message: "LINE_REPLY_TOKEN_MISSING" };
  return callLineApi("reply", {
    replyToken,
    messages: [{ type: "text", text }]
  });
}

export async function pushLineMessage(userId: string, text: string) {
  if (!userId) return { ok: false, message: "LINE_USER_ID_MISSING" };
  return callLineApi("push", {
    to: userId,
    messages: [{ type: "text", text }]
  });
}

export async function sendLineMessage(userId: string | null | undefined, message: string) {
  if (!userId) return { ok: false, message: "LINE_USER_ID_MISSING" };
  return pushLineMessage(userId, message);
}
