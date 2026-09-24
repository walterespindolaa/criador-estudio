import { describe, it, expect } from "vitest";
import { prontidaoDa, DEGRAUS, type CapturaMin, type RoteiroMin, type AprovacaoMin } from "./captacao-prontidao";

// A escada de 5 degraus é o que a social mídia lê no card da gravação. Se ela
// errar, a pessoa vai gravar sem roteiro revisado ou acha que já virou post.
const cap = (over: Partial<CapturaMin> = {}): CapturaMin => ({ id: "c1", status: "marcada", capture_date: "2026-10-05", ...over });
const rot = (over: Partial<RoteiroMin> = {}): RoteiroMin => ({ id: "r1", capture_id: "c1", done: false, source_post_id: null, ...over });
const envio = (status: AprovacaoMin["status"], ids: string[]): AprovacaoMin => ({ status, itens: ids.map((script_id) => ({ script_id })) });

describe("prontidaoDa", () => {
  it("cancelada fica fora da escada", () => {
    const p = prontidaoDa(cap({ status: "cancelada" }), [rot()]);
    expect(p.degrau).toBe("cancelada");
    expect(p.nivel).toBe(0);
  });

  it("sem roteiro: degrau 1 e próximo passo é escrever", () => {
    const p = prontidaoDa(cap(), []);
    expect(p.degrau).toBe("marcada");
    expect(p.proximoPasso).toBe("Escrever roteiro");
    expect(p.tom).toBe("atencao");
  });

  it("com roteiro e sem envio: pede pra enviar pro cliente", () => {
    const p = prontidaoDa(cap(), [rot()]);
    expect(p.degrau).toBe("com_roteiro");
    expect(p.proximoPasso).toBe("Enviar pro cliente");
    expect(p.aguardandoCliente).toBe(false);
  });

  it("enviado e ainda aberto: espera o cliente", () => {
    const p = prontidaoDa(cap(), [rot()], [envio("aberto", ["r1"])]);
    expect(p.degrau).toBe("com_roteiro");
    expect(p.aguardandoCliente).toBe(true);
    expect(p.tom).toBe("espera");
  });

  it("cliente devolveu TODOS os roteiros: revisada", () => {
    const p = prontidaoDa(cap(), [rot(), rot({ id: "r2" })], [envio("aplicado", ["r1", "r2"])]);
    expect(p.degrau).toBe("revisada");
    expect(p.proximoPasso).toBe("Gravar");
  });

  it("roteiro novo escrito depois do envio derruba de revisada pra com_roteiro", () => {
    const p = prontidaoDa(cap(), [rot(), rot({ id: "r2" })], [envio("aplicado", ["r1"])]);
    expect(p.degrau).toBe("com_roteiro");
    expect(p.detalhe).toContain("1 novo sem enviar");
  });

  it("roteiros de OUTRA gravação não contam", () => {
    const p = prontidaoDa(cap(), [rot({ capture_id: "outra" })]);
    expect(p.degrau).toBe("marcada");
    expect(p.roteiros).toBe(0);
  });

  it("todos gravados = gravada, mesmo sem status concluida", () => {
    const p = prontidaoDa(cap(), [rot({ done: true }), rot({ id: "r2", done: true })]);
    expect(p.degrau).toBe("gravada");
    expect(p.detalhe).toBe("2 roteiros sem virar post");
    expect(p.proximoPasso).toBe("Virar post");
  });

  it("gravada e todos viraram post = topo da escada", () => {
    const p = prontidaoDa(cap({ status: "concluida" }), [rot({ done: true, source_post_id: "p1" })]);
    expect(p.degrau).toBe("virou_post");
    expect(p.tom).toBe("ok");
    expect(p.nivel).toBe(5);
  });

  it("concluida sem roteiro registrado é neutra, não vermelha", () => {
    const p = prontidaoDa(cap({ status: "concluida" }), []);
    expect(p.degrau).toBe("gravada");
    expect(p.tom).toBe("neutro");
    expect(p.proximoPasso).toBeNull();
  });

  it("os níveis sobem na ordem da escada", () => {
    const niveis = DEGRAUS.map((d) => d.degrau);
    expect(niveis).toEqual(["marcada", "com_roteiro", "revisada", "gravada", "virou_post"]);
  });
});
