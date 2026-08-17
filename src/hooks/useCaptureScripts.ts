import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// Cast único: as tabelas novas ainda não existem nos types gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

// ── BIBLIOTECA DE ROTEIROS DO CRIA CAPTAÇÃO ───────────────────────────────────
// VÁRIOS roteiros por cliente e por mês (tabela capture_scripts), fora da
// captação agendada. Cada roteiro pode ser copiado, aberto no teleprompter,
// editado, marcado como gravado e virar post. `crm_client_id` OU `client_name`
// (cliente avulso) identificam a pasta do cliente.
//
// LEITURA DEFENSIVA: antes de a migration rodar, o select falha; devolvemos []
// pra página abrir normalmente (só sem roteiros salvos).

export type CaptureScript = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  client_name: string | null;
  month: string; // "YYYY-MM"
  title: string;
  content: string;
  source: string; // manual | reel
  source_post_id: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export type CaptureScriptInput = {
  crm_client_id?: string | null;
  client_name?: string | null;
  month: string;
  title?: string;
  content: string;
  source?: string;
  source_post_id?: string | null;
};

export function useCaptureScripts() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CaptureScript[]>({
    queryKey: ["capture-scripts", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("capture_scripts")
        .select("*").eq("manager_id", agencyOwnerId!)
        .order("created_at", { ascending: true });
      if (error) return [];
      return (data ?? []) as CaptureScript[];
    },
  });
}

export function useAddCaptureScript() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CaptureScriptInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("capture_scripts").insert({
        manager_id: agencyOwnerId,
        crm_client_id: input.crm_client_id ?? null,
        client_name: input.client_name ?? null,
        month: input.month,
        title: input.title ?? "",
        content: input.content,
        source: input.source ?? "manual",
        source_post_id: input.source_post_id ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture-scripts"] }),
    onError: (e) => toast.error(e instanceof Error && /relation|does not exist/i.test(e.message)
      ? "Rode o SQL da captação (capture_scripts) pra salvar roteiros."
      : "Não consegui salvar o roteiro."),
  });
}

export function useUpdateCaptureScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<CaptureScript, "title" | "content" | "done" | "month" | "source_post_id">> }) => {
      const { error } = await sbFrom("capture_scripts")
        .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture-scripts"] }),
    onError: () => toast.error("Não consegui salvar o roteiro."),
  });
}

export function useDeleteCaptureScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("capture_scripts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture-scripts"] }),
    onError: () => toast.error("Não consegui excluir o roteiro."),
  });
}

// ── CLIENTE AVULSO DA CAPTAÇÃO ────────────────────────────────────────────────
// Pasta de cliente fora do CRM (ex.: job pontual). Os roteiros dele usam
// client_name = nome do avulso.

export type CaptureExtraClient = {
  id: string;
  manager_id: string;
  name: string;
  city: string | null;
  created_at: string;
};

export function useCaptureExtraClients() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CaptureExtraClient[]>({
    queryKey: ["capture-extra-clients", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("capture_extra_clients")
        .select("*").eq("manager_id", agencyOwnerId!)
        .order("name", { ascending: true });
      if (error) return [];
      return (data ?? []) as CaptureExtraClient[];
    },
  });
}

export function useAddCaptureExtraClient() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; city?: string | null }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("capture_extra_clients").insert({
        manager_id: agencyOwnerId, name: input.name.trim(), city: input.city?.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capture-extra-clients"] });
      toast.success("Cliente avulso adicionado.");
    },
    onError: (e) => toast.error(e instanceof Error && /relation|does not exist/i.test(e.message)
      ? "Rode o SQL da captação (capture_extra_clients) pra adicionar avulsos."
      : "Não consegui adicionar o cliente."),
  });
}

export function useDeleteCaptureExtraClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("capture_extra_clients").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture-extra-clients"] }),
    onError: () => toast.error("Não consegui remover o cliente avulso."),
  });
}

// ── TOMADAS PADRÃO POR CLIENTE (crm_clients.capture_shots) ────────────────────
// Sobrepõe a lista geral quando existir. Null/[] = usa a geral.
export function useSetClientCaptureShots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crmClientId, shots }: { crmClientId: string; shots: string[] }) => {
      const clean = shots.map((s) => s.trim()).filter(Boolean);
      const { error } = await sbFrom("crm_clients")
        .update({ capture_shots: clean.length ? clean : null }).eq("id", crmClientId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-clients"] }),
    onError: () => toast.error("Não consegui salvar as tomadas do cliente. Já rodou o SQL da captação?"),
  });
}

// ── ROTEIRO SALVO -> POST NO CRIA POST ────────────────────────────────────────
// Mesmo caminho do "Virar post" da captação: cria o rascunho em Produção e marca
// o roteiro com o post gerado (source_post_id) pra não duplicar.
export function useScriptToPost() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scriptId: string; externalClientId: string; title: string; script: string }): Promise<string> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("posts").insert({
        user_id: agencyOwnerId,
        external_client_id: input.externalClientId,
        status: "editando",
        approval_status: "em_producao",
        approval_mode: "fast",
        platform: "instagram",
        format: "reels",
        title: input.title.slice(0, 200),
        caption: null,
        script: input.script,
      }).select("id").single();
      if (error) throw new Error(error.message);
      const postId = (data as { id: string }).id;
      const { error: upErr } = await sbFrom("capture_scripts")
        .update({ source_post_id: postId }).eq("id", input.scriptId);
      if (upErr) throw new Error(upErr.message);
      return postId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capture-scripts"] });
      qc.invalidateQueries({ queryKey: ["cria-posts"] });
      qc.invalidateQueries({ queryKey: ["external-posts-all"] });
      qc.invalidateQueries({ queryKey: ["operation-posts"] });
      toast.success("Post criado em Produção. Monte a arte e a legenda por lá.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui criar o post."),
  });
}
