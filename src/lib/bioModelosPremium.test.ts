import { describe, expect, it } from "vitest";
import { escreverParcial, ehMarcador, numeroCurto, partirNumero } from "./bioMovimento";
import {
  fotoNossa, lerCupons, lerSocial, pdfDoKit, publicoDoKit, redesDaCapa, videosDaPagina, numerosDoKit, ORIGEM_STORAGE,
} from "./bioCriadora";
import { ancorasDaPagina, destinoDoBotao, destinoDoServico, lerServicos, precoLimpo, tituloComDestaque } from "./bioConsultoria";
import { MODELOS } from "./bioTemplates";
import { BLOCOS, BLOCOS_SITE } from "./bioBlocks";

describe("número que sobe", () => {
  it("separa o número do enfeite", () => {
    expect(partirNumero("+1.200 clientes")).toMatchObject({ antes: "+", valor: 1200, depois: " clientes", milhar: true });
    expect(partirNumero("18,4 mil")).toMatchObject({ valor: 18.4, casas: 1, depois: " mil" });
    expect(partirNumero("98%")).toMatchObject({ valor: 98, depois: "%" });
    expect(partirNumero("Itajaí")).toBeNull();
  });
  it("escreve o meio do caminho no mesmo formato", () => {
    const p = partirNumero("+1.200 clientes")!;
    expect(escreverParcial(p, 600)).toBe("+600 clientes");
    expect(escreverParcial(p, 1200)).toBe("+1.200 clientes");
    expect(escreverParcial(partirNumero("4,2%")!, 2.1)).toBe("2,1%");
  });
  it("número curto em português", () => {
    expect(numeroCurto(18432)).toBe("18,4 mil");
    expect(numeroCurto(1250000)).toBe("1,2 mi");
    expect(numeroCurto(123456)).toBe("123 mil");
    expect(numeroCurto(980)).toBe("980");
    expect(numeroCurto(null)).toBe("");
  });
  it("reconhece espaço reservado", () => {
    expect(ehMarcador("[00]")).toBe(true);
    expect(ehMarcador("00k")).toBe(true);
    expect(ehMarcador("R$ [preço]")).toBe(true);
    expect(ehMarcador("12 anos")).toBe(false);
  });
});

const thumb = (uid: string) => `${ORIGEM_STORAGE}ig-thumbs/${uid}/abc.jpg`;

describe("Instagram na página pública: segunda trava", () => {
  it("descarta miniatura de fora e link que não é do instagram.com", () => {
    const s = lerSocial({
      conectado: true, usuario: "bia.lemos", seguidores: 18432,
      videos: [
        { foto: thumb("u1"), link: "https://www.instagram.com/reel/ABCdef123/", video: true, views: 100 },
        { foto: "https://scontent.cdninstagram.com/x.jpg", link: "https://www.instagram.com/reel/ABCdef124/" },
        { foto: thumb("u1"), link: "https://evil.com/reel/ABCdef125/" },
        { foto: thumb("u1") + '" onerror="x', link: "https://www.instagram.com/p/ABCdef126/" },
        { foto: thumb("u1"), link: "javascript:alert(1)" },
      ],
      publico: [{ rotulo: "Mulheres", pct: 178 }, { rotulo: "", pct: 10 }],
    })!;
    expect(s.videos).toHaveLength(1);
    expect(s.publico).toEqual([{ rotulo: "Mulheres", pct: 100 }]);
  });
  it("usuário com caractere estranho não vira link", () => {
    expect(lerSocial({ conectado: true, usuario: "a/../b" })!.usuario).toBeNull();
  });
  it("sem conexão volta vazio, e lixo volta null", () => {
    expect(lerSocial({ conectado: false })!.conectado).toBe(false);
    expect(lerSocial("oi")).toBeNull();
    expect(lerSocial(null)).toBeNull();
  });
});

describe("criadora", () => {
  const social = lerSocial({ conectado: true, usuario: "bia", seguidores: 18432, publico: [{ rotulo: "Mulheres", pct: 78 }], engajamento: 4.2, alcance_30d: 86000 });
  it("Instagram automático usa o conectado; sem conexão cai pro digitado", () => {
    const d = { redes: [{ rede: "instagram", numero: "10 mil", auto: true }, { rede: "tiktok", numero: "" }, { rede: "youtube", numero: "[00]k" }] };
    expect(redesDaCapa(d, social)).toEqual([{ rede: "instagram", numero: "18,4 mil", rotulo: "no Instagram", href: "https://www.instagram.com/bia/" }]);
    expect(redesDaCapa(d, null)[0].numero).toBe("10 mil");
  });
  it("vídeo manual só com foto subida no nosso storage", () => {
    const d = { fonte: "manual", itens: [
      { foto: `${ORIGEM_STORAGE}bio-media/u1/a.jpg`, url: "https://www.tiktok.com/@bia/video/1" },
      { foto: "https://outro-site.com/a.jpg", url: "https://www.tiktok.com/@bia/video/2" },
    ] };
    expect(videosDaPagina(d, null)).toHaveLength(1);
    expect(fotoNossa(`${ORIGEM_STORAGE}ig-thumbs/u1/a.jpg`)).toBe("");
  });
  it("PDF só do nosso storage e terminando em .pdf", () => {
    expect(pdfDoKit(`${ORIGEM_STORAGE}bio-media/u1/midiakit-1.pdf`)).not.toBe("");
    expect(pdfDoKit("https://drive.google.com/x.pdf")).toBe("");
    expect(pdfDoKit(`${ORIGEM_STORAGE}bio-media/u1/a.html`)).toBe("");
  });
  it("público: automático quando há; senão o digitado, só porcentagem válida", () => {
    expect(publicoDoKit({ auto: true }, social).doInstagram).toBe(true);
    const manual = publicoDoKit({ auto: false, publico: [{ rotulo: "SC", pct: "40" }, { rotulo: "X", pct: "300" }, { rotulo: "Y", pct: "abc" }] }, social);
    expect(manual).toEqual({ barras: [{ rotulo: "SC", pct: 40 }], doInstagram: false });
    expect(numerosDoKit({ auto: true }, social)).toEqual([{ valor: "4,2%", rotulo: "engajamento médio" }, { valor: "86 mil", rotulo: "alcance em 30 dias" }]);
    expect(numerosDoKit({ auto: false, engajamento: "[0,0]%", alcance: "" }, social)).toEqual([]);
  });
  it("cupom: código sem espaço e em maiúscula; marcador cai fora", () => {
    expect(lerCupons({ itens: [{ codigo: " bia 10 " }, { codigo: "[CUPOM]" }] }).map((c) => c.codigo)).toEqual(["BIA10"]);
  });
});

describe("consultoria", () => {
  it("itálico só na palavra que existe no título", () => {
    expect(tituloComDestaque("Sua empresa sem depender de você", "você").filter((p) => p.marcado).map((p) => p.texto)).toEqual(["você"]);
    expect(tituloComDestaque("Título", "nada")).toEqual([{ texto: "Título", marcado: false }]);
  });
  it("preço sem R$ duplicado e sem marcador", () => {
    expect(precoLimpo("R$ 1.500")).toBe("1.500");
    expect(precoLimpo("[preço]")).toBe("");
  });
  it("o que inclui vira lista e serviço sem nome some", () => {
    const s = lerServicos({ itens: [{ nome: "A", inclui: "• um\n\n- dois" }, { nome: "" }] });
    expect(s).toHaveLength(1);
    expect(s[0].inclui).toEqual(["um", "dois"]);
  });
  it("botão do serviço: WhatsApp com o nome, senão a chamada, senão o rodapé", () => {
    expect(destinoDoServico("Diagnóstico", "47999990000", false)).toContain("wa.me/5547999990000");
    expect(destinoDoServico("Diagnóstico", "", true)).toBe("#agendar");
    expect(destinoDoServico("Diagnóstico", "", false)).toBe("#contato");
  });
  it("parte da página aceita só id limpo", () => {
    expect(destinoDoBotao({ destino: "secao", secao: "parceria" })).toBe("#parceria");
    expect(destinoDoBotao({ destino: "secao", secao: 'x" onclick="y' })).toBe("");
    expect(destinoDoBotao({ destino: "link", url: "javascript:alert(1)" })).toBe("");
    expect(destinoDoBotao({ destino: "whatsapp", telefone: "" }, "(47) 99999-0000")).toContain("wa.me/55479");
  });
  it("partes da página na ordem, sem repetir", () => {
    expect(ancorasDaPagina(["capa", "servicos", "produtos", "chamada", "contato"]).map((a) => a.id)).toEqual(["topo", "servicos", "agendar", "contato"]);
  });
});

describe("modelos", () => {
  const tipos = new Set([...BLOCOS, ...BLOCOS_SITE].map((b) => b.tipo));
  it("todo bloco de modelo existe no catálogo", () => {
    for (const m of MODELOS) for (const b of m.blocos) expect(tipos.has(b.kind), `${m.id}: ${b.kind}`).toBe(true);
  });
  it("o que vai pra página nunca leva endereço, foto ou número de exemplo", () => {
    for (const m of MODELOS.filter((x) => x.id === "site-consultoria" || x.id === "site-criadora")) {
      const j = JSON.stringify(m.blocos);
      expect(j, m.id).not.toMatch(/https?:\/\//);
      const textos: string[] = [];
      const juntar = (v: unknown) => { if (typeof v === "string") textos.push(v); else if (v && typeof v === "object") Object.values(v).forEach(juntar); };
      juntar(m.blocos);
      expect(textos.filter((t) => /\[[^\]]*\]/.test(t)), m.id).toEqual([]);
      expect(j, m.id).not.toMatch(/"(numero|valor|preco|seguidores)":"[^"]+"/);
    }
  });
  it("Criadora substitui Autoridade", () => {
    expect(MODELOS.some((m) => m.id === "site-autoridade")).toBe(false);
    expect(MODELOS.some((m) => m.id === "site-criadora")).toBe(true);
  });
});
