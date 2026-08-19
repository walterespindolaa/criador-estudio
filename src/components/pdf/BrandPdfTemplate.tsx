import { forwardRef } from "react";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";

/* ═══════════════════════════════════════════════════════════════════════════
   BRANDBOOK EM PDF, VERSÃO APRESENTAÇÃO

   O que este arquivo corrigiu (feedback da Gabriela em 19/08):
   1. FALTAVA CONTEÚDO. O PDF antigo só levava Pilares, Tom de Voz, Linha
      Editorial e UMA persona. Todo o resto que a pessoa preenche no Brandbook
      (Identidade e Sensações, Visual e Estilo, Contexto e Propósito,
      Inspirações, Visão de Mundo, Sobre Você, as perguntas guiadas de persona
      e as DEMAIS personas) simplesmente não saía. Quem preencheu tudo abria o
      PDF e via um terço do próprio trabalho.
   2. ESTAVA FEIO. Era um documento cinza, sem a cara do CRIA. Agora usa a
      paleta oficial (mesma do relatório do cliente): capa creme, traço
      colorido por seção, cards com respiro.

   Regras de exportação (usePdfExport):
   - Cada seção leva data-pdf-block: o corte de página cai ENTRE seções,
     nunca no meio de um texto.
   - Cores em HEX fixo: html2canvas não resolve var() em oklch.
   ═══════════════════════════════════════════════════════════════════════════ */

interface MoodboardEntryLike {
  section: string;
  question_key: string;
  answer: string | null;
}

interface PillarLike {
  name: string;
  color: string;
}

interface BrandPdfProps {
  profile: any;
  brandItems: any[];
  /** TODAS as personas. O PDF antigo recebia só a primeira e a Gabriela (que
   *  tem duas) perguntou onde estava a outra. */
  personas: any[];
  pillars?: PillarLike[];
  moodboardEntries?: MoodboardEntryLike[];
}

// Paleta oficial do Cria (mesma da LP e do relatório do cliente).
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  creme: "#F6F2E8", cremeCard: "#FBF9F2",
  laranja: "#EA4918", verde: "#01A652", azul: "#0061EE",
  rosa: "#FF77B9", amarelo: "#FFCF03", lilas: "#7C90F0",
};

/* Catálogo das seções guiadas que saem no PDF, na ordem da narrativa: primeiro
   quem a marca É, depois como ela FALA, o que ela PUBLICA e pra QUEM. As chaves
   e rótulos espelham QUESTION_SECTIONS do Brandbook; se uma pergunta nova
   nascer lá, é só acrescentar aqui pra ela sair no PDF. */
const SECOES_GUIADAS: Array<{ section: string; title: string; cor: string; questions: Array<{ key: string; label: string }> }> = [
  {
    section: "moodboard-identidade", title: "Identidade e Sensações", cor: C.rosa,
    questions: [
      { key: "sensacoes", label: "Que sensação a marca transmite" },
      { key: "palavras-chave", label: "Palavras-chave da essência" },
      { key: "se-fosse", label: "Se a marca fosse uma pessoa" },
    ],
  },
  {
    section: "moodboard-visual", title: "Visual e Estilo", cor: C.lilas,
    questions: [
      { key: "cores", label: "Cores que representam a marca" },
      { key: "estetica", label: "Estética visual" },
      { key: "referencias-visuais", label: "Referências visuais" },
    ],
  },
  {
    section: "moodboard-contexto", title: "Contexto e Propósito", cor: C.verde,
    questions: [
      { key: "por-que", label: "Por que cria conteúdo" },
      { key: "diferencial", label: "Diferencial" },
      { key: "legado", label: "Impacto que quer causar" },
    ],
  },
  {
    section: "moodboard-inspiracoes", title: "Inspirações Pessoais", cor: C.amarelo,
    questions: [
      { key: "criadores", label: "Criadores que inspiram" },
      { key: "marcas", label: "Marcas que admira" },
      { key: "conteudos", label: "Conteúdos que marcaram" },
    ],
  },
  {
    section: "visao-de-mundo", title: "Visão de Mundo", cor: C.azul,
    questions: [
      { key: "verdade-pouco-dita", label: "Verdade que poucos falam no nicho" },
      { key: "crenca-a-quebrar", label: "Crença que quer quebrar" },
      { key: "incomodo-mercado", label: "O que incomoda no mercado" },
    ],
  },
  {
    section: "sobre-voce", title: "Sobre Você", cor: C.laranja,
    questions: [
      { key: "comeco", label: "O que fez começar" },
      { key: "conflito", label: "Conflito que viveu e hoje ajuda" },
      { key: "meta", label: "Onde quer chegar" },
    ],
  },
];

const TOM_QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "estilo", label: "Estilo de comunicação" },
  { key: "palavras", label: "Palavras / expressões frequentes" },
  { key: "evitar", label: "O que evita" },
  { key: "referencias", label: "Referências de tom" },
  { key: "emocao", label: "Emoção que desperta" },
];

const EDITORIAL_QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "ideia-central", label: "Ideia central" },
  { key: "temas", label: "Temas" },
  { key: "transformacao", label: "Transformação que promove" },
  { key: "tipos-conteudo", label: "Tipos de conteúdo" },
  { key: "lema", label: "Lema / frase-guia" },
];

const PERSONA_GUIADA: Array<{ key: string; label: string }> = [
  { key: "quem-e", label: "Quem é a pessoa que segue" },
  { key: "dores", label: "Dores" },
  { key: "desejos", label: "O que deseja conquistar" },
  { key: "crencas", label: "Crenças que carrega" },
  { key: "comportamento", label: "Comportamento online" },
];

// A cor pode estar no value (cor adicionada à mão) OU no name (cor importada
// do PDF, onde o hex cai no nome e o value fica nulo). Pega o primeiro hex válido.
const hexDe = (s?: string | null): string | null => {
  const m = String(s ?? "").match(/#[0-9a-fA-F]{3,8}/);
  return m ? m[0] : null;
};

export const BrandPdfTemplate = forwardRef<HTMLDivElement, BrandPdfProps>(
  ({ profile, brandItems, personas = [], pillars = [], moodboardEntries = [] }, ref) => {
    const tom = brandItems.find(b => b.type === "tom")?.name;
    const arquetipo = brandItems.find(b => b.type === "arquetipo")?.name;
    const expressoes = brandItems.filter(b => b.type === "expressao").map(b => b.name);
    const evitar = brandItems.filter(b => b.type === "evitar").map(b => b.name);
    const cores = brandItems.filter(b => b.type === "cor");
    const fontes = brandItems.filter(b => b.type === "fonte");

    const resposta = (section: string, key: string) =>
      (moodboardEntries.find(e => e.section === section && e.question_key === key)?.answer || "").trim();

    const respostasDe = (section: string, qs: Array<{ key: string; label: string }>) =>
      qs.map(q => ({ ...q, value: resposta(section, q.key) })).filter(q => q.value.length > 0);

    const tomAnswers = respostasDe("tom-de-voz", TOM_QUESTIONS);
    const editorialAnswers = respostasDe("linha-editorial", EDITORIAL_QUESTIONS);
    const personaGuiada = respostasDe("persona-brand", PERSONA_GUIADA);
    const guiadas = SECOES_GUIADAS
      .map(s => ({ ...s, answers: respostasDe(s.section, s.questions) }))
      .filter(s => s.answers.length > 0);

    const personasCheias = personas.filter((p) =>
      p && (p.name || p.age_range || p.location || p.notes || p.how_you_help
        || p.pain_points?.length || p.desires?.length || p.objections?.length
        || p.interests?.length || p.platforms?.length));

    // ── Peças de layout ──
    const secTitle = (t: string, cor: string) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
        <span style={{ width: 26, height: 6, borderRadius: 99, background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: C.ink }}>{t}</span>
      </div>
    );

    // Bloco pergunta+resposta. pre-line preserva os parágrafos que a pessoa
    // escreveu (o PDF antigo colava tudo num parede de texto).
    const qa = (label: string, value: string, cor: string) => (
      <div key={label} style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: cor, margin: "0 0 4px" }}>{label}</p>
        <p style={{ fontSize: 12.5, color: C.ink, margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{value}</p>
      </div>
    );

    const chip = (texto: string, i: number, fundo = C.soft, corTexto = C.ink) => (
      <span key={i} style={{ padding: "4px 12px", background: fundo, color: corTexto, borderRadius: 100, fontSize: 11.5, fontWeight: 600 }}>{texto}</span>
    );

    const secao = (children: React.ReactNode, key?: string) => (
      <div key={key} data-pdf-block style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
        {children}
      </div>
    );

    return (
      <div ref={ref} style={{ width: 794, fontFamily: "Inter, sans-serif", background: C.creme, color: C.ink }}>
        <div style={{ width: 794, padding: "0 0 28px", boxSizing: "border-box" }}>

          {/* ── Capa/cabeçalho: fundo creme com bolinhas da paleta ── */}
          <div data-pdf-block style={{ position: "relative", overflow: "hidden", padding: "52px 40px 40px", marginBottom: 20 }}>
            <span style={{ position: "absolute", right: -60, top: -60, width: 190, height: 190, borderRadius: 999, background: C.amarelo, opacity: 0.5 }} />
            <span style={{ position: "absolute", right: 110, top: 90, width: 62, height: 62, borderRadius: 999, background: C.rosa, opacity: 0.55 }} />
            <span style={{ position: "absolute", left: -46, bottom: -70, width: 150, height: 150, borderRadius: 999, background: C.lilas, opacity: 0.35 }} />
            <div style={{ position: "relative" }}>
              <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: C.laranja, fontWeight: 800, marginBottom: 10 }}>
                Brandbook · {profile?.niche || "Creator de conteúdo"}
              </p>
              <h1 style={{ fontSize: 40, fontWeight: 800, color: C.ink, margin: 0, lineHeight: 1.1 }}>
                {profile?.name || "Brandbook"}
              </h1>
              <p style={{ fontSize: 13, color: C.sub, marginTop: 8 }}>
                Identidade de marca · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
                {(profile?.platforms || []).map((p: string, i: number) =>
                  chip(p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : p === "youtube" ? "YouTube" : p, i, "#fff"))}
                <span style={{ padding: "4px 12px", background: C.ink, color: "#fff", borderRadius: 100, fontSize: 11.5, fontWeight: 700 }}>
                  {profile?.weekly_goal || 3} posts/semana
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 28px" }}>

            {/* ── Pilares ── */}
            {pillars.length > 0 && secao(
              <>
                {secTitle("Pilares de conteúdo", C.laranja)}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {pillars.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.cremeCard, borderRadius: 12 }}>
                      <span style={{ width: 13, height: 13, borderRadius: 999, background: p.color || C.sub, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </>, "pilares")}

            {/* ── Identidade visual (cores/fontes) ── */}
            {(cores.length > 0 || fontes.length > 0) && secao(
              <>
                {secTitle("Identidade visual", C.rosa)}
                {cores.length > 0 && (
                  <div style={{ marginBottom: fontes.length > 0 ? 16 : 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, margin: "0 0 8px" }}>Paleta de cores</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {cores.map((c, i) => {
                        const hex = hexDe(c.value) || hexDe(c.name);
                        const sub = c.value && hexDe(c.value) !== c.name ? c.value : null;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.cremeCard, borderRadius: 10 }}>
                            <span style={{ width: 20, height: 20, borderRadius: 6, background: hex || "#ddd", border: `1px solid ${C.line}` }} />
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{c.name}</p>
                              {sub && <p style={{ fontSize: 10, color: C.sub, margin: 0 }}>{sub}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {fontes.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, margin: "0 0 8px" }}>Tipografia</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {fontes.map((f, i) => chip(f.name, i, C.cremeCard))}
                    </div>
                  </div>
                )}
              </>, "visual")}

            {/* ── Tom de voz ── */}
            {(tom || arquetipo || expressoes.length > 0 || evitar.length > 0 || tomAnswers.length > 0) && secao(
              <>
                {secTitle("Tom de voz", C.azul)}
                {tom && <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: "0 0 12px", lineHeight: 1.45 }}>{tom}</p>}
                {arquetipo && (
                  <p style={{ fontSize: 12.5, color: C.sub, margin: "0 0 14px" }}>Arquétipo: <b style={{ color: C.ink }}>{arquetipo}</b></p>
                )}
                {tomAnswers.map(q => qa(q.label, q.value, C.azul))}
                {expressoes.length > 0 && (
                  <div style={{ marginTop: 4, marginBottom: evitar.length > 0 ? 12 : 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.verde, margin: "0 0 6px" }}>Expressões que usa</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {expressoes.map((e, i) => chip(e, i, "#01A65215", C.verde))}
                    </div>
                  </div>
                )}
                {evitar.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.laranja, margin: "0 0 6px" }}>Evitar</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {evitar.map((e, i) => chip(e, i, "#EA491812", C.laranja))}
                    </div>
                  </div>
                )}
              </>, "tom")}

            {/* ── Linha editorial ── */}
            {editorialAnswers.length > 0 && secao(
              <>
                {secTitle("Linha editorial", C.verde)}
                {editorialAnswers.map(q => qa(q.label, q.value, C.verde))}
              </>, "editorial")}

            {/* ── Seções guiadas: essência, visual, propósito, inspirações,
                   visão de mundo, sobre você. Era isto que NÃO saía no PDF. ── */}
            {guiadas.map((s) => secao(
              <>
                {secTitle(s.title, s.cor)}
                {s.answers.map(q => qa(q.label, q.value, s.cor))}
              </>, s.section))}

            {/* ── Personas: TODAS, cada uma no seu card ── */}
            {personasCheias.map((persona, pi) => (
              <div key={persona.id ?? pi} data-pdf-block style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
                {secTitle(personasCheias.length > 1 ? `Persona ${pi + 1} de ${personasCheias.length}` : "Persona", C.lilas)}
                <p style={{ fontWeight: 800, fontSize: 16, margin: "0 0 10px" }}>{persona.name || "Persona principal"}</p>
                {persona.notes && (
                  <p style={{ fontSize: 12.5, color: C.ink, margin: "0 0 14px", lineHeight: 1.6, whiteSpace: "pre-line" }}>{persona.notes}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 6 }}>
                  {persona.age_range && (
                    <div style={{ background: C.cremeCard, borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 10, color: C.sub, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Faixa etária</p>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0 }}>{persona.age_range}</p>
                    </div>
                  )}
                  {persona.gender && (
                    <div style={{ background: C.cremeCard, borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 10, color: C.sub, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Gênero</p>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0 }}>{persona.gender}</p>
                    </div>
                  )}
                  {persona.location && (
                    <div style={{ background: C.cremeCard, borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 10, color: C.sub, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Localização</p>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0 }}>{persona.location}</p>
                    </div>
                  )}
                </div>
                {([
                  ["Principais dores", persona.pain_points, C.laranja],
                  ["Desejos", persona.desires, C.verde],
                  ["Objeções", persona.objections, C.azul],
                ] as Array<[string, string[] | undefined, string]>).map(([rotulo, itens, cor]) =>
                  itens && itens.length > 0 ? (
                    <div key={rotulo} style={{ marginTop: 12 }}>
                      <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: cor, margin: "0 0 4px" }}>{rotulo}</p>
                      {itens.map((d: string, i: number) => (
                        <p key={i} style={{ fontSize: 12, color: C.ink, margin: "3px 0", lineHeight: 1.5 }}>
                          <span style={{ color: cor, fontWeight: 800 }}>·</span> {d}
                        </p>
                      ))}
                    </div>
                  ) : null)}
                {persona.how_you_help && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.rosa, margin: "0 0 4px" }}>Como você ajuda</p>
                    <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{persona.how_you_help}</p>
                  </div>
                )}
                {(persona.interests?.length > 0 || persona.platforms?.length > 0) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                    {(persona.interests ?? []).map((d: string, i: number) => chip(d, i, C.cremeCard))}
                    {(persona.platforms ?? []).map((d: string, i: number) => chip(d, 100 + i, "#0061EE12", C.azul))}
                  </div>
                )}
              </div>
            ))}

            {/* ── Perguntas guiadas de persona (texto livre) ── */}
            {personaGuiada.length > 0 && secao(
              <>
                {secTitle("Persona · nas suas palavras", C.amarelo)}
                {personaGuiada.map(q => qa(q.label, q.value, "#B8860B"))}
              </>, "persona-guiada")}

            {/* ── Rodapé ── */}
            <div data-pdf-block style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px 0" }}>
              <AssinaturaCria variante="rodape" tom="claro" altura={24} style={{ width: "auto", alignItems: "flex-start" }} />
              <p style={{ fontSize: 10, color: C.sub, margin: 0 }}>{new Date().toLocaleDateString("pt-BR")} · criasocialclub.com.br</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
BrandPdfTemplate.displayName = "BrandPdfTemplate";
