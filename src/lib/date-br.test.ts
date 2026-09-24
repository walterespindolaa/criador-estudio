import { describe, it, expect } from "vitest";
import { toISODateBR, parseDateOnly } from "./date-br";

// O bug de fuso: 23h em Brasília é "amanhã" em UTC. Tudo que diz "hoje"
// precisa olhar pro Brasil.
describe("datas no fuso do Brasil", () => {
  it("23h30 de Brasília ainda é o mesmo dia", () => {
    // 2026-03-10 23:30 em Brasília = 2026-03-11 02:30 UTC
    expect(toISODateBR(new Date("2026-03-11T02:30:00Z"))).toBe("2026-03-10");
  });
  it("meia-noite UTC do dia 1 ainda é dia anterior no Brasil (vira o mês)", () => {
    expect(toISODateBR(new Date("2026-04-01T01:00:00Z"))).toBe("2026-03-31");
  });
  it("parseDateOnly não tem off-by-one", () => {
    const d = parseDateOnly("2026-03-01");
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(2);
  });
});
