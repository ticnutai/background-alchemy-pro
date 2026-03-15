/**
 * Shared CORS helper for Supabase Edge Functions.
 *
 * Reads ALLOWED_ORIGINS env var (comma-separated list).
 * Falls back to wildcard "*" if not configured.
 */

const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
const allowedOrigins: string[] | null = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed =
    !allowedOrigins || allowedOrigins.length === 0
      ? "*"
      : allowedOrigins.includes(origin)
        ? origin
        : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

export function getCorsHeadersExtended(req: Request): Record<string, string> {
  const base = getCorsHeaders(req);
  return {
    ...base,
    "Access-Control-Allow-Headers":
      base["Access-Control-Allow-Headers"] +
      ", x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
