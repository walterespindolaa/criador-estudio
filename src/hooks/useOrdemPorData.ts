import { useCallback, useState } from "react";
import type { OrdemDir } from "@/lib/ordenar-por-data";

/**
 * Alternador "ordem padrão / por data" de um quadro, agora com DIREÇÃO.
 *
 * É preferência de EXIBIÇÃO, não de dado: nada é gravado no banco. Fica salva
 * por dispositivo (localStorage) e por quadro, então cada board lembra do jeito
 * que a pessoa deixou sem interferir nos outros.
 *
 * Começa sempre DESLIGADO e, quando liga, começa em "asc" (mais antigo primeiro,
 * o que vence antes no topo). Clicar de novo em "Por data" INVERTE a direção
 * (asc <-> desc), pra pessoa escolher o sentido.
 *
 * Persistência (mesma chave de antes, compatível com o esquema anterior):
 *  - "0"            -> desligado
 *  - "asc" / "desc" -> ligado, na direção salva
 *  - "1" (legado)   -> ligado em "asc"
 */
export function useOrdemPorData(
  chave: string,
): readonly [boolean, (v: boolean) => void, OrdemDir, () => void] {
  const [estado, setEstado] = useState<{ porData: boolean; direcao: OrdemDir }>(() => {
    try {
      const raw = localStorage.getItem(chave);
      const porData = raw === "1" || raw === "asc" || raw === "desc";
      const direcao: OrdemDir = raw === "desc" ? "desc" : "asc";
      return { porData, direcao };
    } catch {
      return { porData: false, direcao: "asc" };
    }
  });

  const persistir = useCallback((porData: boolean, direcao: OrdemDir) => {
    try {
      localStorage.setItem(chave, porData ? direcao : "0");
    } catch {
      /* sem localStorage (aba anônima, storage cheio): segue só na sessão */
    }
  }, [chave]);

  // Liga/desliga a ordenação por data (botões "Ordem manual" / "Por data").
  const alterar = useCallback((v: boolean) => {
    setEstado((prev) => {
      persistir(v, prev.direcao);
      return { ...prev, porData: v };
    });
  }, [persistir]);

  // Clique no "Por data": se estava desligado, liga (mantendo a última direção);
  // se já estava ligado, inverte a direção (asc <-> desc).
  const alternar = useCallback(() => {
    setEstado((prev) => {
      if (!prev.porData) {
        persistir(true, prev.direcao);
        return { ...prev, porData: true };
      }
      const direcao: OrdemDir = prev.direcao === "asc" ? "desc" : "asc";
      persistir(true, direcao);
      return { porData: true, direcao };
    });
  }, [persistir]);

  return [estado.porData, alterar, estado.direcao, alternar] as const;
}
