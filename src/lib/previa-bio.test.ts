import { describe, it, expect } from "vitest";
import { lerRotaBio, montarPreviaBio, arteDaBio } from "./previa-bio";

describe("rota da bio", () => {
  it("domínio curto e /bio/", () => {
    expect(lerRotaBio("/criasocialclub")).toBe("criasocialclub");
    expect(lerRotaBio("/bio/CriaSocialClub/")).toBe("criasocialclub");
    expect(lerRotaBio("/gabi.kwk")).toBe("gabi.kwk");
  });
  it("rotas do app e arquivos não são bio", () => {
    expect(lerRotaBio("/")).toBeNull();
    expect(lerRotaBio("/app")).toBeNull();
    expect(lerRotaBio("/login")).toBeNull();
    expect(lerRotaBio("/socialmidia")).toBeNull();
    expect(lerRotaBio("/favicon.ico")).toBeNull();
    expect(lerRotaBio("/logo.png")).toBeNull();
    expect(lerRotaBio("/aprovar/abc")).toBeNull();
    expect(lerRotaBio("/nome/p/produto")).toBeNull();
    expect(lerRotaBio("/a")).toBeNull();
    expect(lerRotaBio("/%E0%A4%A")).toBeNull();
    expect(lerRotaBio("/<script>")).toBeNull();
  });
});

describe("textos da prévia da bio", () => {
  const base = {
    name: "Perfil", bio: "bio do perfil", avatar_url: "https://x.co/a.jpg", bio_slug: "nome",
    bio_settings: {
      header: { name: "Cria Social Club", bio: "O estúdio de quem cria conteúdo.", avatar: "https://x.co/h.jpg" },
      bannerImage: "https://x.co/b.png", buttonColor: "#CE4A1D", buttonTextColor: "#FFF6EA",
    },
  };
  it("topo da bio vale mais que o perfil", () => {
    const p = montarPreviaBio(base, "nome")!;
    expect(p.titulo).toBe("Cria Social Club");
    expect(p.descricao).toBe("O estúdio de quem cria conteúdo.");
    expect(p.avatar).toBe("https://x.co/h.jpg");
    expect(p.banner).toBe("https://x.co/b.png");
    expect(p.endereco).toBe("criaclub.bio/nome");
    expect(p.corBotao).toBe("#CE4A1D");
  });
  it("topo vazio usa o perfil", () => {
    const p = montarPreviaBio({ ...base, bio_settings: { header: { name: "", bio: "" } } }, "nome")!;
    expect(p.titulo).toBe("Perfil");
    expect(p.descricao).toBe("bio do perfil");
    expect(p.avatar).toBe("https://x.co/a.jpg");
    expect(p.banner).toBeNull();
  });
  it("sem bio: descrição padrão; sem nome: @slug", () => {
    const p = montarPreviaBio({ bio_slug: "nome", name: null, bio: null, bio_settings: null }, "nome")!;
    expect(p.titulo).toBe("@nome");
    expect(p.descricao).toBe("Os links de @nome num lugar só.");
  });
  it("tira HTML da bio, corta texto longo e recusa imagem sem https e cor inválida", () => {
    const p = montarPreviaBio({
      ...base,
      bio_settings: { header: { bio: `<b>oi</b> ${"a".repeat(200)}`, avatar: "javascript:alert(1)" }, bannerImage: "http://x.co/b.png", buttonColor: "red" },
    }, "nome")!;
    expect(p.descricao.startsWith("oi a")).toBe(true);
    expect(p.descricao.length).toBeLessThanOrEqual(110);
    expect(p.avatar).toBe("https://x.co/a.jpg");
    expect(p.banner).toBeNull();
    expect(p.corBotao).toBe("#17140F");
  });
  it("não é bio publicada: null", () => {
    expect(montarPreviaBio(null, "nome")).toBeNull();
    expect(montarPreviaBio({ name: "x", bio_slug: null }, "nome")).toBeNull();
  });
  it("arte sem imagens não leva img", () => {
    const p = montarPreviaBio(base, "nome")!;
    expect(JSON.stringify(arteDaBio(p, { semImagens: true }))).not.toContain('"img"');
    expect(JSON.stringify(arteDaBio(p))).toContain("https://x.co/b.png");
  });
});
