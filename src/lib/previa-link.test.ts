import { describe, it, expect } from "vitest";
import {
  mesesDoPeriodo, textoDosMeses, mesDeData, encurtar, montarPrevia, ehRoboDePrevia, lerRota, escaparHtml,
} from "./previa-link";

const conta = { conta_nome: "Kollab", conta_logo: null, cliente: "Marhaban" };

describe("mês do período", () => {
  it("sem período: sem mês", () => {
    expect(textoDosMeses(mesesDoPeriodo(null, null))).toBeNull();
    expect(textoDosMeses(mesesDoPeriodo("2026-12-01", null))).toBeNull();
  });
  it("1 mês", () => expect(textoDosMeses(mesesDoPeriodo("2026-12-01", "2026-12-31"))).toBe("de dezembro"));
  it("2 meses", () => expect(textoDosMeses(mesesDoPeriodo("2026-11-15", "2026-12-15"))).toBe("de novembro e dezembro"));
  it("virada de ano", () => expect(textoDosMeses(mesesDoPeriodo("2026-12-20", "2027-01-10"))).toBe("de dezembro e janeiro"));
  it("3 meses ou mais", () => expect(textoDosMeses(mesesDoPeriodo("2026-12-01", "2027-02-28"))).toBe("de dez a fev"));
  it("período inválido ou invertido: sem mês", () => {
    expect(mesesDoPeriodo("2027-01-01", "2026-12-01")).toBeNull();
    expect(mesesDoPeriodo("lixo", "2026-12-01")).toBeNull();
    expect(mesesDoPeriodo("2026-13-01", "2026-13-02")).toBeNull();
    expect(mesesDoPeriodo("2026-01-01", "2028-06-01")).toBeNull();
  });
  it("dia só não muda de mês por fuso", () => {
    expect(textoDosMeses(mesesDoPeriodo("2026-12-01", "2026-12-01"))).toBe("de dezembro");
    expect(mesDeData("2027-01-01")).toBe("janeiro");
  });
});

describe("textos", () => {
  it("aprovar com período e contagem", () => {
    const p = montarPrevia("aprovar", { ...conta, periodo_inicio: "2026-12-01", periodo_fim: "2026-12-31", contagem: 12 });
    expect(p.titulo).toBe("Marhaban, seus posts de dezembro estão prontos");
    expect(p.arte.frase).toBe("Seus posts de dezembro chegaram.");
    expect(p.arte.linha).toBe("Marhaban · 12 posts esperando seu ok");
    expect(p.arte.marca).toBe("Kollab");
    expect(p.descricao).toContain("Enviado por Kollab.");
  });
  it("aprovar sem período: sem mês", () => {
    const p = montarPrevia("aprovar", { ...conta, contagem: 3 });
    expect(p.titulo).toBe("Marhaban, seus posts estão prontos");
    expect(p.arte.frase).toBe("Seus posts chegaram.");
  });
  it("contagem 0 some, 1 no singular", () => {
    expect(montarPrevia("aprovar", { ...conta, contagem: 0 }).arte.linha).toBe("Marhaban");
    expect(montarPrevia("aprovar", { ...conta, contagem: 1 }).arte.linha).toBe("Marhaban · 1 post esperando seu ok");
    expect(montarPrevia("aprovar", { ...conta, cliente: null, contagem: 0 }).arte.linha).toBeNull();
  });
  it("sem cliente: frase sem nome", () => {
    const p = montarPrevia("agendar", { ...conta, cliente: null, mes: "2026-11-04" });
    expect(p.titulo).toBe("Escolha o dia da sua captação");
    expect(p.arte.linha).toBe("datas livres de novembro");
  });
  it("nome longo é encurtado", () => {
    const longo = "Agência Muito Comprida de Marketing Digital Ltda";
    const p = montarPrevia("roteiros", { ...conta, conta_nome: longo, mes: "2026-10-01" });
    expect(p.arte.marca!.length).toBeLessThanOrEqual(28);
    expect(p.arte.marca!.endsWith("…")).toBe(true);
    expect(p.descricao.endsWith("….")).toBe(false);
    expect(encurtar("  ")).toBeNull();
  });
  it("logo só https", () => {
    expect(montarPrevia("aprovar", { ...conta, conta_logo: "http://x.com/a.png" }).arte.logo).toBeNull();
    expect(montarPrevia("aprovar", { ...conta, conta_logo: "javascript:alert(1)" }).arte.logo).toBeNull();
    expect(montarPrevia("aprovar", { ...conta, conta_logo: "https://x.com/a.png" }).arte.logo).toBe("https://x.com/a.png");
  });
  it("sem conta ou link inválido: genérica, sem oferta de teste pro cliente", () => {
    const p = montarPrevia("aprovar", null);
    expect(p.titulo).toBe("Cria Social Club");
    expect(p.descricao).not.toContain("grátis");
    expect(montarPrevia("aprovar", { ...conta, conta_nome: "" }).titulo).toBe("Cria Social Club");
  });
  it("signup e indicação", () => {
    expect(montarPrevia("signup", null).descricao).toContain("7 dias grátis");
    const i = montarPrevia("indicacao", { indicador: "Gabriela", desconto_pct: 15, meses: 3 });
    expect(i.titulo).toBe("Gabriela te convidou pro CRIA");
    expect(i.arte.linha).toBe("7 dias grátis + 15% off por 3 meses");
    expect(montarPrevia("indicacao", { indicador: "Ana", desconto_pct: 10, meses: 1 }).arte.linha).toBe("7 dias grátis + 10% off no 1º mês");
    expect(montarPrevia("indicacao", { indicador: "Ana", desconto_pct: null, meses: null }).arte.linha).toBe("7 dias grátis pra testar");
    expect(montarPrevia("indicacao", null).titulo).toContain("CRIA |");
  });
  it("nenhum texto tem travessão", () => {
    const tipos = ["aprovar", "materiais", "roteiros", "cronograma", "proposta", "agendar", "cadastro", "acessos", "conectar", "signup"] as const;
    for (const t of tipos) {
      const p = montarPrevia(t, { ...conta, mes: "2026-11-01", periodo_inicio: "2026-11-01", periodo_fim: "2026-11-30", contagem: 2 });
      expect(JSON.stringify(p)).not.toMatch(/[—–]/);
    }
  });
});

describe("robôs e rotas", () => {
  const robos = [
    "WhatsApp/2.23.20.0 A",
    "WhatsApp/2.2343.4 i",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Twitterbot/1.0",
  ];
  const gente = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.40.92 (iPhone14,5; iOS 17_5; pt_BR)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.104;FBBV/123]",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36 LinkedInApp/9.29",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "",
  ];
  it("robôs de prévia", () => robos.forEach((u) => expect(ehRoboDePrevia(u)).toBe(true)));
  it("gente passa direto (inclusive navegador do Instagram/Facebook/LinkedIn)", () => gente.forEach((u) => expect(ehRoboDePrevia(u)).toBe(false)));
  it("rotas", () => {
    expect(lerRota("/aprovar/abc123")).toEqual({ tipo: "aprovar", token: "abc123" });
    expect(lerRota("/agendar/k2m9x/")).toEqual({ tipo: "agendar", token: "k2m9x" });
    expect(lerRota("/p/GABRIELA")).toEqual({ tipo: "indicacao", token: "GABRIELA" });
    expect(lerRota("/signup")).toEqual({ tipo: "signup", token: null });
    expect(lerRota("/app")).toBeNull();
    expect(lerRota("/aprovar/a/b")).toBeNull();
    expect(lerRota("/aprovar/%E0%A4%A")).toBeNull();
  });
  it("escapa HTML", () => expect(escaparHtml(`<b a="1">'&`)).toBe("&lt;b a=&quot;1&quot;&gt;&#39;&amp;"));
});
