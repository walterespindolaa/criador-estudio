import { describe, expect, it } from "vitest";
import {
  capitulosDoRoteiro, categoriaDoNicho, contarTags, descricaoComCapitulos, duracaoYouTube,
  hashtagsDaDescricao, problemasDosCapitulos, segundosDe, separarTags,
} from "./youtube";

describe("tags do YouTube", () => {
  it("conta como a API: vírgula entre tags e aspas em tag com espaço", () => {
    expect(contarTags(["Foo-Baz"])).toBe(7);
    expect(contarTags(["Foo Baz"])).toBe(9);
    expect(contarTags(["a", "b c"])).toBe(1 + 1 + 5);
    expect(contarTags([])).toBe(0);
  });
  it("separa por vírgula, tira # e repetida", () => {
    expect(separarTags("#rotina, Rotina, criador de conteúdo\nvlog")).toEqual(["rotina", "criador de conteúdo", "vlog"]);
  });
});

describe("hashtags", () => {
  it("acha na ordem e ignora # no meio da palavra", () => {
    expect(hashtagsDaDescricao("Oi #um texto#dois\n#três #quatro")).toEqual(["#um", "#três", "#quatro"]);
  });
});

describe("capítulos", () => {
  const blocos = [
    { text: "Abertura", minuto: "0:00" },
    { text: "Passo 1", minuto: "01:10" },
    { text: "", minuto: "02:00" },
    { text: "Passo 2", minuto: "3:05" },
  ];
  it("sai do roteiro só com bloco que tem minuto e texto", () => {
    expect(capitulosDoRoteiro(blocos).map((c) => c.minuto)).toEqual(["00:00", "01:10", "03:05"]);
  });
  it("confere as regras do YouTube", () => {
    expect(problemasDosCapitulos(capitulosDoRoteiro(blocos))).toEqual([]);
    expect(problemasDosCapitulos(capitulosDoRoteiro([{ text: "a", minuto: "0:05" }, { text: "b", minuto: "0:30" }])))
      .toEqual(["O primeiro capítulo precisa começar em 00:00.", "O YouTube pede no mínimo 3 capítulos."]);
    expect(problemasDosCapitulos(capitulosDoRoteiro([
      { text: "a", minuto: "0:00" }, { text: "b", minuto: "0:05" }, { text: "c", minuto: "1:00" },
    ]))).toEqual(["Cada capítulo precisa de 10 segundos ou mais."]);
  });
  it("lê minuto", () => {
    expect(segundosDe("1:02:03")).toBe(3723);
    expect(segundosDe("1:75")).toBeNull();
    expect(segundosDe("abc")).toBeNull();
  });
  it("põe os capítulos antes das hashtags do fim e troca na segunda vez", () => {
    const caps = capitulosDoRoteiro(blocos);
    const uma = descricaoComCapitulos("Intro do vídeo.\n\n#um #dois", caps);
    expect(uma).toBe("Intro do vídeo.\n\nCapítulos\n00:00 Abertura\n01:10 Passo 1\n03:05 Passo 2\n\n#um #dois");
    const duas = descricaoComCapitulos(uma, caps.slice(0, 2));
    expect(duas).toBe("Intro do vídeo.\n\nCapítulos\n00:00 Abertura\n01:10 Passo 1\n\n#um #dois");
  });
});

describe("outros", () => {
  it("categoria pelo nicho", () => {
    expect(categoriaDoNicho("Educação financeira")).toBe("27");
    expect(categoriaDoNicho("Moda e beleza")).toBe("26");
    expect(categoriaDoNicho(null)).toBe("22");
  });
  it("duração no jeito do YouTube", () => {
    expect(duracaoYouTube(520)).toBe("8:40");
    expect(duracaoYouTube(3723)).toBe("1:02:03");
    expect(duracaoYouTube(0)).toBeNull();
  });
});
