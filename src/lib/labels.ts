/* ═══════════════════════════════════════════════════════════════════════════
   RÓTULOS ÚNICOS (pente fino 23/09/2026)

   O mesmo conceito aparecia com nomes diferentes de tela pra tela: o status
   `pendente` era "Pendente", "Aguardando" e "Aguardando cliente"; o `postado`
   era "Postado" numa tela e "Publicado" na outra; a afiliação se chamava
   "Parceria", que o parceiro de produção lia como se fosse o papel dele.

   Regra: uma chave, um rótulo. Quem precisa de um nome de status, etapa ou
   persona importa daqui. Cor e ícone continuam em cada tela (são visuais);
   o TEXTO é único.

   Vocabulário combinado com o Walter:
     - "social mídia" pra pessoa, "agência" pra conta, "Cria" pra marca
     - afiliação (indicar e ganhar comissão) = "Indique e ganhe"
     - parceiro de produção (designer, filmmaker...) = "equipe de produção"
     - collab de marca do criador = "parcerias de marca"
   ═══════════════════════════════════════════════════════════════════════════ */

export const LABELS = {
  marca: "Cria",
  socialMidia: "social mídia",
  agencia: "agência",
  indique: "Indique e ganhe",
  equipeProducao: "Equipe de produção",
  parceriasDeMarca: "Parcerias de marca",
} as const;

/** Status de aprovação do Cria Post (as 5 colunas do quadro da social mídia). */
export const ROTULO_APROVACAO: Record<string, string> = {
  em_producao: "Em produção",
  pendente: "Aguardando cliente",
  ajuste_solicitado: "Ajuste solicitado",
  aprovado: "Aprovado",
  postado: "Postado",
};

/** Etapas do post do criador (colunas do quadro Criando e do calendário). */
export const ROTULO_ETAPA: Record<string, string> = {
  ideia: "Ideia",
  roteiro: "Planejamento",
  gravando: "Produzindo",
  editando: "Pronto",
  agendado: "Agendado",
  publicado: "Publicado",
};

/** Status de produção do card na mão do parceiro. */
export const ROTULO_PRODUCAO: Record<string, string> = {
  aguardando: "Novo",
  em_producao: "Fazendo",
  ajuste: "Ajuste",
  entregue: "Entregue",
};

/** Item do cronograma público (aprovação por link do cronograma). */
export const ROTULO_CRONOGRAMA: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  ajuste: "Ajuste pedido",
};

/** Rótulo seguro: nunca devolve undefined pra chave desconhecida. */
export function rotulo(mapa: Record<string, string>, chave: string | null | undefined, fallback = ""): string {
  if (!chave) return fallback;
  return mapa[chave] ?? fallback ?? chave;
}
