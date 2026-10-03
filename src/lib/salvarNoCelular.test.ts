import { describe, expect, it } from "vitest";
import { ehVideoDoBunny, emLotes, tipoReal, vaiJunto } from "./salvarNoCelular";

// O proxy devolve octet-stream: o tipo certo sai dos primeiros bytes. Sem isso o
// iPhone não oferece "Salvar imagem" e a página de aviso do Drive virava "foto".
const blob = (bytes: number[] | string) =>
  new Blob([typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)]);
const com = (cabeca: number[]) => blob([...cabeca, ...new Array(16).fill(0)]);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe("tipoReal", () => {
  it("reconhece as fotos", async () => {
    expect(await tipoReal(com([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(await tipoReal(com([0x89, ...ascii("PNG")]))).toEqual({ mime: "image/png", ext: "png" });
    expect(await tipoReal(com([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toEqual({ mime: "image/webp", ext: "webp" });
    expect(await tipoReal(com([0, 0, 0, 24, ...ascii("ftypheic")]))).toEqual({ mime: "image/heic", ext: "heic" });
  });
  it("reconhece os vídeos", async () => {
    expect(await tipoReal(com([0, 0, 0, 24, ...ascii("ftypisom")]))).toEqual({ mime: "video/mp4", ext: "mp4" });
    expect(await tipoReal(com([0, 0, 0, 20, ...ascii("ftypqt  ")]))).toEqual({ mime: "video/quicktime", ext: "mov" });
  });
  it("recusa página HTML (aviso do Drive) e arquivo vazio", async () => {
    expect(await tipoReal(blob("<!DOCTYPE html><html><head>"))).toBeNull();
    expect(await tipoReal(blob([]))).toBeNull();
  });
});

describe("ehVideoDoBunny", () => {
  it("separa o vídeo do Bunny Stream do resto", () => {
    expect(ehVideoDoBunny({ bunny_video_id: "abc" })).toBe(true);
    expect(ehVideoDoBunny({ provider: "bunny_stream" })).toBe(true);
    expect(ehVideoDoBunny({ provider: "gdrive", file_type: "video/mp4" })).toBe(false);
    expect(ehVideoDoBunny({ provider: "bunny_storage", file_type: "image/jpeg" })).toBe(false);
  });
});

describe("vaiJunto", () => {
  const driveLink = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";
  it("vídeo que veio do Drive vai junto, mesmo depois de ir pro Bunny", () => {
    expect(vaiJunto({ provider: "bunny_stream", bunny_video_id: "g", download_url: driveLink })).toBe(true);
  });
  it("vídeo subido direto no Bunny fica à parte", () => {
    expect(vaiJunto({ provider: "bunny_stream", bunny_video_id: "g", download_url: null })).toBe(false);
  });
  it("foto vai sempre", () => {
    expect(vaiJunto({ provider: "bunny_storage", file_type: "image/jpeg", download_url: "https://x.b-cdn.net/a.jpg" })).toBe(true);
  });
});

describe("emLotes", () => {
  it("faz tudo, sem passar do limite ao mesmo tempo", async () => {
    let agora = 0, pico = 0;
    const feitos: number[] = [];
    await emLotes([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      agora++; pico = Math.max(pico, agora);
      await new Promise((r) => setTimeout(r, 5));
      feitos.push(n); agora--;
    });
    expect(feitos.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pico).toBeLessThanOrEqual(3);
  });
});
