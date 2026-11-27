/* ═══════════════════════════════════════════════════════════════════════════
   "O QUE TRAVOU?" (Walter, 27/11/2026: "Aprovado, constrói")

   Regras puras da folha de quem volta depois de dias fora. A folha em si mora
   em components/volta/OQueTravou.tsx; o banco em
   supabase/migrations/20261127000002_o_que_travou.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

export const DIAS_PRA_PERGUNTAR = 3;

export type MotivoVolta = "sem_ideia" | "sem_tempo" | "nao_entendi" | "faltou_funcao" | "outro";

/** Pergunta quando a pessoa ficou 3+ dias fora e ninguém perguntou nos últimos 30 dias. */
export function devePerguntar(diasFora: number | null, perguntouRecente: boolean): boolean {
  return diasFora !== null && diasFora >= DIAS_PRA_PERGUNTAR && !perguntouRecente;
}

/**
 * Formato do post pela rede principal (pedido do Walter): youtube = shorts,
 * linkedin = texto, tiktok = vídeo, senão reels. `ia` é a regra de formato
 * que o edge entende (o tiktok usa a do reels: vídeo curto vertical).
 */
export function formatoPelaRede(rede: string | null | undefined): { platform: string; format: string; ia: string } {
  switch ((rede ?? "").toLowerCase()) {
    case "youtube": return { platform: "youtube", format: "shorts", ia: "shorts" };
    case "linkedin": return { platform: "linkedin", format: "texto", ia: "linkedin" };
    case "tiktok": return { platform: "tiktok", format: "video", ia: "reels" };
    default: return { platform: "instagram", format: "reels", ia: "reels" };
  }
}

export const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
