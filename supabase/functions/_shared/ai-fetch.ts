// Wrapper de fetch com timeout (AbortController) pra chamadas ao gateway de IA.
// Evita function travada esperando resposta que nunca vem. Estouro → AiTimeoutError (504).

export class AiTimeoutError extends Error {
  constructor() {
    super("ai_timeout");
    this.name = "AiTimeoutError";
  }
}

export async function aiFetch(url: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiTimeoutError();
    throw e;
  } finally {
    clearTimeout(t);
  }
}
