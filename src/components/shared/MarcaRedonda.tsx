import { useState, type CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   MARCA REDONDA (versão pra PDF e impressão)

   Mesma regra do LogoMarca das páginas públicas, com duas diferenças que o
   PDF obriga:

   1. SEM FUNDO BORRADO. O html2canvas não aplica `filter: blur()`. A cópia
      borrada que resolve o logo de fundo próprio na web sairia NÍTIDA e
      ampliada atrás do logo, o que é pior do que o problema original. Aqui o
      preenchimento é a cor de fundo, e ponto.
   2. `crossOrigin="anonymous"` SEMPRE. Sem isso o canvas fica contaminado e a
      imagem vira um buraco branco na folha.

   A regra que interessa é a mesma: arquivo quase quadrado é SELO (foi
   desenhado pra viver dentro de um círculo) e preenche a moldura inteira;
   logo horizontal cabe inteiro, com respiro, e nunca é cortado no meio.
   Antes cada PDF tinha a sua cópia disso, e todas usavam `cover` puro: logo
   deitado saía com as pontas comidas.
   ═══════════════════════════════════════════════════════════════════════════ */

export function MarcaRedonda({
  src, nome, px, fonte, fundo = "#ffffff", corFallback = "#EA4918", respiro, style,
}: {
  src?: string | null;
  /** Vira a inicial quando não há logo. */
  nome?: string | null;
  /** Diâmetro em pixels (PDF trabalha em medida fixa, não em clamp). */
  px: number;
  /** Tamanho da inicial do fallback. Padrão: 40% do diâmetro. */
  fonte?: number;
  fundo?: string;
  corFallback?: string;
  /** Respiro do logo horizontal. Padrão: 8% do diâmetro. */
  respiro?: number;
  style?: CSSProperties;
}) {
  const [falhou, setFalhou] = useState(false);
  const [selo, setSelo] = useState(false);
  const url = src?.trim() || "";
  const temLogo = !!url && !falhou;
  const folga = respiro ?? Math.max(3, Math.round(px * 0.08));

  const caixa: CSSProperties = {
    width: px, height: px, minWidth: px, flexShrink: 0,
    borderRadius: "50%", overflow: "hidden", boxSizing: "border-box",
    padding: temLogo && !selo ? folga : 0,
    background: fundo,
    display: "flex", alignItems: "center", justifyContent: "center",
    ...style,
  };

  if (!temLogo) {
    /* A inicial é centralizada por LINE-HEIGHT, não por flex. Centralizar texto
       com flex é exatamente o que o html2canvas erra ao fotografar o DOM: na
       tela fica no meio, no PDF a letra desce e encosta na borda de baixo do
       círculo. line-height igual à altura não depende do cálculo de
       alinhamento, só da caixa da linha. */
    return (
      <div style={{ ...caixa, padding: 0, display: "block", background: corFallback }}>
        <span style={{
          display: "block", width: "100%", height: px, lineHeight: `${px}px`, textAlign: "center",
          fontWeight: 800, fontSize: fonte ?? Math.round(px * 0.4), color: "#fff",
        }}>
          {(nome || "?").trim().charAt(0).toUpperCase() || "?"}
        </span>
      </div>
    );
  }

  return (
    <div style={caixa}>
      <img
        src={url}
        alt=""
        crossOrigin="anonymous"
        onError={() => setFalhou(true)}
        onLoad={(e) => {
          const img = e.currentTarget;
          const p = img.naturalWidth / (img.naturalHeight || 1);
          setSelo(p >= 0.8 && p <= 1.25);
        }}
        style={{ width: "100%", height: "100%", objectFit: selo ? "cover" : "contain", display: "block" }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARCA EM BARRA (logo da agência no topo ou no rodapé da folha)

   Logo de agência raramente é redondo: é uma assinatura horizontal. O erro
   antigo era desenhar sem fundo nenhum, então logo escuro ou de contorno fino
   sumia no creme da capa. Aqui ele ganha uma pastilha clara com respiro.
   ═══════════════════════════════════════════════════════════════════════════ */
export function MarcaBarra({
  src, alt, altura = 42, largura = 190, fundo = "#ffffff", style,
}: {
  src: string;
  alt?: string;
  altura?: number;
  largura?: number;
  fundo?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: fundo, borderRadius: 12, padding: "6px 10px", boxSizing: "border-box",
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt ?? "Logo da agência"}
        crossOrigin="anonymous"
        style={{ maxHeight: altura, maxWidth: largura, objectFit: "contain", display: "block" }}
      />
    </span>
  );
}
