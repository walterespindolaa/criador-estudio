import { describe, expect, it } from "vitest";
import { chaveDoPilar, compacto, numerosDoPost, pilaresRepetidos, porque, ranking, resumir, variacao, nomeDoMes } from "./historico";

const base = { id: "1", title: "t", format: "carrossel", platform: "instagram", pillar_id: null, published_at: "2026-11-04T22:00:00Z" };

describe("historico", () => {
  it("prefere o número do Instagram ao preenchido à mão", () => {
    const n = numerosDoPost({ ...base, result_reach: 10, result_saves: 2 }, { reach: 890, saved: 0, ig_reels_avg_watch_time: 9452 });
    expect(n.alcance).toBe(890);
    expect(n.salvos).toBe(0);
    expect(n.tempoMedio).toBe(9.5);
    expect(numerosDoPost({ ...base, result_reach: 10 }, null).alcance).toBe(10);
  });

  it("junta pilares com acento, caixa e barra diferentes", () => {
    expect(chaveDoPilar("Inteligencia Artificial / Sistemas")).toBe(chaveDoPilar("Inteligência Artificial e Sistemas"));
    expect(chaveDoPilar("Empresario")).toBe(chaveDoPilar("Empresário"));
    const g = pilaresRepetidos(
      [{ id: "a", name: "Empresario", position: 0 }, { id: "b", name: "Empresário", position: 1 }, { id: "c", name: "Vida Pessoal", position: 2 }],
      { a: 1, b: 1 },
    );
    expect(g).toHaveLength(1);
    expect(g[0].fica.id).toBe("b"); // empate em posts: fica o escrito com acento
    expect(g[0].saem.map((s) => s.id)).toEqual(["a"]);
  });

  it("ranking, média e porquê", () => {
    const l = [100, 120, 900].map((r, i) => ({ id: String(i), n: numerosDoPost({ ...base, id: String(i) }, { reach: r, saved: 1 }) }));
    expect(ranking(l, "alcance")[0].id).toBe("2");
    expect(porque(l[2], "alcance", l)).toMatch(/x a sua média de alcance/);
    const r = resumir(l);
    expect(r.alcanceSoma).toBe(1120);
    expect(r.alcanceMedio).toBe(373);
  });

  it("formata", () => {
    expect(variacao(131, 100)).toBe(31);
    expect(variacao(5, 0)).toBeNull();
    expect(compacto(24100)).toBe("24,1 mil");
    expect(compacto(1340)).toBe("1.340");
    expect(nomeDoMes("2026-11")).toBe("novembro de 2026");
  });
});
