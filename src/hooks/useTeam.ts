import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Tabelas de time não estão no types.ts, cast (igual useCrm/useHubCria).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export const TEAM_MODULES = [
  { code: "cria_gestao", label: "Gestão de clientes (CRM)" },
  { code: "cria_post", label: "Cria Post (posts + aprovação)" },
  { code: "hub_cria", label: "HUB Criativo (análises)" },
  { code: "agenda", label: "Agenda de criação" },
  { code: "cria_caixa", label: "Cria Caixa" },
  { code: "cria_captacao", label: "Cria Captação (painel de captações)" },
] as const;
export type TeamModuleCode = (typeof TEAM_MODULES)[number]["code"];
// Módulo financeiro (sensível): NÃO entra marcado por padrão no convite.
// Libera só o financeiro da EMPRESA; o Pessoal do dono nunca aparece pro colaborador.
/* Não é módulo pago: é uma permissão a mais pra COLABORADORA (nunca pra
   parceiro). Liga Produção, Conversas e Canal da marca dentro da conta da
   agência e o "Enviar para" com os parceiros dela. Vem desligada e não entra
   no convite: quem decide é a dona, no cartão da pessoa (09/10/2026). */
export const PERM_PARCEIROS = "parceiros_producao";
/* Cofre de acessos (Walter, 14/10/2026): ver as senhas dos clientes. Também é
   chave de confiança, não módulo: vem desligada e só a dona liga. O banco
   confere (cofre_dono_se_pode), então desligar aqui fecha de verdade. */
export const PERM_COFRE = "cofre_acessos";
/* Gerenciar a equipe (Walter, 19/10/2026): a colaboradora de confiança vê a
   aba Pessoas DESTA conta e convida, pausa, remove e muda acessos dos outros.
   O banco confere (pode_gerir_equipe). Não mexe no próprio vínculo nem compra
   assento. Caso de origem: a Gabi, que criou a Kollab com outro e-mail. */
export const PERM_EQUIPE = "gerenciar_equipe";
export const TEAM_MODULE_DEFAULT = TEAM_MODULES.filter((m) => m.code !== "cria_caixa").map((m) => m.code);

export type MemberPermission = {
  id: string; member_row_id: string; module_code: string; all_clients: boolean; client_ids: string[];
  /** Nível no módulo (19/10/2026). Sem a linha = sem acesso. */
  nivel?: "ver" | "editar" | "total" | null;
};
export type TeamMember = {
  id: string; manager_id: string; member_id: string; name: string | null; email: string | null;
  status: "ativo" | "pausado"; created_at: string;
  /** social_media = colaborador pleno; designer/editor_video/copy/trafego = parceiro. */
  role: string;
  /** Parceiro: ids de crm_clients que ele atende. Null ou vazio = todos (19/10/2026). */
  clientes_atendidos?: string[] | null;
  permissions: MemberPermission[];
};

// Assentos: 1 grátis + paid_collab_seats.
export function useCollabSeats(managerId?: string | null) {
  const { user } = useAuth();
  const alvo = managerId ?? user?.id;
  return useQuery({
    queryKey: ["collab-seats", alvo],
    enabled: !!alvo,
    queryFn: async () => {
      // Quem gerencia a equipe de outra conta não lê o perfil da dona: RPC.
      if (alvo !== user?.id) {
        const { data } = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown }>)(
          "equipe_assentos", { _manager: alvo });
        const paid = Math.max(0, Number(data) || 0);
        return { paid, total: 1 + paid };
      }
      const { data } = await supabase.from("profiles").select("paid_collab_seats").eq("id", alvo!).maybeSingle();
      const paid = Math.max(0, Number((data as { paid_collab_seats?: number } | null)?.paid_collab_seats) || 0);
      return { paid, total: 1 + paid };
    },
  });
}

// Permissões do colaborador logado sob o gestor ativo (p/ gate de módulo na UI).
// Retorna o conjunto de module_codes liberados. null = ainda carregando / não é colaborador.
export function useMyTeamPermissions(managerId: string | null | undefined) {
  return useQuery<Set<string>>({
    queryKey: ["my-team-perms", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "my_member_permissions", { target: managerId },
      );
      if (error) throw error;
      const rows = (data ?? []) as { module_code: string }[];
      return new Set(rows.map((r) => r.module_code));
    },
  });
}

export function useTeamMembers(managerId?: string | null) {
  const { user } = useAuth();
  const alvo = managerId ?? user?.id;
  return useQuery<TeamMember[]>({
    queryKey: ["team-members", alvo],
    enabled: !!alvo,
    queryFn: async () => {
      const { data: members, error } = await sbFrom("manager_members")
        .select("*").eq("manager_id", alvo!).order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (members ?? []) as unknown as TeamMember[];
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      const { data: perms } = await sbFrom("manager_member_permissions").select("*").in("member_row_id", ids);
      const byRow = new Map<string, MemberPermission[]>();
      for (const p of (perms ?? []) as unknown as MemberPermission[]) {
        const arr = byRow.get(p.member_row_id) ?? []; arr.push(p); byRow.set(p.member_row_id, arr);
      }
      return rows.map((r) => ({ ...r, permissions: byRow.get(r.id) ?? [] }));
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name?: string; modules?: string[]; all_clients?: boolean; client_ids?: string[]; role?: string; manager_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("manager-member-invite", { body: input });
      if (error) throw new Error(error.message);
      const err = (data as { error?: string })?.error;
      if (err === "no_seats") throw new Error("Você atingiu o limite de assentos. Adicione um assento pra convidar mais colaboradores.");
      if (err === "forbidden") throw new Error("Você não tem permissão pra convidar nesta conta.");
      if (err) throw new Error(err);
      return data as { ok: boolean; member_id: string; existed: boolean };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Convite enviado."); },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao convidar."),
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ativo" | "pausado" }) => {
      const { error } = await sbFrom("manager_members").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: () => toast.error("Erro ao atualizar colaborador."),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("manager_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Colaborador removido."); },
    onError: () => toast.error("Erro ao remover."),
  });
}

// Liga/desliga um módulo para um membro. O escopo de clientes segue o que o
// membro já tem (allClients/clientIds); sem eles, todos os clientes.
export function useSetMemberModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberRowId, moduleCode, enabled, allClients = true, clientIds = [], nivel }: {
      memberRowId: string; moduleCode: string; enabled: boolean; allClients?: boolean; clientIds?: string[];
      /** Nível no módulo; sem informar, mantém o que já estava (ou 'total' num módulo novo). */
      nivel?: "ver" | "editar" | "total";
    }) => {
      if (enabled) {
        const { error } = await sbFrom("manager_member_permissions").upsert(
          { member_row_id: memberRowId, module_code: moduleCode, all_clients: allClients, client_ids: allClients ? [] : clientIds, ...(nivel ? { nivel } : {}) } as never,
          { onConflict: "member_row_id,module_code" } as never,
        );
        if (error) throw error;
      } else {
        const { error } = await sbFrom("manager_member_permissions")
          .delete().eq("member_row_id", memberRowId).eq("module_code", moduleCode);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: () => toast.error("Erro ao salvar permissão."),
  });
}

/** Colaborador: quais clientes ele vê, em todos os módulos dele de uma vez
 *  (mesmo mecanismo all_clients/client_ids do convite). */
export function useSetMemberScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberRowId, allClients, clientIds }: { memberRowId: string; allClients: boolean; clientIds: string[] }) => {
      const { error } = await sbFrom("manager_member_permissions")
        .update({ all_clients: allClients, client_ids: allClients ? [] : clientIds } as never)
        .eq("member_row_id", memberRowId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: () => toast.error("Erro ao salvar os clientes."),
  });
}

/** Parceiro: quais clientes ele atende. Vazio = todos. O "Enviar para" e o
 *  gatilho do post (posts_guard_parceiro) respeitam isso. */
export function useSetParceiroClientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientes }: { id: string; clientes: string[] }) => {
      const { error } = await sbFrom("manager_members")
        .update({ clientes_atendidos: clientes.length ? clientes : null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["parceiros-aptos"] });
    },
    onError: () => toast.error("Erro ao salvar os clientes do parceiro."),
  });
}

export function useBuySeats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seats: number) => {
      const { data, error } = await supabase.functions.invoke("collab-seats-checkout", { body: { seats } });
      if (error) throw new Error(error.message);
      // Assinatura existente atualizada no Stripe (pró-rata): não há checkout pra abrir.
      if ((data as { updated?: boolean })?.updated) return { updated: true as const };
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("checkout_failed");
      window.location.href = url;
      return { updated: false as const };
    },
    onSuccess: (res) => {
      if (res?.updated) {
        qc.invalidateQueries({ queryKey: ["collab-seats"] });
        toast.success("Assento adicionado à sua assinatura. A diferença entra proporcional na próxima fatura.");
      }
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao abrir o checkout."),
  });
}

/* ── CÓDIGO "ME ADICIONE NO CRIA" (pente fino 23/09/2026) ─────────────────
   O parceiro que se cadastrou sozinho não tinha como chamar a agência. Ele
   copia um código de 6 letras, manda no WhatsApp; a social mídia cola na
   tela Equipe e o vínculo nasce sem convite por e-mail. RPCs na migration
   20260923000002. `as never`: as RPCs ainda não estão nos tipos gerados. */
type RpcSolto = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcSolto;

/** O código do parceiro logado (gera na primeira vez). */
export function useMeuCodigoParceiro(habilitado = true) {
  const { user } = useAuth();
  return useQuery<string>({
    queryKey: ["parceiro-codigo", user?.id],
    enabled: !!user && habilitado,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await rpc("parceiro_meu_codigo");
      if (error) throw new Error(error.message);
      return String(data ?? "");
    },
  });
}

/** A agência cola o código e vincula o parceiro. */
export function useVincularParceiroPorCodigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) => {
      const { data, error } = await rpc("agencia_vincular_parceiro", { _codigo: codigo });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { ok?: boolean; erro?: string; nome?: string; papel?: string };
      if (!r.ok) {
        const msg: Record<string, string> = {
          codigo_invalido: "Código inválido. São 6 letras e números, sem espaço.",
          nao_encontrado: "Não achei ninguém com esse código. Confere com o parceiro?",
          proprio_codigo: "Esse é o seu próprio código.",
          muitas_tentativas: "Muitas tentativas. Espera um minuto e tenta de novo.",
        };
        throw new Error(msg[r.erro ?? ""] ?? "Não consegui vincular agora.");
      }
      return r;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(`${r.nome ?? "Parceiro"} entrou na sua equipe de produção.`);
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Não consegui vincular."),
  });
}
