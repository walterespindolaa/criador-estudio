import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOURS, TRAINING_SEQUENCES } from "./registry";

/* TOUR DO PRESTADOR NÃO PODE APONTAR PRO NADA (27/11/2026). Se alguém tira
   ou renomeia um data-tour numa tela, o passo cai num cartão solto no meio da
   tela, sem destacar nada. Este teste confere que cada alvo dos tours do
   tour completo do prestador existe em algum componente. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    if (statSync(c).isDirectory()) return arquivos(c);
    return c.endsWith(".tsx") ? [c] : [];
  });
}

const fonte = arquivos(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n");

describe("tour do prestador", () => {
  const ids = [...TRAINING_SEQUENCES.parceiro, "parceiro-home"];

  it("todos os tours da sequência existem", () => {
    for (const id of ids) expect(TOURS.find((t) => t.id === id), id).toBeTruthy();
  });

  it("cada alvo tem um data-tour numa tela", () => {
    const faltando: string[] = [];
    for (const id of ids) {
      const t = TOURS.find((x) => x.id === id)!;
      for (const s of t.steps) {
        for (const sel of [s.target, s.mobileTarget, s.openFirst, s.mobileOpenFirst]) {
          const chave = sel && /data-tour="([^"]+)"/.exec(sel)?.[1];
          if (chave && !fonte.includes(`data-tour="${chave}"`)) faltando.push(`${id}: ${chave}`);
        }
      }
    }
    expect(faltando).toEqual([]);
  });

  it("a home do prestador tem o marcador que troca o tour do Início", () => {
    expect(fonte.includes("data-parceiro-home")).toBe(true);
    expect(fonte.includes("data-papel-definido")).toBe(true);
  });
});
