/* CONSENTIMENTO DE RASTREAMENTO (pente fino 23/09/2026, LGPD)
   O Meta Pixel e o CAPI rodavam pra todo mundo, sem pergunta. Com a LGPD e o
   Pixel mandando dados pro Meta, isso precisa de um "sim" antes. A escolha
   fica no localStorage; sem escolha ou com "não", nada de tracking de
   terceiros sai do navegador. O essencial do app (login, sessão, preferências)
   não depende disto e nunca dependeu. */

const CHAVE = "cria.consentimento";
export type Consentimento = "aceito" | "recusado";

/* UM AVISO SÓ PRA LP E APP (Walter, 19/10/2026, opção A). A escolha também
   vai num cookie do domínio .criasocialclub.com.br: quem aceita na landing
   page chega no cadastro do app já aceito, e vice-versa. Em outros domínios
   (criaclub.bio, prévias) o cookie não se aplica e vale só o localStorage. */
const COOKIE = "cria_consent";
const DOMINIO = "criasocialclub.com.br";

function noDominioCria(): boolean {
  try {
    const h = window.location.hostname;
    return h === DOMINIO || h.endsWith("." + DOMINIO);
  } catch { return false; }
}

function lerCookie(): Consentimento | null {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    const v = m ? decodeURIComponent(m[1]) : null;
    return v === "aceito" || v === "recusado" ? v : null;
  } catch { return null; }
}

function gravarCookie(v: Consentimento) {
  if (!noDominioCria()) return;
  try {
    document.cookie = `${COOKIE}=${v}; domain=.${DOMINIO}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  } catch { /* sem cookie: fica o localStorage */ }
}

export function lerConsentimento(): Consentimento | null {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "aceito" || v === "recusado") {
      // Decisão antiga, de antes do cookie: espalha pra LP também.
      if (noDominioCria() && !lerCookie()) gravarCookie(v);
      return v;
    }
  } catch { /* segue pro cookie */ }
  if (!noDominioCria()) return null;
  const c = lerCookie();
  if (c) { try { localStorage.setItem(CHAVE, c); } catch { /* ok */ } }
  return c;
}

export function guardarConsentimento(v: Consentimento) {
  try { localStorage.setItem(CHAVE, v); } catch { /* modo privado: vale só nesta aba */ }
  gravarCookie(v);
  memoria = v;
  ouvintes.forEach((f) => f(v));
}

// Cache em memória pra `podeRastrear()` não ler o localStorage a cada evento.
let memoria: Consentimento | null | undefined;
const ouvintes = new Set<(v: Consentimento) => void>();

export function podeRastrear(): boolean {
  if (memoria === undefined) memoria = lerConsentimento();
  return memoria === "aceito";
}

/** Avisa quando a pessoa decide. O Pixel usa pra disparar o PageView atrasado. */
export function aoDecidirConsentimento(f: (v: Consentimento) => void): () => void {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}
