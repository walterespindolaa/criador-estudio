import { useCallback, useState } from "react";

/**
 * Alternador "ordem padrão / por data" de um quadro.
 *
 * É preferência de EXIBIÇÃO, não de dado: nada é gravado no banco. Fica salva
 * por dispositivo (localStorage) e por quadro, então cada board lembra do jeito
 * que a pessoa deixou sem interferir nos outros.
 *
 * Começa sempre DESLIGADO: a ordem que a pessoa arrastou continua sendo a
 * verdade até ela pedir o contrário.
 */
export function useOrdemPorData(chave: string): [boolean, (v: boolean) => void] {
  const [porData, setPorData] = useState<boolean>(() => {
    try {
      return localStorage.getItem(chave) === "1";
    } catch {
      return false;
    }
  });

  const alterar = useCallback((v: boolean) => {
    setPorData(v);
    try {
      localStorage.setItem(chave, v ? "1" : "0");
    } catch {
      /* sem localStorage (aba anônima, storage cheio): segue só na sessão */
    }
  }, [chave]);

  return [porData, alterar];
}
