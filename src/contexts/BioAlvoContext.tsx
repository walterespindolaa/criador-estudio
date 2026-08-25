import { createContext, useContext, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DE QUEM É A PÁGINA QUE ESTOU EDITANDO

   O editor do Link na bio é a mesma tela em três situações, e a única coisa que
   muda entre elas é ONDE os dados moram:

     · criador editando a própria página  → profiles do próprio usuário
     · gestora editando um cliente que TEM conta Cria → profiles do cliente,
       porque é essa a página que o cliente vê quando entra
     · gestora editando um cliente SEM conta Cria → bio_pages, pendurado na
       ficha do CRM (esse cliente não tem linha em profiles pra pendurar nada)

   Duplicar 2500 linhas de editor pra cada caso seria garantir que uma correção
   feita num lugar não chegaria no outro. Então o alvo entra por contexto e só
   os pontos de leitura e escrita olham pra ele. Sem provider, o editor se
   comporta exatamente como antes.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BioAlvo =
  | { tipo: "conta"; ownerId: string; rotulo?: string }
  | { tipo: "ficha"; pageId: string; crmClientId: string; managerId: string; rotulo?: string };

const BioAlvoCtx = createContext<BioAlvo | null>(null);

export function BioAlvoProvider({ alvo, children }: { alvo: BioAlvo; children: ReactNode }) {
  return <BioAlvoCtx.Provider value={alvo}>{children}</BioAlvoCtx.Provider>;
}

export function useBioAlvo(): BioAlvo | null {
  return useContext(BioAlvoCtx);
}
