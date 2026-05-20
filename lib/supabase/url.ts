export function normalizeSupabaseUrl(url: string | undefined) {
  return url?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}
