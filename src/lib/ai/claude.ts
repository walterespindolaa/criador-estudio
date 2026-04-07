import { supabase } from "@/integrations/supabase/client";

export type AIOperation = 'tag-suggestion' | 'reference-filter' | 'archive-summary' | 'daily-insight';

interface AIRequest {
  userId?: string;
  operation: AIOperation;
  data: any;
}

async function callAIContextBuilder(payload: AIRequest) {
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
