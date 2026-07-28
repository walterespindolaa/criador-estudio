import { describe, it, expect } from "vitest";
import { billablePendingMonthlies, paidMonthlyClientIds, receitaDoMesPJ } from "./finance";

// Trava a regra de "mensalidade pendente que REALMENTE conta como a receber".
// É a conta que precisa bater entre TODAS as abas do Caixa (visão geral,
// rentabilidade, lançamentos, calendário, inadimplência, ficha do cliente).
const ym = "2026-07";
const cliente = (over: Partial<{ id: string; status: string; monthly_value: number; contract_end_date: string | null }> = {}) => ({
  id: "c1", status: "ativo", monthly_value: 1000, contract_end_date: null, ...over,
});
const inst = (over: Partial<{ id: string; status: string; amount: number; crm_client_id: string | null; month_ref: string }> = {}) => ({
  id: "m1", status: "pendente", amount: 1000, crm_client_id: "c1", month_ref: "2026-07-01", ...over,
});
const recPagoMensalidade = (cid: string) => ({
  context: "pj", type: "entrada", status: "pago", category: "Mensalidade", amount: 1000, date: "2026-07-10", crm_client_id: cid,
});

describe("billablePendingMonthlies", () => {
  it("conta a mensalidade pendente de cliente ativo", () => {
    const out = billablePendingMonthlies([inst()], [], [cliente()], ym);
    expect(out).toHaveLength(1);
  });

  it("DEDUP: não conta a pendente se o cliente já teve a mensalidade lançada à mão como paga", () => {
    const out = billablePendingMonthlies([inst()], [recPagoMensalidade("c1")], [cliente()], ym);
    expect(out).toHaveLength(0);
  });

  it("FANTASMA: não conta a pendente de cliente inativo", () => {
    const out = billablePendingMonthlies([inst()], [], [cliente({ status: "inativo" })], ym);
    expect(out).toHaveLength(0);
  });

  it("FANTASMA: não conta a pendente de mês posterior ao encerramento do contrato", () => {
    const out = billablePendingMonthlies([inst()], [], [cliente({ contract_end_date: "2026-06-30" })], ym);
    expect(out).toHaveLength(0);
  });

  it("EXCLUÍDO: não conta a pendente de cliente que saiu da carteira (soft delete), se há carteira carregada", () => {
    const out = billablePendingMonthlies([inst({ crm_client_id: "sumiu" })], [], [cliente()], ym);
    expect(out).toHaveLength(0);
  });

  it("não zera durante o carregamento (carteira vazia): mantém a pendente", () => {
    const out = billablePendingMonthlies([inst()], [], [], ym);
    expect(out).toHaveLength(1);
  });

  it("instância sem cliente vinculado sempre conta", () => {
    const out = billablePendingMonthlies([inst({ crm_client_id: null })], [], [cliente()], ym);
    expect(out).toHaveLength(1);
  });

  it("ignora instância que não está pendente", () => {
    const out = billablePendingMonthlies([inst({ status: "pago" }), inst({ id: "m2", status: "pulado" })], [], [cliente()], ym);
    expect(out).toHaveLength(0);
  });
});

describe("paidMonthlyClientIds", () => {
  it("pega só entrada/pago/categoria Mensalidade do mês, com cliente", () => {
    const ids = paidMonthlyClientIds([
      recPagoMensalidade("c1"),
      { context: "pj", type: "entrada", status: "pendente", category: "Mensalidade", amount: 1, date: "2026-07-01", crm_client_id: "c2" },
      { context: "pj", type: "entrada", status: "pago", category: "Avulso", amount: 1, date: "2026-07-01", crm_client_id: "c3" },
      { context: "pj", type: "entrada", status: "pago", category: "Mensalidade", amount: 1, date: "2026-06-01", crm_client_id: "c4" },
    ], ym);
    expect([...ids]).toEqual(["c1"]);
  });
});

describe("receitaDoMesPJ (não conta 2x)", () => {
  it("mensalidade paga à mão entra em recebido e NÃO duplica em aReceberMensal", () => {
    const r = receitaDoMesPJ([recPagoMensalidade("c1")], [inst()], [cliente()], ym);
    expect(r.recebido).toBe(1000);
    expect(r.aReceberMensal).toBe(0);
    expect(r.previstoBruto).toBe(1000); // e não 2000
  });

  it("mensalidade pendente de cliente ativo entra só em aReceberMensal", () => {
    const r = receitaDoMesPJ([], [inst()], [cliente()], ym);
    expect(r.recebido).toBe(0);
    expect(r.aReceberMensal).toBe(1000);
  });
});
