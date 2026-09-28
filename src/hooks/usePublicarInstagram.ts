import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO INSTAGRAM PELO CRIA (ciclo 5 do plano de publicar, 28/09/2026)

   Estado de publicação de UM post + as três ações: publicar agora, ligar ou
   desligar a publicação automática, e checar a mídia antes. Tudo pesado
   (token, conversão de mídia, API da Meta) fica no servidor: aqui só chamamos
   as funções e mostramos o resultado.
   ═══════════════════════════════════════════════════════════════════════════ */

// types.ts é travado: colunas novas de posts e as RPCs ainda não estão tipadas.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type PublishStatus = "na_fila" | "publicando" | "publicado" | "erro" | null;

export type EstadoPublicacao = {
  id: string;
  auto_publish: boolean;
  publish_status: PublishStatus;
  publish_error: string | null;
  publicar_em: string | null;
  ig_permalink: string | null;
  external_client_id: string | null;
  approval_status: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
};

export type ConexaoDoPost = {
  connection_id: string | null;
  origem: string | null;
  username: string | null;
  pode_publicar: boolean;
  motivo: string | null;
};

export type ResultadoChecagem = {
  ok: boolean;
  pendentes: number;
  erros: string[];
};

export function usePublicacaoDoPost(postId: string | null | undefined) {
  return useQuery<EstadoPublicacao | null>({
    queryKey: ["ig-publicacao", postId],
    enabled: !!postId,
    // Enquanto publica, atualiza sozinho pra a pessoa ver o resultado.
    refetchInterval: (q) => (q.state.data?.publish_status === "publicando" ? 4000 : false),
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id,auto_publish,publish_status,publish_error,publicar_em,ig_permalink,external_client_id,approval_status,scheduled_date,scheduled_time")
        .eq("id", postId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EstadoPublicacao) ?? null;
    },
  });
}

export function useConexaoDoPost(postId: string | null | undefined) {
  return useQuery<ConexaoDoPost | null>({
    queryKey: ["ig-conexao-post", postId],
    enabled: !!postId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("ig_conexao_do_post", { _post_id: postId });
      // Sem permissão (ex.: parceiro) = não mostra nada, não é erro de tela.
      if (error) return null;
      return ((data as ConexaoDoPost[] | null) ?? [])[0] ?? null;
    },
  });
}

function useInvalidar(postId: string | null | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["ig-publicacao", postId] });
    // Selo nos cards: quadro do criador, quadro do cliente, agenda e calendário.
    for (const k of ["posts", "cria-posts", "external-posts-all", "manager-calendar"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function usePublicarAgora(postId: string | null | undefined) {
  const invalidar = useInvalidar(postId);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-publish", { body: { post_id: postId } });
      if (error) throw new Error((data as { error?: string } | null)?.error ?? error.message);
      const r = data as { estado: string; mensagem: string; permalink?: string | null; error?: string };
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      if (r.estado === "publicado") toast.success("Publicado no Instagram!");
      else if (r.estado === "aguardando") toast.info(r.mensagem);
      else toast.error(r.mensagem);
      invalidar();
    },
    onError: (e: Error) => { toast.error(e.message || "Não deu pra publicar agora."); invalidar(); },
  });
}

export function useAgendarPublicacao(postId: string | null | undefined) {
  const invalidar = useInvalidar(postId);
  return useMutation({
    mutationFn: async (ligar: boolean) => {
      const { error } = await sbRpc("ig_agendar_publicacao", { _post_id: postId, _ligar: ligar });
      if (error) throw new Error(error.message);
      return ligar;
    },
    onSuccess: (ligar) => {
      toast.success(ligar ? "Publicação automática ligada." : "Publicação automática desligada.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChecarMidia(postId: string | null | undefined) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-preparar-midia", { body: { post_id: postId } });
      if (error) throw new Error((data as { error?: string } | null)?.error ?? error.message);
      return data as ResultadoChecagem;
    },
  });
}
