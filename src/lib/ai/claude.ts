import { supabase } from "@/integrations/supabase/client";

export type AIOperation = 'tag-suggestion' | 'reference-filter' | 'archive-summary' | 'daily-insight' | 'idea-suggestions' | 'generate-caption' | 'suggest-hashtags' | 'onboarding-setup' | 'cria-chat' | 'repurpose-content' | 'refine-caption' | 'score-caption' | 'client-report-insight';

export interface CaptionScore {
  nota: number;
  veredito: string;
  melhorias: string[];
  variacoes: string[];
}

export interface ClientReportInsight {
  resumo: string;
  recomendacoes: string[];
}

export const clientReportInsight = async (
  params: {
    cliente: string; mes: string; total: number;
    formatos: string; plataformas: string;
    aprovados: number; aguardando: number; ajustes: number;
    titulos: string;
  },
  userId?: string
): Promise<ClientReportInsight> => {
  return callAIContextBuilder({ userId, operation: 'client-report-insight', data: params });
};

interface AIRequest {
  userId?: string;
  operation: AIOperation;
  data: any;
}

export async function callAIContextBuilder(payload: AIRequest) {
  const { data, error } = await supabase.functions.invoke('ai-context-builder', {
    body: payload,
  });

  if (error) {
    console.error('AI Operation error:', error);
    throw error;
  }

  return data?.result;
}

export const suggestTag = async (ideaTitle: string, pillars: { name: string }[], userId?: string) => {
  return callAIContextBuilder({
    userId,
    operation: 'tag-suggestion',
    data: { ideaTitle, pillars }
  });
};

export const filterReferences = async (params: { platform: string; format: string; pillar: string; title: string }, userId?: string) => {
  return callAIContextBuilder({
    userId,
    operation: 'reference-filter',
    data: params
  });
};

export const generateArchiveSummary = async (params: { title: string; platform: string; format: string; pillar: string }, userId?: string) => {
  return callAIContextBuilder({
    userId,
    operation: 'archive-summary',
    data: params
  });
};

export const getDailyInsight = async (params: { postsThisWeek: number; weeklyGoal: number; topPillar: string; lastPublished: string }, userId?: string) => {
  return callAIContextBuilder({
    userId,
    operation: 'daily-insight',
    data: params
  });
};

export const getIdeaSuggestions = async (
  params: {
    ideiaTexto: string;
    platform?: string;
    pilar?: string;
    objetivo?: string;
    niche?: string;
  },
  userId?: string
) => {
  return callAIContextBuilder({
    userId,
    operation: 'idea-suggestions',
    data: params,
  });
};

export const generateCaption = async (
  params: {
    titulo: string;
    conteudo?: string;
    roteiro?: string;
    pilar?: string;
    nicho?: string;
    tom?: string;
    tamanho?: 'curto' | 'medio' | 'longo';
    formato?: string;
    plataforma?: string;
  },
  userId?: string
) => {
  return callAIContextBuilder({
    userId,
    operation: 'generate-caption',
    data: params,
  });
};

export const scoreCaption = async (
  params: {
    legenda: string;
    formato?: string;
    plataforma?: string;
    nicho?: string;
  },
  userId?: string
): Promise<CaptionScore> => {
  return callAIContextBuilder({
    userId,
    operation: 'score-caption',
    data: params,
  });
};

export const suggestHashtags = async (
  params: {
    titulo?: string;
    formato?: string;
    plataforma?: string;
    pilar?: string;
    nicho?: string;
    legenda?: string;
  },
  userId?: string
) => {
  return callAIContextBuilder({
    userId,
    operation: 'suggest-hashtags',
    data: params,
  });
};
