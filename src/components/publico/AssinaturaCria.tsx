import type { CSSProperties } from "react";

// Assinatura do Cria nas páginas públicas (os links que o cliente final abre).
//
// Regra de marca destas páginas: elas são white-label. Quem entrega o trabalho
// é a social mídia, e o protagonismo do topo continua sendo do cliente e da
// agência. O Cria entra como assinatura discreta e clicável, em dois pontos
// leves: uma faixa fininha no topo (chrome da plataforma, fora do card da
// marca) e o crédito no rodapé, que é o momento natural de clique.
//
// Nunca usar isto dentro do bloco colorido da marca do cliente: ali o Cria
// brigaria de igual pra igual com a marca de quem pagou pelo trabalho.

const SITE_CRIA = "https://criasocialclub.com.br";

// "claro"    logo escuro, para fundo claro (creme, branco, cinza)
// "escuro"   logo branco, para fundo colorido ou escuro
// "pastilha" logo escuro dentro de uma pílula branca, para fundo imprevisível
//            (imagem, gradiente, cor forte) sem deformar nem lavar o logo
export type TomAssinatura = "claro" | "escuro" | "pastilha";
export type VarianteAssinatura = "topo" | "rodape";

type Props = {
  variante?: VarianteAssinatura;
  tom?: TomAssinatura;
  className?: string;
  style?: CSSProperties;
  // Altura do logo em px. O padrão é calibrado pra tela, onde a assinatura fica
  // ao lado de texto de interface. Em arquivo que vai pro cliente (PDF, media
  // kit) ela é o único lugar onde a marca aparece, então pede mais corpo.
  altura?: number;
};

export function AssinaturaCria({ variante = "rodape", tom = "claro", className, style, altura }: Props) {
  const noTopo = variante === "topo";
  const logoSrc = tom === "escuro" ? "/logo-cria-white.png" : "/logo-cria.png";
  // Cinza escolhido pra passar em contraste AA sobre o creme e sobre o branco,
  // sem virar preto e roubar atenção do conteúdo.
  const corTexto = tom === "escuro" ? "rgba(255,255,255,.8)" : tom === "pastilha" ? "#5B5470" : "#6E675A";

  const alturaPadrao = noTopo ? 14 : 17;
  const alturaLogo = altura ?? alturaPadrao;
  // O texto acompanha o logo, senão em tamanho maior a palavra fica raquítica
  // do lado da marca. Só que ele acompanha com o pé no freio: numa assinatura
  // quem cresce é a marca, o "Feito com" continua sendo legenda.
  const escala = Math.min(alturaLogo / alturaPadrao, 1.15);

  const linha: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    textDecoration: "none",
    color: corTexto,
    fontFamily: "'Nunito Sans', system-ui, sans-serif",
    fontSize: (noTopo ? 10.5 : 11.5) * escala,
    lineHeight: 1.2,
    letterSpacing: ".02em",
    // Alvo de toque confortável no celular sem ocupar espaço visual.
    padding: tom === "pastilha" ? "6px 12px" : "6px 8px",
    borderRadius: 999,
    background: tom === "pastilha" ? "rgba(255,255,255,.92)" : "transparent",
    boxShadow: tom === "pastilha" ? "0 2px 10px -6px rgba(0,0,0,.35)" : undefined,
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: "100%",
        padding: noTopo ? "10px 12px 6px" : "0",
        ...style,
      }}
    >
      <a
        href={SITE_CRIA}
        target="_blank"
        rel="noopener noreferrer"
        title="Cria Social Club, a plataforma que gerou este link"
        style={linha}
      >
        <span>Feito com</span>
        <img
          src={logoSrc}
          alt="Cria Social Club"
          width={Math.round(alturaLogo * 1.83)}
          height={alturaLogo}
          style={{ height: alturaLogo, width: "auto", display: "block", opacity: tom === "pastilha" ? 1 : 0.9 }}
        />
      </a>
      {/* Na pastilha o endereço ficaria solto sobre um fundo imprevisível, então
          só aparece quando o fundo é conhecido. */}
      {!noTopo && tom !== "pastilha" && (
        <span style={{ fontSize: 10 * escala, color: corTexto, opacity: 0.85, fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>
          criasocialclub.com.br
        </span>
      )}
    </div>
  );
}
