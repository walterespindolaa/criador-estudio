import { useSyncExternalStore } from "react";

/* KANBAN DO CLIENTE NA TELA (Walter, 05/11/2026). No celular, o criador tem no
   dock o botão de visão geral do Criando (encolhe as colunas pra passar por
   elas rápido). Dentro do cliente, na visão da social mídia, o mesmo Criando
   aparece embutido no cockpit, mas o dock é outro (ManagerLayout) e não sabia
   que o quadro estava aberto. O Criando embutido avisa aqui; o dock da social
   mídia lê e mostra o mesmo botão. */
let montados = 0;
const ouvintes = new Set<() => void>();

export function marcarCriandoNaTela(): () => void {
  montados += 1;
  ouvintes.forEach((f) => f());
  return () => {
    montados = Math.max(0, montados - 1);
    ouvintes.forEach((f) => f());
  };
}

export function useCriandoNaTela(): boolean {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => montados > 0,
    () => false,
  );
}
