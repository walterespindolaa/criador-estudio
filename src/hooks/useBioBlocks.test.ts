import { describe, expect, it } from "vitest";
import { blocosDoModelo } from "./useBioBlocks";

const modelo = [
  { kind: "capa" as const, data: { titulo: "x" } },
  { kind: "contato" as const, data: { titulo: "", telefone: "", email: "", assinatura: "" } },
];
const atuais = [
  { kind: "contato", data: { titulo: "Forno da Vila", telefone: "(47) 99999-0000", email: "" }, is_active: true },
];

describe("aplicar modelo sem perder o Seu negócio", () => {
  it("trocar: o Contato novo herda o que já estava preenchido", () => {
    const r = blocosDoModelo(modelo, atuais, "trocar");
    expect(r.find((b) => b.kind === "contato")!.data).toMatchObject({ titulo: "Forno da Vila", telefone: "(47) 99999-0000" });
  });
  it("juntar: não cria um segundo Contato", () => {
    expect(blocosDoModelo(modelo, atuais, "juntar").map((b) => b.kind)).toEqual(["capa"]);
  });
  it("página sem Contato: entra o do modelo", () => {
    expect(blocosDoModelo(modelo, [], "juntar").map((b) => b.kind)).toEqual(["capa", "contato"]);
  });
});
