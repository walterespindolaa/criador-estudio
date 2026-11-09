import { useEffect } from "react";

/* TRAVA A PÁGINA DE TRÁS (Walter, 06/11/2026: "abro o menu e ao invés de rolar o
   menu ele rola a página que está atrás"). Enquanto um menu ou gaveta própria
   (feita sem Radix) está aberto, a página de baixo não rola.

   SEM body position:fixed (Walter, 09/11/2026: "a borda branca inferior que
   nasce"). Medido no print do iPhone instalado: camada fixa termina 60 pt acima
   do fim da tela (é onde a barra de baixo encosta). O que está abaixo disso só
   aparece se for página rolando. Com o body preso em position:fixed a página
   inteira virava camada fixa, era cortada nessa linha, e embaixo sobrava o fundo
   branco do próprio app (#FFFFFF puro, não o fundo do Cria). Mudar a cor do
   <html> não mudou nada, o que confirmou que ali não é a página.

   Agora: a rolagem trava com overflow:hidden no <html> e no <body> (o iOS
   respeita desde o 16), o véu tem touch-action:none e o menu tem
   overscroll-contain, então o dedo não chega na página. E a faixa de baixo, que
   o véu fixo não alcança, ganha um "remendo" do véu que rola junto com a página
   e fica exatamente embaixo da área visível. */
export function useTravarRolagem(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const h = document.documentElement.style;
    const b = document.body.style;
    const antes = { hO: h.overflow, hOB: h.overscrollBehavior, bO: b.overflow, bOB: b.overscrollBehavior };
    h.overflow = "hidden"; h.overscrollBehavior = "none";
    b.overflow = "hidden"; b.overscrollBehavior = "none";

    const remendo = document.createElement("div");
    remendo.setAttribute("aria-hidden", "true");
    Object.assign(remendo.style, {
      position: "absolute", left: "0", right: "0",
      top: `${window.scrollY + window.innerHeight - 2}px`, height: "240px",
      background: "hsl(var(--foreground) / 0.2)",
      backdropFilter: "blur(4px)", webkitBackdropFilter: "blur(4px)",
      zIndex: "39", pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(remendo);

    return () => {
      remendo.remove();
      h.overflow = antes.hO; h.overscrollBehavior = antes.hOB;
      b.overflow = antes.bO; b.overscrollBehavior = antes.bOB;
    };
  }, [ativo]);
}
