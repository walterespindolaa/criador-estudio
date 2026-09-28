import { describe, expect, it } from "vitest";
import { computeCrossAnalysis, crossHeadlines, formatMediaLabel, interacoesDe, type CrossItem } from "./insightsUtils";
import { bestTimesFromMedia } from "@/lib/bestTimes";
import { totaisConta30d, type DailyMetric } from "@/hooks/useSocialInsights";

// Ciclo 3 dos dados do Instagram: a análise só afirma com base.
const diasAtras = (d: number, hora = 12) => {
  const x = new Date(Date.now() - d * 86400000);
  x.setUTCHours(hora + 3, 0, 0, 0); // hora de Brasília
  return x.toISOString();
};
const item = (tipo: string, reach: number, dias: number, extra: Partial<CrossItem> = {}): CrossItem =>
  ({ media_type: tipo, posted_at: diasAtras(dias), reach, interactions: Math.round(reach / 10), ...extra });

describe("análise honesta", () => {
  it("Reels e VIDEO viram o mesmo formato", () => {
    expect(formatMediaLabel("VIDEO")).toBe("Reels");
    expect(formatMediaLabel("REELS")).toBe("Reels");
  });

  it("interações: usa o total da Meta, senão soma", () => {
    expect(interacoesDe({ total_interactions: 50, likes: 10 })).toBe(50);
    expect(interacoesDe({ likes: 10, comments: 2, saved: 3, shares: 1 })).toBe(16);
  });

  it("post com menos de 3 dias fica fora", () => {
    const r = computeCrossAnalysis([item("REELS", 1000, 1), item("REELS", 500, 10)]);
    expect(r.analisados).toBe(1);
    expect(r.recentesFora).toBe(1);
  });

  it("um post só não vira 'melhor formato'", () => {
    const r = computeCrossAnalysis([item("REELS", 9000, 10), item("IMAGE", 100, 10), item("IMAGE", 120, 11)]);
    expect(crossHeadlines(r).some((h) => h.includes("Reels alcançam"))).toBe(false);
  });

  it("com amostra, afirma o formato mais forte", () => {
    const lista = [
      ...[5, 6, 7].map((d) => item("REELS", 3000, d)),
      ...[8, 9, 10].map((d) => item("IMAGE", 1000, d)),
    ];
    const r = computeCrossAnalysis(lista);
    expect(crossHeadlines(r)[0]).toContain("Reels alcançam 3x mais que Fotos");
  });

  it("um viral isolado não muda o alcance típico", () => {
    const r = computeCrossAnalysis([item("REELS", 100, 5), item("REELS", 110, 6), item("REELS", 50000, 7)]);
    expect(r.byFormat[0].avgReach).toBe(110);
  });

  it("gancho agrupa pelo começo", () => {
    const r = computeCrossAnalysis([
      item("REELS", 100, 5, { hook: "3 erros que travam seu crescimento" }),
      item("REELS", 100, 6, { hook: "3 erros que travam sua agenda" }),
    ]);
    expect(r.byHook[0].count).toBe(2);
  });
});

describe("melhor horário real", () => {
  it("hora com 1 post só não entra no ranking", () => {
    const media = [
      ...[4, 5, 6, 7, 8].map((d) => ({ posted_at: diasAtras(d, 19), metrics: { total_interactions: 100 } })),
      { posted_at: diasAtras(9, 7), metrics: { total_interactions: 5000 } },
    ];
    const r = bestTimesFromMedia(media);
    expect(r?.slots).toEqual(["19:00"]);
  });
});

describe("totais de conta 30 dias", () => {
  it("usa o total da Meta quando existe (não soma dias)", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const daily = [
      { date: hoje, followers: 1, reach: 1, impressions: null, profile_views: 10, website_clicks: null, accounts_engaged: null, total_interactions: null, metrics: { profile_views_30d: 300 } },
    ] as DailyMetric[];
    expect(totaisConta30d(daily).profileViews).toBe(300);
  });
});
