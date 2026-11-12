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
  /* Rotas que nasceram depois da lista e ficaram vazando (pente fino 23/09/2026):
     roteiros do cliente, cadastro/briefing, materiais, e o obrigado do checkout
     (carrega o session_id do Stripe na query, que o claim-purchase aceita). */
  { prefix: "/roteiros", hasParam: true },
  // Link do cliente pra agendar captação (19/10/2026).
  { prefix: "/agendar", hasParam: true },
  { prefix: "/cadastro", hasParam: true },
  { prefix: "/materiais", hasParam: true },
  // Convite pra cliente liberar o Instagram: o token dá acesso à conexão.
  { prefix: "/conectar", hasParam: true },
  { prefix: "/app/obrigado", hasParam: false },
  { prefix: "/ativar", hasParam: false },
  { prefix: "/reset-password", hasParam: false },
  // Botões dos e-mails (/email/pronto, /email/confirmar): o token vem na query.
  { prefix: "/email", hasParam: false },
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
    /* O "#" SAI SEMPRE (12/11/2026). O link de confirmação de e-mail e o de
       entrar sem senha pousam em QUALQUER rota (ex.: /onboarding) com a sessão
       inteira depois do "#" (access_token, refresh_token). Um erro de tela
       nessa hora gravava a sessão da pessoa no app_logs. O app não usa "#" pra
       navegar, então nada se perde. Na query saem só os nomes de segredo. */
    let mudou = false;
    if (u.hash) { u.hash = ""; mudou = true; }
    for (const k of ["access_token", "refresh_token", "token", "code", "token_hash"]) {
      if (u.searchParams.has(k)) { u.searchParams.delete(k); mudou = true; }
    }
    return mudou ? u.toString() : raw;
  } catch {
    return raw ?? null;
  }
}
