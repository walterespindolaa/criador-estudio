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
  published_at: string | null;
  format: string | null;
  // Conferência final e opções (28/10/2026).
  publish_conferido_por: string | null;
  publish_conferido_em: string | null;
  publish_sem_aprovacao_motivo: string | null;
  publish_aviso: string | null;
  ig_opcoes: OpcoesIg | null;
};

/** Opções do Instagram por post (gravadas por ig_salvar_opcoes). */
export type OpcoesIg = {
  collaborators?: string[];
  user_tags?: Array<{ username: string; x?: number; y?: number }>;
  alt_text?: string;
  trial?: "MANUAL" | "SS_PERFORMANCE";
  share_to_feed?: boolean;
  musica_celular?: boolean;
  /** Story com figurinha (enquete, caixinha, link...): sai pelo app. */
  pelo_celular?: boolean;
  /** O que vai na figurinha do story (29/10/2026). Qualquer uma liga pelo_celular. */
  figurinhas?: FigurinhasStory;
};

export type FigurinhasStory = {
  link?: { url: string; texto?: string };
  enquete?: { pergunta: string; opcoes?: string[] };
  caixinha?: { pergunta: string };
  musica?: { nome: string };
  local?: { nome: string };
};

/** Resumo curto ("link · enquete") pra cards e avisos. */
export function resumoFigurinhas(f: FigurinhasStory | null | undefined): string {
  if (!f) return "";
  return [f.link && "link", f.enquete && "enquete", f.caixinha && "caixinha", f.musica && "música", f.local && "local"].filter(Boolean).join(" · ");
}

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
    // Sempre rebusca ao abrir o post (o padrão do app guarda 5 min e o painel
    // mostrava a data antiga).
    staleTime: 0,
    // Enquanto publica, atualiza sozinho pra a pessoa ver o resultado.
    refetchInterval: (q) => (q.state.data?.publish_status === "publicando" ? 4000 : false),
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id,auto_publish,publish_status,publish_error,publicar_em,ig_permalink,external_client_id,approval_status,scheduled_date,scheduled_time,published_at,format,publish_conferido_por,publish_conferido_em,publish_sem_aprovacao_motivo,publish_aviso,ig_opcoes")
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

export function useInvalidarPublicacao(postId: string | null | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["ig-publicacao", postId] });
    // Selo nos cards: quadro do criador, quadro do cliente, agenda, calendário e Publicações.
    for (const k of ["posts", "cria-posts", "external-posts-all", "manager-calendar", "publicacoes"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function usePublicarAgora(postId: string | null | undefined) {
  const invalidar = useInvalidarPublicacao(postId);
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
  const invalidar = useInvalidarPublicacao(postId);
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

/* ── Conferência final (Walter, 28/10/2026) ──────────────────────────────────
   Post só entra na fila depois que alguém confere o perfil, a mídia e a
   legenda. Sem aprovação do cliente, precisa do motivo (fica registrado). */
export function useConferirPublicacao(postId: string | null | undefined) {
  const invalidar = useInvalidarPublicacao(postId);
  return useMutation({
    mutationFn: async ({ motivo, agora }: { motivo?: string | null; agora?: boolean }) => {
      const { data, error } = await sbRpc("ig_conferir_publicacao", { _post_id: postId, _motivo: motivo ?? null, _agora: !!agora });
      if (error) throw new Error(error.message);
      const linha = ((data as Array<{ publicar_em: string }> | null) ?? [])[0];
      if (agora) {
        // Publica já (não espera o robô do próximo minuto).
        const { data: r, error: e } = await supabase.functions.invoke("instagram-publish", { body: { post_id: postId } });
        if (e) throw new Error((r as { error?: string } | null)?.error ?? e.message);
        return { agora: true, resultado: r as { estado: string; mensagem: string }, publicar_em: linha?.publicar_em ?? null };
      }
      return { agora: false, resultado: null, publicar_em: linha?.publicar_em ?? null };
    },
    onSuccess: (r) => {
      if (r.agora && r.resultado) {
        if (r.resultado.estado === "publicado") toast.success("Publicado no Instagram!");
        else if (r.resultado.estado === "aguardando") toast.info(r.resultado.mensagem);
        else toast.error(r.resultado.mensagem);
      } else toast.success("Conferido. Sai sozinho no horário.");
      invalidar();
    },
    onError: (e: Error) => { toast.error(e.message || "Não deu pra conferir."); invalidar(); },
  });
}

export function useDesfazerConferencia(postId: string | null | undefined) {
  const invalidar = useInvalidarPublicacao(postId);
  return useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("ig_desfazer_conferencia", { _post_id: postId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Conferência desfeita. O post não sai sozinho."); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSalvarOpcoesIg(postId: string | null | undefined) {
  const invalidar = useInvalidarPublicacao(postId);
  return useMutation({
    mutationFn: async (opcoes: OpcoesIg) => {
      const { data, error } = await sbRpc("ig_salvar_opcoes", { _post_id: postId, _opcoes: opcoes });
      if (error) throw new Error(error.message);
      return data as OpcoesIg;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Cota de publicações pela API nas últimas 24 h da conta do post. */
export function useCotaIg(postId: string | null | undefined, ligado = true) {
  return useQuery<{ usado: number; total: number } | null>({
    queryKey: ["ig-cota", postId],
    enabled: !!postId && ligado,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-publish", { body: { cota_post_id: postId } });
      if (error) return null;
      return ((data as { cota?: { usado: number; total: number } | null } | null)?.cota) ?? null;
    },
  });
}

/** Card de stories ("story" no banco; "stories" por garantia). Desde
 *  28/10/2026 o Cria publica story (1 imagem ou 1 vídeo de até 60 s, sem
 *  figurinha, enquete, link nem música: limite da API da Meta). */
export function ehStory(formato: string | null | undefined): boolean {
  const f = (formato ?? "").trim().toLowerCase();
  return f === "story" || f === "stories";
}

/* PUBLICAR DE NOVO (Walter, 29/10/2026): o post saiu e foi apagado no
   Instagram. A edge confere no Instagram antes de liberar (não duplica). */
export type ResultadoRepublicar = { ok: boolean; motivo?: "no_ar" | "sem_conferir" | "nao_publicado"; situacao?: string };
export function useRepublicar(postId: string | null | undefined) {
  const invalidar = useInvalidarPublicacao(postId);
  return useMutation({
    mutationFn: async (forcar: boolean): Promise<ResultadoRepublicar> => {
      const { data, error } = await supabase.functions.invoke("instagram-publish", { body: { republicar_post_id: postId, forcar } });
      if (error) throw new Error("Não consegui liberar agora. Tente de novo.");
      return (data ?? { ok: false }) as ResultadoRepublicar;
    },
    onSuccess: (r) => { if (r.ok) { invalidar(); toast.success("Pronto: o post voltou pra \"Pronto pra sair\". Agende ou publique de novo."); } },
  });
}
