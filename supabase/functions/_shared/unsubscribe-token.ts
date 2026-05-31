import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Garante um token de unsubscribe para o e-mail (normalizado em lower-case).
 * Idempotente: se já existe linha para o email, retorna o token existente; senão cria um novo.
 * `email` deve já vir normalizado (lower-case + trim).
 */
export async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const newToken = crypto.randomUUID();

  // Insere se não existir; se existir, não rotaciona (ignoreDuplicates: true)
  await svc
    .from("email_unsubscribe_tokens")
    .upsert({ email, token: newToken }, { onConflict: "email", ignoreDuplicates: true });

  // Lê o token canônico (novo ou pré-existente — vencedor de race wins)
  const { data, error } = await svc
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .single();

  if (error || !data?.token) {
    throw new Error("could_not_get_unsubscribe_token");
  }
  return data.token as string;
}
