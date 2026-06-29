import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// types.ts é travado — cast padrão (igual useSocialInsights/useModules).
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
};

export const MEDIA_KIT_DEFAULTS: MediaKitProfile = {
  headline: null,
  bio: null,
  niche: null,
  contact: null,
  cities: "",
  gender: { women: 60, men: 40 },
  audience: [
    { label: "25–34 anos", pct: 45 },
    { label: "35–44 anos", pct: 28 },
    { label: "18–24 anos", pct: 18 },
    { label: "45+ anos", pct: 9 },
  ],
  services: [
    { name: "Reels patrocinado", desc: "Roteiro + gravação + edição · 1 publicação", price: "R$ 0" },
    { name: "Sequência de Stories", desc: "3–5 stories com link e CTA", price: "R$ 0" },
    { name: "Carrossel educativo", desc: "Conteúdo + arte na identidade da marca", price: "R$ 0" },
  ],
  accent: "#0F6E56",
};

// Configuração editável do media kit (audiência, serviços/valores, contato…).
export function useMediaKitProfile() {
  const { user } = useAuth();
  return useQuery<MediaKitProfile>({
    queryKey: ["media-kit-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("media_kit_profiles")
        .select("headline,bio,niche,contact,cities,gender,audience,services,accent")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as MediaKitProfile | null;
      return { ...MEDIA_KIT_DEFAULTS, ...(row ?? {}) };
    },
  });
}

export function useSaveMediaKitProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MediaKitProfile>) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { error } = await sbFrom("media_kit_profiles")
        .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() } as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-kit-profile", user?.id] });
    },
    onError: () => toast.error("Não consegui salvar o media kit."),
  });
}

const BUCKET = "files";

export type CustomKitFile = { id: string; name: string; storage_path: string; created_at: string };

// PDF personalizado (o que a pessoa editou no Canva e subiu). Guardamos em files com category 'media_kit'.
export function useCustomMediaKit() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<CustomKitFile | null>({
    queryKey: ["media-kit-file", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id,name,storage_path,created_at")
        .eq("user_id", user!.id)
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

      const path = `${user.id}/media-kit-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("files").insert({
        user_id: user.id,
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
      qc.invalidateQueries({ queryKey: ["media-kit-file", user?.id] });
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
      qc.invalidateQueries({ queryKey: ["media-kit-file", user?.id] });
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
