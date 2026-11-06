import { useEffect } from "react";

/* TRAVA A PÁGINA DE TRÁS (Walter, 06/11/2026: "abro o menu e ao invés de rolar o
   menu ele rola a página que está atrás"). Enquanto um menu ou gaveta própria
   (feita sem Radix) está aberto, a página de baixo não rola. Guarda a posição e
   devolve igual ao fechar: no iPhone o overflow:hidden no body sozinho não segura
   o toque, por isso o body vira position:fixed no lugar onde estava. */
export function useTravarRolagem(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const y = window.scrollY;
    const b = document.body.style;
    const antes = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
    b.position = "fixed"; b.top = `-${y}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
    return () => {
      Object.assign(b, antes);
      window.scrollTo(0, y);
    };
  }, [ativo]);
}
