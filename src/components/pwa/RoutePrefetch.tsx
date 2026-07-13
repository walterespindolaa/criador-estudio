import { useEffect } from "react";

/**
 * PREFETCH DAS TELAS MAIS USADAS.
 *
 * Todas as páginas são `lazy()`. Isso é ótimo pro primeiro carregamento, mas
 * significa que TODA primeira visita a uma tela baixa um chunk novo, e no 4G
 * isso vira um flash de "carregando" a cada clique do menu.
 *
 * Aqui a gente baixa, na ociosidade (depois que a tela inicial já pintou), os
 * chunks das telas que a pessoa mais vai abrir. Quando ela clica, já está no
 * cache do SW: a troca de tela é instantânea.
 *
 * `requestIdleCallback` garante que isso NUNCA compete com o render inicial.
 */
export function RoutePrefetch() {
  useEffect(() => {
    const baixar = () => {
      const telas = [
        () => import("@/pages/app/Ideias"),
        () => import("@/pages/app/Criando"),
        () => import("@/pages/app/Dashboard"),
        () => import("@/pages/socialmidia/ManagerHome"),
        () => import("@/pages/socialmidia/Clientes"),
        () => import("@/pages/socialmidia/ClienteHub"),
      ];
      // Em série, não em paralelo: 6 chunks de uma vez roubariam a banda de
      // quem ainda está carregando dado de verdade.
      void telas.reduce<Promise<unknown>>(
        (fila, carregar) => fila.then(() => carregar().catch(() => {})),
        Promise.resolve(),
      );
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };

    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(baixar, { timeout: 5000 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(baixar, 3000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
