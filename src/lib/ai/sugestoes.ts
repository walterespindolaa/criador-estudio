/* Sugestões de ideia da Cria IA (operação idea-suggestions). Saiu de
   pages/app/Ideias.tsx em 27/11/2026 pra folha "O que travou?" usar a mesma
   leitura. */

export interface AISuggestion {
  titulo: string;
  formato: string;
  angulo: string;
  objetivo: string;
  // v2 (04/09): sugestão completa. Campos opcionais pra tolerar resposta curta.
  gancho?: string;
  estrutura?: string[];
  cta?: string;
  porque?: string;
  referencia_visual?: string;
  tendencia?: string;
}

/* LEITURA TOLERANTE (Walter, 01/09: "deu erro ao gerar as sugestões"): a IA às
   vezes devolve o JSON com uma frase antes, dentro de cerca de código, ou
   embrulhado num objeto. Antes, qualquer um desses casos estourava o parse e a
   pessoa via só "erro". Agora a gente pesca o array de onde ele estiver. */
export function parseSuggestions(result: unknown): AISuggestion[] {
  const valida = (raw: unknown): AISuggestion[] => {
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? ((raw as Record<string, unknown>).sugestoes
          ?? (raw as Record<string, unknown>).suggestions
          ?? (raw as Record<string, unknown>).posts)
        : null;
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is AISuggestion =>
      !!s && typeof s === "object"
      && typeof (s as AISuggestion).titulo === "string"
      && typeof (s as AISuggestion).formato === "string"
      && typeof (s as AISuggestion).angulo === "string"
      && typeof (s as AISuggestion).objetivo === "string"
    ).map((s) => ({
      ...s,
      // "estrutura" pode vir como string única; normaliza pra lista.
      estrutura: Array.isArray(s.estrutura)
        ? s.estrutura.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : typeof s.estrutura === "string" ? [s.estrutura] : undefined,
    }));
  };

  if (typeof result !== "string") return valida(result);
  const limpo = result.replace(/```json\n?|\n?```/g, "").trim();
  // 1ª tentativa: a string inteira é JSON.
  try { return valida(JSON.parse(limpo)); } catch { /* segue pro resgate */ }
  // 2ª: pesca o primeiro array [...] no meio do texto.
  const m = limpo.match(/\[[\s\S]*\]/);
  if (m) {
    try { return valida(JSON.parse(m[0])); } catch { /* segue */ }
  }
  // 3ª: resposta CORTADA no meio (limite de tokens). Resgata cada objeto que
  // veio inteiro: os objetos não têm objeto aninhado (só arrays de string),
  // então um regex de chaves balanceadas de 1 nível pega cada sugestão.
  const objetos = limpo.match(/\{[^{}]*\}/g) ?? [];
  const resgatados: unknown[] = [];
  for (const o of objetos) {
    try { resgatados.push(JSON.parse(o)); } catch { /* esse estava cortado */ }
  }
  return valida(resgatados);
}
