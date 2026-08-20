import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

// Leitura gestor→cliente CRIA via RPCs SECURITY DEFINER (vínculo validado em
// account_members, mesmo padrão da manager_client_posts). types.ts é travado,
// cast padrão do projeto (ver src/lib/tours/progress.ts / useKanbanImport).
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string, args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

// ===================== Foto/perfil dos clientes que usam o CRIA =====================
export type CriaClientProfile = {
  cria_owner_id: string;
  name: string | null;
  avatar_url: string | null;
  niche: string | null;
};

// Mapa cria_owner_id → profile (avatar sempre atual, sem depender do sync manual
// que gravava o logo no crm_clients só quando alguém abria a ficha do CRM).
export function useCriaClientProfiles() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Record<string, CriaClientProfile>>({
    queryKey: ["cria-client-profiles", agencyOwnerId],
    enabled: !!agencyOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("manager_clients_cria_profiles");
      if (error) throw new Error(error.message);
      const map: Record<string, CriaClientProfile> = {};
      ((data as CriaClientProfile[] | null) ?? []).forEach((p) => { map[p.cria_owner_id] = p; });
      return map;
    },
  });
}

// ===================== Instagram do cliente (dados já sincronizados) =====================
export type CriaClientIgDaily = {
  date: string;
  followers: number | null;
  reach: number | null;
  profile_views: number | null;
  total_interactions: number | null;
};
export type CriaClientIgMedia = {
  id: string;
  media_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  metrics: Record<string, number> | null;
  post_id?: string | null;   // vínculo com o post do Cria Post (se houver)
};
export type CriaClientIgAudience = {
  metric: "followers" | "engaged";
  dimension: "age" | "gender" | "city" | "country";
  breakdown_value: string;
  value: number;
};
export type CriaClientIgStory = {
  external_story_id: string;
  media_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  metrics: Record<string, number> | null;  // reach, replies, total_interactions, navigation
};
export type CriaClientInstagram = {
  connected: boolean;
  username?: string | null;
  profile_picture_url?: string | null;
  last_sync?: string | null;
  daily?: CriaClientIgDaily[];
  media?: CriaClientIgMedia[];
  audience?: CriaClientIgAudience[];   // demografia de audiência
  stories?: CriaClientIgStory[];       // snapshot de stories
};

export function useCriaClientInstagram(criaOwnerId: string | null | undefined) {
  return useQuery<CriaClientInstagram>({
    queryKey: ["cria-client-instagram", criaOwnerId],
    enabled: !!criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpc("manager_client_instagram", { client_owner_id: criaOwnerId! });
      if (error) throw new Error(error.message);
      return (data as CriaClientInstagram | null) ?? { connected: false };
    },
  });
}

// ===================== Instagram GERENCIADO (cliente sem conta Cria) =====================
// A social mídia conectou o Instagram do cliente na conta DELA (social_connections
// com crm_client_id). Os dados vivem nas mesmas tabelas do pipeline, separados
// pelo crm_client_id, e a leitura é direta por RLS (user_id = ela). Devolve o
// MESMO shape do RPC do cliente-com-Cria pra reaproveitar o painel inteiro.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useManagedClientInstagram(crmClientId: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CriaClientInstagram>({
    queryKey: ["managed-client-instagram", agencyOwnerId, crmClientId],
    enabled: !!crmClientId && !!agencyOwnerId,
    queryFn: async () => {
      const { data: conn, error: connErr } = await sbFrom("social_connections")
        .select("username, profile_picture_url, updated_at")
        .eq("user_id", agencyOwnerId!).eq("crm_client_id", crmClientId!).eq("provider", "instagram")
        .maybeSingle();
      if (connErr) throw connErr;
      if (!conn) return { connected: false };
      const c = conn as { username: string | null; profile_picture_url: string | null; updated_at: string | null };
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const [daily, media, audience, stories] = await Promise.all([
        sbFrom("social_metrics_daily")
          .select("date, followers, reach, profile_views, total_interactions")
          .eq("user_id", agencyOwnerId!).eq("crm_client_id", crmClientId!).eq("provider", "instagram")
          .gte("date", since).order("date", { ascending: true }),
        sbFrom("social_insights")
          .select("id, media_type, caption, permalink, thumbnail_url, posted_at, metrics, post_id")
          .eq("user_id", agencyOwnerId!).eq("crm_client_id", crmClientId!).eq("provider", "instagram")
          .eq("object_type", "media").order("posted_at", { ascending: false }).limit(48),
        sbFrom("social_audience")
          .select("metric, dimension, breakdown_value, value")
          .eq("user_id", agencyOwnerId!).eq("crm_client_id", crmClientId!).eq("provider", "instagram")
          .order("value", { ascending: false }).limit(500),
        sbFrom("social_stories")
          .select("external_story_id, media_type, permalink, thumbnail_url, media_url, posted_at, metrics")
          .eq("user_id", agencyOwnerId!).eq("crm_client_id", crmClientId!).eq("provider", "instagram")
          .order("posted_at", { ascending: false }).limit(60),
      ]);
      const firstErr = daily.error || media.error || audience.error || stories.error;
      if (firstErr) throw firstErr;
      return {
        connected: true,
        username: c.username, profile_picture_url: c.profile_picture_url, last_sync: c.updated_at,
        daily: (daily.data ?? []) as unknown as CriaClientIgDaily[],
        media: (media.data ?? []) as unknown as CriaClientIgMedia[],
        audience: (audience.data ?? []) as unknown as CriaClientIgAudience[],
        stories: (stories.data ?? []) as unknown as CriaClientIgStory[],
      };
    },
  });
}

// Vínculo mídia↔post do Cria no modo GERENCIADO: as linhas de social_insights
// são da própria social mídia, então é um update direto (RLS user_id = ela).
export function useLinkManagedMedia(crmClientId: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, postId }: { mediaId: string; postId: string | null }) => {
      const { error } = await sbFrom("social_insights").update({ post_id: postId } as never).eq("id", mediaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-client-instagram", agencyOwnerId, crmClientId] });
      qc.invalidateQueries({ queryKey: ["cria-posts"] });
    },
  });
}

// Dispara o sync das conexões da social mídia (a edge roda TODAS: a própria e as
// dos clientes) e recarrega o painel do cliente gerenciado.
export function useSyncManagedInstagram(crmClientId: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-sync");
      if (error) throw error;
      return data as { reconnect?: boolean } | null;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["managed-client-instagram", agencyOwnerId, crmClientId] });
      qc.invalidateQueries({ queryKey: ["social-connection-client", crmClientId] });
      if (data?.reconnect) return;
    },
  });
}

// Gestor vincula (ou desvincula, postId null) uma mídia do IG do cliente a um
// post que ele fez no Cria Post. O resultado real volta pro post no banco.
export function useLinkClientMedia(criaOwnerId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, postId }: { mediaId: string; postId: string | null }) => {
      const { error } = await sbRpc("manager_link_client_media", {
        client_owner_id: criaOwnerId, media_id: mediaId, link_post_id: postId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cria-client-instagram", criaOwnerId] });
      qc.invalidateQueries({ queryKey: ["cria-posts"] });
    },
  });
}

// ===================== Posts do Cria do cliente pra AGENDA da social mídia =====================
// Os posts REAIS que o cliente tem no Cria DELE (tabela `posts`, user_id = conta do
// cliente), já "prontos" em diante e COM data agendada. O gestor lê direto por RLS
// (is_account_member: ele é membro ativo da conta do cliente), numa query só pra
// todos os clientes vinculados de uma vez, pra não pesar. NÃO é post de aprovação por
// link (esses vivem em `posts.external_client_id`); é o kanban pessoal do criador.

// Estados do kanban do cliente (Criando.tsx) que valem pra Agenda quando o post
// TEM data marcada. Antes so aceitava editando/agendado/publicado ("prontos em
// diante"), mas o criador pode marcar uma data com o post ainda em coluna
// anterior (ideia/planejamento/produzindo). O calendario do PROPRIO cliente
// mostra QUALQUER post com scheduled_date (ver UpcomingPosts / Dashboard), entao
// a Agenda do gestor sumia com posts que o cliente ja agendou pra um dia so
// porque nao estavam em "Pronto". Agora todo post COM data aparece pro gestor,
// igual o cliente ve. O filtro que importa e ter scheduled_date, nao a coluna.
export const CLIENT_CRIA_READY_STATUSES = ["ideia", "roteiro", "gravando", "editando", "agendado", "publicado"] as const;

export type ClientCriaAgendaPost = {
  id: string;
  user_id: string;
  title: string | null;
  status: string | null;
  platform: string | null;
  format: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  crm_client_id: string | null;   // resolvido no map (pra abrir o kanban do cliente)
  client_name: string | null;
  client_color: string | null;
};

export type ClientCriaLink = { criaOwnerId: string; crmClientId: string; name: string; color: string | null };

export function useClientCriaAgendaPosts(links: ClientCriaLink[], from: string, to: string) {
  // Deduplica por conta Cria (o mesmo owner pode aparecer em teoria) e ordena a chave.
  const byOwner = new Map(links.map((l) => [l.criaOwnerId, l]));
  const owners = Array.from(byOwner.keys()).sort();
  return useQuery<ClientCriaAgendaPost[]>({
    queryKey: ["client-cria-agenda-posts", owners, from, to],
    enabled: owners.length > 0 && !!from && !!to,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, user_id, title, status, platform, format, scheduled_date, scheduled_time")
        .in("user_id", owners)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .in("status", CLIENT_CRIA_READY_STATUSES as unknown as string[])
        .is("deleted_at", null)
        .is("external_client_id", null);   // só o kanban pessoal do criador, não os de aprovação
      if (error) throw new Error(error.message);
      type RawPost = Omit<ClientCriaAgendaPost, "crm_client_id" | "client_name" | "client_color">;
      return (((data as unknown as RawPost[] | null) ?? [])).map((p) => {
        const link = byOwner.get(p.user_id);
        return {
          ...p,
          crm_client_id: link?.crmClientId ?? null,
          client_name: link?.name ?? null,
          client_color: link?.color ?? null,
        };
      });
    },
  });
}

// ===================== Brandbook do cliente (modo leitura) =====================
export type CriaClientBrandItem = { type: string; name: string; value: string | null };
export type CriaClientPersona = {
  name: string | null;
  age_range: string | null;
  gender: string | null;
  location: string | null;
  pain_points: string[] | null;
  desires: string[] | null;
  interests: string[] | null;
  how_you_help: string | null;
};
export type CriaClientMoodboardEntry = { section: string; question_key: string; answer: string | null };
export type CriaClientBrandbook = {
  profile: { name: string | null; niche: string | null; avatar_url: string | null } | null;
  pillars: string[];
  brand_items: CriaClientBrandItem[];
  personas: CriaClientPersona[];
  moodboard: CriaClientMoodboardEntry[];
};

export function useCriaClientBrandbook(criaOwnerId: string | null | undefined) {
  return useQuery<CriaClientBrandbook>({
    queryKey: ["cria-client-brandbook", criaOwnerId],
    enabled: !!criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpc("manager_client_brandbook", { client_owner_id: criaOwnerId! });
      if (error) throw new Error(error.message);
      const d = (data as Partial<CriaClientBrandbook> | null) ?? {};
      return {
        profile: d.profile ?? null,
        pillars: d.pillars ?? [],
        brand_items: d.brand_items ?? [],
        personas: d.personas ?? [],
        moodboard: d.moodboard ?? [],
      };
    },
  });
}
