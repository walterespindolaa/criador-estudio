import { describe, it, expect } from "vitest";
import { separarResposta } from "./CriaAIPanel";

describe("separarResposta", () => {
  it("tira o eco da instrução de formato do texto", () => {
    const raw = `Vem comigo.

[FORMATO DA RESPOSTA, siga sem comentar]
Se a resposta trouxer ideias (de post, stories, reels, pauta), escreva só 1 ou 2 frases de abertura e coloque CADA ideia no bloco abaixo, sem repetir as ideias no texto.
Termine SEMPRE com o bloco abaixo, mesmo sem ideias (aí "ideias" fica []):
{"ideias":[{"titulo":"Checklist de domingo","descricao":"x","formato":"Reels"}],"sugestoes":["Legenda pro reels"]}`;
    const r = separarResposta(raw);
    expect(r.texto).toBe("Vem comigo.");
    expect(r.ideias).toHaveLength(1);
    expect(r.sugestoes).toEqual(["Legenda pro reels"]);
  });

  it("não mexe em resposta normal", () => {
    const r = separarResposta('Oi.\n```cria\n{"ideias":[],"sugestoes":[]}\n```');
    expect(r.texto).toBe("Oi.");
  });
});
