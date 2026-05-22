import "server-only";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

export type AdminSupabaseConfigError =
  | "SUPABASE_URL_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_INVALID"
  | "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE";

const FALLBACK_SUPABASE_URL = "https://maaudmnlcdvoogvhpomv.supabase.co";
const FALLBACK_SUPABASE_HOST = "maaudmnlcdvoogvhpomv.supabase.co";

function isAsciiHeaderValue(value: string) {
  return /^[\x20-\x7E]+$/.test(value);
}

function looksLikeJwt(value: string) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function decodeJwtPayload(value: string) {
  try {
    const payload = value.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { role?: string };
  } catch {
    return null;
  }
}

export function getAdminSupabaseRestConfig() {
  const url = getAdminSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) return null;

  return {
    url,
    serviceRoleKey
  };
}

function getAdminSupabaseUrl() {
  const normalizedUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!normalizedUrl) return FALLBACK_SUPABASE_URL;

  try {
    const url = new URL(normalizedUrl);
    if (url.hostname !== FALLBACK_SUPABASE_HOST) return FALLBACK_SUPABASE_URL;
    return normalizedUrl;
  } catch {
    return FALLBACK_SUPABASE_URL;
  }
}

export function getAdminSupabaseConfigError(): AdminSupabaseConfigError | null {
  const url = getAdminSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) return "SUPABASE_URL_MISSING";
  if (!serviceRoleKey) return "SUPABASE_SERVICE_ROLE_KEY_MISSING";
  if (!isAsciiHeaderValue(serviceRoleKey) || !looksLikeJwt(serviceRoleKey)) {
    return "SUPABASE_SERVICE_ROLE_KEY_INVALID";
  }
  if (decodeJwtPayload(serviceRoleKey)?.role !== "service_role") {
    return "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE";
  }

  return null;
}

export function createAdminSupabaseClient() {
  const url = getAdminSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (getAdminSupabaseConfigError() || !url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
