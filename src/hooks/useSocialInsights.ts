import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// types.ts é travado — essas tabelas ainda não estão tipadas. Padrão de cast (igual useModules/useFinance).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type SocialProvider = "instagram";

export type SocialConnection = {
  id: string;
  user_id: string;
  provider: SocialProvider;
  external_account_id: string;
  username: string | null;
  account_type: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  updated_at: string | null;
};

export type DailyMetric = {
  date: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  profile_views: number | null;
  website_clicks: number | null;
  accounts_engaged: number | null;
  total_interactions: number | null;
};

export type LinkedPost = {
  title: string | null;
  format: string | null;
  hook: string | null;
  pillar_id: string | null;
} | null;

export type MediaInsight = {
  id: string;
  object_id: string | null;
  media_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  metrics: Record<string, number> | null;
  post_id: string | null;
  posts?: LinkedPost;
};

// Conexão Instagram do usuário (uma por provider). Não selecionamos access_token no client.
export function useSocialConnection() {
  const { user } = useAuth();
  return useQuery<SocialConnection | null>({
    queryKey: ["social-connection", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_connections")
        .select("id,user_id,provider,external_account_id,username,account_type,token_expires_at,connected_at,updated_at")
        .eq("user_id", user!.id)
        .eq("provider", "instagram")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SocialConnection) ?? null;
    },
  });
}

// Série diária da conta (para gráficos de evolução).
export function useDailyMetrics(days = 30) {
  const { user } = useAuth();
  return useQuery<DailyMetric[]>({
    queryKey: ["social-daily", user?.id, days],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await sbFrom("social_metrics_daily")
        .select("date,followers,reach,impressions,profile_views,website_clicks,accounts_engaged,total_interactions")
        .eq("user_id", user!.id)
        .eq("provider", "instagram")
        .gte("date", since)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyMetric[];
    },
  });
}

// Insights por mídia, já com o post do CRIA vinculado (quando houver).
export function useMediaInsights() {
  const { user } = useAuth();
  return useQuery<MediaInsight[]>({
    queryKey: ["social-media-insights", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_insights")
        .select("id,object_id,media_type,caption,permalink,thumbnail_url,posted_at,metrics,post_id,posts(title,format,hook,pillar_id)")
        .eq("user_id", user!.id)
        .eq("provider", "instagram")
        .eq("object_type", "media")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MediaInsight[];
    },
  });
}

// Vínculo manual: liga uma mídia do IG a um post criado no CRIA (ou desvincula com null).
export function useLinkMediaToPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ insightId, postId }: { insightId: string; postId: string | null }) => {
      const { error } = await sbFrom("social_insights")
        .update({ post_id: postId } as never)
        .eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-insights"] });
      toast.success("Vínculo atualizado.");
    },
    onError: () => toast.error("Não foi possível vincular."),
  });
}

export function useDisconnectInstagram() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem sessão");
      const { error } = await sbFrom("social_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "instagram");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-connection"] });
      toast.success("Instagram desconectado.");
    },
    onError: () => toast.error("Erro ao desconectar."),
  });
}

// Dispara o refresh server-side (edge function) e recarrega os dados locais.
export function useSyncInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("instagram-sync");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-daily"] });
      qc.invalidateQueries({ queryKey: ["social-media-insights"] });
      qc.invalidateQueries({ queryKey: ["social-connection"] });
      toast.success("Insights atualizados!");
    },
    onError: () => toast.error("Não foi possível atualizar agora."),
  });
}

// Conexão de Instagram de um cliente específico (gerenciado pela social mídia).
export function useClientSocialConnection(crmClientId: string | null | undefined) {
  return useQuery<SocialConnection | null>({
    queryKey: ["social-connection-client", crmClientId],
    enabled: !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_connections")
        .select("id,user_id,provider,external_account_id,username,account_type,token_expires_at,connected_at,updated_at")
        .eq("crm_client_id", crmClientId!)
        .eq("provider", "instagram")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SocialConnection) ?? null;
    },
  });
}

// Inicia o OAuth do Instagram: pega o App ID público via edge function e redireciona pro consentimento.
// clientId (crm_client_id) opcional: conecta a conta NO contexto de um cliente gerenciado.
export async function connectInstagram(clientId?: string | null) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { toast.error("Faça login novamente."); return; }
    const { data, error } = await supabase.functions.invoke("get-instagram-config");
    if (error || !(data as { client_id?: string })?.client_id) {
      toast.error("Integração ainda não configurada. Tente novamente em breve.");
      return;
    }
    const cfg = data as { client_id: string; redirect_uri: string; scope?: string };
    const scope = cfg.scope ?? "instagram_business_basic,instagram_business_manage_insights";
    // state carrega o JWT (+ clientId quando conectando uma conta de cliente)
    const stateValue = clientId ? `${token}::${clientId}` : token;
    const url = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(cfg.client_id)}&redirect_uri=${encodeURIComponent(cfg.redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(stateValue)}`;
    window.location.href = url;
  } catch {
    toast.error("Integração ainda não configurada.");
  }
}
