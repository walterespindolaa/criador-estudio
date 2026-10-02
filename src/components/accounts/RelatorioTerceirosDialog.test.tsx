import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

/* Walter, 02/10/2026: relatório de terceiros. Confere a conta (peças no
   período, prazo, ajustes, pago x a pagar) com dados fixos, sem banco. */
const hoje = new Date();
const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
const posts = [
  { id: "p1", title: "Outubro Rosa", format: "foto", external_client_id: "c1", assignee_id: "m1",
    entregue_em: `${mes}-01T15:00:00Z`, prazo_producao: `${mes}-02`, revisoes: 1, cache_parceiro: 80 },
  { id: "p2", title: "Botox Day", format: "foto", external_client_id: "c1", assignee_id: "m1",
    entregue_em: `${mes}-01T16:00:00Z`, prazo_producao: `${mes}-01`, revisoes: 0, cache_parceiro: 50 },
];
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq", "not", "is", "gte", "lt", "order"]) chain[k] = () => chain;
  chain.limit = () => Promise.resolve({ data: posts, error: null });
  return { supabase: { from: () => chain } };
});
vi.mock("@/contexts/AccountContext", () => ({ useActiveAccount: () => ({ agencyOwnerId: "dono" }) }));
vi.mock("@/hooks/useCriaPost", () => ({ useExternalClients: () => ({ clients: [{ id: "c1", name: "Clínica Lorem" }] }) }));
vi.mock("@/hooks/usePdfExport", () => ({ usePdfExport: () => ({ exportPdf: vi.fn() }) }));

import { RelatorioTerceirosDialog } from "./RelatorioTerceirosDialog";

describe("relatório de terceiros", () => {
  it("soma peças do período, prazo, ajustes e pago x a pagar", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RelatorioTerceirosDialog open onOpenChange={() => {}} nomeCliente={new Map()}
          terceiros={[{ terceiro_id: null, member_id: "m1", nome: "Agatha", papel: "designer", nota: "", fechamento: "dia15", pagamento: "", no_cria: true }]}
          linhas={[
            { id: "f1", date: `${mes}-01`, pago_em: `${mes}-01`, description: "Cachê Agatha: Outubro Rosa", amount: 80, status: "pago", crm_client_id: null, post_id: "p1", assignee_id: "m1", terceiro_id: null },
            { id: "f2", date: `${mes}-01`, pago_em: null, description: "Cachê Agatha: Botox Day", amount: 50, status: "pendente", crm_client_id: null, post_id: "p2", assignee_id: "m1", terceiro_id: null },
          ]} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByText("Outubro Rosa").length).toBeGreaterThan(0));
    const corpo = document.body.textContent ?? "";
    expect(corpo).toContain("2 peça(s)");
    expect(corpo).toContain("1 ajuste(s)");
    expect(corpo.replace(/\s/g, " ")).toMatch(/R\$\s?130,00/);
    expect(corpo.replace(/\s/g, " ")).toMatch(/R\$\s?50,00 a pagar/);
  });
});
