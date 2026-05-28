import { describe, it, expect } from "vitest";
import { validateUpload, UPLOAD_LIMITS, bytesToMB } from "./upload-validation";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(Math.min(sizeBytes, 1024))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("validateUpload", () => {
  it("aceita imagem válida dentro do limite (avatar)", () => {
    const file = makeFile("foto.jpg", "image/jpeg", 1 * 1024 * 1024);
    expect(validateUpload(file, "avatar")).toEqual({ ok: true });
  });

  it("rejeita arquivo vazio", () => {
    const file = makeFile("vazio.jpg", "image/jpeg", 0);
    const r = validateUpload(file, "avatar");
    expect(r.ok).toBe(false);
  });

  it("rejeita arquivo acima do limite de tamanho", () => {
    const file = makeFile("grande.jpg", "image/jpeg", 999 * 1024 * 1024);
    const r = validateUpload(file, "avatar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/máximo/i);
  });

  it("rejeita MIME type não permitido", () => {
    const file = makeFile("doc.pdf", "application/pdf", 1024);
    const r = validateUpload(file, "avatar");
    expect(r.ok).toBe(false);
  });

  it("rejeita extensão perigosa mesmo com MIME falsificado", () => {
    const file = makeFile("malicioso.html", "image/png", 1024);
    const r = validateUpload(file, "avatar");
    expect(r.ok).toBe(false);
  });

  it("rejeita SVG (vetor de XSS)", () => {
    const file = makeFile("icon.svg", "image/svg+xml", 1024);
    const r = validateUpload(file, "avatar");
    expect(r.ok).toBe(false);
  });

  it("aceita vídeo mp4 em postMedia mas não em avatar", () => {
    const video = makeFile("clip.mp4", "video/mp4", 10 * 1024 * 1024);
    expect(validateUpload(video, "postMedia")).toEqual({ ok: true });
    expect(validateUpload(video, "avatar").ok).toBe(false);
  });

  it("rejeita arquivo sem MIME type", () => {
    const file = makeFile("semtipo", "", 1024);
    const r = validateUpload(file, "file");
    expect(r.ok).toBe(false);
  });
});

describe("bytesToMB", () => {
  it("converte bytes pra MB com 1 casa decimal", () => {
    expect(bytesToMB(1024 * 1024)).toBe("1.0");
    expect(bytesToMB(5 * 1024 * 1024)).toBe("5.0");
  });
});

describe("UPLOAD_LIMITS", () => {
  it("avatar tem limite menor que postMedia", () => {
    expect(UPLOAD_LIMITS.avatar.maxBytes).toBeLessThan(UPLOAD_LIMITS.postMedia.maxBytes);
  });
  it("nenhum kind permite html/svg explicitamente nos MIMEs", () => {
    for (const kind of Object.keys(UPLOAD_LIMITS) as (keyof typeof UPLOAD_LIMITS)[]) {
      const mimes = UPLOAD_LIMITS[kind].allowedMimes as readonly string[];
      expect(mimes).not.toContain("text/html");
      expect(mimes).not.toContain("image/svg+xml");
    }
  });
});
