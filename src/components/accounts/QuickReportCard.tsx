import { useEffect, useMemo, useState } from "react";
import { FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExternalClients, useExternalPosts, type ExternalClient } from "@/hooks/useCriaPost";
import { useProfile } from "@/hooks/useProfile";
import { ClientReportDialog } from "@/components/accounts/ClientReportDialog";

// Relatório pronto em segundos: cliente + período + 1 clique.
// Personalização (análise da IA, editor, mês a mês) continua dentro do relatório.

const LS_CLIENT = "cria.relatorio-rapido.cliente";
const LS_PERIOD = "cria.relatorio-rapido.periodo";

const PRESETS = [
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "este-mes", label: "Este mês" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export function QuickReportCard() {
  const { clients } = useExternalClients();
  const active = useMemo(() => clients.filter((c) => c.active), [clients]);

  const [clientId, setClientId] = useState<string>(() => readLS(LS_CLIENT) ?? "");
  const [periodKey, setPeriodKey] = useState<PresetKey>(() => {
    const saved = readLS(LS_PERIOD);
    return PRESETS.some((p) => p.key === saved) ? (saved as PresetKey) : "30d";
  });
  const [open, setOpen] = useState(false);

  // Se o cliente salvo sumiu (ou é o primeiro acesso), assume o primeiro da lista.
  useEffect(() => {
    if (active.length === 0) return;
    if (!clientId || !active.some((c) => c.id === clientId)) setClientId(active[0].id);
  }, [active, clientId]);

  const selected: ExternalClient | null = active.find((c) => c.id === clientId) ?? null;

  if (active.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-warm-sm p-4 sm:p-5 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Zap className="h-4 w-4 text-primary" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-sm font-display font-bold text-foreground">Relatório rápido</h2>
          <p className="text-[11px] font-body text-muted-foreground">Escolha o cliente e o período, o relatório sai pronto pra enviar.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <select
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); writeLS(LS_CLIENT, e.target.value); }}
          aria-label="Cliente do relatório"
          className="w-full md:w-56 rounded-xl border border-border bg-card px-3 py-2 text-sm font-body"
        >
          {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setPeriodKey(p.key); writeLS(LS_PERIOD, p.key); }}
              className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
                periodKey === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Button onClick={() => setOpen(true)} disabled={!selected} className="md:ml-auto shrink-0">
          <FileText className="h-4 w-4 mr-1.5" /> Gerar relatório
        </Button>
      </div>

      {selected && open && (
        <QuickReportDialog client={selected} periodKey={periodKey} open={open} onOpenChange={setOpen} />
      )}
    </div>
  );
}

// Wrapper: carrega os posts do cliente escolhido e abre o relatório já no preset.
function QuickReportDialog({ client, periodKey, open, onOpenChange }: {
  client: ExternalClient;
  periodKey: PresetKey;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { posts } = useExternalPosts(client.id);
  const { profile } = useProfile();
  return (
    <ClientReportDialog
      open={open}
      onOpenChange={onOpenChange}
      client={client}
      posts={posts}
      managerName={profile?.name ?? undefined}
      initialPeriodKey={periodKey}
    />
  );
}
