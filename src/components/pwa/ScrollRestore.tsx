import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * RESTAURAÇÃO DE SCROLL.
 *
 * Comportamento de hoje: a pessoa rola 800px na lista de clientes, abre um,
 * aperta "voltar" — e cai no topo da lista. Tem que rolar tudo de novo pra achar
 * onde estava. Num celular, com 20 clientes, isso é enlouquecedor.
 *
 * Aqui a gente guarda a altura de cada rota e devolve no POP (o botão voltar).
 * Em navegação nova (PUSH), sobe pro topo, que é o certo.
 */
export function ScrollRestore() {
  const { key, pathname } = useLocation();
  const tipo = useNavigationType();
  const mapa = useRef<Map<string, number>>(new Map());

  // Guarda a posição da tela que está saindo.
  useEffect(() => {
    const guardar = () => mapa.current.set(key, window.scrollY);
    window.addEventListener("scroll", guardar, { passive: true });
    return () => {
      guardar();
      window.removeEventListener("scroll", guardar);
    };
  }, [key]);

  useEffect(() => {
    if (tipo === "POP") {
      const y = mapa.current.get(key);
      if (y != null) {
        // rAF duplo: espera o conteúdo da rota montar, senão a página ainda não
        // tem altura suficiente e o scroll não vai a lugar nenhum.
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [key, pathname, tipo]);

  return null;
}
