/* ═══════════════════════════════════════════════════════════════════════════
   ERRO DE BANCO: "ainda não existe" x "deu errado" (pente fino 23/09/2026)

   Vários hooks faziam `if (error) return []` pra tolerar migration que ainda
   não rodou (tabela ou coluna inexistente). O efeito colateral: QUALQUER
   erro (rede caída, RLS, token vencido) virava lista vazia, e a pessoa via
   "nenhum roteiro" achando que tinha perdido tudo. Agora só o erro de
   esquema vira vazio; o resto sobe como erro e a tela mostra "não consegui
   carregar, tentar de novo" (ErroAoCarregar), com o cache antigo preservado.
   ═══════════════════════════════════════════════════════════════════════════ */

type ErroSupabase = { code?: string | null; message?: string | null } | null | undefined;

/** Tabela, coluna ou função que ainda não existe no banco (migration pendente). */
export function esquemaFaltando(e: ErroSupabase): boolean {
  if (!e) return false;
  const code = e.code ?? "";
  const msg = e.message ?? "";
  return /^(42P01|42703|42883|PGRST202|PGRST204|PGRST205)$/.test(code)
    || /does not exist|schema cache|could not find/i.test(msg);
}

/** Vazio se for migration pendente; senão, sobe o erro pra tela reagir. */
export function vazioOuErro<T>(e: ErroSupabase, vazio: T): T {
  if (esquemaFaltando(e)) return vazio;
  throw e;
}
