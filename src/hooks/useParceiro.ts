import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PARCEIROS, o lado de quem produz

   O designer, o editor e o copy não enxergam a tabela de posts: tudo passa
   pelas RPCs `parceiro_*` (migration 20260828000001), que conferem o vínculo
   com a agência e devolvem só o que é da pessoa. O motivo está documentado na
   migration: a policy restritiva de `posts` depende de uma função que não
   existe no repositório, então mexer nela seria reescrever segurança no escuro.
   ═══════════════════════════════════════════════════════════════════════════ */

// As RPCs novas ainda não estão no types.ts gerado; mesmo padrão dos outros hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type CardDaFila = {
  post_id: string;
  titulo: string;
  formato: string | null;
  plataforma: string | null;
  producao_status: "aguardando" | "em_producao" | "entregue" | "ajuste";
  prazo_producao: string | null;
  /** null = sem prazo · proposto = aguardando o aceite do parceiro ·
   *  negociando = parceiro sugeriu outra data · aceito = combinado. */
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  cache: number | null;
  publica_em: string | null;
  assigned_at: string | null;
  agencia_id: string;
  agencia_nome: string;
  cliente_nome: string;
  cliente_handle: string | null;
  cliente_cor: string | null;
  cliente_logo: string | null;
  etiquetas: string[];
};

export type CardAberto = {
  id: string;
  titulo: string;
  formato: string | null;
  plataforma: string | null;
  gancho: string | null;
  roteiro: string | null;
  legenda: string | null;
  arte: unknown;
  blocos: unknown;
  notas: string | null;
  pasta_drive: string | null;
  referencia: string | null;
  etiquetas: string[];
  producao_status: string;
  prazo_producao: string | null;
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  publica_em: string | null;
  /** Eixo de aprovação do CLIENTE, só leitura pro parceiro: depois de
   *  entregar, ele vê onde a peça está (pendente, aprovado, postado...). */
  aprovacao: string | null;
  /** Valor combinado pela social mídia. Vira despesa no Caixa dela quando a
   *  peça é entregue; o parceiro precisa ver o que vai receber. */
  cache: number | null;
  agencia: string;
  marca: {
    nome: string | null;
    handle: string | null;
    cor: string | null;
    logo: string | null;
    hashtags: string[] | null;
  };
  comentarios: { id: string; texto: string; papel: string; em: string }[];
};

export type Parceiro = { member_id: string; nome: string; email: string | null; role: string };

export const ROTULO_PAPEL: Record<string, string> = {
  designer: "Designer",
  editor_video: "Editor de vídeo",
  copy: "Copy",
  trafego: "Tráfego",
};

/* SINCRONIA ENTRE DOIS LADOS (auditoria 04/09): não há realtime no app, e o
   cache global fica 5 min sem revalidar e não refaz ao focar a janela. Quem
   delega de um lado e quem entrega do outro estão em sessões diferentes: sem
   isto, a demanda nova só aparecia com F5. Estas queries revalidam a cada 45s
   e ao voltar pra aba. */
const SINCRONIA = { staleTime: 20_000, refetchInterval: 45_000, refetchOnWindowFocus: true } as const;

/* ── A FILA DO PARCEIRO (todas as agências de uma vez) ──────────────────── */
export function useFilaDoParceiro() {
  const { user } = useAuth();
  return useQuery<CardDaFila[]>({
    queryKey: ["parceiro-fila", user?.id],
    enabled: !!user,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minha_fila");
      if (error) {
        // Migration ainda não rodou: fila vazia em vez de tela quebrada.
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as CardDaFila[];
    },
  });
}

/* ── O CARD ABERTO ──────────────────────────────────────────────────────── */
export function useCardDoParceiro(postId: string | null) {
  return useQuery<CardAberto | null>({
    queryKey: ["parceiro-card", postId],
    enabled: !!postId,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_abrir_card", { _post_id: postId });
      if (error) throw error;
      return (data ?? null) as CardAberto | null;
    },
  });
}

/* ── AÇÕES DO PARCEIRO ──────────────────────────────────────────────────── */
export function useAcoesDoParceiro(postId: string | null) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["parceiro-fila"] });
    // Entregou: o card sai da fila e ENTRA em Entregues; sem invalidar aqui ele
    // "sumia" até o cache vencer (auditoria 04/09).
    void qc.invalidateQueries({ queryKey: ["parceiro-entregues"] });
    void qc.invalidateQueries({ queryKey: ["parceiro-agencias"] });
    if (postId) void qc.invalidateQueries({ queryKey: ["parceiro-card", postId] });
  };

  const marcar = useMutation({
    // Entregar aceita o link da versão final: é o antídoto do "qual arquivo é
    // o final?" que apareceu em toda pesquisa de fluxo com freelancer.
    mutationFn: async (v: { status: "em_producao" | "entregue"; link?: string }) => {
      const { error } = await sbRpc("parceiro_marcar", {
        _post_id: postId, _status: v.status, _link: v.link?.trim() || null,
      });
      if (error) throw error;
      return v.status;
    },
    onSuccess: (status) => {
      invalidar();
      toast.success(status === "entregue"
        ? "Entregue! A social mídia recebeu o aviso."
        : "Marcado como em produção.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui atualizar."),
  });

  const comentar = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await sbRpc("parceiro_comentar", { _post_id: postId, _texto: texto });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); },
    onError: (e: Error) => toast.error(e.message || "Não consegui comentar."),
  });

  /* Responder ao prazo proposto: topar fecha o combinado; sugerir outra data
     manda a contraproposta pra social mídia, com o motivo na conversa do
     card. Negociar data não trava o trabalho: o card segue produzível. */
  const responderPrazo = useMutation({
    mutationFn: async (v: { aceita: boolean; sugestao?: string; motivo?: string }) => {
      const { error } = await sbRpc("parceiro_responder_prazo", {
        _post_id: postId, _aceita: v.aceita,
        _sugestao: v.sugestao || null, _motivo: v.motivo?.trim() || null,
      });
      if (error) throw error;
      return v.aceita;
    },
    onSuccess: (aceitou) => {
      invalidar();
      toast.success(aceitou ? "Prazo combinado!" : "Sugestão enviada. A social mídia recebe agora.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui responder o prazo."),
  });

  /* ENTREGA COM ARQUIVO (fase 3). O parceiro não enxerga external_media_refs
     do dono (RLS), então: sobe no bucket `media` dentro da PRÓPRIA pasta (a
     policy do bucket permite) e registra o anexo no post do dono pela RPC
     security definer parceiro_anexar_entrega, que confere o card. */
  const anexar = useMutation({
    mutationFn: async (v: { arquivo: File; marcarEntregue?: boolean }) => {
      if (!postId) throw new Error("Sem card.");
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Faça login de novo.");
      const MAX = 80 * 1024 * 1024;
      if (v.arquivo.size > MAX) throw new Error("Arquivo acima de 80 MB: entregue pelo link da pasta.");
      const safe = v.arquivo.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const caminho = `${uid}/entregas/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("media")
        .upload(caminho, v.arquivo, { contentType: v.arquivo.type || undefined, upsert: false, cacheControl: "31536000" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("media").getPublicUrl(caminho);
      const { error } = await sbRpc("parceiro_anexar_entrega", {
        _post_id: postId, _view_url: pub.publicUrl, _file_name: v.arquivo.name,
        _file_type: v.arquivo.type || null, _file_size: v.arquivo.size, _thumbnail_url: null,
      });
      if (error) throw error;
      if (v.marcarEntregue) {
        const { error: e2 } = await sbRpc("parceiro_marcar", { _post_id: postId, _status: "entregue", _link: null });
        if (e2) throw e2;
      }
      return v.marcarEntregue ?? false;
    },
    onSuccess: (entregou) => {
      invalidar();
      toast.success(entregou ? "Arquivo anexado e card entregue!" : "Arquivo anexado ao card.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui anexar."),
  });

  return { marcar, comentar, responderPrazo, anexar };
}

/* ── CACHÊS (fase 3) ─────────────────────────────────────────────────────── */
export type CacheDaAgencia = {
  manager_id: string; agencia: string; pendente: number; pago: number; pendente_qtd: number; ultimo_pago: string | null;
};

/** Lado parceiro: quanto cada agência deve e já pagou (fin_records ligado a mim). */
export function useMeusCaches() {
  const { user } = useAuth();
  return useQuery<CacheDaAgencia[]>({
    queryKey: ["parceiro-caches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_meus_caches");
      if (error) return [];
      return (data ?? []) as CacheDaAgencia[];
    },
  });
}

export type CacheDoParceiro = {
  id: string; assignee_id: string; amount: number; status: string; date: string; description: string; post_id: string | null;
};

/** Lado social mídia: cachês lançados (despesas do Caixa ligadas a parceiro). */
export function useCachesDosParceiros(managerId: string | null) {
  return useQuery<CacheDoParceiro[]>({
    queryKey: ["caches-parceiros", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("fin_records")
        .select("id, assignee_id, amount, status, date, description, post_id")
        .eq("manager_id", managerId)
        .not("assignee_id", "is", null)
        .order("date", { ascending: false })
        .limit(300);
      if (error) return [];
      return (data ?? []) as CacheDoParceiro[];
    },
  });
}

/* ── CONVERSA DO CARD (lado social mídia) ──────────────────────────────────
   O parceiro já conversa pela RPC. A dona lê e escreve direto na thread
   (post_approval_comments), que a RLS dela permite. Só os papéis do time
   entram aqui: o que é do cliente externo fica no portal dele. */
export type MensagemCard = { id: string; author_role: string; content: string; created_at: string };

export function useConversaDoCard(postId: string | null) {
  const qc = useQueryClient();
  const chave = ["conversa-card", postId] as const;
  const lista = useQuery<MensagemCard[]>({
    queryKey: chave,
    ...SINCRONIA,
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await sbFrom("post_approval_comments")
        .select("id, author_role, content, created_at")
        .eq("post_id", postId)
        .in("author_role", ["parceiro", "social_media"])
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) return [];
      return (data ?? []) as MensagemCard[];
    },
  });
  const enviar = useMutation({
    mutationFn: async (texto: string) => {
      const { data: sess } = await supabase.auth.getUser();
      const { error } = await sbFrom("post_approval_comments").insert({
        post_id: postId, author_id: sess.user?.id ?? null, author_role: "social_media", content: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: chave }); },
    onError: () => toast.error("Não consegui enviar."),
  });
  return { mensagens: lista.data ?? [], carregando: lista.isLoading, enviar };
}

export type AgenciaDoParceiro = {
  agencia_id: string;
  agencia_nome: string;
  meu_papel: string;
  vinculo_status: string;
  abertos: number;
  entregues_30d: number;
};

/** As agências que me acoplaram, com quanto está na minha mão em cada uma e o
 *  que entreguei nos últimos 30 dias. A contagem de entregas é a semente do
 *  "quanto cada agência me deve" da fase 3. */
export function useMinhasAgencias() {
  const { user } = useAuth();
  return useQuery<AgenciaDoParceiro[]>({
    queryKey: ["parceiro-agencias", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minhas_agencias");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as AgenciaDoParceiro[];
    },
  });
}

/* ── O LADO DA SOCIAL MÍDIA ─────────────────────────────────────────────── */

/** Os parceiros ativos da agência, pro botão "Enviar para". */
export function useMeusParceiros() {
  const { user } = useAuth();
  return useQuery<Parceiro[]>({
    queryKey: ["meus-parceiros", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("meus_parceiros");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Parceiro[];
    },
  });
}

/* ── PRODUÇÃO EXTERNA (lado da social mídia) ────────────────────────────── */

export type PecaExterna = {
  id: string;
  title: string | null;
  format: string | null;
  producao_status: "aguardando" | "em_producao" | "entregue" | "ajuste" | null;
  prazo_producao: string | null;
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  approval_status: string | null;
  scheduled_date: string | null;
  assignee_id: string;
  external_client_id: string | null;
  updated_at: string | null;
};

/** Tudo que está na mão de parceiros: a matéria-prima do painel "Com
 *  parceiros". Ela é dona dos posts, então é consulta direta (a RLS dela já
 *  cobre, inclusive colaborador via acts_for). */
export function usePecasComParceiros(temParceiros: boolean) {
  const { user } = useAuth();
  return useQuery<PecaExterna[]>({
    queryKey: ["pecas-com-parceiros", user?.id],
    ...SINCRONIA,
    enabled: !!user && temParceiros,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id, title, format, producao_status, prazo_producao, prazo_status, prazo_sugerido, approval_status, scheduled_date, assignee_id, external_client_id, updated_at")
        .not("assignee_id", "is", null)
        .order("prazo_producao", { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as PecaExterna[];
    },
  });
}

/** A social mídia responde à sugestão de prazo do parceiro. Aceitar fecha o
 *  combinado na data sugerida; ela também pode manter/propor outra data pelo
 *  "Enviar para" (que reabre como proposto). Dona do post = update direto. */
export function useResolverPrazoSugerido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; dataAceita: string }) => {
      const { data, error } = await sbFrom("posts").update({
        prazo_producao: v.dataAceita,
        prazo_status: "aceito",
        prazo_sugerido: null,
      } as never).eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui fechar o prazo. Recarregue e tente de novo.");
      const [a, m, d] = v.dataAceita.split("-");
      const { error: cErr } = await sbFrom("post_approval_comments").insert({
        post_id: v.postId, content: `Prazo combinado: ${d}/${m}/${a}`, author_role: "social_media",
      } as never);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      toast.success("Prazo combinado. O parceiro é avisado.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui fechar o prazo."),
  });
}

/** Pedir ajuste (lado da social mídia). A pesquisa é unânime: rodada de
 *  revisão sem feedback CONSOLIDADO vira pingado de "aumenta a fonte" por
 *  áudio, e o freelancer perde a conta do que mudou. Por isso o motivo é
 *  obrigatório e entra na conversa do card, com a voz da social mídia. */
export function usePedirAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; motivo: string }) => {
      const motivo = v.motivo.trim();
      if (!motivo) throw new Error("Escreva o que precisa mudar, consolidado num texto só.");
      const { data, error } = await sbFrom("posts")
        .update({ producao_status: "ajuste" } as never)
        .eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui pedir o ajuste. Recarregue e tente de novo.");
      const { error: cErr } = await sbFrom("post_approval_comments").insert({
        post_id: v.postId, content: `Ajuste: ${motivo}`.slice(0, 4000), author_role: "social_media",
      } as never);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      toast.success("Ajuste pedido. O parceiro recebe o card de volta com o motivo.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui pedir o ajuste."),
  });
}

/** Delegar um card: quem escreve é a DONA do post, então aqui é update direto
 *  na tabela (a RLS dela já permite). `assignee_id` null remove a delegação. */
export function useDelegarPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; assigneeId: string | null; prazo: string | null; nomeParceiro?: string; cache?: number | null }) => {
      const { data, error } = await sbFrom("posts").update({
        assignee_id: v.assigneeId,
        // Cachê combinado (fase 3): vira despesa no Caixa quando entregar.
        cache_parceiro: v.assigneeId ? (v.cache ?? null) : null,
        prazo_producao: v.assigneeId ? v.prazo : null,
        // Prazo nasce PROPOSTO: o parceiro topa ou sugere outra data. Sem
        // data, não há o que aceitar (fica "a combinar").
        prazo_status: v.assigneeId && v.prazo ? "proposto" : null,
        prazo_sugerido: null,
        producao_status: v.assigneeId ? "aguardando" : null,
        assigned_at: v.assigneeId ? new Date().toISOString() : null,
      } as never).eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      // Bloqueio de RLS devolve zero linhas sem erro; sem isto a tela diria
      // "enviado" sem ter enviado.
      if (!data) throw new Error("Não consegui delegar. Recarregue e tente de novo.");
      return v;
    },
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      toast.success(v.assigneeId
        ? `Enviado pra ${v.nomeParceiro ?? "o parceiro"}. Ele recebe o aviso na hora.`
        : "Delegação removida.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui delegar."),
  });
}

/** Sou parceiro de alguém? Decide se o item "Minhas demandas" aparece e se o
 *  login cai direto na fila. Papel de parceiro em QUALQUER vínculo ativo basta. */
export function useSouParceiro() {
  const { user } = useAuth();
  return useQuery<boolean>({
    queryKey: ["sou-parceiro", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sbFrom("manager_members")
        .select("role")
        .eq("member_id", user!.id)
        .eq("status", "ativo");
      if (error) return false;
      const papeis = (data ?? []) as { role?: string | null }[];
      return papeis.some((p) => ["designer", "editor_video", "copy", "trafego"].includes(p.role ?? ""));
    },
  });
}
