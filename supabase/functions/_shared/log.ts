/* Registro de erro das edges em app_logs (pente fino 23/09/2026). Antes cada
   edge só fazia console.error, que morre no log do Supabase e ninguém lê. Aqui
   o erro cai na mesma tabela que o Admin > Logs já mostra, com a função como
   contexto. Nunca lança: log que falha não pode derrubar quem chamou. */
// deno-lint-ignore no-explicit-any
type Svc = { from: (t: string) => any };

export async function registrarErro(svc: Svc, funcao: string, mensagem: string, contexto?: Record<string, unknown>, userId?: string | null) {
  try {
    console.error(`[${funcao}] ${mensagem}`, contexto ?? "");
    await svc.from("app_logs").insert({
      user_id: userId ?? null,
      level: "error",
      message: `[edge:${funcao}] ${mensagem}`.slice(0, 500),
      context: { funcao, ...(contexto ?? {}) },
      url: `edge/${funcao}`,
    });
  } catch { /* sem log, segue */ }
}

export function mensagemDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e).slice(0, 300); } catch { return String(e); }
}
