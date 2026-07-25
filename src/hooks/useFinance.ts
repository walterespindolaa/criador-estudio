import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

export type FinType = "entrada" | "despesa";
export type FinStatus = "pago" | "pendente" | "atrasado";
export type FinContext = "pj" | "pf";
export type FinRecord = {
  id: string; manager_id: string; crm_client_id: string | null; context: FinContext;
  type: FinType; description: string; category: string | null; subcategory: string | null; amount: number;
  status: FinStatus; payment_method: string | null; date: string; recurring: boolean; recurring_id: string | null; transfer_group: string | null;
  created_at: string; updated_at: string;
};
export type FinRecordInput = Partial<Omit<FinRecord, "id" | "manager_id" | "created_at" | "updated_at">> & { type: FinType; description: string; amount: number };

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// opts.since (YYYY-MM-DD): quando informado, traz só lançamentos a partir dessa
// data (janela leve, ex.: a home do copiloto só precisa do mês corrente). Sem
// opts, mantém o comportamento antigo (histórico completo) pras telas de finanças.
export function useFinRecords(opts?: { since?: string }) {
  const { agencyOwnerId } = useActiveAccount();
  const since = opts?.since;
  return useQuery<FinRecord[]>({
    // Chave separada pra janela não colidir com o cache do histórico completo.
    queryKey: since ? ["fin-records", agencyOwnerId, "since", since] : ["fin-records", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const base = sbFrom("fin_records").select("*").eq("manager_id", agencyOwnerId!);
      const filtered = since ? base.gte("date", since) : base;
      // Teto generoso pra não puxar histórico infinito. Ordenado por data desc,
      // então os lançamentos mais recentes (usados nos relatórios/mês) estão sempre
      // presentes. Nota: contas com mais de 2000 lançamentos podem ter os mais
      // antigos truncados num relatório de período muito longo.
      const { data, error } = await filtered.order("date", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as FinRecord[];
    },
  });
}
export function useCreateFinRecord() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinRecordInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("fin_records").insert({ ...input, manager_id: agencyOwnerId } as never);
      if (error) throw error;
    },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar lançamento."),
  });
}
export function useUpdateFinRecord() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<FinRecordInput>) => {
      const { error } = await sbFrom("fin_records").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar."),
  });
}
export function useDeleteFinRecord() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("fin_records").delete().eq("id", id); if (error) throw error; },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: () => toast.error("Erro ao excluir."),
  });
}

// ===================== RECORRENTES =====================
export type FinRecurring = {
  id: string; manager_id: string; context: FinContext; type: FinType;
  description: string; category: string | null; subcategory: string | null;
  amount: number; due_day: number; crm_client_id: string | null;
  payment_method: string | null;
  active: boolean; start_date: string; end_date: string | null;
  created_at: string; updated_at: string;
};
export type FinRecurringInput = Partial<Omit<FinRecurring, "id" | "manager_id" | "created_at" | "updated_at">> & { description: string };

export function useFinRecurring() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<FinRecurring[]>({
    queryKey: ["fin-recurring", agencyOwnerId], enabled: !!agencyOwnerId,
    queryFn: async () => {
      // Recorrentes são poucas por agência; 500 é teto de segurança generoso.
      const { data, error } = await sbFrom("fin_recurring").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as FinRecurring[];
    },
  });
}
export function useCreateFinRecurring() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinRecurringInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("fin_recurring").insert({ ...input, manager_id: agencyOwnerId } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-recurring", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar recorrente."),
  });
}
export function useUpdateFinRecurring() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<FinRecurringInput>) => {
      const { error } = await sbFrom("fin_recurring").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-recurring", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar recorrente."),
  });
}
export function useDeleteFinRecurring() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("fin_recurring").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-recurring", agencyOwnerId] }),
    onError: () => toast.error("Erro ao excluir recorrente."),
  });
}
export function useGenerateRecurring() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: FinRecordInput[]): Promise<number> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (rows.length === 0) return 0;
      const payload = rows.map((r) => ({ ...r, manager_id: agencyOwnerId }));
      const { error } = await sbFrom("fin_records").insert(payload as never);
      if (error) throw error;
      return rows.length;
    },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao lançar recorrentes."),
  });
}

// ===================== TRANSFERÊNCIA PJ→PF =====================
export type TransferKind = "Pró-labore" | "Distribuição de lucros";
export function useCreateFinTransfer() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: TransferKind; amount: number; date: string; description: string }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const group = crypto.randomUUID();
      const base = { manager_id: agencyOwnerId, amount: input.amount, status: "pago", date: input.date, transfer_group: group };
      const rows = [
        { ...base, context: "pj", type: "despesa", category: input.kind === "Pró-labore" ? "Pró-labore" : "Distribuição", description: input.description || `${input.kind} (saída)` },
        { ...base, context: "pf", type: "entrada", category: input.kind === "Pró-labore" ? "Pró-labore" : "Distribuição de lucros", description: input.description || input.kind },
      ];
      const { error } = await sbFrom("fin_records").insert(rows as never);
      if (error) throw error;
    },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro na transferência."),
  });
}
export function useDeleteFinByGroup() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: string) => { const { error } = await sbFrom("fin_records").delete().eq("transfer_group", group); if (error) throw error; },
    // refetchType "all": a home (useOperationSignals) e a ficha do cliente usam
    // janelas de fin-records que ficam INATIVAS quando você está no Cria Caixa.
    // Com o refetchOnMount:false global, sem isto elas não recarregavam ao voltar
    // e a pendência/valor não atualizava. "all" revalida até as inativas.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" }),
    onError: () => toast.error("Erro ao excluir transferência."),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MENSALIDADES, instância mensal (modelo absorvido do Atlas).
// Cada mensalidade tem vida própria no mês: nasce PENDENTE, e você pode
//   • confirmar  → cria o lançamento (fin_record) e guarda o vínculo
//   • desfazer   → apaga o lançamento e volta a pendente   ← faltava isso
//   • pular      → status "pulado", com motivo, sem sumir do histórico
// ═══════════════════════════════════════════════════════════════════════

export type MonthlyStatus = "pendente" | "pago" | "pulado";
export type FinMonthly = {
  id: string; manager_id: string; crm_client_id: string | null;
  month_ref: string; due_date: string; amount: number;
  status: MonthlyStatus; skip_reason: string | null;
  fin_record_id: string | null; paid_at: string | null; created_at: string;
};

// 1º dia do mês, no formato do banco.
export const monthRefOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
// Vencimento real: respeita o payment_day do cliente sem estourar o fim do mês.
export function dueDateFor(monthRef: string, paymentDay: number | null | undefined): string {
  const [y, m] = monthRef.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(Number(paymentDay) || 1, 1), lastDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function useFinMonthly(monthRef: string) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<FinMonthly[]>({
    queryKey: ["fin-monthly", agencyOwnerId, monthRef],
    enabled: !!agencyOwnerId && !!monthRef,
    queryFn: async () => {
      const { data, error } = await sbFrom("fin_monthly")
        .select("*").eq("manager_id", agencyOwnerId!).eq("month_ref", monthRef)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FinMonthly[];
    },
  });
}

// Garante que existe uma instância do mês pra cada cliente ativo com mensalidade.
// Idempotente: o UNIQUE (crm_client_id, month_ref) impede duplicar.
export function useEnsureMonthly() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ monthRef, clients }: {
      monthRef: string;
      clients: { id: string; monthly_value: number | null; payment_day: number | null; status?: string }[];
    }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const rows = clients
        .filter((c) => c.status !== "inativo" && Number(c.monthly_value) > 0)
        .map((c) => ({
          manager_id: agencyOwnerId,
          crm_client_id: c.id,
          month_ref: monthRef,
          due_date: dueDateFor(monthRef, c.payment_day),
          amount: Number(c.monthly_value) || 0,
          status: "pendente" as MonthlyStatus,
        }));
      if (!rows.length) return;
      // ignoreDuplicates: não sobrescreve o que já foi pago/pulado.
      const { error } = await sbFrom("fin_monthly")
        .upsert(rows as never, { onConflict: "crm_client_id,month_ref", ignoreDuplicates: true } as never);
      if (error) throw error;
      // O upsert acima NÃO atualiza instâncias que já existem. Então mudar o
      // "Dia de pagamento" ou o valor mensal do cliente não refletia no mês.
      // Aqui sincronizamos SÓ as instâncias pendentes com o valor/dia atual.
      for (const r of rows) {
        await sbFrom("fin_monthly").update({ due_date: r.due_date, amount: r.amount } as never)
          .eq("crm_client_id", r.crm_client_id).eq("month_ref", r.month_ref).eq("status", "pendente");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-monthly", agencyOwnerId] }),
  });
}

// Confirmar recebimento: cria o lançamento e vincula à instância.
export function useConfirmMonthly() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ m, clientName }: { m: FinMonthly; clientName: string }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data: rec, error: e1 } = await sbFrom("fin_records").insert({
        manager_id: agencyOwnerId, crm_client_id: m.crm_client_id, context: "pj",
        type: "entrada", description: `Mensalidade, ${clientName}`, category: "Mensalidade",
        amount: m.amount, status: "pago", date: m.due_date, recurring: true,
      } as never).select("id").single();
      if (e1) throw e1;
      const { error: e2 } = await sbFrom("fin_monthly").update({
        status: "pago", paid_at: new Date().toISOString(), fin_record_id: (rec as { id: string }).id,
      } as never).eq("id", m.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      // "all" pra que a home e a ficha do cliente (queries inativas) reflitam o
      // check na hora, mesmo com o refetchOnMount:false global.
      qc.invalidateQueries({ queryKey: ["fin-monthly", agencyOwnerId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" });
      toast.success("Recebimento confirmado.");
    },
    onError: () => toast.error("Não consegui confirmar."),
  });
}

// DESFAZER: apaga o lançamento criado e volta a instância pra pendente.
export function useUndoMonthly() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: FinMonthly) => {
      if (m.fin_record_id) {
        const { error } = await sbFrom("fin_records").delete().eq("id", m.fin_record_id);
        if (error) throw error;
      }
      const { error } = await sbFrom("fin_monthly").update({
        status: "pendente", paid_at: null, fin_record_id: null, skip_reason: null,
      } as never).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-monthly", agencyOwnerId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" });
      toast.success("Desfeito. A mensalidade voltou pra pendente.");
    },
    onError: () => toast.error("Não consegui desfazer."),
  });
}

// PULAR o mês (com motivo). Não vira lançamento e não conta na previsão.
export function useSkipMonthly() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ m, reason }: { m: FinMonthly; reason?: string }) => {
      // Se já tinha virado lançamento, some com ele antes de pular.
      if (m.fin_record_id) await sbFrom("fin_records").delete().eq("id", m.fin_record_id);
      const { error } = await sbFrom("fin_monthly").update({
        status: "pulado", skip_reason: reason?.trim() || null, paid_at: null, fin_record_id: null,
      } as never).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-monthly", agencyOwnerId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" });
      toast.success("Mensalidade pulada neste mês.");
    },
    onError: () => toast.error("Não consegui pular."),
  });
}
