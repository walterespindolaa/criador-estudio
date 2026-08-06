import { useSyncExternalStore } from "react";

// ═══════════════════════════════════════════════════════════════════════
// OLHINHO DO CRIA CAIXA (padrão app de banco)
//
// Um botão de olho no cabeçalho do módulo troca TODOS os valores monetários
// por "••••". Fonte única: quem formata dinheiro pra EXIBIÇÃO chama
// mascarável (ex.: o brl() do CriaCaixa passa por aqui). Campos de
// DIGITAÇÃO (MoneyInput) nunca são mascarados.
//
// Persistência: sessionStorage de propósito. Mudar de aba/rota mantém
// oculto; fechar e reabrir o app volta MOSTRANDO (foi o pedido: "fica
// oculto até a pessoa abrir de novo").
// ═══════════════════════════════════════════════════════════════════════

const KEY = "cria-caixa-valores-ocultos";
export const MASCARA = "••••";

const lerSessao = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false; // sessionStorage indisponível (ex.: privacidade) → mostra normal
  }
};

// Store minimalista fora do React: qualquer componente que use o hook
// re-renderiza no toggle, mesmo se estiver memoizado.
let oculto = lerSessao();
const listeners = new Set<() => void>();

export function valoresOcultos(): boolean {
  return oculto;
}

export function setValoresOcultos(v: boolean) {
  oculto = v;
  try {
    if (v) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // sem sessionStorage o estado vive só em memória, comportamento igual
  }
  listeners.forEach((l) => l());
}

/** Aplica a máscara em um valor JÁ formatado ("R$ 1.197,00" → "••••"). */
export function mascarar(formatado: string): string {
  return oculto ? MASCARA : formatado;
}

/** [oculto, setOculto] reativo. Use em quem renderiza valores ou o botão do olho. */
export function useValoresOcultos(): [boolean, (v: boolean) => void] {
  const atual = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => oculto,
  );
  return [atual, setValoresOcultos];
}
