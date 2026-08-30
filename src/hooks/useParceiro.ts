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
  publica_em: string | null;
  /** Eixo de aprovação do CLIENTE, só leitura pro parceiro: depois de
   *  entregar, ele vê onde a peça está (pendente, aprovado, postado...). */
  aprovacao: string | null;
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

/* ── A FILA DO PARCEIRO (todas as agências de uma vez) ──────────────────── */
export function useFilaDoParceiro() {
  const { user } = useAuth();
  return useQuery<CardDaFila[]>({
    queryKey: ["parceiro-fila", user?.id],
    enabled: !!user,
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

  return { marcar, comentar };
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
    mutationFn: async (v: { postId: string; assigneeId: string | null; prazo: string | null; nomeParceiro?: string }) => {
      const { data, error } = await sbFrom("posts").update({
        assignee_id: v.assigneeId,
        prazo_producao: v.assigneeId ? v.prazo : null,
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
