import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, ChevronRight, CalendarRange, Link2, Users, Package, Inbox } from "lucide-react";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAllExternalPosts, useExternalClients } from "@/hooks/useCriaPost";
import { useCronogramas } from "@/hooks/useCronograma";
import { useManagerApprovalItems } from "@/hooks/useApprovals";
import { useManagerPendingMaterials } from "@/hooks/useClientMaterials";
import { useCrmClients } from "@/hooks/useCrm";
import { cn } from "@/lib/utils";

// Tipos de pendência que a Central agrupa.
type PendType = "criapost" | "cronograma" | "conteudo" | "material";
type PendFilter = PendType | null;

// Item normalizado da lista unificada. Cada linha sabe pra onde levar pra resolver.
type PendItem = {
  key: string;
  type: PendType;
  clientName: string;
  title: string;
  ts: number;                       // p/ ordenar por mais recente
  adjust?: boolean;                 // pediu ajuste (etiqueta laranja)
  to?: string;                      // rota de destino
  onClick?: () => void;             // ação alternativa (trocar de conta ativa)
};

// Cor/rótulo da etiqueta de tipo.
const TYPE_META: Record<PendType, { label: string; chip: string; icon: typeof Link2 }> = {
  criapost: { label: "Cria Post", chip: "bg-amber-100 text-amber-800 border-amber-200", icon: Link2 },
  cronograma: { label: "Cronograma", chip: "bg-violet-100 text-violet-800 border-violet-200", icon: CalendarRange },
  conteudo: { label: "Conteúdo", chip: "bg-sky-100 text-sky-800 border-sky-200", icon: Users },
  material: { label: "Material", chip: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Package },
};

function initial(name: string) {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export default function Aprovacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agencyOwnerId, setActiveAccount } = useActiveAccount();
  const [filter, setFilter] = useState<PendFilter>(null);

  // ── Fontes de dados (só hooks existentes; nada de fetch cru novo) ─────────
  const { clients } = useExternalClients();                 // mapa external_client_id -> cliente
  const { data: extPosts = [] } = useAllExternalPosts();    // posts de aprovação por link
  const { cronogramas } = useCronogramas();                 // cronogramas dos clientes
  const { items: approvalItems } = useManagerApprovalItems(); // conteúdo das contas gerenciadas
  const { pending: pendingMaterials } = useManagerPendingMaterials(); // materiais pedidos
  const crmClients = useCrmClients().data ?? [];

  // Mapa de nomes de cliente (external_client_id -> nome / crm_client_id).
  const extById = useMemo(() => {
    const m = new Map<string, { name: string; crmId: string | null }>();
    for (const c of clients) m.set(c.id, { name: c.name, crmId: c.crm_client_id });
    return m;
  }, [clients]);
  const crmNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of crmClients) m.set(c.id, c.name);
    return m;
  }, [crmClients]);

  // Contas que NÃO são clientes gerenciados: a conta pessoal do próprio gestor
  // (e a do gestor quando um colaborador atua no time). Filtramos p/ não poluir
  // a Central com posts da conta pessoal.
  const selfIds = useMemo(() => new Set([user?.id, agencyOwnerId].filter(Boolean) as string[]), [user?.id, agencyOwnerId]);

  // ── 1. CRIA POST (aprovação por link): pendente ou ajuste_solicitado ──────
  const criapostItems: PendItem[] = useMemo(() => {
    return extPosts
      .filter((p) => p.approval_status === "pendente" || p.approval_status === "ajuste_solicitado")
      .map((p) => {
        const info = extById.get(p.external_client_id);
        const crmId = info?.crmId ?? null;
        return {
          key: `cp-${p.id}`,
          type: "criapost" as const,
          clientName: info?.name ?? "Cliente",
          title: p.title || "Post sem título",
          ts: new Date(p.approval_updated_at ?? p.created_at).getTime(),
          adjust: p.approval_status === "ajuste_solicitado",
          to: crmId ? `/socialmidia/clientes/${crmId}/posts` : "/socialmidia/criapost",
        };
      });
  }, [extPosts, extById]);
  const criapostClients = useMemo(
    () => new Set(criapostItems.map((i) => i.clientName)).size,
    [criapostItems],
  );

  // ── 2. CRONOGRAMAS aguardando o cliente (status = enviado) ────────────────
  const cronoItems: PendItem[] = useMemo(() => {
    return cronogramas
      .filter((c) => c.status === "enviado")
      .map((c) => {
        const nome = c.client_label || (c.crm_client_id ? crmNameById.get(c.crm_client_id) : null) || "Cliente";
        return {
          key: `cr-${c.id}`,
          type: "cronograma" as const,
          clientName: nome,
          title: c.title || "Cronograma",
          ts: new Date(c.created_at).getTime(),
          to: c.crm_client_id ? `/socialmidia/clientes/${c.crm_client_id}/cronograma` : "/socialmidia/clientes",
        };
      });
  }, [cronogramas, crmNameById]);

  // ── 3. CONTEÚDO das contas gerenciadas (exclui a conta pessoal do gestor) ─
  const conteudoItems: PendItem[] = useMemo(() => {
    return approvalItems
      .filter((it) => !selfIds.has(it.owner_id))
      .map((it) => ({
        key: `co-${it.post_id}`,
        type: "conteudo" as const,
        clientName: it.client_name ?? "Cliente",
        title: it.title || "Conteúdo",
        ts: new Date(it.approval_updated_at ?? 0).getTime(),
        adjust: it.approval_status === "ajuste_solicitado",
        onClick: () => { setActiveAccount(it.owner_id); navigate("/app/aprovacao"); },
      }));
  }, [approvalItems, selfIds, setActiveAccount, navigate]);

  // ── 4. MATERIAIS solicitados pelo cliente (status = solicitado) ───────────
  const materialItems: PendItem[] = useMemo(() => {
    return pendingMaterials.map((m) => ({
      key: `ma-${m.id}`,
      type: "material" as const,
      clientName: (m.crm_client_id ? crmNameById.get(m.crm_client_id) : null) ?? "Cliente",
      title: m.title || "Material",
      ts: new Date(m.created_at).getTime(),
      to: m.crm_client_id ? `/socialmidia/clientes/${m.crm_client_id}/materiais` : "/socialmidia/clientes",
    }));
  }, [pendingMaterials, crmNameById]);

  const counts: Record<PendType, number> = {
    criapost: criapostItems.length,
    cronograma: cronoItems.length,
    conteudo: conteudoItems.length,
    material: materialItems.length,
  };
  const total = counts.criapost + counts.cronograma + counts.conteudo + counts.material;

  // Lista unificada, ordenada por mais recente.
  const allItems = useMemo(
    () => [...criapostItems, ...cronoItems, ...conteudoItems, ...materialItems].sort((a, b) => b.ts - a.ts),
    [criapostItems, cronoItems, conteudoItems, materialItems],
  );
  const visible = filter ? allItems.filter((i) => i.type === filter) : allItems;

  // Cards de resumo, um por tipo. Clicar filtra a lista abaixo.
  const cards: { type: PendType; title: string; count: number; hint: string; tone: string }[] = [
    { type: "criapost", title: "Cria Post (aprovação por link)", count: counts.criapost, tone: "bg-amber-500/12 text-amber-600",
      hint: counts.criapost > 0 ? `${counts.criapost} post(s) em ${criapostClients} cliente(s)` : "Tudo em dia" },
    { type: "cronograma", title: "Cronogramas", count: counts.cronograma, tone: "bg-violet-500/12 text-violet-600",
      hint: counts.cronograma > 0 ? `${counts.cronograma} aguardando o cliente` : "Nenhum aguardando" },
    { type: "conteudo", title: "Conteúdo de clientes (Cria)", count: counts.conteudo, tone: "bg-sky-500/12 text-sky-600",
      hint: counts.conteudo > 0 ? `${counts.conteudo} aguardando revisão` : "Nada pra revisar" },
    { type: "material", title: "Materiais solicitados", count: counts.material, tone: "bg-emerald-500/12 text-emerald-600",
      hint: counts.material > 0 ? `${counts.material} pedido(s) do cliente` : "Nenhum pedido" },
  ];

  const chips: [string, PendFilter][] = [
    ["Todos", null], ["Cria Post", "criapost"], ["Cronogramas", "cronograma"], ["Conteúdo", "conteudo"], ["Materiais", "material"],
  ];

  return (
    <div>
      <ManagerSectionTitle t="Aprovações" s="Tudo que está esperando aprovação, num lugar só." />

      {/* Cards de resumo: um por tipo. Clicar no card filtra a lista. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => {
          const Icon = TYPE_META[c.type].icon;
          const active = filter === c.type;
          return (
            <button
              key={c.type}
              onClick={() => setFilter(active ? null : c.type)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-all min-h-[64px]",
                active ? "border-primary shadow-md" : "border-border hover:border-primary/40 hover:shadow-md",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("grid h-11 w-11 place-items-center rounded-xl shrink-0", c.tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-foreground text-sm leading-tight">{c.title}</p>
                  <p className="text-xs text-muted-foreground font-body">{c.hint}</p>
                </div>
              </div>
              <span className={cn(
                "shrink-0 text-sm font-display font-extrabold px-2.5 py-1 rounded-full min-w-[32px] text-center",
                c.count > 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista unificada de pendentes + filtros por tipo. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-display font-bold text-foreground">Pendentes</p>
        {total > 0 && <span className="text-xs text-muted-foreground font-body">({total})</span>}
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {chips.map(([label, val]) => (
          <button
            key={label}
            onClick={() => setFilter(val)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors min-h-[36px]",
              filter === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-body text-foreground font-medium">Nada esperando aprovação por aqui</p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            {filter ? "Nenhuma pendência deste tipo." : "Assim que algo precisar de aprovação, aparece nesta lista."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {visible.map((it) => {
            const meta = TYPE_META[it.type];
            const go = () => { if (it.onClick) it.onClick(); else if (it.to) navigate(it.to); };
            return (
              <button
                key={it.key}
                onClick={go}
                className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors min-h-[56px]"
              >
                <div className="w-9 h-9 rounded-xl bg-muted shrink-0 flex items-center justify-center">
                  <span className="text-sm font-display font-bold text-primary">{initial(it.clientName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">{it.clientName}</p>
                </div>
                {it.adjust && (
                  <span className="shrink-0 text-[11px] font-body font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 bg-orange-100 text-orange-800 border border-orange-200">
                    <RotateCcw className="h-3 w-3" /> Ajuste
                  </span>
                )}
                <span className={cn("shrink-0 text-[11px] font-body font-semibold px-2 py-1 rounded-full border inline-flex items-center gap-1", meta.chip)}>
                  <meta.icon className="h-3 w-3" /> {meta.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
