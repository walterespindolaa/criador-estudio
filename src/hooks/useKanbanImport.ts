import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { FORMATS_BY_PLATFORM } from "@/lib/constants";

// posts/external_media_refs fora dos types em alguns campos + RPC nova: cast padrão (ver src/lib/push.ts).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string, args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

export type KanbanMedia = {
  provider: string;
  external_file_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  view_url: string | null;
  thumbnail_url: string | null;
  download_url: string | null;
  bunny_video_id: string | null;
  position: number | null;
};

export type KanbanPost = {
  id: string;
  title: string;
  status: string | null;
  platform: string;
  format: string;
  caption: string | null;
  hook: string | null;
  script: string | null;
  cta: string | null;
  sections: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  created_at: string | null;
  media: KanbanMedia[];
};

// O kanban guarda o roteiro por blocos em `sections` (JSON de { text, captacao }).
// Quando o campo `script` está vazio, montamos um texto único a partir dos blocos.
function sectionsToText(sections: string | null): string {
  if (!sections) return "";
  try {
    const parsed = JSON.parse(sections) as unknown;
    if (!Array.isArray(parsed)) return "";
    const parts: string[] = [];
    parsed.forEach((s, i) => {
      const text = typeof s === "string"
        ? s
        : typeof (s as { text?: unknown })?.text === "string" ? (s as { text: string }).text : "";
      if (text.trim()) parts.push(parsed.length > 1 ? `Parte ${i + 1}: ${text.trim()}` : text.trim());
    });
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

export function useKanbanImport(criaOwnerId: string | null, externalClientId: string) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();

  // Lê o kanban do cliente via RPC (SECURITY DEFINER valida o vínculo gestor-cliente
  // em account_members, a mesma tabela do my_managed_accounts) e já traz as mídias.
  const kanbanQ = useQuery({
    queryKey: ["kanban-import", criaOwnerId],
    enabled: !!criaOwnerId,
    queryFn: async (): Promise<KanbanPost[]> => {
      const { data, error } = await sbRpc("manager_client_posts", { client_owner_id: criaOwnerId! });
      if (error) throw new Error(error.message);
      return (data as KanbanPost[] | null) ?? [];
    },
  });

  const importPosts = useMutation({
    mutationFn: async (selected: KanbanPost[]) => {
      let mediaFails = 0;
      for (const kp of selected) {
        // Garante formato compatível com a plataforma no Cria Post.
        const allowed = FORMATS_BY_PLATFORM[kp.platform] ?? [];
        const format = allowed.length && !allowed.includes(kp.format) ? allowed[0] : kp.format;
        const script = (kp.script ?? "").trim() || sectionsToText(kp.sections) || null;
        const { data: created, error } = await sbFrom("posts").insert({
          user_id: agencyOwnerId!,
          external_client_id: externalClientId,
          status: "editando",
          approval_status: "pendente",
          approval_mode: "fast",
          title: kp.title,
          platform: kp.platform,
          format,
          caption: kp.caption,
          hook: kp.hook,
          script,
          cta: kp.cta,
          scheduled_date: kp.scheduled_date,
          scheduled_time: kp.scheduled_time,
        }).select("id").single();
        if (error) throw error;
        const newId = (created as { id: string }).id;
        // Copia as referências de mídia (Drive, Storage, Bunny) pro post do Cria Post.
        for (const m of kp.media ?? []) {
          const { error: mErr } = await sbRpc("criapost_add_media", {
            p_post_id: newId,
            p_provider: m.provider,
            p_external_file_id: m.external_file_id,
            p_file_name: m.file_name,
            p_file_type: m.file_type,
            p_file_size: m.file_size,
            p_view_url: m.view_url,
            p_thumbnail_url: m.thumbnail_url,
            p_download_url: m.download_url,
            p_bunny_video_id: m.bunny_video_id,
          });
          if (mErr) mediaFails++;
        }
      }
      return { count: selected.length, mediaFails };
    },
    onSuccess: ({ count, mediaFails }) => {
      toast.success(count === 1 ? "1 post importado, já está na fila de aprovação!" : `${count} posts importados, já estão na fila de aprovação!`);
      if (mediaFails > 0) toast.warning(`${mediaFails} mídia(s) não puderam ser copiadas, confira nos posts.`);
      qc.invalidateQueries({ queryKey: ["cria-posts", externalClientId] });
      qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] });
    },
    onError: () => toast.error("Erro ao importar os posts do kanban."),
  });

  return { kanban: kanbanQ.data ?? [], isLoading: kanbanQ.isLoading, isError: kanbanQ.isError, importPosts };
}
