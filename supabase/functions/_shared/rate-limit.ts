import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type RateLimitWindow = "minute" | "hour" | "day";
// failClosed: em erro de DB, BLOQUEAR (allowed=false) em vez de liberar. Default
// mantém o comportamento atual (fail-open). Ligue failClosed:true em endpoints
// PÚBLICOS anônimos, onde um RPC quebrado não pode virar "sem limite nenhum".
export interface RateLimitOptions { scope: string; window: RateLimitWindow; limit: number; failClosed?: boolean; }
export interface RateLimitResult { allowed: boolean; count: number; limit: number; }

let cachedAdmin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return cachedAdmin;
}

function buildWindowKey(window: RateLimitWindow): string {
  const now = new Date().toISOString();
  if (window === "minute") return now.slice(0, 16); // YYYY-MM-DDTHH:MM
  if (window === "hour") return now.slice(0, 13);    // YYYY-MM-DDTHH
  return now.slice(0, 10);                            // YYYY-MM-DD
}

/** Check-and-increment atômico. allowed=false quando estourou o limite na janela. */
export async function checkRateLimit(userId: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const admin = getAdmin();
  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    _user_id: userId,
    _scope: options.scope,
    _window_key: buildWindowKey(options.window),
    _limit: options.limit,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    // Em erro de DB: por padrão LIBERA (fail-open, não trava todo mundo). Se o
    // chamador passou failClosed:true (endpoints públicos anônimos), BLOQUEIA -
    // senão um RPC fora do ar deixaria o endpoint sem limite algum. Vai pros logs.
    const failClosed = options.failClosed === true;
    console.error(`[rate-limit] RPC error, failing ${failClosed ? "closed" : "open"}:`, (error as { message?: string })?.message);
    return { allowed: !failClosed, count: 0, limit: options.limit };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row.allowed === true, count: row.current_count ?? 0, limit: row.limit ?? options.limit };
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>, message?: string): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", message: message ?? "Você excedeu o limite de uso. Aguarde um pouco e tente de novo.", limit: result.limit, count: result.count }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
