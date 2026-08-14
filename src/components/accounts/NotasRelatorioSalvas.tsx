import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { confirmar } from "@/components/shared/Confirm";
import { parseDateOnly } from "@/lib/date-br";

// Acesso "solto" à tabela nova (client_report_notes ainda não está nos types
// gerados). Mesmo padrão do ClientReportDialog.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

type Nota = { period_key: string; body: string | null; analysis_html?: string | null; next_steps?: string | null; updated_at: string | null };

type Props = {
  crmClientId: string | null;
  // Reabre o relatório completo daquele período (com os dados, a nota e a análise
  // restauradas) pra editar/baixar de novo, sem precisar guardar o PDF.
  onAbrirPeriodo?: (since: string, until: string) => void;
};

// Histórico de relatórios por período: a nota, os próximos passos e a análise
// ficam salvos por cliente+período. Cada item abre fechado (só o cabeçalho) e
// expande no clique; dá pra reabrir o relatório do período ou excluir a nota.
export function NotasRelatorioSalvas({ crmClientId, onAbrirPeriodo }: Props) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["report-notes-list", agencyOwnerId, crmClientId],
    enabled: !!agencyOwnerId && !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_report_notes")
        .select("period_key, body, analysis_html, next_steps, updated_at")
        .eq("manager_id", agencyOwnerId!)
        .eq("crm_client_id", crmClientId!)
        .order("period_key", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Nota[]).filter((n) => (n.body ?? "").trim() || (n.analysis_html ?? "").trim() || (n.next_steps ?? "").trim());
    },
  });

  const excluir = useMutation({
    mutationFn: async (periodKey: string) => {
      const { error } = await sbFrom("client_report_notes")
        .delete()
        .eq("manager_id", agencyOwnerId!)
        .eq("crm_client_id", crmClientId!)
        .eq("period_key", periodKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-notes-list", agencyOwnerId, crmClientId] });
      qc.invalidateQueries({ queryKey: ["report-notes"] });
      toast.success("Nota excluída.");
    },
    onError: () => toast.error("Não consegui excluir a nota."),
  });

  if (!crmClientId || notas.length === 0) return null;

  // period_key é "YYYY-MM-DD_YYYY-MM-DD" (intervalo do período do relatório).
  const partes = (k: string) => k.split("_");
  const label = (k: string) => {
    const [a, b] = partes(k);
    const f = (s?: string) => (s ? parseDateOnly(s).toLocaleDateString("pt-BR") : "");
    return a && b ? `${f(a)} a ${f(b)}` : k;
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 text-left">
      <p className="text-sm font-body font-medium text-foreground">Histórico de relatórios</p>
      <p className="text-xs text-muted-foreground font-body mt-0.5 mb-3">
        A nota, os próximos passos e a análise de cada período ficam salvos. Clique pra ver, reabrir o relatório ou excluir.
      </p>
      <div className="space-y-2">
        {notas.map((n) => {
          const [since, until] = partes(n.period_key);
          return (
            <details key={n.period_key} className="rounded-xl border border-border bg-muted/20 px-3.5 py-2.5">
              <summary className="cursor-pointer text-xs font-body font-semibold text-foreground flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                <span>Nota do relatório · {label(n.period_key)}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {n.updated_at ? `editada em ${new Date(n.updated_at).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                  {onAbrirPeriodo && since && until && (
                    <button
                      type="button"
                      title="Reabrir o relatório deste período (editar, baixar, compartilhar)"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAbrirPeriodo(since, until); }}
                      className="rounded-md p-1 text-muted-foreground hover:text-primary"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Excluir nota"
                    onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      const ok = await confirmar({
                        titulo: "Excluir esta nota de relatório?",
                        descricao: "O recado, os próximos passos e a análise deste período serão apagados.",
                        acao: "Excluir",
                      });
                      if (ok) excluir.mutate(n.period_key);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </summary>
              {(n.body ?? "").trim() && (
                <div className="mt-2">
                  <p className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">Recado</p>
                  <p className="mt-1 text-[13px] font-body text-foreground whitespace-pre-wrap leading-relaxed">{(n.body ?? "").trim()}</p>
                </div>
              )}
              {(n.next_steps ?? "").trim() && (
                <div className="mt-3">
                  <p className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">Próximos passos</p>
                  <p className="mt-1 text-[13px] font-body text-foreground whitespace-pre-wrap leading-relaxed">{(n.next_steps ?? "").trim()}</p>
                </div>
              )}
              {(n.analysis_html ?? "").trim() && (
                <div className="mt-3">
                  <p className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">Análise do período</p>
                  {/* HTML do editor da própria gestora (ou da IA), sanitizado antes de renderizar. */}
                  <div
                    className="mt-1 text-[13px] font-body text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(n.analysis_html ?? "") }}
                  />
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
