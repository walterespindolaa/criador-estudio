import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useExternalClients, useAllExternalPosts, type ExternalClient, type ExternalPostWithClient } from "@/hooks/useCriaPost";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { Button } from "@/components/ui/button";
import { Clock, RotateCcw, CheckCircle2, ChevronRight, Contact, Send } from "lucide-react";

// Painel de aprovações por link (Cria Post): visão do fluxo por status, com filtro
// por cliente. Não é mais uma lista de clientes: clicar em qualquer post abre o
// hub do cliente em /socialmidia/clientes/:id/posts.

type StatusKey = "pendente" | "ajuste_solicitado" | "aprovado";

const SECTIONS: { key: StatusKey; label: string; cls: string; icon: typeof Clock }[] = [
  { key: "pendente", label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  { key: "ajuste_solicitado", label: "Em ajuste", cls: "bg-orange-100 text-orange-700", icon: RotateCcw },
  { key: "aprovado", label: "Aprovados", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
];
const APPROVED_LIMIT = 10;

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function daysWaiting(p: ExternalPostWithClient): number {
  const base = p.approval_updated_at ?? p.created_at;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
}
function dateBR(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}` : null;
}

export function ExternalApprovalsPanel({ statusFilter = null, compact = false, title }: {
  statusFilter?: StatusKey | null;
  compact?: boolean;
  title?: string;
}) {
  const navigate = useNavigate();
  const { clients } = useExternalClients();
  const { data: posts = [], isLoading } = useAllExternalPosts();
  const [clientId, setClientId] = useState<string>("");
  const [fixing, setFixing] = useState<ExternalClient | null>(null);

  const byId = useMemo(() => {
    const m: Record<string, ExternalClient> = {};
    clients.forEach((c) => { m[c.id] = c; });
    return m;
  }, [clients]);
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);

  const shown = useMemo(
    () => posts.filter((p) => !clientId || p.external_client_id === clientId),
    [posts, clientId],
  );
  const sections = statusFilter ? SECTIONS.filter((s) => s.key === statusFilter) : SECTIONS;

  const openClient = (ext: ExternalClient | undefined) => {
    if (!ext) return;
    if (ext.crm_client_id) {
      navigate(`/socialmidia/clientes/${ext.crm_client_id}/posts`);
    } else {
      // Cliente antigo sem vínculo com o cadastro central: pede o vínculo aqui mesmo.
      toast.message("Vincule este cliente ao cadastro central pra abrir a página dele.");
      setFixing(ext);
    }
  };

  if (isLoading) {
    return <div className="grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }

  // No modo compacto (página Aprovações), some junto com o título quando não há nada.
  if (compact && posts.length === 0) return null;

  if (!compact && posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3"><Send className="h-5 w-5 text-primary" /></div>
        <p className="text-sm font-body text-foreground font-medium">Nenhum post na fila de aprovação</p>
        <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-sm mx-auto">Abra um cliente na página Clientes, ative o Cria Post nele e monte os posts. Eles aparecem aqui conforme o status.</p>
        <Button onClick={() => navigate("/socialmidia/clientes")}><Contact className="h-4 w-4 mr-1.5" /> Ir pra Clientes</Button>
      </div>
    );
  }

  const card = (p: ExternalPostWithClient) => {
    const c = byId[p.external_client_id];
    const wait = daysWaiting(p);
    const dt = dateBR(p.scheduled_date);
    return (
      <button key={p.id} onClick={() => openClient(c)}
        className="w-full text-left bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all flex items-center gap-2.5">
        <span className="relative w-8 h-8 rounded-lg grid place-items-center text-white text-xs font-display font-bold shrink-0 overflow-hidden"
          style={{ background: c?.color || "#8B5CF6" }}>
          {initial(c?.name)}
          {c?.logo_url && <img src={c.logo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-body font-medium text-foreground truncate">{p.title}</span>
          <span className="block text-[11px] text-muted-foreground font-body truncate">
            {c?.name ?? "Cliente"} · {cap(p.format)}{dt ? ` · ${dt}` : ""}
          </span>
          {p.approval_status === "ajuste_solicitado" && p.last_comment && p.last_comment_role === "cliente_externo" && (
            <span className="block text-[11px] text-orange-700 font-body truncate mt-0.5">"{p.last_comment}"</span>
          )}
          {p.approval_status === "pendente" && wait > 3 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-body font-bold text-amber-600"><Clock className="h-3 w-3 shrink-0" /> Esperando há {wait} dias</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      </button>
    );
  };

  return (
    <div>
      {title && <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>}
      {activeClients.length > 1 && (
        <div className="mb-3">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-body" aria-label="Filtrar por cliente">
            <option value="">Todos os clientes</option>
            {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className={sections.length > 1 ? "grid gap-3 lg:grid-cols-3 items-start" : "space-y-2"}>
        {sections.map((s) => {
          const all = shown.filter((p) => (p.approval_status ?? "pendente") === s.key);
          const list = s.key === "aprovado" ? all.slice(0, APPROVED_LIMIT) : all;
          const Icon = s.icon;
          return (
            <div key={s.key} className={sections.length > 1 ? "rounded-2xl bg-muted/30 p-2" : ""}>
              <div className="flex items-center justify-between px-2 py-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-body font-bold px-2 py-0.5 rounded-full ${s.cls}`}><Icon className="h-3 w-3" /> {s.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{all.length}</span>
              </div>
              <div className="space-y-2">
                {list.map(card)}
                {all.length === 0 && <p className="text-center py-8 text-muted-foreground/40 text-[11px] font-body">vazio</p>}
                {all.length > list.length && <p className="text-center py-1 text-[11px] text-muted-foreground font-body">e mais {all.length - list.length} aprovados, veja no cliente</p>}
              </div>
            </div>
          );
        })}
      </div>
      <ExternalClientDialog open={!!fixing} onOpenChange={(o) => { if (!o) setFixing(null); }} client={fixing} />
    </div>
  );
}
