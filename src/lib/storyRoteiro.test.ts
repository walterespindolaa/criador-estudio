import { describe, it, expect } from "vitest";
import { lerRoteiro, montarRoteiro, falaDoStory, tipoDoFormato, formatoDoTipo, storyDaIA, storyFalado } from "./storyRoteiro";

describe("roteiro do story em partes", () => {
  it("monta e lê de volta", () => {
    const s = montarRoteiro("falado", { b1: "Três coisas antes de gravar.", b2: "zero travada", b3: "Me conta na caixinha", mostrar: "o set montado" });
    expect(s).toBe("Mostrar: o set montado\nFala: Três coisas antes de gravar.\nNa tela: zero travada\nFechamento: Me conta na caixinha");
    const p = lerRoteiro(s);
    expect(p).toMatchObject({ b1: "Três coisas antes de gravar.", b2: "zero travada", b3: "Me conta na caixinha", mostrar: "o set montado", estruturado: true });
  });
  it("texto antigo sem rótulo vira o bloco 1", () => {
    const p = lerRoteiro("Grave você mostrando o set e escreva na tela: meu segredo");
    expect(p.estruturado).toBe(false);
    expect(p.b1).toContain("Grave você");
  });
  it("Prompter recebe só a fala e o fechamento", () => {
    const f = falaDoStory("Mostrar: o set\nFala: Oi gente\nNa tela: legenda\nFechamento: Responde aí");
    expect(f.fala).toBe("Oi gente\nResponde aí");
    expect(f.mostrar).toBe("o set");
    expect(f.tela).toBe("legenda");
  });
  it("rótulos com e sem acento das outras partes", () => {
    const p = lerRoteiro("Mídia: foto do set\nTexto por cima: dia de gravação\nOpções: sim ou não");
    expect(p.b1).toBe("foto do set");
    expect(p.b2).toBe("dia de gravação\nsim ou não");
  });
  it("tipo pelo formato", () => {
    expect(tipoDoFormato("falado")).toBe("falado");
    expect(tipoDoFormato("enquete")).toBe("figurinha");
    expect(tipoDoFormato("dica-rapida")).toBe("midia");
    expect(tipoDoFormato("texto")).toBe("texto");
    expect(tipoDoFormato("antes-depois")).toBe("midia");
    expect(storyFalado("falado")).toBe(true);
    expect(formatoDoTipo("figurinha", "quiz")).toBe("quiz");
    expect(formatoDoTipo("falado", "enquete")).toBe("falado");
  });
  it("story da IA nos dois formatos", () => {
    const novo = storyDaIA({ tipo: "falado", titulo: "Bom dia", fala: "Bom dia!", tela: "meta", fechamento: "" });
    expect(novo.format).toBe("falado");
    expect(novo.script).toBe("Fala: Bom dia!\nNa tela: meta");
    const velho = storyDaIA({ titulo: "Enquete", formato: "enquete", roteiro: "Pergunte X" });
    expect(velho.tipo).toBe("figurinha");
    expect(velho.script).toBe("Pergunte X");
  });
});
