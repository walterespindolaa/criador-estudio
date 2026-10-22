import { describe, it, expect } from "vitest";
import { lerRotaBio, montarPreviaBio, arteDaBio, imagemDoDono, previaNeutra, resumoDaSemana, fontesDaArte, STORAGE_PUBLICO, type DadosPreviaBio, type PreviaBio } from "./previa-bio";
import { TEXTOS_DE_EXEMPLO } from "./textosExemplo";
import { textosDeExemplo } from "./bioStatus";
import { MODELOS } from "./bioTemplates";

const DONO = "11111111-2222-4333-8444-555555555555";
const OUTRO = "99999999-8888-4777-8666-555555555555";
const foto = (dono: string, arq = "capa.jpg") => `${STORAGE_PUBLICO}bio-media/${dono}/${arq}`;
const site = (blocos: { kind: string; data: Record<string, unknown> }[], extra: Partial<NonNullable<DadosPreviaBio>> = {}): DadosPreviaBio => ({
  slug: "nome", origem: "perfil", dono: DONO, nome: "Perfil", bio: null, avatar: null,
  ajustes: { layout: "vitrine", buttonColor: "#1F4D3A", buttonTextColor: "#FFFFFF", header: {} }, blocos, ...extra,
});
const texto = (a: unknown) => JSON.stringify(a);

describe("rota da bio", () => {
  it("domínio curto e /bio/", () => {
    expect(lerRotaBio("/criasocialclub")).toBe("criasocialclub");
    expect(lerRotaBio("/bio/CriaSocialClub/")).toBe("criasocialclub");
    expect(lerRotaBio("/gabi.kwk")).toBe("gabi.kwk");
  });
  it("rotas do app e arquivos não são bio", () => {
    for (const r of ["/", "/app", "/login", "/socialmidia", "/favicon.ico", "/logo.png", "/aprovar/abc", "/nome/p/produto", "/a", "/%E0%A4%A", "/<script>"]) {
      expect(lerRotaBio(r), r).toBeNull();
    }
  });
});

describe("travas contra uma página aparecer com coisa de outra", () => {
  it("o slug devolvido pelo banco tem que ser o pedido", () => {
    expect(montarPreviaBio(site([]), "nome")).not.toBeNull();
    expect(montarPreviaBio(site([]), "outro")).toBeNull();
    expect(montarPreviaBio({ ...site([])!, slug: null }, "nome")).toBeNull();
    expect(montarPreviaBio({ ...site([])!, dono: "x" }, "nome")).toBeNull();
    expect(montarPreviaBio(null, "nome")).toBeNull();
  });
  it("foto só do nosso storage, na pasta do dono", () => {
    expect(imagemDoDono(foto(DONO), DONO)).toBe(foto(DONO));
    expect(imagemDoDono(`${STORAGE_PUBLICO}avatars/${DONO}/a.png`, DONO)).not.toBeNull();
    expect(imagemDoDono(foto(OUTRO), DONO)).toBeNull();
    expect(imagemDoDono(`${STORAGE_PUBLICO}bio-media/${DONO}/../${OUTRO}/a.jpg`, DONO)).toBeNull();
    expect(imagemDoDono(`${STORAGE_PUBLICO}ig-thumbs/${DONO}/a.jpg`, DONO)).toBeNull();
    expect(imagemDoDono(`https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/sign/crm/${DONO}/a.jpg?token=x`, DONO)).toBeNull();
    expect(imagemDoDono("https://outro-site.com/a.jpg", DONO)).toBeNull();
    expect(imagemDoDono(`${foto(DONO)}" onerror="x`, DONO)).toBeNull();
    expect(imagemDoDono(foto(DONO), "nao-e-uuid")).toBeNull();
  });
  it("capa com foto de outra conta cai na arte neutra, sem foto", () => {
    const p = montarPreviaBio(site([{ kind: "capa", data: { layout: "foto_cheia", titulo: "Forno", imagem: foto(OUTRO) } }]), "nome")!;
    expect(p.modelo).toBe("neutra");
    expect(texto(p)).not.toContain(OUTRO);
    expect(texto(arteDaBio(p))).not.toContain(OUTRO);
  });
  it("item do cardápio com foto de outra conta fica fora da arte", () => {
    const p = montarPreviaBio(site([
      { kind: "capa", data: { layout: "foto_cheia", titulo: "Forno da Vila", imagem: foto(DONO) } },
      { kind: "cardapio", data: { itens: [{ nome: "Pão", preco: 24, foto: foto(DONO, "pao.jpg") }, { nome: "Bolo", preco: 9, foto: foto(OUTRO, "bolo.jpg") }] } },
    ]), "nome")!;
    expect(p.modelo).toBe("loja");
    expect(texto(arteDaBio(p))).not.toContain(OUTRO);
    expect(p.modelo === "loja" && p.itens.map((i) => i.nome)).toEqual(["Pão"]);
  });
  it("a arte só leva dados da própria página: duas páginas, nada cruza", () => {
    const a = montarPreviaBio(site([{ kind: "capa", data: { layout: "foto_cheia", titulo: "Loja A", imagem: foto(DONO) } }]), "nome")!;
    const b = montarPreviaBio({ ...site([{ kind: "capa", data: { layout: "foto_cheia", titulo: "Loja B", imagem: foto(OUTRO) } }])!, slug: "outra", dono: OUTRO }, "outra")!;
    const ja = texto(arteDaBio(a)), jb = texto(arteDaBio(b));
    expect(ja).toContain("criaclub.bio/nome"); expect(ja).not.toContain("outra"); expect(ja).not.toContain(OUTRO); expect(ja).not.toContain("Loja B");
    expect(jb).toContain("criaclub.bio/outra"); expect(jb).not.toContain(DONO); expect(jb).not.toContain("Loja A");
  });
  it("marcador e texto de exemplo nunca vão pra arte", () => {
    const capa = MODELOS.find((m) => m.id === "site-consultoria")!.blocos[0].data;
    const p = montarPreviaBio(site([{ kind: "capa", data: { ...capa, imagem: foto(DONO) } }]), "nome")!;
    expect(p.modelo).toBe("neutra");
    const j = texto(arteDaBio(p));
    for (const t of TEXTOS_DE_EXEMPLO) expect(j).not.toContain(t);
    const c = montarPreviaBio(site([{ kind: "perfil_criadora", data: { foto: foto(DONO), nome: "Bia", redes: [{ rede: "tiktok", numero: "[00]k" }, { rede: "youtube", numero: "00k" }] } }]), "nome")!;
    expect(c.modelo === "criadora" && c.redes).toEqual([]);
    expect(texto(arteDaBio(c))).not.toMatch(/\[\d*\]|00k/);
  });
  it("a lista de exemplos da borda está igual à dos modelos", () => {
    expect([...TEXTOS_DE_EXEMPLO].sort()).toEqual([...textosDeExemplo()].sort());
  });
});

describe("arte de cada modelo", () => {
  it("especialista: vídeo vira pôster do Bunny montado aqui; números de prova", () => {
    const guid = "0b6f2c4a-1d2e-4f3a-8b9c-0d1e2f3a4b5c";
    const p = montarPreviaBio(site([
      { kind: "apresentacao", data: { midia: "video", video_guid: guid, nome: "Lívia Moraes", profissao: "Nutrição esportiva", assinatura: { modo: "fonte", fonte: "allura" } } },
      { kind: "numeros", data: { itens: [{ valor: "12", rotulo: "anos" }, { valor: "[800]", rotulo: "pacientes" }] } },
    ]), "nome")!;
    expect(p.modelo).toBe("especialista");
    if (p.modelo !== "especialista") return;
    expect(p.foto).toBe(`https://vz-86788381-03e.b-cdn.net/${guid}/thumbnail.jpg`);
    expect(p.numeros).toEqual([{ valor: "12", rotulo: "anos" }]);
    expect(fontesDaArte(p).map((f) => f.arquivo)).toContain("assin-allura.woff");
  });
  it("especialista com traço desenhado aceita só M, L e números", () => {
    const base = { midia: "imagem", imagem: foto(DONO), nome: "Ana" };
    const ok = montarPreviaBio(site([{ kind: "apresentacao", data: { ...base, assinatura: { modo: "desenho", d: "M 1 2 L 3 4" } } }]), "nome")!;
    expect(ok.modelo === "especialista" && ok.assinatura.modo).toBe("desenho");
    const ruim = montarPreviaBio(site([{ kind: "apresentacao", data: { ...base, assinatura: { modo: "desenho", d: 'M1 2"/><script>' } } }]), "nome")!;
    expect(ruim.modelo === "especialista" && ruim.assinatura.modo).toBe("fonte");
  });
  it("consultoria: manchete com a palavra em destaque", () => {
    const p = montarPreviaBio(site([
      { kind: "capa", data: { layout: "editorial", titulo: "Sua empresa rodando sem depender de você", destaque: "você", etiqueta: "Consultoria · Itajaí", imagem: foto(DONO) } },
    ]), "nome")!;
    expect(p.modelo).toBe("consultoria");
    expect(texto(arteDaBio(p))).toContain('"fontStyle":"italic"');
    expect(fontesDaArte(p).some((f) => f.italico)).toBe(true);
  });
  it("criadora: seguidores do Instagram conectado só com o automático ligado", () => {
    const d = (auto: boolean) => site([{ kind: "perfil_criadora", data: { foto: foto(DONO), nome: "Bia", redes: [{ rede: "instagram", auto, numero: "10 mil" }] } }], { seguidores: 18432 });
    const a = montarPreviaBio(d(true), "nome")!, m = montarPreviaBio(d(false), "nome")!;
    expect(a.modelo === "criadora" && a.redes[0].numero).toBe("18,4 mil");
    expect(m.modelo === "criadora" && m.redes[0].numero).toBe("10 mil");
  });
  it("sem foto em nada: neutra com a inicial", () => {
    const p = montarPreviaBio(site([{ kind: "contato", data: { titulo: "Forno da Vila" } }]), "nome")!;
    expect(p.modelo).toBe("neutra");
    expect(p.nome).toBe("Forno da Vila");
    expect(texto(arteDaBio(p))).not.toContain('"img"');
  });
  it("plano B sempre desenha sem imagem", () => {
    const p = montarPreviaBio(site([{ kind: "capa", data: { layout: "foto_cheia", titulo: "Loja", imagem: foto(DONO) } }]), "nome")!;
    expect(texto(arteDaBio(previaNeutra(p)))).not.toContain('"img"');
    expect(texto(arteDaBio(p, { semImagens: true }))).not.toContain('"img"');
  });
  it("cor clara demais vira fundo escuro na neutra", () => {
    const p = montarPreviaBio({ ...site([])!, ajustes: { layout: "vitrine", buttonColor: "#FFF6EA" } }, "nome")!;
    expect(texto(arteDaBio(p))).toContain("#17140F");
  });
});

describe("horário da semana na arte da loja", () => {
  const dia = (aberto: boolean, abre = "07:00", fecha = "19:00") => ({ aberto, abre, fecha });
  it("dias seguidos com o mesmo horário", () => {
    expect(resumoDaSemana({ dias: [dia(false), dia(true), dia(true), dia(true), dia(true), dia(true), dia(true)] })).toBe("Seg a Sáb · 7h às 19h");
    expect(resumoDaSemana({ dias: Array(7).fill(dia(true, "08:30", "18:00")) })).toBe("Todos os dias · 8h30 às 18h");
  });
  it("horários diferentes: nada (melhor nada que meia verdade)", () => {
    expect(resumoDaSemana({ dias: [dia(false), dia(true), dia(true), dia(true), dia(true), dia(true), dia(true, "07:30", "13:00")] })).toBeNull();
  });
});

describe("formato Clássico", () => {
  const classico = (header: Record<string, unknown>, extra: Partial<NonNullable<DadosPreviaBio>> = {}): DadosPreviaBio => ({
    slug: "nome", origem: "perfil", dono: DONO, nome: "Perfil", bio: "bio do perfil", avatar: `${STORAGE_PUBLICO}avatars/${DONO}/a.png`,
    ajustes: { layout: "classic", header, bannerImage: foto(DONO, "b.png"), buttonColor: "#CE4A1D", buttonTextColor: "#FFF6EA" }, ...extra,
  });
  it("topo da bio vale mais que o perfil", () => {
    const p = montarPreviaBio(classico({ name: "Cria Social Club", bio: "O estúdio de quem cria conteúdo.", avatar: foto(DONO, "h.jpg") }), "nome") as Extract<PreviaBio, { modelo: "classica" }>;
    expect(p.modelo).toBe("classica");
    expect(p.titulo).toBe("Cria Social Club");
    expect(p.descricao).toBe("O estúdio de quem cria conteúdo.");
    expect(p.avatar).toBe(foto(DONO, "h.jpg"));
    expect(p.banner).toBe(foto(DONO, "b.png"));
    expect(p.endereco).toBe("criaclub.bio/nome");
    expect(p.cor).toBe("#CE4A1D");
  });
  it("foto de fora (Google, link assinado) não entra; HTML sai da bio", () => {
    const p = montarPreviaBio(classico({ bio: `<b>oi</b> ${"a".repeat(200)}`, avatar: "https://lh3.googleusercontent.com/x.jpg" }, { avatar: "https://lh3.googleusercontent.com/y.jpg" }), "nome") as Extract<PreviaBio, { modelo: "classica" }>;
    expect(p.avatar).toBeNull();
    expect(p.descricao.startsWith("oi a")).toBe(true);
    expect(p.descricao.length).toBeLessThanOrEqual(110);
  });
});
