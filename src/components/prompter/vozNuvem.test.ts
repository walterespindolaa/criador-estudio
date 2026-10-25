import { describe, it, expect } from "vitest";
import { paraPcm16, palavrasDaMensagem, urlDeepgram } from "./vozNuvem";

describe("prompter: transcrição na nuvem", () => {
  it("converte 48 kHz float pra 16 kHz int16", () => {
    const f = new Float32Array(4800).fill(0.5);
    const p = paraPcm16(f, 48000);
    expect(p.length).toBe(1600);
    expect(p[0]).toBe(16383); // 0,5 × 32767, truncado pelo Int16Array
    expect(p[100]).toBeGreaterThan(16000);
    const neg = paraPcm16(new Float32Array(441).fill(-1), 44100);
    expect(neg.length).toBe(160);
    expect(neg[0]).toBe(-32768);
  });
  it("lê as palavras de um Results do Deepgram", () => {
    const msg = { type: "Results", is_final: true, channel: { alternatives: [{ transcript: "não importa em quem", words: [{ word: "não" }, { word: "importa" }, { word: "em" }, { word: "quem" }] }] } };
    expect(palavrasDaMensagem(msg)).toEqual({ palavras: ["não", "importa", "em", "quem"], final: true });
    expect(palavrasDaMensagem({ type: "Metadata" })).toBeNull();
  });
  it("pede nova-3 em pt-BR, PCM 16 kHz e resultados provisórios", () => {
    const u = new URL(urlDeepgram());
    expect(u.searchParams.get("model")).toBe("nova-3");
    expect(u.searchParams.get("language")).toBe("pt-BR");
    expect(u.searchParams.get("encoding")).toBe("linear16");
    expect(u.searchParams.get("sample_rate")).toBe("16000");
    expect(u.searchParams.get("interim_results")).toBe("true");
  });
});
