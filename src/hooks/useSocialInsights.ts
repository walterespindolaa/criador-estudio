import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// types.ts é travado, essas tabelas ainda não estão tipadas. Padrão de cast (igual useModules/useFinance).
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
  profile_picture_url: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  updated_at: string | null;
  // Contadores do perfil (SQL 04/09): opcionais pra ler antes da migration.
  followers_count?: number | null;
  follows_count?: number | null;
  media_count?: number | null;
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
  // metrics jsonb: reach, saved, shares, total_interactions, likes, comments, views e,
  // pra reels/vídeo, ig_reels_avg_watch_time e ig_reels_video_view_total_time (retenção).
  metrics: Record<string, number> | null;
  post_id: string | null;
  posts?: LinkedPost;
};

// Demografia de audiência (1 linha por bucket). metric: followers|engaged.
// dimension: age|gender|city|country.
export type AudienceRow = {
  metric: "followers" | "engaged";
  dimension: "age" | "gender" | "city" | "country";
  breakdown_value: string;
  value: number;
};

// Story capturado (snapshot; stories somem em 24h).
export type StoryInsight = {
  id: string;
  external_story_id: string;
  media_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  // metrics jsonb: reach, replies, total_interactions, navigation (o que a API liberar).
  metrics: Record<string, number> | null;
};

// Dono da conta ATIVA (quem manda nos dados de Instagram exibidos). Quando uma
// gestora/colaboradora abre a conta de um criador (account switcher / cockpit),
// os insights e a conexão são os do DONO, não os de quem está logado. Antes os
// hooks consultavam por auth.uid(): pra gestora a query voltava vazia e a tela
// pedia pra "conectar" um Instagram que o dono já tinha conectado.
// isOwnAccount gateia as ações que só o dono pode fazer (conectar, desconectar,
// atualizar via edge function, que roda com o JWT de quem clica).
export function useSocialAccountOwner() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const ownerId = activeAccountId ?? user?.id ?? null;
  return { ownerId, isOwnAccount: !!ownerId && ownerId === user?.id };
}

// Conexão Instagram da conta ativa (uma por provider). Não selecionamos access_token
// no client (e o banco nem deixa: grant de coluna sem access_token).
export function useSocialConnection() {
  const { ownerId } = useSocialAccountOwner();
  return useQuery<SocialConnection | null>({
    queryKey: ["social-connection", ownerId],
    enabled: !!ownerId,
    // A conexao vive no banco (por user_id), entao vale pra qualquer aparelho. Se a
    // pessoa conecta o Instagram no celular, o PC precisa buscar de novo: por isso
    // refazemos ao montar e ao focar a janela (o padrao global nao refaz no foco),
    // pra a conexao "aparecer" no PC sem precisar recarregar na mao.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_connections")
        // Lista explicita (o "*" tropeçaria no access_token, que tem grant de
        // coluna negado). Os 3 contadores exigem o SQL de 04/09 rodado antes.
        .select("id,user_id,provider,external_account_id,username,account_type,profile_picture_url,token_expires_at,connected_at,updated_at,followers_count,follows_count,media_count")
        .eq("user_id", ownerId!)
        .eq("provider", "instagram")
        .is("crm_client_id", null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SocialConnection) ?? null;
    },
  });
}

// Série diária da conta ativa (para gráficos de evolução).
export function useDailyMetrics(days = 30) {
  const { ownerId } = useSocialAccountOwner();
  return useQuery<DailyMetric[]>({
    queryKey: ["social-daily", ownerId, days],
    enabled: !!ownerId,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await sbFrom("social_metrics_daily")
        .select("date,followers,reach,impressions,profile_views,website_clicks,accounts_engaged,total_interactions")
        .eq("user_id", ownerId!)
        .eq("provider", "instagram")
        .is("crm_client_id", null) // conta própria (contas por-cliente ficam separadas)
        .gte("date", since)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyMetric[];
    },
  });
}

// Insights por mídia, já com o post do CRIA vinculado (quando houver).
export function useMediaInsights() {
  const { ownerId } = useSocialAccountOwner();
  return useQuery<MediaInsight[]>({
    queryKey: ["social-media-insights", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_insights")
        .select("id,object_id,media_type,caption,permalink,thumbnail_url,posted_at,metrics,post_id,posts(title,format,hook,pillar_id)")
        .eq("user_id", ownerId!)
        .eq("provider", "instagram")
        .eq("object_type", "media")
        .is("crm_client_id", null) // conta própria
        .order("posted_at", { ascending: false })
        // Teto generoso: a tela de Insights lista as mídias mais recentes; 200
        // cobre bem mais de um ano de posts sem puxar histórico infinito.
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as MediaInsight[];
    },
  });
}

// Demografia de audiência da conta ativa (age/gender/city/country x followers/engaged).
export function useAudienceDemographics() {
  const { ownerId } = useSocialAccountOwner();
  return useQuery<AudienceRow[]>({
    queryKey: ["social-audience", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_audience")
        .select("metric,dimension,breakdown_value,value")
        .eq("user_id", ownerId!)
        .eq("provider", "instagram")
        .is("crm_client_id", null)
        .order("value", { ascending: false })
        // Demografia tem no máx. alguns buckets por dimensão (idade/gênero/
        // cidade/país); 500 é folgado e evita puxar linhas antigas à toa.
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AudienceRow[];
    },
  });
}

// Stories capturados da conta ativa (mais recentes primeiro).
export function useStories() {
  const { ownerId } = useSocialAccountOwner();
  return useQuery<StoryInsight[]>({
    queryKey: ["social-stories", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_stories")
        .select("id,external_story_id,media_type,permalink,thumbnail_url,media_url,posted_at,metrics")
        .eq("user_id", ownerId!)
        .eq("provider", "instagram")
        .is("crm_client_id", null)
        .order("posted_at", { ascending: false })
        // Stories mais recentes primeiro; 100 cobre bastante snapshot sem excesso.
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as StoryInsight[];
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
  const { isOwnAccount } = useSocialAccountOwner();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem sessão");
      // Só o DONO desconecta. Gerenciando a conta de outra pessoa, o delete abaixo
      // (por user_id do logado) apagaria a conexão da conta ERRADA (a da gestora).
      // A UI esconde o botão; isto é o cinto de segurança.
      if (!isOwnAccount) throw new Error("Só o dono da conta pode desconectar o Instagram.");
      const { error } = await sbFrom("social_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "instagram")
        .is("crm_client_id", null);
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
  const { isOwnAccount } = useSocialAccountOwner();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // A edge roda com o JWT de quem clica e sincroniza as conexões DELE. Uma
      // gestora na conta de um criador sincronizaria a conta errada (ou daria
      // not_connected). A UI esconde o botão; isto é o cinto de segurança.
      if (!isOwnAccount) throw new Error("Só o dono da conta pode atualizar os insights.");
      const { data, error } = await supabase.functions.invoke("instagram-sync");
      if (error) throw error;
      return data as { demographics_rows?: number; demographics_error?: string | null; reconnect?: boolean } | null;
    },
    onSuccess: (data) => {
      // Token da conta própria expirou: a edge devolve reconnect:true. Nesse caso
      // NADA foi atualizado, entao nao mostramos "Insights atualizados!". Avisamos
      // pra reconectar e atualizamos a conexao (pra a UI refletir o estado expirado).
      if (data?.reconnect) {
        qc.invalidateQueries({ queryKey: ["social-connection"] });
        toast.warning("Sua conexao com o Instagram expirou. Reconecte a conta pra atualizar os insights.", { duration: 12000 });
        return;
      }
      qc.invalidateQueries({ queryKey: ["social-daily"] });
      qc.invalidateQueries({ queryKey: ["social-media-insights"] });
      qc.invalidateQueries({ queryKey: ["social-connection"] });
      qc.invalidateQueries({ queryKey: ["social-audience"] });
      qc.invalidateQueries({ queryKey: ["social-stories"] });
      // Diagnostico da demografia: se veio 0 linha com erro, mostra o motivo real
      // da Meta (pra a gente saber por que a audiencia nao puxa) e loga no console.
      if (data && !data.demographics_rows && data.demographics_error) {
        console.warn("[instagram-sync] demografia falhou:", data.demographics_error);
        toast.warning(`Demografia nao veio: ${String(data.demographics_error).slice(0, 160)}`, { duration: 12000 });
      } else {
        toast.success("Insights atualizados!");
      }
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
    // A função autentica pelo header e devolve um "ticket" (state) de uso único
    // o JWT NÃO vai mais na URL do OAuth.
    const { data, error } = await supabase.functions.invoke("get-instagram-config", {
      body: { crm_client_id: clientId ?? null },
    });
    if (error || !(data as { client_id?: string })?.client_id || !(data as { state?: string })?.state) {
      toast.error("Integração ainda não configurada. Tente novamente em breve.");
      return;
    }
    const cfg = data as { client_id: string; redirect_uri: string; scope?: string; state: string };
    const scope = cfg.scope ?? "instagram_business_basic,instagram_business_manage_insights";
    const url = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(cfg.client_id)}&redirect_uri=${encodeURIComponent(cfg.redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(cfg.state)}`;
    window.location.href = url;
  } catch {
    toast.error("Integração ainda não configurada.");
  }
}
