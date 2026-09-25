type LogoProps = {
  className?: string;
  variant?: "auto" | "light" | "dark";
  icon?: boolean;
  /** Versão leve do arquivo, pra quando a logo é desenhada pequena (topo, rail,
   *  menu). Ver o comentário abaixo. */
  pequeno?: boolean;
};

/* ═══════════════════════════════════════════════════════════════════════════
   A LOGO EMBAÇADA NO CELULAR (Walter, 20/09/2026)

   O arquivo da marca tem 900px de largura e o do selo tinha 1606x1841 (770 KB).
   No topo do app eles são desenhados com 24 e 38 pixels. Reduzir uma imagem
   quarenta vezes no navegador é o caminho mais curto pra ela sair borrada: o
   celular faz a conta na pressa, sem o cuidado que um editor de imagem tem, e o
   resultado é aquele borrão ao lado de um texto nítido.

   Agora existe uma versão pequena de cada arquivo, reduzida com filtro bom
   (Lanczos), e as telas que desenham a logo pequena usam ela. O selo caiu de
   770 KB pra 20 KB, que é benefício de sobra por si só: era quase um megabyte
   baixado pra desenhar um quadradinho de 38 pixels.

   Os arquivos grandes CONTINUAM existindo e não mudaram, porque eles têm dono:
   a prévia de link (og:image), a faixa da tela de Parceria e os e-mails. Trocar
   o arquivo grande resolveria o topo e estragaria esses três.
   ═══════════════════════════════════════════════════════════════════════════ */

export function Logo({ className = "h-8 w-auto", variant = "auto", icon = false, pequeno = false }: LogoProps) {
  const sufixo = pequeno ? "-sm" : "";
  /* object-contain (25/09/2026): o selo não é quadrado (128x147) e as telas
     desenham ele em caixa quadrada (h-8 w-8). Sem isto o navegador ESTICA a
     imagem pra caber, e o esticado era metade do "esfumaçado" do topo no
     celular. A outra metade eram os traços azuis finos: o arquivo -sm agora
     tem os traços engrossados, pra continuarem traço (e não borrão) em 32px. */
  className = `${className} object-contain`;
  const light = icon ? `/logo-icon${sufixo}.png` : `/logo-cria${sufixo}.png`;
  const dark = icon ? `/logo-icon-white${sufixo}.png` : `/logo-cria-white${sufixo}.png`;

  if (variant === "light") {
    return <img src={light} alt="cria" className={className} />;
  }
  if (variant === "dark") {
    return <img src={dark} alt="cria" className={className} />;
  }
  return (
    <>
      <img src={light} alt="cria" className={`${className} block dark:hidden`} />
      <img src={dark} alt="cria" className={`${className} hidden dark:block`} />
    </>
  );
}
