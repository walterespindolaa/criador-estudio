import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Link2, Loader2, Plus, Settings2, Wallet, Send } from "lucide-react";
import { toast } from "sonner";
import { useCrmClient } from "@/hooks/useCrm";
import { useExternalClients } from "@/hooks/useCriaPost";
import { useFinRecords, useCreateFinRecord, type FinType } from "@/hooks/useFinance";
import { ClientDetail } from "@/components/accounts/CriaPostBoard";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { saveLastClient } from "@/components/accounts/ClientSwitcher";
import { CriativoTab } from "@/components/hubcria/CriativoTab";
import { useHasHubCria } from "@/hooks/useHubCria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABS = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "criativo", label: "Criativo", gated: true },
  { key: "posts", label: "Posts" },
  { key: "cronograma", label: "Cronograma" },
  { key: "relatorio", label: "Relatório" },
  { key: "instagram", label: "Instagram" },
  { key: "financeiro", label: "Financeiro" },
];
const OPERACIONAIS = new Set(["posts", "cronograma", "relatorio", "instagram"]);
const WORKFLOW = new Set(["criativo", "posts", "cronograma", "relatorio"]);
const FLOW_STEPS = [
  { key: "criativo", n: 1, label: "Pesquisa & ideias", gated: true },
  { key: "posts", n: 2, label: "Montar & aprovar" },
  { key: "cronograma", n: 3, label: "Calendário do mês" },
  { key: "relatorio", n: 4, label: "Resultado" },
];
const FLOW_EXPLAIN: Record<string, string> = {
  criativo: "De onde vem: você analisa concorrentes (HUB/Apify) e recebe ideias prontas. Pra onde vai: marque as boas como “Usar” e clique em “Criar posts”, elas viram posts na aba Posts.",
  posts: "De onde vem: as ideias que você aprovou no Criativo (ou posts criados na mão). Aqui você monta cada post e manda o cliente aprovar por link: Aguardando cliente → Ajuste solicitado → Aprovado.",
  cronograma: "É o calendário do mês pro cliente: datas comemorativas + link público com a visão geral do que vai sair. Serve pra alinhar o plano, a aprovação post a post acontece na aba Posts.",
  relatorio: "O relatório white-label com o resultado do que foi publicado no mês.",
};
const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
import { formatBRL } from "@/lib/money";
// Financeiro (crm_records) guarda CENTAVOS. Cliente (monthly_value) guarda REAIS — usar formatBRL.
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

export default function ClienteHub() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { allowed: hasHubCria } = useHasHubCria();
  const visibleTabs = useMemo(() => TABS.filter((t) => !("gated" in t && t.gated) || hasHubCria), [hasHubCria]);
  const activeTab = tab && visibleTabs.some((t) => t.key === tab) ? tab : "visao-geral";
  const { data: client, isLoading } = useCrmClient(id);
  const { clients: ext, create: createExt, pending, copyLink } = useExternalClients();
  const extClient = useMemo(() => ext.find((e) => e.crm_client_id === id) ?? null, [ext, id]);
  const pendCount = extClient ? (pending[extClient.id] ?? 0) : 0;

  // Ações do cabeçalho: copiar o link de aprovação (toast no hook) e abrir o portal em nova aba.
  const [copying, setCopying] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const doCopyLink = async () => {
    if (!extClient) return;
    setCopying(true);
    await copyLink(extClient.id);
    setCopying(false);
  };
  const openPortal = async () => {
    if (!extClient) return;
    const url = await copyLink(extClient.id);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const goTab = (t: string) => navigate(`/socialmidia/clientes/${id}/${t}`);

  // Último cliente visitado: alimenta o seletor global e o "Continuar em {cliente}" do dashboard.
  useEffect(() => {
    if (client) saveLastClient(client.id, client.name);
  }, [client]);

  const enableCriaPost = async () => {
    if (!client) return;
    await createExt.mutateAsync({ name: client.name, crm_client_id: id, instagram_handle: client.instagram });
    toast.success("Cliente ativado no Cria Post!");
  };

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>;
  if (!client) return (
    <div className="py-20 text-center">
      <p className="text-sm font-body text-muted-foreground">Cliente não encontrado.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/socialmidia/clientes")}>Voltar</Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <button onClick={() => navigate("/socialmidia/clientes")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>

      {/* Cabeçalho no padrão vitrine: logo grande, badges de status e ações sempre visíveis. */}
      <div className="mb-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center text-white text-xl font-display font-bold shrink-0 overflow-hidden ring-2 ring-border/60" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
            {initial(client.name)}
            {client.logo && <img src={client.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
            <p className="text-sm text-muted-foreground font-body truncate">
              {client.instagram ? `@${client.instagram.replace(/^@/, "")}` : "sem @"}{client.cria_owner_id ? " · usa o Cria" : " · aprova por link"}
            </p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {extClient
                ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 font-body font-semibold">Link de aprovação ativo</span>
                : <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-body">Cria Post não ativado</span>}
              {pendCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-body font-semibold">{pendCount} pendente{pendCount > 1 ? "s" : ""}</span>}
            </div>
          </div>
          {extClient && (
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button onClick={doCopyLink} disabled={copying}>
                {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Link de aprovação</span></>}
              </Button>
              <Button variant="outline" className="px-3" onClick={openPortal} title="Abrir portal do cliente em nova aba" aria-label="Abrir portal do cliente em nova aba">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Settings2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Personalizar</span>
              </Button>
            </div>
          )}
        </div>
      </div>
      <ExternalClientDialog open={editOpen} onOpenChange={setEditOpen} client={extClient} />

      {/* Abas por URL */}
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
        {visibleTabs.map((t) => {
          const on = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => goTab(t.key)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${on ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
          );
        })}
      </div>

      {/* Régua de fluxo (Criativo → Posts → Cronograma → Relatório) */}
      {WORKFLOW.has(activeTab) && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {FLOW_STEPS.filter((s) => !s.gated || hasHubCria).map((s, idx, arr) => {
              const on = activeTab === s.key;
              return (
                <div key={s.key} className="flex items-center shrink-0">
                  <button onClick={() => goTab(s.key)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors ${on ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.n}</span>
                    <span className={`text-xs font-body font-semibold whitespace-nowrap ${on ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                  </button>
                  {idx < arr.length - 1 && <span className="mx-0.5 text-muted-foreground/50">›</span>}
                </div>
              );
            })}
          </div>
          {FLOW_EXPLAIN[activeTab] && (
            <p className="text-[12px] font-body text-muted-foreground leading-relaxed mt-1.5 px-1">{FLOW_EXPLAIN[activeTab]}</p>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {activeTab === "visao-geral" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Info label="Segmento" value={client.segment || "-"} />
            <Info label="Contato" value={client.email || client.phone || "-"} />
            {/* monthly_value é em REAIS (não centavos) — brl() aqui é da parte financeira, que é em centavos. */}
            <Info label="Mensalidade" value={formatBRL(client.monthly_value)} />
            <Info label="Renovação" value={client.renewal_date ? new Date(client.renewal_date).toLocaleDateString("pt-BR") : "-"} />
          </div>
          {client.notes && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-body text-muted-foreground mb-1">Anotações</p>
              <p className="text-sm font-body text-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => goTab("posts")}><Send className="h-4 w-4 mr-1.5" /> Ver posts</Button>
            <Button variant="outline" onClick={() => goTab("relatorio")}>Relatório</Button>
            <Button variant="outline" asChild><Link to={`/socialmidia/criacrm/${id}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Ficha completa (CRM)</Link></Button>
          </div>
        </div>
      )}

      {OPERACIONAIS.has(activeTab) && (
        extClient ? (
          <ClientDetail client={extClient} embedded activeTab={activeTab} onTabChange={goTab} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3"><Send className="h-5 w-5 text-primary" /></div>
            <p className="text-sm font-body text-foreground font-medium">Ative o Cria Post pra este cliente</p>
            <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-sm mx-auto">Cria a área de posts, cronograma, relatório e aprovação por link deste cliente.</p>
            <Button onClick={enableCriaPost} disabled={createExt.isPending}>{createExt.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Ativar agora</Button>
          </div>
        )
      )}

      {activeTab === "criativo" && hasHubCria && <CriativoTab clientId={id!} clientName={client.name} />}

      {activeTab === "financeiro" && <FinanceTab clientId={id!} clientName={client.name} />}
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-body text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}

function FinanceTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: all = [], isLoading } = useFinRecords();
  const create = useCreateFinRecord();
  const records = useMemo(() => all.filter((r) => r.crm_client_id === clientId), [all, clientId]);
  const totalIn = records.filter((r) => r.type === "entrada").reduce((s, r) => s + r.amount, 0);
  const totalOut = records.filter((r) => r.type === "despesa").reduce((s, r) => s + r.amount, 0);

  const [type, setType] = useState<FinType>("entrada");
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");

  const add = async () => {
    const cents = Math.round(parseFloat(valor.replace(",", ".")) * 100);
    if (!desc.trim() || !cents || cents <= 0) { toast.error("Preencha descrição e valor."); return; }
    await create.mutateAsync({ crm_client_id: clientId, context: "pj", type, description: desc.trim(), amount: cents, status: "pendente", date: new Date().toISOString().slice(0, 10) });
    setDesc(""); setValor("");
    toast.success("Lançamento criado, aparece no Cria Caixa.");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4"><p className="text-xs text-muted-foreground font-body">Recebido/previsto</p><p className="text-xl font-display font-extrabold text-green-600 mt-1">{brl(totalIn)}</p></div>
        <div className="bg-card border border-border rounded-2xl p-4"><p className="text-xs text-muted-foreground font-body">Custos</p><p className="text-xl font-display font-extrabold text-red-500 mt-1">{brl(totalOut)}</p></div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-display font-semibold text-foreground mb-3">Novo lançamento de {clientName}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {(["entrada", "despesa"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`text-xs px-3 py-2 ${type === t ? (t === "entrada" ? "bg-green-600 text-white" : "bg-red-500 text-white") : "text-muted-foreground"}`}>{t === "entrada" ? "Entrada" : "Despesa"}</button>
            ))}
          </div>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" className="rounded-lg flex-1" />
          <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" className="rounded-lg w-full sm:w-32" />
          <Button onClick={add} disabled={create.isPending} className="shrink-0">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </div>
        <p className="text-[11px] text-muted-foreground font-body mt-2 flex items-center gap-1"><Wallet className="h-3 w-3" /> Tudo que você lança aqui entra unificado no Cria Caixa.</p>
      </div>

      {isLoading ? (
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body text-center py-8">Nenhum lançamento deste cliente ainda.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-body text-foreground truncate">{r.description}</p>
                <p className="text-[11px] text-muted-foreground font-body">{new Date(r.date).toLocaleDateString("pt-BR")} · {r.status}</p>
              </div>
              <span className={`text-sm font-display font-bold shrink-0 ${r.type === "entrada" ? "text-green-600" : "text-red-500"}`}>{r.type === "entrada" ? "+" : "−"}{brl(r.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
