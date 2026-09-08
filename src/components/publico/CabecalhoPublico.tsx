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
  /** Respiro entre a borda do círculo e o logo. Só vale pro formato pastilha. */
  respiro?: number;
  style?: CSSProperties;
  extra?: ReactNode;
};

export function LogoMarca({
  src, nome, tamanho = "md", formato = "pastilha", comFallback = false,
  cor = "#2A2440", fundo = "#ffffff", respiro = 9, style,
}: LogoMarcaProps) {
  const [falhou, setFalhou] = useState(false);
  /* PROPORÇÃO DA IMAGEM: sai de naturalWidth/naturalHeight, que o navegador dá
     de graça e sem depender de CORS (foi por isso que a leitura por canvas não
     servia). Arquivo quase quadrado é selo: já foi desenhado pra caber num
     círculo, e encaixá-lo com "contain" deixa o logo pequeno no meio de uma
     moldura larga. Selo preenche o círculo inteiro. Logo horizontal continua
     cabendo inteiro, sem corte. */
  const [quadrada, setQuadrada] = useState(false);
  const url = src?.trim() || "";
  const temLogo = !!url && !falhou;

  if (!temLogo && !comFallback) return null;

  const size = TAMANHOS[tamanho];
  const avatar = formato === "avatar";
  const preenche = avatar || quadrada;

  const caixa: CSSProperties = {
    // Círculo nos dois formatos: é o padrão da marca nas páginas públicas.
    // A diferença é o encaixe, não a forma: avatar é foto de pessoa e preenche
    // (cover), logo de marca cabe inteiro dentro do círculo (contain), então
    // logo largo aparece menor, mas nunca cortado no meio nem deformado.
    height: size,
    width: size,
    minWidth: size,
    maxWidth: size,
    padding: preenche ? 0 : respiro,
    boxSizing: "border-box",
    position: "relative",
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
      {/* FUNDO BORRADO (Gabi, 08/09/2026): o logo dela é um quadrado creme com o
          selo desenhado dentro. Encaixado com "contain" num círculo, sobravam as
          quinas retas e a moldura aparecia por baixo: quadrado dentro de redondo.
          Medir a transparência num canvas resolvia, mas dependia de CORS e
          falhava calado justamente com imagem de fora.
          A cópia borrada da PRÓPRIA imagem preenche o círculo com a cor que já
          está no logo. Some a emenda sem cortar, sem deformar e sem depender de
          servidor nenhum. Logo com fundo transparente borra pra transparente e o
          comportamento continua o de sempre. */}
      {!preenche && (
        <img
          src={url} alt="" aria-hidden draggable={false} loading="eager"
          style={{
            position: "absolute", inset: 0, height: "100%", width: "100%",
            objectFit: "cover", transform: "scale(1.7)", filter: "blur(11px)",
            // Um respiro de opacidade: o logo em cima continua sendo o herói.
            opacity: 0.92, pointerEvents: "none",
          }}
        />
      )}
      <img
        src={url}
        alt={nome ? `Logo de ${nome}` : "Logo da marca"}
        loading="eager"
        onError={() => setFalhou(true)}
        onLoad={(e) => {
          const img = e.currentTarget;
          const p = img.naturalWidth / (img.naturalHeight || 1);
          // Entre 0,8 e 1,25 é selo: preenche o círculo inteiro.
          setQuadrada(p >= 0.8 && p <= 1.25);
        }}
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          objectFit: preenche ? "cover" : "contain",
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
      {temAgencia && <LogoMarca src={agencia?.src} nome={agencia?.nome} tamanho={tamanho} fundo={fundo} respiro={5} />}
      {temCliente && <LogoMarca src={cliente?.src} nome={cliente?.nome} tamanho={tamanho} fundo={fundo} formato="avatar" />}
    </div>
  );
}
