/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXTO DO OUTLET DA AGÊNCIA (pente fino 23/09/2026 · performance)

   `useManagerOutlet` e `MODULE_ICON` moravam dentro de ManagerLayout.tsx.
   Qualquer tela que importasse só o hook (SoOperacao, ModuleGate, ModuleUpsell,
   ManagerHome, ParceiroHome, Caches) puxava o layout INTEIRO da agência junto,
   e App.tsx importa SoOperacao direto: o lazy do ManagerLayout não valia
   nada, o criador carregava o painel da agência no boot. Aqui é um arquivo
   pequeno, sem JSX, que qualquer tela pode importar de graça.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useOutletContext } from "react-router-dom";
import { Camera, Search, Send, Users2, Wallet, type LucideIcon } from "lucide-react";
import type { ModuleWithStatus } from "@/hooks/useModules";

// Ícone de cada módulo, casado pelo CÓDIGO DO CATÁLOGO (m.code). Fonte única da
// verdade: o rail (desktop), o menu "Mais" (mobile) e os cards da home
// (ManagerHome) leem daqui, pra o ícone do card ser o MESMO do menu lateral.
export const MODULE_ICON: Record<string, LucideIcon> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet, hub_cria: Search, cria_captacao: Camera };

export type ManagerOutletContext = { openModule: (m: ModuleWithStatus) => void; openSettings: () => void; parceiroPuro: boolean };
export function useManagerOutlet() { return useOutletContext<ManagerOutletContext>(); }
