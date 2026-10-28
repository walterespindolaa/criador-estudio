import { describe, expect, it } from "vitest";
import { estadoDoStory, storyComFigurinha, storyFalado } from "./StoryAndamento";
import type { StoryPost, StorySlot } from "@/hooks/useStoryPlan";

const slot = (format: string, extra: Partial<StorySlot> = {}): StorySlot => ({
  id: "s", user_id: "u", slot_date: "2026-10-29", slot_time: "18:00:00", title: "T", script: "x", format,
  status: "pendente", sort_order: 0, source: "ia", created_at: "", post_id: "p", ...extra,
});
const post = (extra: Partial<StoryPost> = {}): StoryPost => ({
  id: "p", status: "roteiro", publish_status: null, publish_error: null, auto_publish: false, publicar_em: null,
  ig_media_id: null, ig_permalink: null, ig_opcoes: {}, deleted_at: null, title: "T", script: "x", midias: 0, numeros: null, ...extra,
});

describe("andamento do story", () => {
  it("classifica figurinha e falado", () => {
    expect(storyComFigurinha("caixinha_de_perguntas")).toBe(true);
    expect(storyFalado("talking_head")).toBe(true);
    expect(storyFalado("enquete")).toBe(false);
    expect(storyFalado("dica-rapida")).toBe(false);
  });
  it("falado sem vídeo pede gravar no Prompter", () => {
    expect(estadoDoStory(slot("bastidor"), post(), true)?.acao?.tipo).toBe("gravar");
  });
  it("com mídia e Instagram liberado pede agendar no horário", () => {
    const e = estadoDoStory(slot("dica-rapida"), post({ midias: 1 }), true);
    expect(e?.acao).toEqual({ tipo: "conferir", txt: "Agendar 18:00" });
  });
  it("figurinha vai pelo celular e nunca oferece agendar", () => {
    const e = estadoDoStory(slot("enquete"), post({ midias: 1, ig_opcoes: { pelo_celular: true } }), true);
    expect(e?.selo).toBe("Pelo celular");
    expect(e?.acao?.tipo).toBe("postei");
  });
  it("publicado mostra os números", () => {
    const e = estadoDoStory(slot("bastidor"), post({ status: "publicado", numeros: { views: 612, replies: 11 } }), true);
    expect(e?.selo).toBe("Saiu");
    expect(e?.numeros?.map((n) => n.v)).toEqual([612, 11]);
  });
  it("post na lixeira some", () => {
    expect(estadoDoStory(slot("bastidor"), post({ deleted_at: "2026-10-28" }), true)).toBeNull();
  });
});
