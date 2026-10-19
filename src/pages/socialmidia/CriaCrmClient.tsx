import { Navigate, useParams, useSearchParams } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════════════════
   A FICHA DO CRM VIROU A TELA DO CLIENTE (Walter, 19/10/2026)

   Existiam duas telas do mesmo cliente (esta ficha e a tela do cliente), cada
   uma com uma parte dos campos. Tudo o que só existia aqui (cadastro da
   empresa, diagnóstico, concorrência, etiquetas, excluir) foi pra tela do
   cliente, no grupo Cria Gestão (src/components/accounts/crm/FichaCrmCliente).
   Este arquivo ficou só pra não quebrar link antigo salvo: /criacrm/:id manda
   pra /clientes/:id/<aba>. As duas telas usam o MESMO id (crm_clients.id).
   ?aba= aceita os nomes antigos das abas (resumo, tarefas, brand, diag, conc).
   ═══════════════════════════════════════════════════════════════════════════ */

const ABA_NOVA: Record<string, string> = {
  resumo: "cadastro",
  cadastro: "cadastro",
  tarefas: "tarefas",
  brand: "brandbook",
  brandbook: "brandbook",
  diag: "diagnostico",
  diagnostico: "diagnostico",
  conc: "concorrencia",
  concorrencia: "concorrencia",
};

export default function CriaCrmClient() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const aba = ABA_NOVA[sp.get("aba") ?? ""] ?? "cadastro";
  if (!id) return <Navigate to="/socialmidia/clientes" replace />;
  return <Navigate to={`/socialmidia/clientes/${id}/${aba}`} replace />;
}
