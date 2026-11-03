import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO TIKTOK E NO YOUTUBE (03/11/2026, só pro master por enquanto)

   Estado de UM post numa rede (linha de post_publicacoes) e as ações:
   conectar a conta, agendar na data do post, publicar agora e consultar a
   conta do TikTok (obrigatório pela regra de tela do TikTok). Token, envio
   do vídeo e API das redes ficam no servidor (redes-oauth, redes-publicar).
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type RedeNova = "tiktok" | "youtube";
export const NOME_REDE: Record<RedeNova, string> = { tiktok: "TikTok", youtube: "YouTube" };

export type PublicacaoRede = {
  id: string;
  status: "rascunho" | "na_fila" | "publicando" | "processando" | "publicado" | "erro" | "cancelado";
  titulo: string | null;
  texto: string | null;
  opcoes: Record<string, unknown> | null;
  permalink: string | null;
  erro: string | null;
  publicado_em: string | null;
};

export type ConexaoRede = {
  connection_id: string | null;
  origem: string | null;
  username: string | null;
  pode_publicar: boolean;
  motivo: string | null;
};

export type CriadorTikTok = {
  usuario: string | null;
  nome: string | null;
  foto: string | null;
  privacidades: string[];
  comentarioDesligado: boolean;
  duetoDesligado: boolean;
  costuraDesligada: boolean;
  duracaoMaxSeg: number | null;
};

async function erroDaFuncao(error: unknown, data: unknown): Promise<string> {
  const d = data as { error?: string } | null;
  if (d?.error) return d.error;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    const j = await ctx.json().catch(() => null) as { error?: string } | null;
    if (j?.error) return j.error;
  }
  return (error as Error | null)?.message ?? "Não deu certo. Tente de novo.";
}

export function useConexaoRede(postId: string | null | undefined, rede: RedeNova, ativo = true) {
  return useQuery<ConexaoRede | null>({
    queryKey: ["rede-conexao", postId, rede],
    enabled: !!postId && ativo,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("conexao_do_post", { _post_id: postId, _rede: rede });
      if (error) return null;
      return ((data as ConexaoRede[] | null) ?? [])[0] ?? null;
    },
  });
}

export function usePublicacaoRede(postId: string | null | undefined, rede: RedeNova, ativo = true) {
  return useQuery<PublicacaoRede | null>({
    queryKey: ["rede-publicacao", postId, rede],
    enabled: !!postId && ativo,
    // Enquanto publica ou o TikTok processa, acompanha sozinho.
    refetchInterval: (q) => {
      const st = (q.state.data as PublicacaoRede | null)?.status;
      return st === "publicando" || st === "processando" ? 15_000 : false;
    },
    queryFn: async () => {
      const { data, error } = await sbFrom("post_publicacoes")
        .select("id, status, titulo, texto, opcoes, permalink, erro, publicado_em")
        .eq("post_id", postId!).eq("rede", rede).maybeSingle();
      if (error) return null;
      return (data as unknown as PublicacaoRede | null) ?? null;
    },
  });
}

/** O cliente do post (pra conectar a conta certa). Null = conta do próprio criador. */
export function useCrmDoPost(postId: string | null | undefined, ativo = true) {
  return useQuery<string | null>({
    queryKey: ["post-crm-cliente", postId],
    enabled: !!postId && ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await sbFrom("posts").select("external_client_id").eq("id", postId!).maybeSingle();
      const ext = (data as { external_client_id?: string | null } | null)?.external_client_id;
      if (!ext) return null;
      const { data: ec } = await sbFrom("external_clients").select("crm_client_id").eq("id", ext).maybeSingle();
      return (ec as { crm_client_id?: string | null } | null)?.crm_client_id ?? null;
    },
  });
}

export async function conectarRede(rede: RedeNova, crmClientId: string | null) {
  const returnTo = window.location.pathname + window.location.search;
  const { data, error } = await supabase.functions.invoke("redes-oauth", {
    body: { rede, crm_client_id: crmClientId, return_to: returnTo },
  });
  const url = (data as { url?: string } | null)?.url;
  if (error || !url) { toast.error(await erroDaFuncao(error, data)); return; }
  window.location.href = url;
}

export function useCriadorTikTok(postId: string | null | undefined, ativo: boolean) {
  return useQuery<CriadorTikTok | null>({
    queryKey: ["tiktok-criador", postId],
    enabled: !!postId && ativo,
    staleTime: 0, // a regra do TikTok pede a consulta a cada vez que a tela abre
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("redes-publicar", { body: { acao: "criador", post_id: postId } });
      if (error) throw new Error(await erroDaFuncao(error, data));
      return (data as { criador?: CriadorTikTok } | null)?.criador ?? null;
    },
  });
}

function useInvalidar(postId: string | null | undefined, rede: RedeNova) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rede-publicacao", postId, rede] });
    qc.invalidateQueries({ queryKey: ["rede-conexao", postId, rede] });
  };
}

type Escolhas = { opcoes: Record<string, unknown>; titulo?: string | null; texto?: string | null };

export function useAgendarRede(postId: string | null | undefined, rede: RedeNova) {
  const inv = useInvalidar(postId, rede);
  return useMutation({
    mutationFn: async (v: Escolhas & { ligar: boolean }) => {
      const { error } = await sbRpc("agendar_publicacao_rede", {
        _post_id: postId, _rede: rede, _ligar: v.ligar, _opcoes: v.opcoes, _titulo: v.titulo ?? null, _texto: v.texto ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => { toast.success(v.ligar ? `Agendado no ${NOME_REDE[rede]} pra data do post.` : "Agendamento cancelado."); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePublicarAgoraRede(postId: string | null | undefined, rede: RedeNova) {
  const inv = useInvalidar(postId, rede);
  return useMutation({
    mutationFn: async (v: Escolhas) => {
      const { data: id, error } = await sbRpc("preparar_publicacao_rede", {
        _post_id: postId, _rede: rede, _opcoes: v.opcoes, _titulo: v.titulo ?? null, _texto: v.texto ?? null,
      });
      if (error) throw new Error(error.message);
      const { data, error: e2 } = await supabase.functions.invoke("redes-publicar", { body: { pub_id: id } });
      if (e2) throw new Error(await erroDaFuncao(e2, data));
      return data as { estado?: string; mensagem?: string };
    },
    onSuccess: (r) => {
      if (r?.estado === "publicado") toast.success(`Publicado no ${NOME_REDE[rede]}.`);
      else if (r?.estado === "processando") toast.success(r.mensagem ?? `O ${NOME_REDE[rede]} está processando o vídeo.`);
      else if (r?.estado === "erro") toast.error(r.mensagem ?? "Não saiu.");
      else if (r?.mensagem) toast(r.mensagem);
      inv();
    },
    onError: (e: Error) => { toast.error(e.message); inv(); },
  });
}
