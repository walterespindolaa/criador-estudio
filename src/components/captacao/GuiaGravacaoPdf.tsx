import { forwardRef } from "react";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { cenasDe, type CaptureScript } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   GUIA DE GRAVAÇÃO EM PDF

   É o documento que a social mídia leva pro dia da gravação (e manda pro
   cliente). Copia a estrutura do guia que a Gabriela já montava fora do Cria,
   com duas coisas que faltavam lá:
     · DIREÇÃO por cena (o que fazer/filmar), ao lado da fala;
     · a REFERÊNCIA como link clicável de verdade dentro do PDF
       (data-pdf-link: o exportador cria a área clicável por cima da imagem).

   Uma página A4 por roteiro, na ordem de gravação definida na tela.
   ═══════════════════════════════════════════════════════════════════════════ */

const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f6f4ef",
  creme: "#FBF9F2", laranja: "#EA4918", verde: "#01A652", lilas: "#7C90F0",
};

const dataBR = (iso?: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

export const GuiaGravacaoPdf = forwardRef<HTMLDivElement, {
  cliente: string;
  mesLabel: string;
  agencia?: string | null;
  roteiros: CaptureScript[];
}>(({ cliente, mesLabel, agencia, roteiros }, ref) => {
  const pagina: React.CSSProperties = {
    width: 794, minHeight: 1123, background: "#fff", boxSizing: "border-box",
    padding: "44px 46px", display: "flex", flexDirection: "column",
  };

  return (
    <div ref={ref} style={{ width: 794, fontFamily: "Inter, sans-serif", color: C.ink }}>
      {/* CAPA */}
      <div data-pdf-page style={{ ...pagina, background: C.creme, justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <span style={{ position: "absolute", right: -70, top: -70, width: 220, height: 220, borderRadius: 999, background: "#FFCF03", opacity: .45 }} />
        <span style={{ position: "absolute", left: -60, bottom: -80, width: 190, height: 190, borderRadius: 999, background: C.lilas, opacity: .3 }} />
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: 0 }}>Guia de gravação</p>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: "10px 0 0", lineHeight: 1.05 }}>{cliente}</h1>
          <p style={{ fontSize: 15, color: C.sub, marginTop: 10 }}>{mesLabel}{agencia ? ` · por ${agencia}` : ""}</p>
          <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ background: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
              {roteiros.length} {roteiros.length === 1 ? "vídeo pra gravar" : "vídeos pra gravar"}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: C.sub, marginTop: 24, maxWidth: "62ch", lineHeight: 1.6 }}>
            Cada página é um vídeo: o que ele é, quando grava, a referência e as cenas.
            Em cada cena, a <b style={{ color: C.ink }}>fala</b> e a <b style={{ color: C.ink }}>direção</b> (o que fazer na frente da câmera).
          </p>
        </div>
      </div>

      {/* UMA PÁGINA POR ROTEIRO */}
      {roteiros.map((r, idx) => {
        const cenas = cenasDe(r);
        return (
          <div key={r.id} data-pdf-page style={pagina}>
            {/* Cabeçalho da página */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ background: C.laranja, color: "#fff", borderRadius: 999, width: 26, height: 26, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800 }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: C.sub, fontWeight: 700 }}>
                Vídeo {idx + 1} de {roteiros.length} · {cliente}
              </span>
              {r.done && (
                <span style={{ marginLeft: "auto", background: "#01A65215", color: C.verde, borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 800 }}>GRAVADO</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 22, flex: 1 }}>
              {/* Coluna da esquerda: a ficha do vídeo */}
              <div style={{ width: 232, flexShrink: 0 }}>
                <Bloco titulo="Data da gravação">{dataBR(r.record_date) ?? "a combinar"}</Bloco>
                <Bloco titulo="Local">{r.location?.trim() || "a combinar"}</Bloco>
                <Bloco titulo="Formato">{(r.format || "reels").toUpperCase()}</Bloco>
                <Bloco titulo="Título do vídeo">
                  <span style={{ fontWeight: 700 }}>{r.title?.trim() || "(sem título)"}</span>
                </Bloco>
                {r.about?.trim() && <Bloco titulo="Sobre o vídeo">{r.about}</Bloco>}
                {r.reference_url?.trim() && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: "0 0 6px" }}>Referência</p>
                    {/* data-pdf-link: o exportador transforma esta caixa em área
                        clicável no PDF, então o link do reel abre de verdade. */}
                    <a href={r.reference_url} data-pdf-link={r.reference_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 12px", background: C.soft, textDecoration: "none" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: `1px solid ${C.line}`, display: "grid", placeItems: "center", fontSize: 15 }}>▶</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>Abrir o vídeo de referência</span>
                      </span>
                      <span style={{ display: "block", fontSize: 10, color: C.sub, marginTop: 6, wordBreak: "break-all" }}>
                        {r.reference_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                      </span>
                    </a>
                  </div>
                )}
              </div>

              {/* Coluna da direita: o roteiro */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: "0 0 10px" }}>Roteiro</p>
                {cenas.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: C.sub, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.content || "(roteiro em branco)"}</p>
                ) : cenas.map((c, i) => (
                  <div key={i} style={{ marginBottom: 14, breakInside: "avoid" }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: C.ink, margin: "0 0 3px" }}>Cena {i + 1}</p>
                    {c.fala.trim() && (
                      <p style={{ fontSize: 12.5, color: C.ink, margin: 0, lineHeight: 1.62, whiteSpace: "pre-wrap" }}>{c.fala}</p>
                    )}
                    {c.direcao.trim() && (
                      <p style={{ fontSize: 11.5, color: C.sub, margin: "5px 0 0", lineHeight: 1.5, borderLeft: `2px solid ${C.lilas}`, paddingLeft: 8 }}>
                        <b style={{ color: C.lilas }}>Direção:</b> {c.direcao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <AssinaturaCria variante="rodape" tom="claro" altura={20} style={{ width: "auto", alignItems: "flex-start" }} />
              <span style={{ fontSize: 10, color: C.sub }}>{mesLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
GuiaGravacaoPdf.displayName = "GuiaGravacaoPdf";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: "#EA4918", fontWeight: 800, margin: "0 0 4px" }}>{titulo}</p>
      <p style={{ fontSize: 12.5, color: "#1a1a2e", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{children}</p>
    </div>
  );
}
