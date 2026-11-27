import { describe, expect, it } from "vitest";
import { numeroDuranteArraste } from "./CriaPostMedia";

// Simula a tira e confere que os números viram exatamente a ordem final.
function numeros(n: number, arraste: { de: number; para: number } | null) {
  return Array.from({ length: n }, (_, i) => numeroDuranteArraste(i, arraste));
}
function ordemFinal(n: number, de: number, para: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  const [m] = a.splice(de, 1);
  a.splice(para, 0, m);
  // número de cada item (pela posição original) depois de soltar
  const r: number[] = [];
  a.forEach((orig, pos) => { r[orig] = pos + 1; });
  return r;
}

describe("número da miniatura durante o arraste", () => {
  it("sem arraste é a posição normal", () => {
    expect(numeros(4, null)).toEqual([1, 2, 3, 4]);
  });
  it("bate com a ordem depois de soltar, pra qualquer origem e destino", () => {
    for (let de = 0; de < 10; de++) {
      for (let para = 0; para < 10; para++) {
        expect(numeros(10, { de, para })).toEqual(ordemFinal(10, de, para));
      }
    }
  });
});
