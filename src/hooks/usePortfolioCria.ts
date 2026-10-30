import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/* PORTFÓLIO COM AS PEÇAS ENTREGUES PELO CRIA + CONVITE DO CRIAKUT NA HOME
   (Walter, 30/10/2026, mockup aprovado). Funções na migração
   20261030000002_criakut_portfolio_do_cria_e_convite.sql. O types.ts é
   travado, então as chamadas vão pelo rpc sem tipo. */
type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type StatusPeca = "com_agencia" | "com_cliente" | "liberada" | "recusada";

export type PecaDoCria = {
  post_id: string; titulo: string | null; capa: string; segmento: string | null;
  status: StatusPeca | null; com_marca: boolean | null; rotulo: string | null;
};
export type PecaPublica = { post_id: string; capa: string; rotulo: string };
export type PedidoNoCard = { id: string; status: StatusPeca; com_marca: boolean; prestador: string; regra_da_ficha: string | null };
export type PedidoDoCliente = {
  id: string; titulo: string | null; capa: string | null; prestador: string;
  escolha: "nao" | "sem_marca" | "com_marca" | null; rotulo_sem_marca: string;
};
export type ConviteCriakut = {
  base: string; tem_pagina: boolean; publicado: boolean; slug: string | null; nome: string | null;
  foto_url: string | null; capa_url: string | null; cidade: string | null; tem_capa: boolean; tem_busco: boolean;
  servicos: number; preco_min_centavos: number | null; portfolio: number; portfolio_aguardando: number;
  entregas_no_cria: number; papel: string | null; seguidores: number | null; visitas_30d: number; pedidos_30d: number;
};

const invalidar = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["criakut-pecas-cria"] });
  void qc.invalidateQueries({ queryKey: ["criakut-portfolio-publico"] });
  void qc.invalidateQueries({ queryKey: ["criakut-convite"] });
};

/** Dados do convite da home. null = sem acesso ao Criakut (não mostra nada). */
export function useConviteCriakut() {
  return useQuery({
    queryKey: ["criakut-convite"],
    staleTime: 60_000,
    queryFn: async (): Promise<ConviteCriakut | null> => {
      const { data, error } = await sbRpc("criakut_meu_convite");
      if (error) return null; // migração ainda não rodou: some em silêncio
      return (data as unknown as ConviteCriakut) ?? null;
    },
  });
}

export function useMinhasPecasCria(ativo = true) {
  return useQuery({
    queryKey: ["criakut-pecas-cria"],
    enabled: ativo,
    queryFn: async (): Promise<PecaDoCria[]> => {
      const { data, error } = await sbRpc("criakut_minhas_pecas_cria");
      if (error) throw error;
      return (data as unknown as PecaDoCria[]) ?? [];
    },
  });
}

export function usePortfolioPublico(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["criakut-portfolio-publico", slug],
    enabled: !!slug,
    queryFn: async (): Promise<PecaPublica[]> => {
      const { data, error } = await sbRpc("criakut_portfolio_publico", { _slug: slug });
      if (error) return [];
      return (data as unknown as PecaPublica[]) ?? [];
    },
  });
}

export function usePedirPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (posts: string[]) => {
      const { error } = await sbRpc("criakut_portfolio_pedir", { _posts: posts });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(qc); toast.success("Pedido enviado. Cada peça aparece quando o dono da marca liberar."); },
    onError: () => toast.error("Não consegui pedir agora. Tente de novo."),
  });
}

export function useTirarDoPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await sbRpc("criakut_portfolio_tirar", { _post: postId });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
    onError: () => toast.error("Não consegui tirar a peça."),
  });
}

/* ── Agência: o pedido dentro do card da peça ── */
export function usePedidoPortfolioDoCard(postId: string | null | undefined) {
  return useQuery({
    queryKey: ["portfolio-card", postId],
    enabled: !!postId,
    staleTime: 30_000,
    queryFn: async (): Promise<PedidoNoCard[]> => {
      const { data, error } = await sbRpc("portfolio_pedido_do_card", { _post: postId });
      if (error) return [];
      return (data as unknown as PedidoNoCard[]) ?? [];
    },
  });
}

export function useDecidirPortfolioAgencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, acao }: { id: string; acao: "pedir_cliente" | "recusar" }) => {
      const { error } = await sbRpc("portfolio_decidir_agencia", { _id: id, _acao: acao });
      if (error) throw error;
      return acao;
    },
    onSuccess: (acao) => {
      void qc.invalidateQueries({ queryKey: ["portfolio-card"] });
      toast.success(acao === "recusar" ? "Recusado. O parceiro foi avisado." : "Vai aparecer pro cliente no link de aprovação.");
    },
    onError: () => toast.error("Não consegui salvar a decisão."),
  });
}

/* ── Cliente: no link de aprovação, sem login ── */
export function usePedidosPortfolioDoCliente(token: string | null | undefined) {
  return useQuery({
    queryKey: ["portfolio-cliente", token],
    enabled: !!token,
    queryFn: async (): Promise<PedidoDoCliente[]> => {
      const { data, error } = await sbRpc("portfolio_pedidos_by_token", { _token: token });
      if (error) return [];
      return (data as unknown as PedidoDoCliente[]) ?? [];
    },
  });
}

export function useDecidirPortfolioCliente(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, escolha }: { id: string; escolha: "nao" | "sem_marca" | "com_marca" }) => {
      const { error } = await sbRpc("portfolio_decidir_by_token", { _token: token, _id: id, _escolha: escolha });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["portfolio-cliente"] }); toast.success("Escolha salva."); },
    onError: () => toast.error("Não consegui salvar. Tente de novo."),
  });
}
