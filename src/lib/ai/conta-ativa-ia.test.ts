import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { callAIContextBuilder } from "@/lib/ai/claude";
import { definirContaAtiva } from "@/lib/conta-ativa";

describe("IA endereçada à conta aberta", () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { result: "ok" }, error: null }));

  it("manda accountId da conta ativa", async () => {
    definirContaAtiva("cliente-123");
    await callAIContextBuilder({ operation: "generate-caption", data: {} });
    expect(invoke.mock.calls[0][1].body.accountId).toBe("cliente-123");
  });

  it("sem conta ativa, não manda accountId", async () => {
    definirContaAtiva(null);
    await callAIContextBuilder({ operation: "generate-caption", data: {} });
    expect(invoke.mock.calls[0][1].body.accountId).toBeUndefined();
  });
});
