import { describe, expect, it } from "vitest";
import { exemploNoBloco, progressoDaPagina, statusDaSecao } from "./bioStatus";
import { MODELOS } from "./bioTemplates";

const loja = MODELOS.find((m) => m.id === "site-loja")!;
const cons = MODELOS.find((m) => m.id === "site-consultoria")!;
const comId = (bs: { kind: string; data: Record<string, unknown> }[]) =>
  bs.map((b, i) => ({ id: `b${i}`, kind: b.kind, data: JSON.parse(JSON.stringify(b.data)), is_active: true }));

describe("estado de cada seção", () => {
  it("texto que veio do modelo é exemplo; trocado deixa de ser", () => {
    const capa = cons.blocos[0].data;
    expect(exemploNoBloco(capa)).not.toBeNull();
    expect(exemploNoBloco({ ...capa, etiqueta: "Consultoria em Itajaí", titulo: "Minha promessa", frase: "Minha frase própria pra minha empresa" })).toBeNull();
  });
  it("rótulo curto e consentimento não contam como exemplo", () => {
    expect(exemploNoBloco({ rotulo: "Serviços", botao: "Quero esse", consentimento: "Ao enviar, você autoriza o uso dos seus dados para eu responder sua proposta." })).toBeNull();
  });
  it("escondida, falta, exemplo e pronta", () => {
    expect(statusDaSecao({ kind: "capa", data: {}, is_active: false }).tipo).toBe("escondida");
    expect(statusDaSecao({ kind: "capa", data: {}, is_active: true })).toEqual({ tipo: "falta", texto: "Falta o título" });
    expect(statusDaSecao({ kind: "capa", data: cons.blocos[0].data, is_active: true }).texto).toBe("Falta a foto");
    expect(statusDaSecao({ kind: "capa", data: { ...cons.blocos[0].data, imagem: "x" }, is_active: true }).tipo).toBe("exemplo");
    expect(statusDaSecao({ kind: "capa", data: { titulo: "Meu título" }, is_active: true }).tipo).toBe("pronta");
  });
  it("cardápio conta item sem foto e pedido sem WhatsApp", () => {
    const d = { pedidos: true, itens: [{ id: "a", nome: "Pão", foto: "x" }, { id: "b", nome: "Bolo" }] };
    expect(statusDaSecao({ kind: "cardapio", data: d, is_active: true }).texto).toBe("Falta o WhatsApp dos pedidos");
    expect(statusDaSecao({ kind: "cardapio", data: d, is_active: true }, "(47) 99999-0000").texto).toBe("Falta foto em 1 item");
  });
});

describe("progresso", () => {
  it("modelo recém aplicado começa baixo e aponta o WhatsApp primeiro", () => {
    const p = progressoDaPagina(comId(loja.blocos), "");
    expect(p.pct).toBeLessThan(40);
    expect(p.proximo?.id).toBe("negocio");
  });
  it("com WhatsApp, o próximo passo é a primeira seção que não está pronta", () => {
    const bs = comId(loja.blocos);
    const p = progressoDaPagina(bs, "(47) 99999-0000");
    expect(p.proximo?.id).toBe("b0");
  });
  it("página vazia sugere um modelo", () => {
    expect(progressoDaPagina([], "").proximo?.id).toBe("modelos");
  });
});
