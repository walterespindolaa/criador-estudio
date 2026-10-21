import { describe, expect, it } from "vitest";
import {
  FONTES_ASSINATURA, NICHOS, fonteAssinatura, guidValido, lerAssinatura, tracoValido, tracosParaD, videoDaCapa,
} from "@/lib/bioEspecialista";
import { faltaNoBloco, metaDoBloco, resumoDoBloco } from "@/lib/bioBlocks";

describe("assinatura", () => {
  it("tem 5 fontes e cai na primeira quando a salva não existe", () => {
    expect(FONTES_ASSINATURA).toHaveLength(5);
    expect(fonteAssinatura("nao-existe").id).toBe("delafield");
    expect(fonteAssinatura("allura").familia).toBe("Allura");
  });

  it("lê qualquer coisa do banco sem quebrar e limita posição e tamanho", () => {
    expect(lerAssinatura(null)).toMatchObject({ modo: "fonte", x: 6, y: 62, escala: 70 });
    const a = lerAssinatura({ modo: "desenho", x: 500, y: -3, escala: 5, d: "M1 2 L3 4" });
    expect(a).toMatchObject({ modo: "desenho", x: 90, y: 0, escala: 25, d: "M1 2 L3 4" });
    expect(lerAssinatura({ modo: "qualquer" }).modo).toBe("fonte");
  });

  it("joga fora traço com qualquer coisa além de M, L e números", () => {
    expect(tracoValido("M1 2 L3 4")).toBe("M1 2 L3 4");
    expect(tracoValido('M1 2"/><script>')).toBe("");
    expect(tracoValido(42)).toBe("");
  });

  it("transforma os traços num d só, sem repetir ponto parado", () => {
    const d = tracosParaD([[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 10, y: 0 }], [{ x: 5, y: 5 }]]);
    expect(d).toBe("M0.0 0.0 L10.0 0.0 M5.0 5.0 L5.0 5.0");
    expect(tracoValido(d)).toBe(d);
    expect(tracosParaD([])).toBe("");
  });
});

describe("vídeo da capa", () => {
  it("só aceita guid do Bunny e monta MP4 do maior pro menor", () => {
    expect(guidValido("javascript:alert(1)")).toBe("");
    expect(videoDaCapa("")).toBeNull();
    const v = videoDaCapa("510b2d9e-f289-4e64-8183-722968cc6df8")!;
    expect(v.fontes[0]).toMatch(/\/510b2d9e-f289-4e64-8183-722968cc6df8\/play_720p\.mp4$/);
    expect(v.fontes).toHaveLength(3);
    expect(v.poster).toMatch(/thumbnail\.jpg$/);
  });
});

describe("blocos novos", () => {
  it("existem no catálogo do Site", () => {
    for (const k of ["apresentacao", "numeros", "acao_fixa"]) expect(metaDoBloco(k).tipo).toBe(k);
  });

  it("dizem o que falta", () => {
    expect(faltaNoBloco({ kind: "apresentacao", data: { midia: "video" } })).toBe("falta o vídeo");
    expect(faltaNoBloco({ kind: "apresentacao", data: { midia: "imagem", imagem: "x.jpg" } })).toBeNull();
    expect(faltaNoBloco({ kind: "numeros", data: { itens: [{ valor: "" }] } })).toBe("nenhum número");
    expect(faltaNoBloco({ kind: "acao_fixa", data: { texto: "Agendar", destino: "whatsapp", telefone: "47 99999-0000" } })).toBeNull();
    expect(faltaNoBloco({ kind: "acao_fixa", data: { texto: "Agendar", destino: "link", url: "javascript:alert(1)" } })).toBe("falta o endereço");
    expect(resumoDoBloco({ kind: "numeros", data: { itens: [{ valor: "12" }, { valor: "3 mil+" }] } })).toBe("12 · 3 mil+");
  });

  it("todo nicho tem botão e números de exemplo entre colchetes", () => {
    for (const n of NICHOS) {
      expect(n.cta.length).toBeGreaterThan(3);
      expect(n.numeros.length).toBe(3);
    }
    // OAB: nada de quantidade de causas no exemplo.
    const adv = NICHOS.find((n) => n.id === "advocacia")!;
    expect(adv.numeros.map((x) => x.rotulo).join(" ")).not.toMatch(/caus|caso/);
  });
});
