// Campo "Ideia / Referência (link)" com VÁRIOS links.
//
// FORMATO DE ARMAZENAMENTO: continua na MESMA coluna de texto que já existe
// (cronograma_items.ref_url e posts.reference_url), com UM LINK POR LINHA.
// Por que não criar coluna nova:
//  - URL nunca tem espaço em branco, então a quebra de linha é um separador
//    seguro e sem ambiguidade;
//  - todo valor antigo (1 link só) continua sendo lido igual, sem migração e
//    sem risco de perder o que já está salvo;
//  - a página pública de aprovação do cliente recebe esse campo pela RPC
//    get_cronograma_by_token, que devolve o texto cru: com este formato ela
//    segue funcionando sem precisar mexer no banco.
// Toda leitura/escrita do campo deve passar por estes helpers.

// Texto salvo -> lista de links (sem vazios, na ordem em que foram digitados).
export function parseRefLinks(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Lista de links -> texto pra salvar. Link vazio nunca é gravado; lista
// vazia vira null pra coluna ficar limpa (mesmo comportamento de antes).
export function serializeRefLinks(links: string[]): string | null {
  const clean = links.map((l) => l.trim()).filter(Boolean);
  return clean.length ? clean.join("\n") : null;
}

// Primeiro link: usado onde só cabe UM (ex.: post convertido do cronograma).
export function firstRefLink(value?: string | null): string | null {
  return parseRefLinks(value)[0] ?? null;
}

// Parece link? Serve pra não transformar texto solto num <a> quebrado.
export function isRefLink(link: string): boolean {
  const v = link.trim();
  if (!v || /\s/.test(v)) return false;
  return /^(https?:)?\/\//i.test(v) || /^[^/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(v);
}

// href seguro: o usuário costuma colar sem "https://".
export function refLinkHref(link: string): string {
  const v = link.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v.replace(/^\/+/, "")}`;
}

// Rótulo curto (sem protocolo/www) pra não estourar o layout no mobile.
export function refLinkLabel(link: string, max = 46): string {
  const v = link.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}
