import { describe, expect, it } from "vitest";
import { ganchoDaLegenda, metricasNaJanela, passouDoInicio, rankingDeGanchos, seguidoresPorPost, type MidiaIg } from "./ganchos";

const reel = (id: string, posted_at: string, metrics: Record<string, unknown>, caption = "Gancho " + id): MidiaIg => ({
  id, media_type: "REELS", caption, thumbnail_url: null, permalink: null, posted_at, metrics,
});

describe("ganchos", () => {
  it("passou do início aceita % e fração", () => {
    expect(passouDoInicio({ reels_skip_rate: 34 })).toBe(66);
    expect(passouDoInicio({ reels_skip_rate: 0.25 })).toBe(75);
    expect(passouDoInicio({})).toBeNull();
  });

  it("gancho é a primeira frase da legenda sem hashtag", () => {
    expect(ganchoDaLegenda("3 mitos sobre clareamento. Salva esse post!\n#dente #sorriso")).toBe("3 mitos sobre clareamento.");
    expect(ganchoDaLegenda("#publi\nNinguém te conta isso #dica")).toBe("Ninguém te conta isso");
    expect(ganchoDaLegenda(null)).toBe("");
  });

  it("janela usa a foto e ignora quem não tem", () => {
    const a = reel("a", "2026-10-01T12:00:00Z", { views: 900, snap_24h: { views: 300, reels_skip_rate: 20 } });
    const b = reel("b", "2026-10-02T12:00:00Z", { views: 5000 });
    expect(metricasNaJanela(a, "24h")).toEqual({ views: 300, reels_skip_rate: 20 });
    expect(metricasNaJanela(b, "24h")).toBeNull();
    const r = rankingDeGanchos([a, b], "24h", "views");
    expect(r.semFoto).toBe(1);
    expect(r.linhas.map((l) => l.midia.id)).toEqual(["a"]);
    expect(r.linhas[0].passou).toBe(80);
  });

  it("ordena por quem passou do início", () => {
    const ms = [reel("x", "2026-10-01T12:00:00Z", { reels_skip_rate: 50, views: 10 }), reel("y", "2026-10-01T12:00:00Z", { reels_skip_rate: 10, views: 5 })];
    expect(rankingDeGanchos(ms, "total", "passou").linhas.map((l) => l.midia.id)).toEqual(["y", "x"]);
  });

  it("seguidores: real no feed, estimado no Reels acima do ritmo", () => {
    const diario = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]
      .map((date, i) => ({ date, followers: [100, 102, 104, 106, 126, 132, 134][i] }));
    const midias: MidiaIg[] = [
      reel("r1", "2026-10-05T15:00:00Z", {}),
      { id: "f1", media_type: "IMAGE", caption: "", thumbnail_url: null, permalink: null, posted_at: "2026-10-02T15:00:00Z", metrics: { follows: 3 } },
    ];
    const s = seguidoresPorPost(midias, diario);
    expect(s.get("f1")).toEqual({ valor: 3, estimado: false });
    // ritmo normal = 2/dia; dia 05: +20 (18 a mais), dia 06: +6 (4 a mais) → 22
    expect(s.get("r1")).toEqual({ valor: 22, estimado: true });
  });

  it("série curta não estima Reels", () => {
    const s = seguidoresPorPost([reel("r", "2026-10-05T15:00:00Z", {})], [{ date: "2026-10-05", followers: 1 }, { date: "2026-10-06", followers: 9 }]);
    expect(s.has("r")).toBe(false);
  });
});
