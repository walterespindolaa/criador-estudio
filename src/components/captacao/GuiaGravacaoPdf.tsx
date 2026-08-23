import { forwardRef } from "react";
import { parseRefLinks, isRefLink } from "@/lib/refLinks";
import { useLinkPreviews, comCapa, type CapaDeLink } from "@/hooks/useLinkPreviews";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { cenasDe, type CaptureScript } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   GUIA DE GRAVAÇÃO EM PDF

   É o documento que a social mídia leva pro dia da gravação E manda pro
   cliente. Por isso ele veste a MESMA roupa do relatório do cliente: capa
   creme com as bolinhas da paleta, a logo do cliente em destaque, a logo da
   agência, cabeçalho e rodapé em toda página e contracapa. Quem recebe os dois
   documentos vê a mesma marca, não dois PDFs de ferramentas diferentes.

   Do guia que a Gabriela montava fora do Cria, herdamos a estrutura (ficha do
   vídeo à esquerda, roteiro à direita) e acrescentamos as duas coisas que
   faltavam lá:
     · DIREÇÃO por cena (o que fazer/filmar), ao lado da fala;
     · a REFERÊNCIA como link clicável de verdade dentro do PDF
       (data-pdf-link: o exportador cria a área clicável por cima da imagem).

   Uma página A4 por roteiro, na ordem de gravação definida na tela.
   ═══════════════════════════════════════════════════════════════════════════ */

// Hex fixo: html2canvas não resolve variável CSS em oklch. Mesma paleta do
// relatório do cliente, de propósito.
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  creme: "#F6F2E8", cremeCard: "#FBF9F2",
  laranja: "#EA4918", verde: "#01A652", azul: "#0061EE",
  rosa: "#FF77B9", amarelo: "#FFCF03", lilas: "#7C90F0",
};

/** Referências do roteiro (o campo guarda um link por linha). */
const refsDe = (r: { reference_url?: string | null }, capas: Record<string, CapaDeLink>) =>
  parseRefLinks(r.reference_url).filter(isRefLink).map((l) => comCapa(l, capas));

const dataBR = (iso?: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

/* PAGINAÇÃO DAS CENAS
   A folha tem altura fixa (A4) e overflow:hidden: um roteiro de 10 cenas
   simplesmente SUMIRIA da metade pra baixo, sem aviso. Aqui a gente mede o
   custo de cada cena em "linhas de texto" e quebra em quantas páginas
   precisar, sempre entre cenas (nunca no meio de uma) e sempre dentro da
   margem. A primeira página divide espaço com a ficha do vídeo; as seguintes
   usam a largura inteira e ganham "continuação" no título. */
const LARGURA_COL_CENA = 62;   // caracteres por linha na coluna do roteiro
const LARGURA_CHEIA = 96;      // caracteres por linha nas páginas de continuação
const ORCAMENTO_1A = 30;       // linhas úteis da 1ª página (divide com a ficha)
const ORCAMENTO_CONT = 40;     // linhas úteis das páginas seguintes

function custoCena(c: { fala: string; direcao: string }, largura: number): number {
  const linhas = (t: string) => t.trim() ? Math.ceil(t.trim().length / largura) + t.trim().split("\n").length - 1 : 0;
  return 1 + linhas(c.fala) + (c.direcao.trim() ? linhas(c.direcao) + 1 : 0) + 1;
}

/** Divide as cenas em páginas: [cenas da 1ª, cenas da 2ª, ...]. */
function paginarCenas(cenas: Array<{ fala: string; direcao: string }>): Array<Array<{ fala: string; direcao: string }>> {
  if (cenas.length === 0) return [[]];
  const paginas: Array<Array<{ fala: string; direcao: string }>> = [];
  let atual: Array<{ fala: string; direcao: string }> = [];
  let usado = 0;
  for (const c of cenas) {
    const primeira = paginas.length === 0;
    const largura = primeira ? LARGURA_COL_CENA : LARGURA_CHEIA;
    const orcamento = primeira ? ORCAMENTO_1A : ORCAMENTO_CONT;
    const custo = custoCena(c, largura);
    if (atual.length > 0 && usado + custo > orcamento) {
      paginas.push(atual); atual = []; usado = 0;
    }
    atual.push(c); usado += custo;
  }
  if (atual.length) paginas.push(atual);
  return paginas;
}

type Props = {
  cliente: string;
  mesLabel: string;
  roteiros: CaptureScript[];
  /** Logo do cliente (a mesma do relatório: portal > CRM > avatar do Cria). */
  logoCliente?: string | null;
  /** Logo da agência (profiles.brand_logo_url do dono do tenant). */
  logoAgencia?: string | null;
  /** Nome de quem assina ("sua social mídia" quando não houver). */
  elaboradoPor?: string | null;
};

export const GuiaGravacaoPdf = forwardRef<HTMLDivElement, Props>(
  ({ cliente, mesLabel, roteiros, logoCliente, logoAgencia, elaboradoPor }, ref) => {
    const assina = elaboradoPor?.trim() || "sua social mídia";
    // Capa das referências: no papel, o print do reel diz em um segundo o que
    // três linhas de URL não dizem.
    const capas = useLinkPreviews(roteiros.flatMap((r) => parseRefLinks(r.reference_url).filter(isRefLink)));

    // Página A4 com a mesma proporção do relatório (o exportador fotografa
    // cada [data-pdf-page] e vira uma folha).
    const folha: React.CSSProperties = {
      width: "100%", aspectRatio: "210 / 297", background: "#fff",
      display: "flex", flexDirection: "column", overflow: "hidden",
      boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif", color: C.ink,
    };

    const logoRedonda = (px: number, fontePx: number) => (
      <div style={{ width: px, height: px, borderRadius: "50%", background: "#fff", border: `3px solid ${C.laranja}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, boxShadow: "0 10px 26px -14px rgba(20,16,40,.5)" }}>
        {logoCliente
          ? <img src={logoCliente} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontWeight: 800, fontSize: fontePx, color: C.laranja }}>{cliente.charAt(0).toUpperCase()}</span>}
      </div>
    );

    const cabecalho = (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 32px 12px", borderBottom: `2px solid ${C.laranja}`, background: C.creme, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.soft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {logoCliente
            ? <img src={logoCliente} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontWeight: 800, fontSize: 13, color: C.laranja }}>{cliente.charAt(0).toUpperCase()}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>{cliente}</div>
          <div style={{ fontSize: 9.5, color: C.sub }}>Guia de gravação · {mesLabel}</div>
        </div>
        {logoAgencia && (
          <img src={logoAgencia} alt="" crossOrigin="anonymous" style={{ maxHeight: 22, maxWidth: 110, objectFit: "contain", display: "block", flexShrink: 0, borderRadius: 6 }} />
        )}
      </div>
    );

    const rodape = (num: number, total: number) => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 32px 16px", borderTop: `1px solid ${C.line}`, background: C.cremeCard, flexShrink: 0 }}>
        <span style={{ fontSize: 9.5, color: C.sub }}>Preparado por {assina}</span>
        <span style={{ fontSize: 9.5, color: C.sub }}>Vídeo {num} de {total}</span>
      </div>
    );

    return (
      <div ref={ref} style={{ width: 794, fontFamily: "Inter, system-ui, sans-serif", color: C.ink }}>

        {/* ── CAPA (mesma linguagem do relatório do cliente) ── */}
        <div data-pdf-page style={folha}>
          <div style={{ position: "relative", overflow: "hidden", flex: 1, padding: "44px 42px", background: C.creme, display: "flex", flexDirection: "column" }}>
            <span style={{ position: "absolute", top: -92, left: -66, width: 250, height: 250, borderRadius: "50%", background: C.amarelo }} />
            <span style={{ position: "absolute", bottom: -116, right: -92, width: 250, height: 250, borderRadius: "50%", background: C.rosa }} />
            <span style={{ position: "absolute", top: "32%", right: 28, width: 46, height: 46, borderRadius: "50%", background: C.verde }} />
            <span style={{ position: "absolute", bottom: "28%", left: 32, width: 54, height: 54, borderRadius: "50%", background: C.azul }} />

            <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "flex-end" }}>
              {logoAgencia
                ? <img src={logoAgencia} alt="" crossOrigin="anonymous" style={{ maxHeight: 42, maxWidth: 190, objectFit: "contain", display: "block", borderRadius: 10 }} />
                : <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{assina}</div>}
            </div>

            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              {logoRedonda(134, 54)}
              <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, marginTop: 20 }}>{cliente}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{mesLabel}</div>
              <div style={{ marginTop: 18, fontSize: 20, fontWeight: 800, color: C.laranja }}>Guia de Gravação</div>
              <div style={{ marginTop: 14, display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ background: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 12.5, fontWeight: 700 }}>
                  {roteiros.length} {roteiros.length === 1 ? "vídeo pra gravar" : "vídeos pra gravar"}
                </span>
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: C.sub, maxWidth: 380, lineHeight: 1.6 }}>
                Cada página é um vídeo: o que ele é, quando grava, a referência e as cenas.
                Em cada cena, a <b style={{ color: C.ink }}>fala</b> e a <b style={{ color: C.ink }}>direção</b> (o que fazer na frente da câmera).
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                <div>Elaborado por <b style={{ color: C.ink }}>{assina}</b></div>
                <div>Gerado em {new Date().toLocaleDateString("pt-BR")}</div>
              </div>
              <AssinaturaCria variante="rodape" tom="claro" altura={22} style={{ width: "auto" }} />
            </div>
          </div>
        </div>

        {/* ── PÁGINAS DOS ROTEIROS (quebradas entre cenas) ── */}
        {roteiros.map((r, idx) => {
          const cenas = cenasDe(r);
          const paginas = paginarCenas(cenas);
          let contador = 0; // numeração contínua das cenas entre páginas
          return paginas.map((cenasDaPagina, pg) => {
            const inicio = contador;
            contador += cenasDaPagina.length;
            return (
              <div key={`${r.id}-${pg}`} data-pdf-page style={folha}>
                {cabecalho}
                <div style={{ flex: 1, overflow: "hidden", padding: "18px 32px 10px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                    <span style={{ background: C.laranja, color: "#fff", borderRadius: 999, width: 24, height: 24, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800 }}>{idx + 1}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, flex: 1, minWidth: 0 }}>
                      {r.title?.trim() || "(sem título)"}
                      {pg > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.sub }}> · continuação</span>}
                    </span>
                    {r.done && pg === 0 && (
                      <span style={{ background: "#01A65215", color: C.verde, borderRadius: 999, padding: "4px 12px", fontSize: 10, fontWeight: 800 }}>GRAVADO</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
                    {/* A ficha do vídeo só na PRIMEIRA página do roteiro: nas
                        seguintes o roteiro usa a largura inteira. */}
                    {pg === 0 && (
                      <div style={{ width: 214, flexShrink: 0 }}>
                        <Bloco titulo="Data da gravação">{dataBR(r.record_date) ?? "a combinar"}</Bloco>
                        <Bloco titulo="Local">{r.location?.trim() || "a combinar"}</Bloco>
                        <Bloco titulo="Formato">{(r.format || "reels").toUpperCase()}</Bloco>
                        {r.about?.trim() && <Bloco titulo="Sobre o vídeo">{r.about}</Bloco>}
                        {refsDe(r, capas).length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <p style={{ fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: "0 0 6px" }}>
                              {refsDe(r, capas).length === 1 ? "Referência" : "Referências"}
                            </p>
                            {/* A capa que entra aqui é a NOSSA cópia (bucket do
                                Cria), que libera CORS: capa de CDN externo faria
                                o html2canvas descartar a imagem. data-pdf-link
                                deixa a área clicável no PDF exportado. */}
                            {refsDe(r, capas).map((pv, ri) => (
                              <a key={ri} href={pv.url} data-pdf-link={pv.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "block", border: `1px solid ${C.line}`, borderRadius: 12, padding: 11, background: C.cremeCard, textDecoration: "none", marginBottom: 6 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {pv.thumb ? (
                                    <img src={pv.thumb} alt="" crossOrigin="anonymous"
                                      style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}`, display: "block" }} />
                                  ) : (
                                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: `1px solid ${C.line}`, display: "grid", placeItems: "center", fontSize: 14, color: C.laranja }}>▶</span>
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Abrir no {pv.nome}</span>
                                </span>
                                <span style={{ display: "block", fontSize: 9, color: C.sub, marginTop: 5, wordBreak: "break-all" }}>
                                  {pv.label}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <p style={{ fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: "0 0 9px" }}>
                        Roteiro{paginas.length > 1 ? ` · parte ${pg + 1} de ${paginas.length}` : ""}
                      </p>
                      {cenasDaPagina.length === 0 ? (
                        <p style={{ fontSize: 12, color: C.sub, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.content || "(roteiro em branco)"}</p>
                      ) : cenasDaPagina.map((c, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, margin: "0 0 3px" }}>Cena {inicio + i + 1}</p>
                          {c.fala.trim() && (
                            <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.fala}</p>
                          )}
                          {c.direcao.trim() && (
                            <p style={{ fontSize: 11, color: C.sub, margin: "5px 0 0", lineHeight: 1.5, borderLeft: `2px solid ${C.lilas}`, paddingLeft: 8 }}>
                              <b style={{ color: C.lilas }}>Direção:</b> {c.direcao}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {rodape(idx + 1, roteiros.length)}
              </div>
            );
          });
        })}

        {/* ── CONTRACAPA ── */}
        <div data-pdf-page style={folha}>
          <div style={{ position: "relative", overflow: "hidden", flex: 1, padding: "44px 42px", background: C.creme, display: "flex", flexDirection: "column" }}>
            <span style={{ position: "absolute", top: -92, left: -66, width: 250, height: 250, borderRadius: "50%", background: C.amarelo }} />
            <span style={{ position: "absolute", bottom: -116, right: -92, width: 250, height: 250, borderRadius: "50%", background: C.rosa }} />
            <span style={{ position: "absolute", top: "30%", right: 30, width: 46, height: 46, borderRadius: "50%", background: C.verde }} />
            <span style={{ position: "absolute", bottom: "26%", left: 34, width: 54, height: 54, borderRadius: "50%", background: C.azul }} />
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              {logoRedonda(110, 44)}
              <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 18 }}>{cliente}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Guia de gravação · {mesLabel}</div>
              <div style={{ marginTop: 22, fontSize: 19, fontWeight: 800, color: C.laranja }}>Bora gravar!</div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: C.sub, maxWidth: 340, lineHeight: 1.6 }}>
                Qualquer dúvida sobre algum roteiro, é só chamar antes do dia da gravação.
              </div>
            </div>
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 12, color: C.sub }}>Elaborado por <b style={{ color: C.ink }}>{assina}</b></div>
              <AssinaturaCria variante="rodape" tom="claro" altura={22} style={{ width: "auto" }} />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
GuiaGravacaoPdf.displayName = "GuiaGravacaoPdf";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#EA4918", fontWeight: 800, margin: "0 0 4px" }}>{titulo}</p>
      <p style={{ fontSize: 12, color: "#1a1a2e", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{children}</p>
    </div>
  );
}
