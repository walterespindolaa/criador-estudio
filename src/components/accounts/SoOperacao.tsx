import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useManagerOutlet } from "@/components/accounts/managerOutlet";

/**
 * SÓ QUEM OPERA A AGÊNCIA PASSA (Walter, 14/09/2026).
 *
 * O menu do parceiro puro já escondia Clientes, Agenda, Aprovações, Relatório,
 * Contas e Equipe. Mas esconder não é trancar: a URL continuava abrindo tudo, e
 * em Equipe ele até convidava gente. A auditoria de hoje pegou isso.
 *
 * Aqui não tem tela de bloqueio, tem desvio: quem só produz vai pra fila dele,
 * que é onde ele queria estar. Cara feia de "acesso negado" é pra invasor, e
 * ele não é invasor, é parceiro.
 *
 * ATENÇÃO, e é de propósito: as rotas de MÓDULO (Cria Post, Gestão, Caixa,
 * Radar, Captação) NÃO usam este guard. Lá o parceiro tem que cair na vitrine
 * do módulo, porque ele é cliente em potencial. Porta na cara em quem está
 * tentando pagar é o antipadrão que o código já combateu na barra de baixo.
 */
export function SoOperacao({ children }: { children: ReactNode }) {
  const { parceiroPuro } = useManagerOutlet();
  if (parceiroPuro) return <Navigate to="/socialmidia/demandas" replace />;
  return <>{children}</>;
}
