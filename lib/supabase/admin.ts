import "server-only";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

export type AdminSupabaseConfigError =
  | "SUPABASE_URL_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_INVALID";

function isAsciiHeaderValue(value: string) {
  return /^[\x20-\x7E]+$/.test(value);
}

function looksLikeJwt(value: string) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

export function getAdminSupabaseConfigError(): AdminSupabaseConfigError | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) return "SUPABASE_URL_MISSING";
  if (!serviceRoleKey) return "SUPABASE_SERVICE_ROLE_KEY_MISSING";
  if (!isAsciiHeaderValue(serviceRoleKey) || !looksLikeJwt(serviceRoleKey)) {
    return "SUPABASE_SERVICE_ROLE_KEY_INVALID";
  }

  return null;
}

export function createAdminSupabaseClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (getAdminSupabaseConfigError() || !url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
