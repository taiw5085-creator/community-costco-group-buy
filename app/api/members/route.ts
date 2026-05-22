import { NextRequest } from "next/server";
import { getAdminSupabaseConfigError, getAdminSupabaseRestConfig } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateMemberPayload = {
  name?: string;
  phone?: string;
  line_name?: string;
  lineName?: string;
  building?: string;
  note?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function toErrorDetail(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return cause ? `${error.message}: ${String(cause)}` : error.message;
  }
  return String(error);
}

function isMissingColumn(detail: string, column: string) {
  return detail.toLowerCase().includes(column.toLowerCase()) && detail.toLowerCase().includes("column");
}

function createInternalLookupCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function insertMember(payload: Record<string, unknown>) {
  const config = getAdminSupabaseRestConfig();
  if (!config) {
    return { ok: false, detail: "SUPABASE_CLIENT_UNAVAILABLE" };
  }

  const response = await fetch(`${config.url}/rest/v1/members`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (response.ok) return { ok: true, detail: "" };

  const detail = await response.text();
  return { ok: false, detail: detail || `SUPABASE_HTTP_${response.status}` };
}

export async function POST(req: NextRequest) {
  let payload: CreateMemberPayload;

  try {
    payload = (await req.json()) as CreateMemberPayload;
  } catch (error) {
    console.error("[MEMBER_CREATE_INVALID_JSON]", error);
    return jsonResponse({ success: false, message: "INVALID_MEMBER_PAYLOAD" }, 400);
  }

  const name = String(payload.name ?? "").trim();
  const phone = normalizePhone(payload.phone);
  const lineName = String(payload.line_name ?? payload.lineName ?? "").trim();
  const building = String(payload.building ?? "").trim();
  const note = String(payload.note ?? "").trim();

  if (!name || !phone || !lineName || !building) {
    return jsonResponse({ success: false, message: "INVALID_MEMBER_PAYLOAD" }, 400);
  }

  const configError = getAdminSupabaseConfigError();
  if (configError) {
    console.error("[CREATE_MEMBER_ENV_FAILED]", configError);
    return jsonResponse(
      {
        success: false,
        message: "SUPABASE_ENV_MISSING",
        detail: configError
      },
      500
    );
  }

  let errorMessage = "";

  const memberPayload: Record<string, unknown> = {
    name,
    phone,
    line_name: lineName,
    building,
    lookup_code: createInternalLookupCode(),
    note: note || null,
    balance: 0,
    line_bind_status: "pending",
    created_at: new Date().toISOString()
  };

  try {
    let result = await insertMember(memberPayload);

    if (!result.ok && isMissingColumn(result.detail, "note")) {
      const { note: _unusedNote, ...fallbackPayload } = memberPayload;
      result = await insertMember(fallbackPayload);
    }

    if (!result.ok && isMissingColumn(result.detail, "line_bind_status")) {
      const { line_bind_status: _unusedStatus, ...fallbackPayload } = memberPayload;
      result = await insertMember(fallbackPayload);
    }

    if (!result.ok && result.detail.includes("line_bind_status")) {
      result = await insertMember({
        ...memberPayload,
        line_bind_status: "未綁定"
      });
    }

    errorMessage = result.ok ? "" : result.detail;
  } catch (error) {
    errorMessage = toErrorDetail(error);
  }

  if (errorMessage) {
    console.error("[CREATE_MEMBER_FAILED]", errorMessage);
    return jsonResponse(
      {
        success: false,
        message: "SUPABASE_INSERT_FAILED",
        detail: errorMessage
      },
      500
    );
  }

  return jsonResponse({ success: true, message: "MEMBER_CREATED" });
}
