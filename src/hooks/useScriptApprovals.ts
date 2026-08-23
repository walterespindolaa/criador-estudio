import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { cenasDe, type CaptureScene, type CaptureScript } from "@/hooks/useCaptureScripts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);
type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   APROVAÇÃO DO ROTEIRO PELO CLIENTE

   A social mídia gera um link, o cliente edita o texto e a ordem, finaliza, e
   ela confirma. Só a confirmação escreve no roteiro de verdade: o cliente
   trabalha numa cópia, então nada se perde se ele mexer sem querer.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ScriptApprovalItem = {
  id: string;
  approval_id: string;
  script_id: string | null;
  position: number;
  orig_title: string;
  orig_content: string;
  orig_scenes: CaptureScene[] | null;
  client_title: string | null;
  client_content: string | null;
  client_scenes: CaptureScene[] | null;
  client_position: number | null;
  client_comment: string | null;
  removed: boolean;
};

export type ScriptApproval = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  client_name: string | null;
  month: string;
  title: string;
  token: string;
  status: "aberto" | "enviado" | "aplicado";
  client_note: string | null;
  created_at: string;
  submitted_at: string | null;
  applied_at: string | null;
  itens?: ScriptApprovalItem[];
};

const tabelaFaltando = (msg: string) =>
  /does not exist|schema cache|could not find/i.test(msg ?? "");

/** Envios de roteiro do mês, para esta pasta de cliente. */
export function useScriptApprovals(month: string, crmClientId?: string | null, clientName?: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["script-approvals", agencyOwnerId, month, crmClientId ?? clientName ?? ""],
    enabled: !!agencyOwnerId && !!month && (!!crmClientId || !!clientName),
    queryFn: async (): Promise<ScriptApproval[]> => {
      let q = sbFrom("script_approvals")
        .select("*, itens:script_approval_items(*)")
        .eq("manager_id", agencyOwnerId)
        .eq("month", month)
        .order("created_at", { ascending: false });
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.eq("client_name", clientName);
      const { data, error } = await q;
      if (error) {
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }
      return (data ?? []) as ScriptApproval[];
    },
  });
}

/** Gera o link: guarda o "antes" de cada roteiro enviado. */
export function useCreateScriptApproval() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      month: string; crmClientId?: string | null; clientName?: string | null;
      title?: string; roteiros: CaptureScript[];
    }) => {
      const { data, error } = await sbFrom("script_approvals")
        .insert({
          manager_id: agencyOwnerId,
          crm_client_id: v.crmClientId ?? null,
          client_name: v.crmClientId ? null : (v.clientName ?? null),
          month: v.month,
          title: v.title?.trim() || "Roteiros de gravação",
        })
        .select("*")
        .single();
      if (error) throw error;
      const aprovacao = data as ScriptApproval;

      const itens = v.roteiros.map((r, i) => ({
        approval_id: aprovacao.id,
        script_id: r.id,
        position: i,
        orig_title: r.title ?? "",
        orig_content: r.content ?? "",
        orig_scenes: cenasDe(r),
      }));
      if (itens.length) {
        const { error: e2 } = await sbFrom("script_approval_items").insert(itens);
        if (e2) throw e2;
      }
      return aprovacao;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["script-approvals"] }); },
    onError: (e: Error) =>
      toast.error(tabelaFaltando(e.message)
        ? "Rode a migration da aprovação de roteiro (20260823000003) pra liberar o link."
        : "Não consegui gerar o link agora."),
  });
}

/** Confirma o que o cliente escreveu: vira o texto oficial do roteiro. */
export function useApplyScriptApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (approvalId: string) => {
      const { data, error } = await sbRpc("apply_script_approval", { _approval_id: approvalId });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: ["script-approvals"] });
      void qc.invalidateQueries({ queryKey: ["capture-scripts"] });
      toast.success(n > 0 ? `Pronto: ${n} roteiro(s) atualizados com o texto do cliente.` : "Nada pra aplicar.");
    },
    onError: () => toast.error("Não consegui aplicar as alterações."),
  });
}

/** Descarta o envio (o cliente vai receber outro link). */
export function useDeleteScriptApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("script_approvals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["script-approvals"] }); },
    onError: () => toast.error("Não consegui excluir este envio."),
  });
}

/** O que mudou num item: usado pro "antes e depois" da confirmação. */
export function mudancasDoItem(i: ScriptApprovalItem) {
  const cenasIguais = JSON.stringify(i.client_scenes ?? null) === JSON.stringify(i.orig_scenes ?? null);
  return {
    titulo: !!i.client_title && i.client_title !== i.orig_title,
    texto: i.client_content != null && i.client_content !== i.orig_content,
    cenas: i.client_scenes != null && !cenasIguais,
    ordem: i.client_position != null && i.client_position !== i.position,
    removido: i.removed,
    comentario: !!i.client_comment,
  };
}

export function itemFoiTocado(i: ScriptApprovalItem) {
  const m = mudancasDoItem(i);
  return m.titulo || m.texto || m.cenas || m.ordem || m.removido || m.comentario;
}
