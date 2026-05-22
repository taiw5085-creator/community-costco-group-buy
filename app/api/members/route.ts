import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getAdminSupabaseConfigError } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/calculations";

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
  if (error instanceof Error) return error.message;
  return String(error);
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

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return jsonResponse({ success: false, message: "SUPABASE_ENV_MISSING", detail: "SUPABASE_CLIENT_UNAVAILABLE" }, 500);
  }

  let errorMessage = "";

  try {
    const { error } = await supabase.from("members").insert({
      name,
      phone,
      line_name: lineName,
      building,
      note: note || null,
      balance: 0,
      line_bind_status: "pending",
      created_at: new Date().toISOString()
    });
    errorMessage = error?.message ?? "";
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
