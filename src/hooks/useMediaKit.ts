import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import type { MostrarKit } from "@/lib/mediaKitCapas";

// types.ts é travado, cast padrão (igual useSocialInsights/useModules).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type AudienceBand = { label: string; pct: number };
export type KitService = { name: string; desc: string; price: string };

export type MediaKitProfile = {
  headline: string | null;
  bio: string | null;
  niche: string | null;
  contact: string | null;
  cities: string | null;
  gender: { women?: number; men?: number } | null;
  audience: AudienceBand[] | null;
  services: KitService[] | null;
  accent: string | null;
  link: string | null;
  /** Nome exibido no kit (se null, cai no nome do perfil). */
  display_name: string | null;
  /** Foto própria do kit (a do IG expira no CDN e sumia do PDF). */
  avatar_url: string | null;
  /** Seção "Melhores conteúdos" é opcional. */
  show_top_posts: boolean | null;
  /** Ids (media_insights.id) escolhidos a dedo; null = top 3 automático. */
  featured_post_ids: string[] | null;
  /* LINK PRA MANDAR PRA MARCA (06/11/2026). Colunas novas: antes do SQL
     rodar, elas não vêm do banco e ficam com o padrão abaixo. */
  capa: string | null;
  slug: string | null;
  publico: boolean;
  mostrar: Partial<MostrarKit> | null;
  aviso_mensal: boolean;
};

export const MEDIA_KIT_DEFAULTS: MediaKitProfile = {
  headline: null,
  bio: null,
  niche: null,
  contact: null,
  cities: "",
  gender: { women: 60, men: 40 },
  audience: [
    { label: "25-34 anos", pct: 45 },
    { label: "35-44 anos", pct: 28 },
    { label: "18-24 anos", pct: 18 },
    { label: "45+ anos", pct: 9 },
  ],
  services: [
    { name: "Reels patrocinado", desc: "Roteiro + gravação + edição · 1 publicação", price: "R$ 0" },
    { name: "Sequência de Stories", desc: "3-5 stories com link e CTA", price: "R$ 0" },
    { name: "Carrossel educativo", desc: "Conteúdo + arte na identidade da marca", price: "R$ 0" },
  ],
  accent: "#0F6E56",
  link: null,
  display_name: null,
  avatar_url: null,
  show_top_posts: true,
  featured_post_ids: null,
  capa: "cria",
  slug: null,
  publico: false,
  mostrar: null,
  aviso_mensal: true,
};

/** Colunas que só existem depois do SQL de 07/11 (link público do kit). */
const COLUNAS_NOVAS = ["capa", "slug", "publico", "mostrar", "aviso_mensal"] as const;
const faltaColuna = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST204" || e.code === "42703" || /column .* does not exist|could not find the .* column/i.test(e.message ?? ""));
const faltaTabela = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST205" || e.code === "42P01" || /relation .* does not exist|could not find the table/i.test(e.message ?? ""));

/** Cores de destaque prontas do kit (o verde era fixo e parecia aleatório). */
export const KIT_ACCENTS = ["#0F6E56", "#7A1F3D", "#0061EE", "#EA4918", "#7C3AED", "#DB2777", "#B45309", "#1F2937"] as const;

// Configuração editável do media kit (audiência, serviços/valores, contato…).
/* Dono = conta aberta, não quem está logado (18/10/2026, "Meu perfil"). */
function useDonoDoKit() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  return activeAccountId ?? user?.id ?? null;
}

export function useMediaKitProfile() {
  const dono = useDonoDoKit();
  return useQuery<MediaKitProfile>({
    queryKey: ["media-kit-profile", dono],
    enabled: !!dono,
    queryFn: async () => {
      // "*" de propósito: as colunas novas do link público só existem depois do
      // SQL; com a lista explícita a tela quebraria antes dele rodar.
      const { data, error } = await sbFrom("media_kit_profiles")
        .select("*")
        .eq("user_id", dono!)
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as MediaKitProfile | null;
      return { ...MEDIA_KIT_DEFAULTS, ...(row ?? {}) };
    },
  });
}

export function useSaveMediaKitProfile() {
  const dono = useDonoDoKit();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MediaKitProfile>) => {
      if (!dono) throw new Error("Sem sessão");
      const linha = { user_id: dono, ...patch, updated_at: new Date().toISOString() };
      const { error } = await sbFrom("media_kit_profiles").upsert(linha as never, { onConflict: "user_id" });
      if (error && faltaColuna(error)) {
        // SQL do link público ainda não rodou: salva o resto e avisa o que ficou.
        const semNovas = Object.fromEntries(Object.entries(linha).filter(([k]) => !(COLUNAS_NOVAS as readonly string[]).includes(k)));
        const { error: e2 } = await sbFrom("media_kit_profiles").upsert(semNovas as never, { onConflict: "user_id" });
        if (e2) throw e2;
        if (COLUNAS_NOVAS.some((k) => k in patch)) throw new Error("FALTA_SQL");
        return;
      }
      if (error) {
        if (error.code === "23505") throw new Error("SLUG_EM_USO");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-kit-profile", dono] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "FALTA_SQL") toast.error("O link do kit ainda não está ligado no banco. Falta rodar o SQL do media kit.");
      else if (msg === "SLUG_EM_USO") toast.error("Esse endereço já é de outra pessoa. Tente outro.");
      else toast.error("Não consegui salvar o media kit.");
    },
  });
}

/* ── VERSÕES POR MARCA ─────────────────────────────────────────────── */
export type VersaoKit = { id: string; nome: string; slug: string; capa: string | null; accent: string | null; mostrar: Partial<MostrarKit> | null };

export function useVersoesKit() {
  const dono = useDonoDoKit();
  const qc = useQueryClient();
  const query = useQuery<{ lista: VersaoKit[]; semTabela: boolean }>({
    queryKey: ["media-kit-versoes", dono],
    enabled: !!dono,
    queryFn: async () => {
      const { data, error } = await sbFrom("media_kit_versoes")
        .select("id,nome,slug,capa,accent,mostrar")
        .eq("user_id", dono!)
        .order("created_at", { ascending: true });
      if (error) { if (faltaTabela(error)) return { lista: [], semTabela: true }; throw error; }
      return { lista: (data ?? []) as unknown as VersaoKit[], semTabela: false };
    },
  });
  const criar = useMutation({
    mutationFn: async (v: { nome: string; slug: string; capa: string | null; accent: string | null; mostrar: Partial<MostrarKit> | null }) => {
      if (!dono) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("media_kit_versoes").insert({ user_id: dono, ...v } as never).select("id,nome,slug,capa,accent,mostrar").single();
      if (error) {
        if (faltaTabela(error)) throw new Error("FALTA_SQL");
        if (error.code === "23505") throw new Error("SLUG_EM_USO");
        throw error;
      }
      return data as unknown as VersaoKit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-kit-versoes", dono] }),
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg === "FALTA_SQL" ? "As versões ainda não estão ligadas no banco. Falta rodar o SQL do media kit."
        : msg === "SLUG_EM_USO" ? "Você já tem uma versão com esse nome." : "Não consegui criar a versão.");
    },
  });
  const atualizar = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<VersaoKit> & { id: string }) => {
      const { error } = await sbFrom("media_kit_versoes").update({ ...patch, updated_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-kit-versoes", dono] }),
    onError: () => toast.error("Não consegui salvar a versão."),
  });
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("media_kit_versoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-kit-versoes", dono] }),
    onError: () => toast.error("Não consegui excluir a versão."),
  });
  return { versoes: query.data?.lista ?? [], semTabela: query.data?.semTabela ?? false, criar, atualizar, excluir };
}

/** Quantas vezes o link foi aberto nos últimos 7 dias (null = SQL ainda não rodou). */
export function useAberturasKit() {
  const dono = useDonoDoKit();
  return useQuery<{ semana: number; total: number } | null>({
    queryKey: ["media-kit-aberturas", dono],
    enabled: !!dono,
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      const [s, t] = await Promise.all([
        sbFrom("media_kit_aberturas").select("id", { count: "exact", head: true }).eq("user_id", dono!).gte("aberto_em", desde),
        sbFrom("media_kit_aberturas").select("id", { count: "exact", head: true }).eq("user_id", dono!),
      ]);
      if (s.error || t.error) return null;
      return { semana: s.count ?? 0, total: t.count ?? 0 };
    },
  });
}

/* ── LEITURA PÚBLICA (página do link) ─────────────────────────────── */
export type KitPublico = {
  nome: string;
  handle: string | null;
  avatar_url: string | null;
  niche: string;
  bio: string;
  capa: string;
  accent: string;
  contato: string | null;
  cidades: string | null;
  genero: { women?: number; men?: number } | null;
  audiencia: AudienceBand[] | null;
  servicos: KitService[] | null;
  stats: { followers: number; reachMonth: number; engagementPct: number; saves: number } | null;
  desempenho: { followersGrowth: number; profileViews: number; accountsEngaged: number; interactions: number; avgReach: number; postsCount: number } | null;
  posts: { title: string; format: string; reach: number; saves: number; thumbnail_url: string | null }[];
  atualizado_em: string | null;
  versao: string | null;
};

export async function buscarKitPublico(slug: string, versao: string | null, contar: boolean): Promise<KitPublico | null> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("media_kit_publico", { _slug: slug, _versao: versao, _contar: contar });
  if (error) throw error;
  return (data as KitPublico | null) ?? null;
}

const BUCKET = "files";

export type CustomKitFile = { id: string; name: string; storage_path: string; created_at: string };

// PDF personalizado (o que a pessoa editou no Canva e subiu). Guardamos em files com category 'media_kit'.
export function useCustomMediaKit() {
  const { user } = useAuth();
  const dono = useDonoDoKit();
  const qc = useQueryClient();

  const query = useQuery<CustomKitFile | null>({
    queryKey: ["media-kit-file", dono],
    enabled: !!dono,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id,name,storage_path,created_at")
        .eq("user_id", dono!)
        .eq("category", "media_kit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CustomKitFile) ?? null;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Sem sessão");
      if (file.type !== "application/pdf") throw new Error("Envie um PDF.");
      if (file.size > 15 * 1024 * 1024) throw new Error("Máx. 15 MB.");

      // remove o anterior (mantém só um media kit ativo)
      const prev = query.data;
      if (prev) {
        await supabase.storage.from(BUCKET).remove([prev.storage_path]);
        await supabase.from("files").delete().eq("id", prev.id);
      }

      // Pasta da DONA da conta: a policy "Managers manage files" deixa a social
      // media gravar ali, e a própria dona consegue abrir depois. Na pasta da
      // sessão, a cliente não lia o próprio media kit.
      const path = `${dono ?? user.id}/media-kit-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("files").insert({
        user_id: dono ?? user.id,
        name: file.name,
        storage_path: path,
        file_type: "application/pdf",
        size_bytes: file.size,
        category: "media_kit",
        source: "media_kit",
      } as never);
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-kit-file", dono] });
      toast.success("Media kit enviado!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const cur = query.data;
      if (!cur) return;
      await supabase.storage.from(BUCKET).remove([cur.storage_path]);
      await supabase.from("files").delete().eq("id", cur.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-kit-file", dono] });
      toast.success("Media kit removido.");
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const openFile = async () => {
    const cur = query.data;
    if (!cur) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(cur.storage_path, 60 * 60);
    if (error || !data?.signedUrl) { toast.error("Não consegui abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return { file: query.data ?? null, isLoading: query.isLoading, upload, remove, openFile };
}
