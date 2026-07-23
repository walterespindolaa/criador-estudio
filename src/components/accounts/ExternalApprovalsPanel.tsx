import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useExternalClients, useAllExternalPosts, type ExternalClient, type ExternalPostWithClient } from "@/hooks/useCriaPost";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, RotateCcw, CheckCircle2, ChevronRight, ChevronsUpDown, Contact, Send, Palette, Instagram } from "lucide-react";

// Painel de aprovações por link (Cria Post): visão do fluxo por status, com filtro
// por cliente. Não é mais uma lista de clientes: clicar em qualquer post abre o
// hub do cliente em /socialmidia/clientes/:id/posts.
// O board espelha o kanban de 5 status do cliente (Em produção -> Aguardando ->
// Ajuste solicitado -> Aprovado -> Postado), agregando todos os clientes.

type StatusKey = "em_producao" | "pendente" | "ajuste_solicitado" | "aprovado" | "postado";

// Mesmas cores/rótulos do kanban do cliente (POST_STATUS em CriaPostBoard.tsx).
const SECTIONS: { key: StatusKey; label: string; cls: string; icon: typeof Clock }[] = [
  { key: "em_producao", label: "Em produção", cls: "bg-violet-100 text-violet-700", icon: Palette },
  { key: "pendente", label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  { key: "ajuste_solicitado", label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700", icon: RotateCcw },
  { key: "aprovado", label: "Aprovado", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  { key: "postado", label: "Postado", cls: "bg-slate-200 text-slate-600", icon: Instagram },
];
// Colunas de histórico (aprovado/postado) podem crescer muito: limita a prévia.
const HISTORY_LIMIT = 10;
const HISTORY_KEYS: StatusKey[] = ["aprovado", "postado"];

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busca, setBusca] = useState("");

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

  // Sumário por cliente: contagem de cada status pros chips do topo (clicáveis = filtro).
  const summary = useMemo(() => {
    const m = new Map<string, { client: ExternalClient; pendente: number; ajuste: number; aprovado: number }>();
    posts.forEach((p) => {
      const c = byId[p.external_client_id];
      if (!c) return;
      const s = m.get(c.id) ?? { client: c, pendente: 0, ajuste: 0, aprovado: 0 };
      const st = p.approval_status ?? "pendente";
      if (st === "pendente") s.pendente += 1;
      else if (st === "ajuste_solicitado") s.ajuste += 1;
      else if (st === "aprovado") s.aprovado += 1;
      // em_producao e postado não entram nas contagens de "atenção" dos chips.
      m.set(c.id, s);
    });
    return Array.from(m.values()).sort((a, b) => (b.pendente + b.ajuste) - (a.pendente + a.ajuste));
  }, [posts, byId]);

  // O cliente escolhido no seletor (com as contagens dele já prontas).
  const selecionado = useMemo(
    () => (clientId ? summary.find((s) => s.client.id === clientId) ?? null : null),
    [clientId, summary],
  );
  // Totais gerais, pro estado "Todos os clientes" dizer alguma coisa útil.
  const totais = useMemo(
    () => summary.reduce(
      (acc, s) => ({ pendente: acc.pendente + s.pendente, ajuste: acc.ajuste + s.ajuste }),
      { pendente: 0, ajuste: 0 },
    ),
    [summary],
  );

  // Celebração: tudo que está visível foi aprovado pelo(s) cliente(s).
  const allApproved = shown.length > 0 && shown.every((p) => (p.approval_status ?? "pendente") === "aprovado");
  const celebName = clientId ? byId[clientId]?.name ?? null : null;

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
        className="w-full min-w-0 max-w-full overflow-hidden text-left bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all flex items-center gap-2.5">
        <span className="relative w-8 h-8 rounded-lg grid place-items-center text-white text-xs font-display font-bold shrink-0 overflow-hidden"
          style={{ background: c?.color || "#EA4918" }}>
          {initial(c?.name)}
          {c?.logo_url && <img src={c.logo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-body font-medium text-foreground truncate">{p.title}</span>
          <span className="block text-[11px] text-muted-foreground font-body truncate">
            {c?.name ?? "Cliente"} · {cap(p.format)} · {dt
              ? <span className="font-semibold text-foreground/80">{dt}</span>
              : <span className="italic opacity-70">sem data</span>}
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

      {/* SELETOR DE CLIENTE.
          Antes era uma fileira de chips com TODOS os clientes empilhados: com 20
          clientes virava um paredão antes de você ver um único post. Agora é um
          botão. A lista com as contagens abre dentro dele, com busca. */}
      {!compact && summary.length > 0 && (
        <div className="mb-4">
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <button type="button"
                className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40">
                {selecionado ? (
                  <>
                    <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-display font-bold text-white"
                      style={{ background: selecionado.client.color || "#EA4918" }}>
                      {initial(selecionado.client.name)}
                      {selecionado.client.logo_url && <img src={selecionado.client.logo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-display font-bold text-foreground">{selecionado.client.name}</span>
                      <span className="flex items-center gap-1 flex-wrap mt-0.5">
                        {selecionado.pendente > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{selecionado.pendente} aguardando</span>}
                        {selecionado.ajuste > 0 && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">{selecionado.ajuste} em ajuste</span>}
                        {selecionado.aprovado > 0 && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{selecionado.aprovado} aprovado{selecionado.aprovado > 1 ? "s" : ""}</span>}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Contact className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-display font-bold text-foreground">Todos os clientes</span>
                      <span className="block text-[11.5px] font-body text-muted-foreground">
                        {totais.pendente > 0 ? `${totais.pendente} aguardando o cliente` : "Nada aguardando"}
                        {totais.ajuste > 0 ? ` · ${totais.ajuste} em ajuste` : ""}
                      </span>
                    </span>
                  </>
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md rounded-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display text-left">Escolha o cliente</DialogTitle></DialogHeader>

              <div className="mt-3">
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="rounded-xl" />
              </div>

              <div className="mt-3 space-y-1 pb-2">
                <button type="button"
                  onClick={() => { setClientId(""); setPickerOpen(false); setBusca(""); }}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${!clientId ? "bg-primary/10" : "active:bg-muted/60"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Contact className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-body font-semibold text-foreground">Todos os clientes</span>
                    <span className="block text-[11.5px] font-body text-muted-foreground">{posts.length} post(s) na fila</span>
                  </span>
                </button>

                {summary
                  .filter(({ client: c }) => !busca.trim() || c.name.toLowerCase().includes(busca.trim().toLowerCase()))
                  .map(({ client: c, pendente, ajuste, aprovado }) => (
                    <button key={c.id} type="button"
                      onClick={() => { setClientId(c.id); setPickerOpen(false); setBusca(""); }}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${clientId === c.id ? "bg-primary/10" : "active:bg-muted/60"}`}>
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-display font-bold text-white"
                        style={{ background: c.color || "#EA4918" }}>
                        {initial(c.name)}
                        {c.logo_url && <img src={c.logo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-body font-semibold text-foreground">{c.name}</span>
                        {/* As contagens já aparecem aqui: a pessoa escolhe sabendo onde está o problema. */}
                        <span className="flex items-center gap-1 flex-wrap mt-0.5">
                          {pendente > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{pendente} aguardando</span>}
                          {ajuste > 0 && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">{ajuste} em ajuste</span>}
                          {aprovado > 0 && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{aprovado} aprovado{aprovado > 1 ? "s" : ""}</span>}
                          {pendente === 0 && ajuste === 0 && <span className="text-[11px] font-body text-muted-foreground">em dia</span>}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Tudo aprovado no recorte visível: estado de celebração. */}
      {!compact && allApproved && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-green-500/25 bg-green-50 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-green-800">Tudo aprovado!</p>
            <p className="text-sm font-body text-green-700">
              {celebName ? `Os posts de ${celebName} estão liberados pra produção e agenda.` : "Todos os posts visíveis foram aprovados. Conteúdo liberado pra produção e agenda."}
            </p>
          </div>
        </div>
      )}

      {/* No modo compacto (página Aprovações) o filtro é o mesmo seletor, mas enxuto. */}
      {compact && activeClients.length > 1 && (
        <div className="mb-3">
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <button type="button"
                className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40">
                <span className="min-w-0 flex-1 truncate text-sm font-body font-semibold text-foreground">
                  {selecionado ? selecionado.client.name : "Todos os clientes"}
                </span>
                {!selecionado && totais.pendente > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{totais.pendente} aguardando</span>
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display text-left">Escolha o cliente</DialogTitle></DialogHeader>
              <div className="mt-3">
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="rounded-xl" />
              </div>
              <div className="mt-3 space-y-1 pb-2">
                <button type="button" onClick={() => { setClientId(""); setPickerOpen(false); setBusca(""); }}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${!clientId ? "bg-primary/10" : "active:bg-muted/60"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Contact className="h-4 w-4" /></span>
                  <span className="text-[15px] font-body font-semibold text-foreground">Todos os clientes</span>
                </button>
                {summary
                  .filter(({ client: c }) => !busca.trim() || c.name.toLowerCase().includes(busca.trim().toLowerCase()))
                  .map(({ client: c, pendente, ajuste, aprovado }) => (
                    <button key={c.id} type="button" onClick={() => { setClientId(c.id); setPickerOpen(false); setBusca(""); }}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${clientId === c.id ? "bg-primary/10" : "active:bg-muted/60"}`}>
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-display font-bold text-white"
                        style={{ background: c.color || "#EA4918" }}>
                        {initial(c.name)}
                        {c.logo_url && <img src={c.logo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-body font-semibold text-foreground">{c.name}</span>
                        <span className="flex items-center gap-1 flex-wrap mt-0.5">
                          {pendente > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{pendente} aguardando</span>}
                          {ajuste > 0 && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">{ajuste} em ajuste</span>}
                          {aprovado > 0 && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{aprovado} aprovado{aprovado > 1 ? "s" : ""}</span>}
                          {pendente === 0 && ajuste === 0 && <span className="text-[11px] font-body text-muted-foreground">em dia</span>}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {/* min-w-0 no grid E na coluna: item de grid nasce com `min-width: auto`,
          ou seja, ele NÃO encolhe abaixo do min-content dos filhos. Um título
          longo de post empurrava a coluna inteira pra fora da tela, mesmo com
          o `truncate` no texto. É o bug do print. */}
      {/* 5 colunas (espelha o kanban do cliente). Scroll horizontal no mobile,
          igual ao kanban do Cria Post: cada coluna encolhe até um mínimo. */}
      <div className={sections.length > 1 ? "flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 kanban-scroll items-start" : "space-y-2 min-w-0"}>
        {sections.map((s) => {
          const all = shown.filter((p) => (p.approval_status ?? "pendente") === s.key);
          const limited = HISTORY_KEYS.includes(s.key);
          const list = limited ? all.slice(0, HISTORY_LIMIT) : all;
          const Icon = s.icon;
          return (
            <div key={s.key} className={sections.length > 1 ? "w-[80vw] max-w-[300px] sm:w-72 shrink-0 rounded-2xl bg-muted/30 p-2" : "min-w-0"}>
              <div className="flex items-center justify-between px-2 py-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-body font-bold px-2 py-0.5 rounded-full ${s.cls}`}><Icon className="h-3 w-3" /> {s.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{all.length}</span>
              </div>
              <div className="space-y-2">
                {list.map(card)}
                {all.length === 0 && <p className="text-center py-8 text-muted-foreground/40 text-[11px] font-body">vazio</p>}
                {all.length > list.length && <p className="text-center py-1 text-[11px] text-muted-foreground font-body">e mais {all.length - list.length}, veja no cliente</p>}
              </div>
            </div>
          );
        })}
      </div>
      <ExternalClientDialog open={!!fixing} onOpenChange={(o) => { if (!o) setFixing(null); }} client={fixing} />
    </div>
  );
}
