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
  /** null = ainda não mediu. true = imagem quadrada (selo), preenche o círculo. */
  const [quadrada, setQuadrada] = useState<boolean | null>(null);
  const url = src?.trim() || "";
  const temLogo = !!url && !falhou;

  if (!temLogo && !comFallback) return null;

  const size = TAMANHOS[tamanho];
  const avatar = formato === "avatar";

  const caixa: CSSProperties = {
    // Círculo nos dois formatos: é o padrão da marca nas páginas públicas.
    // A diferença é o encaixe, não a forma: avatar é foto de pessoa e preenche
    // (cover), logo de marca cabe inteiro dentro do círculo (contain), então
    // logo largo aparece menor, mas nunca cortado no meio nem deformado.
    height: size,
    width: size,
    minWidth: size,
    maxWidth: size,
    // Selo quadrado preenche igual avatar; logo horizontal mantém o respiro.
    padding: (avatar || quadrada) ? 0 : 9,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    background: fundo,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.92)",
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
        onLoad={(e) => {
          const img = e.currentTarget;
          const p = img.naturalWidth / (img.naturalHeight || 1);
          // Entre 0,85 e 1,2 é selo quadrado: preenche o círculo inteiro.
          setQuadrada(p >= 0.85 && p <= 1.2);
        }}
        style={{
          height: "100%",
          width: "100%",
          objectFit: (avatar || quadrada) ? "cover" : "contain",
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
    // gap 18 + anel branco: com dois logos (um deles de fundo escuro, como o
    // da Laura) as pastilhas ficavam ENCOSTADAS e o logo escuro sumia dentro do
    // cabeçalho colorido. O anel separa cada marca do fundo e uma da outra.
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "wrap", ...style }}>
      {/* A do cliente vem do CRM, onde quase sempre é uma foto/avatar já
          recortado em círculo: com "contain" sobrava moldura e parecia que a
          imagem não preenchia. A da agência segue como pastilha (logo inteiro),
          só com respiro menor pra ocupar mais o círculo. */}
      {temAgencia && <LogoMarca src={agencia?.src} nome={agencia?.nome} tamanho={tamanho} fundo={fundo} style={{ padding: 5 }} />}
      {temCliente && <LogoMarca src={cliente?.src} nome={cliente?.nome} tamanho={tamanho} fundo={fundo} formato="avatar" />}
    </div>
  );
}
