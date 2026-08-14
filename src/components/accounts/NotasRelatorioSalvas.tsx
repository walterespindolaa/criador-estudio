import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { parseDateOnly } from "@/lib/date-br";

// Acesso "solto" à tabela nova (client_report_notes ainda não está nos types
// gerados). Mesmo padrão do ClientReportDialog.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

type Nota = { period_key: string; body: string | null; analysis_html?: string | null; updated_at: string | null };

// Notas de relatório já escritas pra este cliente (uma por período). A social
// mídia escreve o recado e a análise dentro do diálogo do relatório e os dois
// ficam salvos JUNTOS por período; aqui ela reabre depois só o texto ("nota do
// relatório do período X"), sem precisar gerar o relatório de novo.
export function NotasRelatorioSalvas({ crmClientId }: { crmClientId: string | null }) {
  const { agencyOwnerId } = useActiveAccount();
  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["report-notes-list", agencyOwnerId, crmClientId],
    enabled: !!agencyOwnerId && !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_report_notes")
        .select("period_key, body, analysis_html, updated_at")
        .eq("manager_id", agencyOwnerId!)
        .eq("crm_client_id", crmClientId!)
        .order("period_key", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Nota[]).filter((n) => (n.body ?? "").trim() || (n.analysis_html ?? "").trim());
    },
  });

  if (!crmClientId || notas.length === 0) return null;

  // period_key é "YYYY-MM-DD_YYYY-MM-DD" (intervalo do período do relatório).
  const label = (k: string) => {
    const [a, b] = k.split("_");
    const f = (s?: string) => (s ? parseDateOnly(s).toLocaleDateString("pt-BR") : "");
    return a && b ? `${f(a)} a ${f(b)}` : k;
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 text-left">
      <p className="text-sm font-body font-medium text-foreground">Notas de relatório salvas</p>
      <p className="text-xs text-muted-foreground font-body mt-0.5 mb-3">
        O recado e a análise que você escreveu em cada período ficam guardados aqui, mesmo sem gerar o PDF de novo.
      </p>
      <div className="space-y-2">
        {notas.map((n) => (
          <details key={n.period_key} className="rounded-xl border border-border bg-muted/20 px-3.5 py-2.5">
            <summary className="cursor-pointer text-xs font-body font-semibold text-foreground flex items-center justify-between gap-2">
              <span>Nota do relatório · {label(n.period_key)}</span>
              <span className="text-[10px] font-normal text-muted-foreground shrink-0">
                {n.updated_at ? `editada em ${new Date(n.updated_at).toLocaleDateString("pt-BR")}` : ""}
              </span>
            </summary>
            {(n.body ?? "").trim() && (
              <div className="mt-2">
                <p className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">Recado</p>
                <p className="mt-1 text-[13px] font-body text-foreground whitespace-pre-wrap leading-relaxed">{(n.body ?? "").trim()}</p>
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
        ))}
      </div>
    </div>
  );
}
