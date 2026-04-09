export type FormatField = {
  key: string;
  label: string;
  placeholder: string;
  rows: number;
  icon: string;
};

export type FormatStructure = {
  fields: FormatField[];
  hasDynamicSections?: boolean;
  sectionLabel?: string;
  defaultSections?: number;
};

export const FORMAT_STRUCTURES: Record<string, FormatStructure> = {
  reels: {
    fields: [
      { key: "hook", label: "Hook (gancho)", placeholder: "A primeira frase que prende nos primeiros 3 segundos...", rows: 2, icon: "Anchor" },
      { key: "caption", label: "Legenda", placeholder: "Texto para o feed com hashtags e CTA...", rows: 3, icon: "MessageSquare" },
      { key: "cta", label: "CTA", placeholder: "Ex: Salva esse post!", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: true,
    sectionLabel: "Cena",
    defaultSections: 5,
  },
  shorts: {
    fields: [
      { key: "hook", label: "Hook (gancho)", placeholder: "Primeiros 3 segundos — o que vai prender?", rows: 2, icon: "Anchor" },
      { key: "caption", label: "Legenda", placeholder: "Descrição curta com hashtags...", rows: 2, icon: "MessageSquare" },
      { key: "cta", label: "CTA", placeholder: "Ex: Segue pra mais!", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: true,
    sectionLabel: "Cena",
    defaultSections: 5,
  },
  foto: {
    fields: [
      { key: "hook", label: "Texto da foto / chamada", placeholder: "O que vai aparecer junto com a imagem? (frase de impacto, pergunta, afirmação...)", rows: 2, icon: "Type" },
      { key: "caption", label: "Legenda", placeholder: "Legenda completa com storytelling, hashtags e CTA...", rows: 5, icon: "MessageSquare" },
      { key: "cta", label: "CTA", placeholder: "Ex: Salva esse post! | Comenta aqui embaixo | Link na bio", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: false,
  },
  carrossel: {
    fields: [
      { key: "hook", label: "Capa (slide 1)", placeholder: "O que vai aparecer na capa para parar o scroll?", rows: 2, icon: "Layers" },
      { key: "caption", label: "Legenda", placeholder: "Texto para o feed com CTA para salvar...", rows: 3, icon: "MessageSquare" },
      { key: "cta", label: "CTA (último slide)", placeholder: "Ex: Salva esse carrossel!", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: true,
    sectionLabel: "Lâmina",
    defaultSections: 5,
  },
  story: {
    fields: [
      { key: "hook", label: "Texto principal", placeholder: "O que vai aparecer no story?", rows: 2, icon: "Type" },
      { key: "cta", label: "CTA / Swipe Up", placeholder: "Ex: Arrasta pra cima, Link na bio...", rows: 1, icon: "MousePointerClick" },
      { key: "script", label: "Notas de produção", placeholder: "Sequência de stories, filtros, stickers...", rows: 2, icon: "PenLine" },
    ],
    hasDynamicSections: false,
  },
  video: {
    fields: [
      { key: "hook", label: "Hook (abertura)", placeholder: "Como vai começar o vídeo para prender?", rows: 2, icon: "Anchor" },
      { key: "caption", label: "Descrição (YouTube)", placeholder: "Descrição completa com palavras-chave, links e timestamps...", rows: 4, icon: "MessageSquare" },
      { key: "cta", label: "CTA no vídeo", placeholder: "Ex: Curte, se inscreve e ativa o sino!", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: true,
    sectionLabel: "Cena",
    defaultSections: 5,
  },
  live: {
    fields: [
      { key: "hook", label: "Tema da live", placeholder: "Qual o assunto principal?", rows: 1, icon: "Radio" },
      { key: "script", label: "Roteiro / Pauta", placeholder: "Tópicos a cobrir durante a live...", rows: 4, icon: "PenLine" },
      { key: "cta", label: "CTA final", placeholder: "Ex: Link na bio pra entrar no grupo!", rows: 1, icon: "MousePointerClick" },
    ],
    hasDynamicSections: false,
  },
};

export function getFormatStructure(format: string): FormatStructure {
  return FORMAT_STRUCTURES[format] || FORMAT_STRUCTURES.reels;
}
