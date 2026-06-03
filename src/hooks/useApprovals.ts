import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Post } from "@/hooks/usePosts";
import { toast } from "sonner";

export type ApprovalStatus = "pendente" | "aprovado" | "ajuste_solicitado";

export type ApprovalPost = Post & {
  approval_status: ApprovalStatus | null;
  approval_updated_at: string | null;
};

export type ApprovalComment = {
  id: string;
  post_id: string;
  author_id: string | null;
  author_role: string;
  content: string;
  created_at: string;
};

export type ApprovalOverviewRow = {
  owner_id: string;
  name: string | null;
  avatar_url: string | null;
  pendentes: number;
  ajustes: number;
  aprovados: number;
};

// types.ts ainda não tem post_approval_comments nem as RPCs novas — cast (igual usePartner.ts).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
type RpcFn = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as RpcFn;

/** Fila de aprovação da conta ATIVA: posts em "Pronto" (status = editando). */
export function useApprovals() {
  const { activeAccountId } = useActiveAccount();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ownerId = activeAccountId;
  const isOwner = !!user?.id && user.id === ownerId; // só o dono (cliente) aprova
  const queryKey = ["approvals", ownerId] as const;

  const { data: queue = [], isLoading } = useQuery<ApprovalPost[]>({
    queryKey,
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", ownerId!)
        .eq("status", "editando")
        .order("approval_updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApprovalPost[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["posts", ownerId] });
    queryClient.invalidateQueries({ queryKey: ["approval-overview"] });
  };

  const approve = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await sbRpc("approve_post", { _post_id: postId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Post aprovado!"); invalidate(); },
    onError: (e: Error) => toast.error(e.message || "Erro ao aprovar."),
  });

  const requestAdjustment = useMutation({
    mutationFn: async ({ postId, comment }: { postId: string; comment: string }) => {
      const { error } = await sbRpc("request_post_adjustment", { _post_id: postId, _comment: comment });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Ajuste solicitado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message || "Erro ao solicitar ajuste."),
  });

  return { queue, isLoading, isOwner, approve, requestAdjustment };
}

/** Thread de comentários de um post. */
export function usePostApprovalComments(postId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["approval-comments", postId] as const;

  const { data: comments = [], isLoading } = useQuery<ApprovalComment[]>({
    queryKey,
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await sbFrom("post_approval_comments")
        .select("*")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ApprovalComment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ content, role }: { content: string; role: "cliente" | "social_media" }) => {
      if (!postId || !user?.id) throw new Error("Sem contexto");
      const { error } = await sbFrom("post_approval_comments").insert({
        post_id: postId, author_id: user.id, author_role: role, content,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao enviar comentário."),
  });

  return { comments, isLoading, addComment };
}

/** Painel cross-cliente da social media. */
export function useManagerApprovalOverview() {
  const { data = [], isLoading } = useQuery<ApprovalOverviewRow[]>({
    queryKey: ["approval-overview"],
    queryFn: async () => {
      const { data, error } = await sbRpc("manager_approval_overview");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ApprovalOverviewRow[];
    },
  });
  return { overview: data, isLoading };
}
