import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

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
 *
 * POR PAPEL (pente fino 23/09/2026): antes baixava as 6 telas de criador E de
 * agência pra todo mundo, inclusive pra quem estava só numa página pública de
 * aprovação. Agora: sem sessão, não baixa nada; criador baixa as do criador;
 * agência baixa as da agência. E respeita "economia de dados" do celular.
 */
export function RoutePrefetch() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const con = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (con?.saveData || con?.effectiveType === "2g" || con?.effectiveType === "slow-2g") return;

    const path = window.location.pathname;
    const intencao = (user.user_metadata as { account_intent?: string } | undefined)?.account_intent;
    const agencia = path.startsWith("/socialmidia") || (path === "/" && intencao === "manager");
    const parceiro = intencao === "parceiro";

    const baixar = () => {
      const telas = parceiro
        ? [() => import("@/pages/app/MinhasDemandas")]
        : agencia
          ? [
            () => import("@/pages/socialmidia/ManagerHome"),
            () => import("@/pages/socialmidia/Clientes"),
            () => import("@/pages/socialmidia/ClienteHub"),
            () => import("@/pages/socialmidia/Aprovacoes"),
          ]
          : [
            () => import("@/pages/app/Ideias"),
            () => import("@/pages/app/Criando"),
            () => import("@/pages/app/Dashboard"),
          ];
      // Em série, não em paralelo: vários chunks de uma vez roubariam a banda
      // de quem ainda está carregando dado de verdade.
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
  }, [user]);

  return null;
}
