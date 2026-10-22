import { describe, expect, it } from "vitest";
import {
  agoraEmBrasilia, foneWhats, lerCardapio, lerHorarios, linhasDaSacola, linkWhats,
  mensagemDoPedido, real, statusAgora, totalDoPedido, lerListaColada,
} from "./bioLoja";

const cardapio = lerCardapio({
  itens: [
    { id: "a", nome: "Pão", preco: 24, cat: "Pães" },
    { id: "b", nome: "Croissant", preco: "12,50", cat: "Doces" },
    { id: "c", nome: "Fora do ar", preco: 5, ativo: false },
    { id: "d", nome: "", preco: 1 },
  ],
  categorias: ["Pães", "Doces", "Pães", " "],
});

describe("cardápio", () => {
  it("lê preço em número ou texto e limpa categorias repetidas", () => {
    expect(cardapio.itens[1].preco).toBe(12.5);
    expect(cardapio.categorias).toEqual(["Pães", "Doces"]);
    expect(cardapio.pedidos).toBe(true);
  });
  it("sacola ignora item fora do ar, sem nome ou que não existe", () => {
    const l = linhasDaSacola(cardapio, { a: 2, b: 1, c: 3, d: 1, zz: 9 });
    expect(l.map((i) => i.id)).toEqual(["a", "b"]);
    expect(totalDoPedido(l)).toBe(60.5);
  });
  it("mensagem com itens e total; sem total quando falta preço", () => {
    const l = linhasDaSacola(cardapio, { a: 2, b: 1 });
    expect(mensagemDoPedido(l)).toBe("Olá! Quero fazer um pedido:\n• 2x Pão (R$ 48,00)\n• 1x Croissant (R$ 12,50)\nTotal: R$ 60,50");
    const semPreco = lerCardapio({ itens: [{ id: "x", nome: "Bolo" }] });
    expect(mensagemDoPedido(linhasDaSacola(semPreco, { x: 1 }))).not.toMatch(/Total/);
  });
  it("formata real com milhar", () => { expect(real(1234.5)).toBe("R$ 1.234,50"); });
});

describe("WhatsApp", () => {
  it("aceita com e sem 55 e recusa número curto", () => {
    expect(foneWhats("(47) 99999-0000")).toBe("5547999990000");
    expect(foneWhats("+55 47 99999-0000")).toBe("5547999990000");
    expect(foneWhats("9999")).toBe("");
  });
  it("link codifica a mensagem e some sem telefone", () => {
    expect(linkWhats("47999990000", "a b&c")).toBe("https://wa.me/5547999990000?text=a%20b%26c");
    expect(linkWhats("", "oi")).toBe("");
  });
});

describe("horários", () => {
  const h = lerHorarios({ dias: [
    { aberto: false }, // dom
    { aberto: true, abre: "06:00", fecha: "19:00" }, // seg
    { aberto: true, abre: "06:00", fecha: "19:00" },
    { aberto: true, abre: "06:00", fecha: "19:00" },
    { aberto: true, abre: "06:00", fecha: "19:00" },
    { aberto: true, abre: "18:00", fecha: "02:00" }, // sex vira a noite
    { aberto: true, abre: "07:30", fecha: "14:00" }, // sáb
  ] });
  it("aberto, antes de abrir e depois de fechar", () => {
    expect(statusAgora(h, { dia: 1, min: 10 * 60 })?.texto).toBe("Aberto agora · fecha às 19h");
    expect(statusAgora(h, { dia: 1, min: 5 * 60 })?.texto).toBe("Fechado · abre hoje às 6h");
    expect(statusAgora(h, { dia: 1, min: 20 * 60 })?.texto).toBe("Fechado · abre amanhã às 6h");
  });
  it("horário que passa da meia-noite segue aberto na madrugada", () => {
    expect(statusAgora(h, { dia: 6, min: 60 })?.texto).toBe("Aberto agora · fecha às 2h");
    expect(statusAgora(h, { dia: 5, min: 23 * 60 })?.aberto).toBe(true);
  });
  it("sábado à tarde aponta o próximo dia aberto, pulando o domingo", () => {
    expect(statusAgora(h, { dia: 6, min: 15 * 60 })?.texto).toBe("Fechado · abre segunda às 6h");
  });
  it("loja sem nenhum dia aberto não mostra selo", () => {
    expect(statusAgora(lerHorarios({ dias: Array(7).fill({ aberto: false }) }), { dia: 1, min: 600 })).toBeNull();
  });
  it("conta o dia no fuso de Brasília", () => {
    // 02:30 UTC de uma segunda = 23:30 de domingo em Brasília.
    expect(agoraEmBrasilia(new Date("2026-10-19T02:30:00Z"))).toEqual({ dia: 0, min: 23 * 60 + 30 });
  });
});

describe("colar lista", () => {
  it("entende nome, preço e categoria em qualquer ordem", () => {
    const r = lerListaColada("Pão de fermentação - R$ 24,00 - Pães\n• Croissant - Doces - 12,5\n\nCafé coado\nBolo de cenoura\t18");
    expect(r).toEqual([
      { nome: "Pão de fermentação", preco: 24, cat: "Pães" },
      { nome: "Croissant", preco: 12.5, cat: "Doces" },
      { nome: "Café coado", preco: null, cat: "" },
      { nome: "Bolo de cenoura", preco: 18, cat: "" },
    ]);
  });
  it("nome com hífen colado não quebra", () => {
    expect(lerListaColada("Pão-de-queijo - 6")[0]).toEqual({ nome: "Pão-de-queijo", preco: 6, cat: "" });
  });
});

import { linkDoBotao, alvoDoLink } from "./bioBlocks";
import { MODELOS } from "./bioTemplates";

describe("botão da capa", () => {
  it("aceita âncora da página e recusa o que poderia virar script", () => {
    expect(linkDoBotao("#cardapio")).toBe("#cardapio");
    expect(linkDoBotao('#a" onmouseover="x')).toBe("");
    expect(linkDoBotao("javascript:alert(1)")).toBe("");
    expect(linkDoBotao("wa.me/5547999990000")).toBe("https://wa.me/5547999990000");
    expect(alvoDoLink("#x")).toEqual({});
    expect(alvoDoLink("https://a.com")).toMatchObject({ target: "_blank" });
  });
});

describe("modelo Loja", () => {
  const loja = MODELOS.find((m) => m.id === "site-loja")!;
  it("traz cardápio com sacola, horários e capa de foto cheia", () => {
    const kinds = loja.blocos.map((b) => b.kind);
    expect(kinds).toEqual(["capa", "vantagens", "cardapio", "destaque", "horarios", "depoimentos", "atendimento", "contato"]);
    expect(loja.blocos[0].data.layout).toBe("foto_cheia");
    const c = lerCardapio(loja.blocos[2].data);
    expect(c.pedidos).toBe(true);
    expect(new Set(c.itens.map((i) => i.id)).size).toBe(c.itens.length);
  });
  it("modelo não carrega foto de exemplo pra página de ninguém", () => {
    for (const b of loja.blocos) {
      expect(JSON.stringify(b.data)).not.toMatch(/unsplash|https?:\/\//);
    }
  });
});
