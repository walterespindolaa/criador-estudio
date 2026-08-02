import { useState, type CSSProperties, type ReactNode } from "react";

// Peças compartilhadas do cabeçalho das páginas públicas (cronograma, portal de
// aprovação, proposta). O que estas páginas precisam ter igual é o tratamento
// do logo das marcas: tamanho generoso, sem corte e sem deformação, e sem
// estourar no celular, que é onde o cliente abre o link (quase sempre pelo
// WhatsApp). O layout de cada página continua sendo dela, porque o cabeçalho do
// cronograma (card colorido) e o do portal (barra fixa) resolvem problemas
// diferentes.

// Tamanhos em clamp: o piso garante que o logo cresça de verdade em relação ao
// que era antes (54px no cronograma, 40px no portal) e o teto impede que ele
// tome a tela inteira num celular pequeno.
const TAMANHOS = {
  sm: "clamp(48px, 13vw, 58px)",
  md: "clamp(62px, 17vw, 78px)",
  lg: "clamp(74px, 21vw, 94px)",
} as const;

export type TamanhoLogo = keyof typeof TAMANHOS;
export type FormatoLogo = "pastilha" | "avatar";

type LogoMarcaProps = {
  src?: string | null;
  /** Nome da marca. Vira o alt da imagem e a inicial do fallback. */
  nome?: string | null;
  tamanho?: TamanhoLogo;
  /** "pastilha" para logo de marca (mostra o logo inteiro), "avatar" para foto de pessoa. */
  formato?: FormatoLogo;
  /** Sem logo: mostra a inicial do nome. Se false, some do layout. */
  comFallback?: boolean;
  /** Cor da inicial e do anel do fallback. */
  cor?: string;
  fundo?: string;
  style?: CSSProperties;
  extra?: ReactNode;
};

export function LogoMarca({
  src, nome, tamanho = "md", formato = "pastilha", comFallback = false,
  cor = "#2A2440", fundo = "#ffffff", style,
}: LogoMarcaProps) {
  const [falhou, setFalhou] = useState(false);
  const url = src?.trim() || "";
  const temLogo = !!url && !falhou;

  if (!temLogo && !comFallback) return null;

  const size = TAMANHOS[tamanho];
  const avatar = formato === "avatar";

  const caixa: CSSProperties = {
    height: size,
    width: avatar ? size : "auto",
    minWidth: size,
    // Logo muito largo vira uma pastilha mais larga em vez de ser cortado no
    // meio. O teto evita que um logo 5:1 empurre o resto do cabeçalho.
    maxWidth: avatar ? size : `calc(${size} * 1.75)`,
    padding: avatar ? 0 : 7,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    background: fundo,
    borderRadius: avatar ? "50%" : 18,
    boxShadow: "0 4px 14px -8px rgba(20,16,40,.45)",
    ...style,
  };

  if (!temLogo) {
    const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
    return (
      <span style={caixa} aria-hidden={nome ? undefined : true}>
        <span style={{ fontWeight: 800, fontSize: "1.6em", lineHeight: 1, color: cor }}>{inicial}</span>
      </span>
    );
  }

  return (
    <span style={caixa}>
      <img
        src={url}
        alt={nome ? `Logo de ${nome}` : "Logo da marca"}
        loading="eager"
        onError={() => setFalhou(true)}
        style={{
          height: "100%",
          width: avatar ? "100%" : "auto",
          // Teto em px (e não em %) porque a pastilha se ajusta ao conteúdo:
          // com % o navegador pode ignorar o limite e cortar o logo largo.
          maxWidth: avatar ? "100%" : `calc(${size} * 1.75 - 14px)`,
          objectFit: avatar ? "cover" : "contain",
          display: "block",
        }}
      />
    </span>
  );
}

type LogosCabecalhoProps = {
  agencia?: { src?: string | null; nome?: string | null };
  cliente?: { src?: string | null; nome?: string | null };
  /** Cor de fundo da pastilha, útil quando o cabeçalho é colorido. */
  fundo?: string;
  style?: CSSProperties;
};

// Linha com os logos da agência e do cliente. Quando só existe um deles, ele
// cresce mais, porque tem a linha inteira só pra ele.
export function LogosCabecalho({ agencia, cliente, fundo, style }: LogosCabecalhoProps) {
  const temAgencia = !!agencia?.src?.trim();
  const temCliente = !!cliente?.src?.trim();
  if (!temAgencia && !temCliente) return null;
  const tamanho: TamanhoLogo = temAgencia && temCliente ? "md" : "lg";

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap", ...style }}>
      {temAgencia && <LogoMarca src={agencia?.src} nome={agencia?.nome} tamanho={tamanho} fundo={fundo} />}
      {temCliente && <LogoMarca src={cliente?.src} nome={cliente?.nome} tamanho={tamanho} fundo={fundo} />}
    </div>
  );
}
