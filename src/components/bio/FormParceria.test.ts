import { describe, expect, it } from "vitest";
import { erroDaParceria, LIMITE_MENSAGEM } from "./FormParceria";

const base = { nome: "Ana", empresa: "", email: "ana@marca.com", telefone: "", mensagem: "Quero um Reels" };

describe("erroDaParceria", () => {
  it("aceita o preenchimento mínimo", () => {
    expect(erroDaParceria(base, true)).toBeNull();
    expect(erroDaParceria({ ...base, email: "", telefone: "(47) 99999-0000" }, true)).toBeNull();
  });
  it("exige nome, um contato, mensagem e consentimento", () => {
    expect(erroDaParceria({ ...base, nome: " " }, true)).toMatch(/nome/);
    expect(erroDaParceria({ ...base, email: "", telefone: "" }, true)).toMatch(/e-mail ou um WhatsApp/);
    expect(erroDaParceria({ ...base, mensagem: "" }, true)).toMatch(/Conte/);
    expect(erroDaParceria(base, false)).toMatch(/consentimento/);
  });
  it("barra contato que ninguém consegue usar", () => {
    expect(erroDaParceria({ ...base, email: "ana@" }, true)).toMatch(/incompleto/);
    expect(erroDaParceria({ ...base, email: "", telefone: "9999" }, true)).toMatch(/DDD/);
  });
  it("barra mensagem acima do limite", () => {
    expect(erroDaParceria({ ...base, mensagem: "x".repeat(LIMITE_MENSAGEM + 1) }, true)).toMatch(/passou/);
  });
});
