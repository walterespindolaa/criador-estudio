import { describe, it, expect } from "vitest";
import { proximasDatas } from "./datasComerciais";

describe("datas comerciais", () => {
  it("Black Friday 2026 é 27/11 e vem depois de Finados", () => {
    const l = proximasDatas(new Date(2026, 9, 28), 8);
    expect(l[0]).toMatchObject({ iso: "2026-10-31", nome: "Halloween", diasAte: 3 });
    expect(l.find((x) => x.nome === "Black Friday")?.iso).toBe("2026-11-27");
  });
  it("vira o ano", () => {
    const l = proximasDatas(new Date(2026, 11, 30), 3);
    expect(l.map((x) => x.nome)).toEqual(["Réveillon", "Ano Novo", "Carnaval"]);
    expect(l[2].iso).toBe("2027-02-09");
  });
});
