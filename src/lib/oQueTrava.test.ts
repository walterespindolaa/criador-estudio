import { describe, expect, it } from "vitest";
import { atrasado, contarTravas, esperandoAprovacao, semMidia, somarDias } from "./oQueTrava";

const hoje = "2026-11-06";
const p = (o: Partial<Parameters<typeof atrasado>[0]>) => ({ id: "x", status: "gravando", scheduled_date: null, ...o });

describe("o que trava", () => {
  it("atrasado só quando a data passou e não saiu", () => {
    expect(atrasado(p({ scheduled_date: "2026-11-05" }), hoje)).toBe(true);
    expect(atrasado(p({ scheduled_date: "2026-11-06" }), hoje)).toBe(false);
    expect(atrasado(p({ scheduled_date: "2026-11-01", status: "publicado" }), hoje)).toBe(false);
  });
  it("aprovação só quando pendente", () => {
    expect(esperandoAprovacao(p({ approval_status: "pendente" }))).toBe(true);
    expect(esperandoAprovacao(p({ approval_status: "aprovado" }))).toBe(false);
  });
  it("sem mídia em pronto, agendado ou produzindo que sai até amanhã", () => {
    expect(semMidia(p({ status: "agendado" }), false, hoje)).toBe(true);
    expect(semMidia(p({ status: "agendado" }), true, hoje)).toBe(false);
    expect(semMidia(p({ status: "gravando", scheduled_date: "2026-11-07" }), false, hoje)).toBe(true);
    expect(semMidia(p({ status: "gravando", scheduled_date: "2026-11-09" }), false, hoje)).toBe(false);
    expect(semMidia(p({ status: "ideia" }), false, hoje)).toBe(false);
  });
  it("soma dias e conta", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    const c = contarTravas([p({ id: "a", status: "roteiro", scheduled_date: "2026-11-01" }), p({ id: "b", status: "editando", approval_status: "pendente" })], new Set(), hoje);
    expect(c).toEqual({ atrasado: 1, aprovacao: 1, semmidia: 1 });
  });
});
