/* ─────────────────────────────────────────────────────────────
   GANCHOS PRONTOS (curadoria do produto)

   Fonte única dos 60 ganchos de abertura que aparecem no botão
   "Ideias de gancho" (SeletorDeGanchos), ao lado dos campos onde
   a pessoa digita o gancho do post.

   Regras:
   - Lista ESTÁTICA, sem banco: é curadoria nossa. Se um dia o
     usuário puder editar/criar ganchos, isso migra pra tabela.
   - Os "___" são lacunas de propósito: a pessoa escolhe o gancho
     e completa com o tema dela.
   - Cada gancho vive numa categoria só (a de intenção dominante),
     pra navegação por chip ficar simples.
   ───────────────────────────────────────────────────────────── */

export type CategoriaGancho =
  | "curiosidade"
  | "segredo"
  | "erro"
  | "prova"
  | "polemica"
  | "chamada"
  | "lista";

export type Gancho = {
  texto: string;
  categoria: CategoriaGancho;
};

/** Ordem e rótulo dos chips de categoria no seletor. */
export const CATEGORIAS_GANCHO: { key: CategoriaGancho; label: string }[] = [
  { key: "curiosidade", label: "Curiosidade" },
  { key: "segredo", label: "Segredo" },
  { key: "erro", label: "Erro & alerta" },
  { key: "prova", label: "Prova & resultado" },
  { key: "polemica", label: "Polêmica & verdade" },
  { key: "chamada", label: "Chamada direta" },
  { key: "lista", label: "Lista & como fazer" },
];

export const GANCHOS: Gancho[] = [
  // Curiosidade: abre um vão ("o quê?!") que só o resto do post fecha.
  { texto: "Eu não esperava isso", categoria: "curiosidade" },
  { texto: "Isso está em todo o Instagram", categoria: "curiosidade" },
  { texto: "Isso quebrou a internet", categoria: "curiosidade" },
  { texto: "Todo mundo está fazendo isso", categoria: "curiosidade" },
  { texto: "Eu finalmente cedi.", categoria: "curiosidade" },
  { texto: "Isso fica insano", categoria: "curiosidade" },
  { texto: "E se eu te dissesse ___", categoria: "curiosidade" },
  { texto: "Isso vai te surpreender", categoria: "curiosidade" },
  { texto: "Isso fica absurdo", categoria: "curiosidade" },
  { texto: "É aqui que fica interessante", categoria: "curiosidade" },

  // Segredo: informação "de dentro", que parece exclusiva.
  { texto: "Parece ilegal saber disso", categoria: "segredo" },
  { texto: "Posso te contar um segredo?", categoria: "segredo" },
  { texto: "O segredo que ninguém fala.", categoria: "segredo" },
  { texto: "Rouba meu ___", categoria: "segredo" },
  { texto: "Eu queria ter sabido isso antes", categoria: "segredo" },
  { texto: "Tenho um segredo", categoria: "segredo" },
  { texto: "O que eles não querem que você saiba.", categoria: "segredo" },
  { texto: "Eu guardei um segredo.", categoria: "segredo" },

  // Erro & alerta: aponta o erro (do público ou o próprio) e manda parar.
  { texto: "Para de perder tempo com ___", categoria: "erro" },
  { texto: "É por isso que você não está crescendo.", categoria: "erro" },
  { texto: "Você é culpado disso?", categoria: "erro" },
  { texto: "Você está fazendo errado", categoria: "erro" },
  { texto: "Chega de ___, veja como", categoria: "erro" },
  { texto: "Meu maior erro foi ___", categoria: "erro" },
  { texto: "Isso é uma armadilha", categoria: "erro" },
  { texto: "Esse erro está te custando ___", categoria: "erro" },
  { texto: "Se você ainda faz isso, para agora", categoria: "erro" },
  { texto: "Para de cometer esse erro", categoria: "erro" },
  { texto: "Se você faz isso, para", categoria: "erro" },
  { texto: "Me arrependo de ter feito isso", categoria: "erro" },

  // Prova & resultado: número, transformação ou antes/depois.
  { texto: "Acabei de ganhar R$___ fazendo isso", categoria: "prova" },
  { texto: "Como eu resolvi isso em 3 dias", categoria: "prova" },
  { texto: "Isso dobrou meus resultados", categoria: "prova" },
  { texto: "Isso mudou tudo pra mim", categoria: "prova" },
  { texto: "Isso me poupou meses", categoria: "prova" },
  { texto: "De zerado a ___", categoria: "prova" },
  { texto: "Isso funcionou na hora", categoria: "prova" },
  { texto: "O dia em que tudo mudou.", categoria: "prova" },
  { texto: "Tentei isso por 30 dias", categoria: "prova" },

  // Polêmica & verdade: compra uma briga boa com o senso comum.
  { texto: "Me diz se eu estou errado.", categoria: "polemica" },
  { texto: "Essa é a verdade sobre ___", categoria: "polemica" },
  { texto: "Te enganaram sobre ___", categoria: "polemica" },
  { texto: "Eu estava errado.", categoria: "polemica" },
  { texto: "Todo mundo está errado sobre ___", categoria: "polemica" },

  // Chamada direta: fala com a pessoa certa e segura ela no vídeo.
  { texto: "Se você ainda tem dificuldade com ___", categoria: "chamada" },
  { texto: "Assiste até o final", categoria: "chamada" },
  { texto: "Para de rolar o feed se você quer ___", categoria: "chamada" },
  { texto: "Seja honesto:", categoria: "chamada" },
  { texto: "Não pula esse", categoria: "chamada" },
  { texto: "Se você já sentiu isso, presta atenção", categoria: "chamada" },
  { texto: "Se você odeia esse problema ___", categoria: "chamada" },
  { texto: "Levanta a mão se ___", categoria: "chamada" },
  { texto: "Se isso é você ___", categoria: "chamada" },

  // Lista & como fazer: promete passos, dicas ou a solução prática.
  { texto: "Minhas 5 dicas para ___", categoria: "lista" },
  { texto: "Como melhorar instantaneamente ___", categoria: "lista" },
  { texto: "Troca isso por isso", categoria: "lista" },
  { texto: "Veja como eu fiz", categoria: "lista" },
  { texto: "Aqui está a solução real", categoria: "lista" },
  { texto: "Vamos resolver isso de uma vez", categoria: "lista" },
  { texto: "7 formas de ___", categoria: "lista" },
];
