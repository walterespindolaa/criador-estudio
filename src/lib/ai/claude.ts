import { supabase } from "@/integrations/supabase/client";

export type AIOperation = 'tag-suggestion' | 'reference-filter' | 'archive-summary';

interface AIRequest {
  operation: AIOperation;
  data: any;
  userContext?: any;
}

async function callAIOperations(payload: AIRequest) {
  const { data, error } = await supabase.functions.invoke('ai-operations', {
    body: payload,
  });

  if (error) {
    console.error('AI Operation error:', error);
    throw error;
  }

  return data;
}

export const suggestTag = async (ideaTitle: string, pillars: { name: string }[]) => {
  const pillarNames = pillars.map(p => p.name);
  return callAIOperations({
    operation: 'tag-suggestion',
    data: { ideaTitle, pillars: pillarNames }
  });
};

export const filterReferences = async (params: { platform: string; format: string; pillar: string; title: string }) => {
  return callAIOperations({
    operation: 'reference-filter',
    data: params
  });
};

export const generateArchiveSummary = async (params: { title: string; platform: string; format: string; pillar: string }) => {
  return callAIOperations({
    operation: 'archive-summary',
    data: params
  });
};
