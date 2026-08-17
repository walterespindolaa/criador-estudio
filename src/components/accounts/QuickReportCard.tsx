import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseDateOnly } from "@/lib/date-br";
import { useExternalClients, useExternalPosts, type ExternalClient } from "@/hooks/useCriaPost";
import { useCrmClients } from "@/hooks/useCrm";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { useCriaClientProfiles } from "@/hooks/useManagerClientCria";
import { useProfile } from "@/hooks/useProfile";
import { ClientReportDialog } from "@/components/accounts/ClientReportDialog";

// DD/MM/AAAA pro gatilho do campo de data (a string já é YYYY-MM-DD, dá pra fatiar).
function ddmmyyyy(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// Date -> YYYY-MM-DD pelos componentes locais (dia de calendário, sem UTC).
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Campo de data visual: clica -> abre o calendário shadcn num popover; seleciona
// o dia -> fecha e guarda como string YYYY-MM-DD (fuso BR). Mesmo padrão do TasksTab/CriaPostBoard.
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateOnly(value) : undefined;
  return (
    <div className="flex-1 min-w-0">
      <Label className="text-[11px] font-body text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="mt-1 flex w-full sm:w-44 items-center gap-1.5 h-10 rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? ddmmyyyy(value) : "dd/mm/aaaa"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selected} defaultMonth={selected}
            onSelect={(dt) => { if (dt) { onChange(isoFromDate(dt)); setOpen(false); } }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Relatório pronto em segundos: cliente + período + 1 clique.
// Personalização (análise da IA, editor, mês a mês) continua dentro do relatório.

const LS_CLIENT = "cria.relatorio-rapido.cliente";
const LS_PERIOD = "cria.relatorio-rapido.periodo";
const LS_CUSTOM_FROM = "cria.relatorio-rapido.custom-de";
const LS_CUSTOM_TO = "cria.relatorio-rapido.custom-ate";

const PRESETS = [
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "este-mes", label: "Este mês" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];
// "custom" = período personalizado de/até (dois inputs date).
type PeriodKey = PresetKey | "custom";

function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export function QuickReportCard() {
  const { clients } = useExternalClients();
  const { data: crmClients = [] } = useCrmClients();
  const { data: criaProfiles } = useCriaClientProfiles();
  // Nome ATUALIZADO no seletor (a lista mostrava o name antigo do portal):
  // apelido do gestor > nome ao vivo do Cria > name. E cliente com cadastro
  // central INATIVO sai da lista (era a "Fabi" fantasma no dropdown).
  const active = useMemo(() => {
    const rotulo = (c: ExternalClient) => {
      const crm = c.crm_client_id ? crmClients.find((k) => k.id === c.crm_client_id) ?? null : null;
      const live = crm?.cria_owner_id ? criaProfiles?.[crm.cria_owner_id]?.name ?? null : null;
      return (crm ? nomeExibidoCliente(crm, live) : "") || c.name;
    };
    return clients
      .filter((c) => c.active)
      .filter((c) => {
        const crm = c.crm_client_id ? crmClients.find((k) => k.id === c.crm_client_id) : null;
        return !crm || crm.status !== "inativo";
      })
      .map((c) => ({ ...c, _rotulo: rotulo(c) }))
      .sort((a, b) => a._rotulo.localeCompare(b._rotulo, "pt-BR"));
  }, [clients, crmClients, criaProfiles]);

  const [clientId, setClientId] = useState<string>(() => readLS(LS_CLIENT) ?? "");
  const [periodKey, setPeriodKey] = useState<PeriodKey>(() => {
    const saved = readLS(LS_PERIOD);
    if (saved === "custom") return "custom";
    return PRESETS.some((p) => p.key === saved) ? (saved as PresetKey) : "30d";
  });
  // Período personalizado (de/até, YYYY-MM-DD). Só entra em ação quando periodKey === "custom".
  const [customFrom, setCustomFrom] = useState<string>(() => readLS(LS_CUSTOM_FROM) ?? "");
  const [customTo, setCustomTo] = useState<string>(() => readLS(LS_CUSTOM_TO) ?? "");
  const customValid = !!customFrom && !!customTo && customFrom <= customTo;
  const [open, setOpen] = useState(false);

  // Se o cliente salvo sumiu (ou é o primeiro acesso), assume o primeiro da lista.
  useEffect(() => {
    if (active.length === 0) return;
    if (!clientId || !active.some((c) => c.id === clientId)) setClientId(active[0].id);
  }, [active, clientId]);

  const selected: ExternalClient | null = active.find((c) => c.id === clientId) ?? null;

  if (active.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.09] via-primary/[0.04] to-transparent shadow-warm-sm p-4 sm:p-5 mb-5">
      {/* Fundo destacado no estilo Cria pra deixar claro: isto é o gerador de
          relatório, não o filtro da página. */}
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-sm">
          <Zap className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-sm font-display font-extrabold text-foreground">Gerar relatório do cliente</h2>
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
          {active.map((c) => <option key={c.id} value={c.id}>{c._rotulo}</option>)}
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
          {/* Período personalizado: ativa os dois inputs de/até abaixo. */}
          <button
            type="button"
            onClick={() => { setPeriodKey("custom"); writeLS(LS_PERIOD, "custom"); }}
            className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
              periodKey === "custom"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Período
          </button>
        </div>

        <Button
          onClick={() => setOpen(true)}
          disabled={!selected || (periodKey === "custom" && !customValid)}
          className="md:ml-auto shrink-0"
        >
          <FileText className="h-4 w-4 mr-1.5" /> Gerar relatório
        </Button>
      </div>

      {/* Campos de/até só aparecem no modo "Período". Clicar abre o calendário visual
          (mesmo DateField do TasksTab/CriaPostBoard). Mobile-first: empilham em 390px,
          viram lado a lado a partir do sm. A data continua indo como YYYY-MM-DD. */}
      {periodKey === "custom" && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
          <DateField label="De" value={customFrom} onChange={(iso) => { setCustomFrom(iso); writeLS(LS_CUSTOM_FROM, iso); }} />
          <DateField label="Até" value={customTo} onChange={(iso) => { setCustomTo(iso); writeLS(LS_CUSTOM_TO, iso); }} />
          {!customValid && (
            <span className="text-[11px] font-body text-muted-foreground/80 sm:pb-2.5">Preencha de/até pra gerar o relatório.</span>
          )}
        </div>
      )}

      {selected && open && (
        <QuickReportDialog
          client={selected}
          periodKey={periodKey}
          customFrom={periodKey === "custom" && customValid ? customFrom : undefined}
          customTo={periodKey === "custom" && customValid ? customTo : undefined}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

// Wrapper: carrega os posts do cliente escolhido e abre o relatório já no preset.
function QuickReportDialog({ client, periodKey, customFrom, customTo, open, onOpenChange }: {
  client: ExternalClient;
  periodKey: PeriodKey;
  customFrom?: string;
  customTo?: string;
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
      customSince={customFrom}
      customUntil={customTo}
    />
  );
}
