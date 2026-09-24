/* CONSENTIMENTO DE RASTREAMENTO (pente fino 23/09/2026, LGPD)
   O Meta Pixel e o CAPI rodavam pra todo mundo, sem pergunta. Com a LGPD e o
   Pixel mandando dados pro Meta, isso precisa de um "sim" antes. A escolha
   fica no localStorage; sem escolha ou com "não", nada de tracking de
   terceiros sai do navegador. O essencial do app (login, sessão, preferências)
   não depende disto e nunca dependeu. */

const CHAVE = "cria.consentimento";
export type Consentimento = "aceito" | "recusado";

export function lerConsentimento(): Consentimento | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "aceito" || v === "recusado" ? v : null;
  } catch { return null; }
}

export function guardarConsentimento(v: Consentimento) {
  try { localStorage.setItem(CHAVE, v); } catch { /* modo privado: vale só nesta aba */ }
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
