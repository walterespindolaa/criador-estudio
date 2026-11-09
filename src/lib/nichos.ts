/* Nicho normalizado (09/11/2026). Mesma regra de supabase/functions/_shared/dossie.ts:
   "Lifestyle, Moda e Beleza" -> ["lifestyle", "moda", "beleza"]. Comparar o
   texto inteiro fazia "Lifestyle, Moda, Beleza" nunca casar com "lifestyle". */
export function nichosDe(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const sem = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const partes = sem.split(/,|;|\/|\be\b|&|\+/).map((p) => p.trim().replace(/\s+/g, " ")).filter((p) => p.length >= 3 && p.length <= 40);
  return [...new Set(partes)];
}

/** A tendência serve pra esta conta? Geral (ou sem nicho) serve pra todo mundo. */
export function casaNicho(nichoDaTendencia: string | null | undefined, nichoDaConta: string | null | undefined): boolean {
  const t = nichosDe(nichoDaTendencia);
  if (!t.length || t.includes("geral")) return true;
  const c = nichosDe(nichoDaConta);
  if (!c.length) return true;
  return t.some((n) => c.includes(n));
}
