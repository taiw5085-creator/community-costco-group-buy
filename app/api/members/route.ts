import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
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

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return jsonResponse({ success: false, message: "SUPABASE_ENV_MISSING" }, 500);
  }

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

  if (error) {
    console.error("[CREATE_MEMBER_FAILED]", error);
    return jsonResponse(
      {
        success: false,
        message: "SUPABASE_INSERT_FAILED",
        detail: error.message
      },
      500
    );
  }

  return jsonResponse({ success: true, message: "MEMBER_CREATED" });
}
