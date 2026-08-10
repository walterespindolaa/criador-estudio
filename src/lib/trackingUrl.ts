// Normalização de URL antes de mandar pra tracking (Meta Pixel/CAPI) ou pro log.
//
// SEGURANÇA: vazamento de token. As rotas públicas abaixo carregam um TOKEN
// secreto no caminho (aprovação, proposta, cronograma) ou na query (ativação,
// reset de senha). Mandar a URL crua pro Meta ou pro log de erro entrega esse
// token a terceiros e a quem lê o painel. Aqui o token vira ":token" e toda a
// query/hash é descartada nessas rotas.

// prefix = início do caminho; hasParam = o token vem como segmento (/aprovar/<token>).
const TOKEN_ROUTES: { prefix: string; hasParam: boolean }[] = [
  { prefix: "/aprovar", hasParam: true },
  { prefix: "/proposta", hasParam: true },
  { prefix: "/cronograma", hasParam: true },
  { prefix: "/ativar", hasParam: false },
  { prefix: "/reset-password", hasParam: false },
];

function matchTokenRoute(pathname: string) {
  return TOKEN_ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
}

// A rota atual carrega token sensível? Serve pra decidir se dispara o pixel do
// browser (que captura window.location sozinho e vazaria o token).
export function isSensitiveTokenRoute(pathname: string): boolean {
  return !!matchTokenRoute(pathname);
}

// URL segura pra tracking/log: nas rotas sensíveis mascara o token e remove
// query/hash; nas demais devolve a URL como está.
export function sanitizeTrackingUrl(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null;
  try {
    const u = new URL(raw);
    const r = matchTokenRoute(u.pathname);
    if (r) {
      const masked = r.hasParam ? `${r.prefix}/:token` : r.prefix;
      return `${u.origin}${masked}`;
    }
    return raw;
  } catch {
    return raw ?? null;
  }
}
