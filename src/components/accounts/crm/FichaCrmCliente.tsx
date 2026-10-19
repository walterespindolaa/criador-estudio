import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Check, Lightbulb, NotebookPen, Pencil, Phone, Plus, Tags, Target, Trash2, ArrowRight } from "lucide-react";
import {
  useDeleteCrmClient, useSyncCrmFromCria, useCrmTags, useCreateCrmTag, useDeleteCrmTag,
  useUpdateCrmTag, useSeedDefaultCrmTags, DEFAULT_CRM_TAGS, TAG_COLORS, TAG_COLOR_CLS,
  type CrmClient, type CrmTag,
} from "@/hooks/useCrm";
import { useCaptureCities } from "@/hooks/useCaptureCities";
import { useScrapes, useHasHubCria, useDeleteScrape } from "@/hooks/useHubCria";
import { SummaryCard } from "@/components/hubcria/ResultadoPesquisa";
import { useFichaEditavel, Card, CF, F, MicTextarea } from "@/components/accounts/crm/BrandbookEditor";
import { LinkCadastroCliente } from "@/components/accounts/crm/LinkCadastroCliente";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { confirmar } from "@/components/shared/Confirm";
import { PAYMENT_METHODS } from "@/lib/finance";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   A FICHA DO CRM DENTRO DA TELA DO CLIENTE (Walter, 19/10/2026)

   Antes existiam duas telas do mesmo cliente: a tela do cliente (ClienteHub) e
   a "ficha completa" do Cria Gestão (CriaCrmClient), cada uma com uma parte
   dos campos. A Gabriela abria uma, não achava o campo, ia na outra. Agora o
   que só existia na ficha (cadastro da empresa, diagnóstico, concorrência)
   mora aqui e aparece como sub-abas do Cria Gestão na tela do cliente.

   Cada bloco grava SÓ os seus campos (opção `campos` do useFichaEditavel): o
   cabeçalho do cliente fica montado ao lado e escreve status, cor e foto no
   mesmo registro, e um autosave com a ficha inteira desfaria o que ele fez.
   ═══════════════════════════════════════════════════════════════════════════ */

const CAMPOS_CADASTRO: (keyof CrmClient)[] = [
  "company_name", "cnpj", "owner_name", "whatsapp", "phone", "address", "city", "birthday",
  "instagram", "email", "segment", "monthly_value", "plan_name", "payment_day", "payment_method",
  "contract_date", "renewal_date", "notes", "tags",
];
const CAMPOS_DIAG: (keyof CrmClient)[] = ["diagnosis"];
const CAMPOS_CONC: (keyof CrmClient)[] = ["competitors"];

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
const DIAG = { baixo: { l: "Baixo", c: "text-red-600" }, medio: { l: "Médio", c: "text-amber-600" }, alto: { l: "Alto", c: "text-green-600" } } as const;

function Salvando({ estado }: { estado: "idle" | "saving" | "saved" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1.5 rounded-lg transition-colors",
      estado === "saving" ? "text-muted-foreground bg-muted"
      : estado === "saved" ? "text-emerald-600 bg-emerald-500/10"
      : "text-muted-foreground")}>
      {estado === "saving" ? "Salvando…" : estado === "saved" ? "Salvo" : "Salva automático"}
    </span>
  );
}

function Carregando() {
  return <div className="space-y-4"><div className="h-40 rounded-3xl bg-muted animate-pulse" /><div className="h-72 rounded-3xl bg-muted animate-pulse" /></div>;
}

/* ─── CADASTRO ──────────────────────────────────────────────────────────── */
export function FichaCadastroCliente({ crmClientId }: { crmClientId: string }) {
  const navigate = useNavigate();
  const { client, form, setForm, saveState, isLoading } = useFichaEditavel(crmClientId, { campos: CAMPOS_CADASTRO });
  const { cities: captureCities } = useCaptureCities();
  const del = useDeleteCrmClient();
  const sync = useSyncCrmFromCria();
  const syncedOnce = useRef(false);

  // Cliente que usa o Cria: puxa uma vez os dados atualizados da conta dele
  // (era o que a ficha antiga fazia ao abrir).
  useEffect(() => {
    if (client?.cria_owner_id && !syncedOnce.current) {
      syncedOnce.current = true;
      sync.mutate(crmClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.cria_owner_id, crmClientId]);

  if (isLoading || !form) return <Carregando />;

  const excluir = async () => {
    if (await confirmar({ titulo: "Excluir este cliente?", descricao: "A ficha, as tarefas, os contratos e o financeiro dele vão junto." })) {
      await del.mutateAsync(form.id);
      navigate("/socialmidia/clientes");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] font-body text-muted-foreground">Os dados da empresa e do contrato. Situação, cor e foto ficam no topo do cliente.</p>
        <Salvando estado={saveState} />
      </div>

      {/* O cliente preenche o próprio cadastro: os dados chegam prontos. */}
      <LinkCadastroCliente crmClientId={form.id} clienteNome={form.name ?? "o cliente"} />

      <Card icon={<NotebookPen />} title="Empresa">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Nome da empresa (razão social)"><Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="rounded-xl" /></F>
          <F label="CNPJ"><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="rounded-xl" /></F>
          <F label="Responsável principal"><Input value={form.owner_name ?? ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="rounded-xl" /></F>
          <F label="Aniversário (lembrete)"><BirthdayPicker value={form.birthday ?? null} onChange={(v) => setForm({ ...form, birthday: v })} /></F>
          <F label="Endereço" className="sm:col-span-2"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, nº, sala, bairro / cidade" className="rounded-xl" /></F>
          {/* Cidade alimenta o gráfico por cidade do Cria Captação. */}
          <F label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value || null })}
              list="ficha-capture-cities" placeholder="Ex.: Itajaí" className="rounded-xl" />
            <datalist id="ficha-capture-cities">
              {captureCities.map((c) => <option key={c} value={c} />)}
            </datalist>
          </F>
          <F label="Segmento"><Input value={form.segment ?? ""} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="rounded-xl" /></F>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={<Phone />} title="Contato">
          <div className="grid grid-cols-1 gap-3">
            <F label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(DDD) 90000-0000" className="rounded-xl" /></F>
            <F label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" /></F>
            <F label="Instagram"><Input value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="rounded-xl" /></F>
            <F label="E-mail"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" /></F>
          </div>
        </Card>
        <Card icon={<Activity />} title="Contrato e pagamento">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label="Valor mensal"><MoneyInput value={form.monthly_value} onChange={(v) => setForm({ ...form, monthly_value: v })} /></F>
            <F label="Plano contratado"><Input value={form.plan_name ?? ""} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Ex.: Gestão completa" className="rounded-xl" /></F>
            <F label="Dia de pagamento">
              <Input type="number" inputMode="numeric" min={1} max={31} value={form.payment_day ?? ""} placeholder="Ex.: 15"
                onChange={(e) => { const n = Number(e.target.value); setForm({ ...form, payment_day: e.target.value === "" ? null : Math.max(1, Math.min(31, n)) }); }}
                className="rounded-xl" />
            </F>
            <F label="Forma de pagamento">
              <select value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value || null })}
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="">-</option>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="Início do contrato"><Input type="date" value={form.contract_date ?? ""} onChange={(e) => setForm({ ...form, contract_date: e.target.value || null })} className="rounded-xl" /></F>
            <F label="Renovação"><Input type="date" value={form.renewal_date ?? ""} onChange={(e) => setForm({ ...form, renewal_date: e.target.value || null })} className="rounded-xl" /></F>
          </div>
          <p className="text-[11.5px] font-body text-muted-foreground mt-3">O encerramento do contrato é marcado no seletor de situação, no topo do cliente.</p>
        </Card>
      </div>

      <Card icon={<Tags />} title="Etiquetas">
        <div className="flex items-center gap-2 flex-wrap">
          <TagPicker selected={form.tags ?? []} onChange={(tags) => setForm({ ...form, tags })} />
        </div>
      </Card>

      <Card icon={<NotebookPen />} title="Sobre o cliente">
        <p className="text-[11.5px] font-body text-muted-foreground -mt-2 mb-2">Resumo fixo do cliente (contexto e objetivo). As conversas do dia a dia ficam nas Notas.</p>
        <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, objetivo, observações..." className="rounded-xl text-sm" />
      </Card>

      <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-semibold text-foreground">Excluir cliente</p>
          <p className="text-xs font-body text-muted-foreground mt-0.5">Apaga a ficha, as tarefas, os contratos e o financeiro dele. Pra só parar de atender, use a situação Inativo no topo.</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => void excluir()} disabled={del.isPending}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
        </Button>
      </div>
    </div>
  );
}

/* ─── DIAGNÓSTICO ───────────────────────────────────────────────────────── */
export function DiagnosticoCliente({ crmClientId }: { crmClientId: string }) {
  const { form, setForm, saveState, isLoading } = useFichaEditavel(crmClientId, { campos: CAMPOS_DIAG });
  if (isLoading || !form) return <Carregando />;
  const dg = (form.diagnosis ?? {}) as Record<string, string>;
  const setDg = (k: string, v: string) => setForm({ ...form, diagnosis: { ...dg, [k]: v } });
  const geral = dg.overall && DIAG[dg.overall as keyof typeof DIAG];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] font-body text-muted-foreground">
          Classificação geral: <strong className={cn("font-display", geral ? geral.c : "text-foreground")}>{geral ? geral.l : "sem nota ainda"}</strong>
        </p>
        <Salvando estado={saveState} />
      </div>
      {/* Checklist "Arrumando a casa": antes de crescer, o perfil precisa transmitir clareza. */}
      <Card icon={<Check />} title="Arrumando a casa (checklist do perfil)">
        <p className="text-[11px] font-body text-muted-foreground -mt-1 mb-2">Antes de crescer, viralizar ou vender: o perfil transmite clareza? Marque item a item.</p>
        {([
          ["chkBio", "A bio comunica o que a marca faz?"],
          ["chkFeed", "O feed mostra autoridade?"],
          ["chkPinned", "Os fixados conectam com o cliente ideal?"],
          ["chkHighlights", "Os destaques eliminam objeções?"],
          ["chkVisual", "A identidade visual transmite foco e clareza?"],
          ["chkSite", "Há direcionamento pro site?"],
          ["chkContact", "Há um canal claro de contato?"],
        ] as const).map(([k, l]) => (
          <SimNao key={k} label={l} value={dg[k] ?? ""} on={(x) => setDg(k, x)} />
        ))}
      </Card>
      <Card icon={<Lightbulb />} title="Primeiros ajustes (plano)">
        <F label="Bio sugerida"><MicTextarea value={dg.bioSuggestion ?? ""} onChange={(v) => setDg("bioSuggestion", v)} placeholder="Clareza + valor + autoridade + CTA." /></F>
        <F label="Nome do perfil sugerido" className="mt-3"><Input value={dg.nameSuggestion ?? ""} onChange={(e) => setDg("nameSuggestion", e.target.value)} placeholder="Ex.: Nome | o que faz" className="rounded-xl" /></F>
        <F label="Destaques sugeridos" className="mt-3"><MicTextarea value={dg.highlightsPlan ?? ""} onChange={(v) => setDg("highlightsPlan", v)} placeholder="Um por linha: nome do destaque + o que vai dentro." /></F>
        <F label="Fixados sugeridos" className="mt-3"><MicTextarea value={dg.pinnedPlan ?? ""} onChange={(v) => setDg("pinnedPlan", v)} placeholder="Post 1 quem sou; Post 2 o que entregamos; Post 3 educativo de valor..." /></F>
      </Card>
      <Card icon={<Activity />} title="Diagnóstico do perfil">
        {[["visualIdentity", "Identidade visual"], ["bio", "Bio do perfil"], ["highlights", "Destaques (Highlights)"], ["positioning", "Clareza de posicionamento"]].map(([k, l]) => (
          <Rating key={k} label={l} value={dg[k] ?? ""} on={(x) => setDg(k, x)} />
        ))}
        <Rating label="Classificação geral" value={dg.overall ?? ""} on={(x) => setDg("overall", x)} bold />
      </Card>
      <Card icon={<NotebookPen />} title="Notas do diagnóstico"><Textarea rows={3} value={dg.notes ?? ""} onChange={(e) => setDg("notes", e.target.value)} className="rounded-xl text-sm" /></Card>
    </div>
  );
}

/* ─── CONCORRÊNCIA ──────────────────────────────────────────────────────── */
export function ConcorrenciaCliente({ crmClientId, onNovaAnalise }: { crmClientId: string; onNovaAnalise: () => void }) {
  const { form, setForm, saveState, isLoading } = useFichaEditavel(crmClientId, { campos: CAMPOS_CONC });
  const { allowed: hasHubCria } = useHasHubCria();
  const { data: hubScrapes = [] } = useScrapes(crmClientId);
  const delScrape = useDeleteScrape();
  if (isLoading || !form) return <Carregando />;
  const hubDone = hubScrapes.filter((s) => s.status === "done" && s.result_summary);
  const comps = form.competitors ?? [];
  const setComp = (i: number, patch: Partial<CrmClient["competitors"][number]>) => {
    const arr = comps.slice(); arr[i] = { ...arr[i], ...patch }; setForm({ ...form, competitors: arr });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Salvando estado={saveState} /></div>
      {/* Análises do Cria Radar (pesquisa real de concorrentes). */}
      {hasHubCria && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-display font-bold text-foreground">Análises do Cria Radar</p>
            <span className="text-[11px] font-body text-muted-foreground">({hubDone.length})</span>
            <Button variant="outline" size="sm" className="ml-auto h-8 text-xs" onClick={onNovaAnalise}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" /> Nova análise na Pesquisa
            </Button>
          </div>
          {hubDone.length === 0 ? (
            <p className="text-[12px] font-body text-muted-foreground">Nenhuma pesquisa ainda. Rode uma análise de concorrente na <strong>Pesquisa</strong> (Cria Radar), os resultados aparecem aqui pra consulta.</p>
          ) : (
            <div className="space-y-2">
              {hubDone.map((s, i) => (
                <SummaryCard key={s.id} summary={s.result_summary as Record<string, unknown>} handle={s.input_handle} defaultOpen={i === 0} onDelete={() => delScrape.mutate(s.id)} crmClientId={crmClientId} scrapeId={s.id} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider pt-1">Concorrentes acompanhados (manual)</p>
      {comps.map((c, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold">{initial(c.name)}</div>
            <span className="flex-1 font-display font-bold text-sm text-foreground">{c.name || "Novo concorrente"}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remover concorrente" onClick={() => setForm({ ...form, competitors: comps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <CF label="Nome" v={c.name ?? ""} on={(x) => setComp(i, { name: x })} />
            <CF label="Instagram" v={c.instagram ?? ""} on={(x) => setComp(i, { instagram: x })} />
            <CF label="Seguidores" v={c.followers ?? ""} on={(x) => setComp(i, { followers: x })} />
            <CF label="Frequência" v={c.frequency ?? ""} on={(x) => setComp(i, { frequency: x })} />
            <CF label="Conteúdo" v={c.contentType ?? ""} on={(x) => setComp(i, { contentType: x })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 mt-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <select value={(c as { kind?: string }).kind ?? ""} onChange={(e) => setComp(i, { kind: e.target.value } as never)}
                className="w-full h-9 mt-1 rounded-xl border border-input bg-card px-2 text-sm">
                <option value="">-</option>
                <option value="direto">Direto</option>
                <option value="indireto">Indireto</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">O que observar (por que compete / o que faz bem)</Label>
              <Input value={(c as { note?: string }).note ?? ""} onChange={(e) => setComp(i, { note: e.target.value } as never)} className="rounded-xl mt-1" />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setForm({ ...form, competitors: [...comps, {}] })} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-[1.5px] border-dashed border-primary/25 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors">
        <Plus className="h-4 w-4" /> Adicionar concorrente
      </button>
    </div>
  );
}

/* ─── PEÇAS ─────────────────────────────────────────────────────────────── */

// Etiquetas personalizadas: multi-seleção + criar/editar/excluir (catálogo por agência).
export function TagPicker({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) {
  const { data: tags = [] } = useCrmTags();
  const createTag = useCreateCrmTag();
  const delTag = useDeleteCrmTag();
  const updTag = useUpdateCrmTag();
  const seed = useSeedDefaultCrmTags();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("violet");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((t) => t !== name) : [...selected, name]);
  const colorOf = (name: string) => tags.find((t) => t.name === name)?.color ?? "slate";
  const doCreate = () => { if (newName.trim()) { createTag.mutate({ name: newName, color: newColor }); setNewName(""); } };

  // Renomear: se o cliente já usava a etiqueta, o nome selecionado acompanha.
  const commitRename = (t: CrmTag) => {
    const nome = editName.trim();
    setEditId(null);
    if (!nome || nome === t.name) return;
    updTag.mutate({ id: t.id, name: nome }, {
      onSuccess: () => { if (selected.includes(t.name)) onChange(selected.map((s) => (s === t.name ? nome : s))); },
    });
  };

  const faltamPadrao = DEFAULT_CRM_TAGS.some(
    (d) => !tags.some((t) => t.name.toLowerCase() === d.name.toLowerCase()),
  );

  return (
    <>
      {selected.map((name) => (
        <span key={name} className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1", TAG_COLOR_CLS[colorOf(name)] ?? TAG_COLOR_CLS.slate)}>
          {name}
          <button type="button" onClick={() => toggle(name)} className="opacity-60 hover:opacity-100" aria-label={`Remover ${name}`}>×</button>
        </span>
      ))}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}>
        <PopoverTrigger asChild>
          <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
            + Etiqueta
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Etiquetas da sua agência</p>
          <p className="text-[10.5px] font-body text-muted-foreground mb-2 leading-tight">Valem pra todos os clientes. Renomeie, troque a cor ou exclua à vontade.</p>

          <div className="max-h-52 overflow-y-auto space-y-1 mb-2">
            {tags.length === 0 && <p className="text-[11px] text-muted-foreground py-1">Nenhuma ainda.</p>}
            {tags.map((t) => {
              const on = selected.includes(t.name);
              if (editId === t.id) {
                return (
                  <div key={t.id} className="rounded-lg border border-primary/40 bg-primary/[0.03] p-2 space-y-2">
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm rounded-lg"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitRename(t); } if (e.key === "Escape") setEditId(null); }} />
                    <div className="flex items-center gap-1 flex-wrap">
                      {TAG_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => updTag.mutate({ id: t.id, color: c })}
                          className={cn("h-5 w-5 rounded-full border", TAG_COLOR_CLS[c], t.color === c && "ring-2 ring-primary ring-offset-1")} aria-label={c} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => commitRename(t)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}>Cancelar</Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={t.id} className="flex items-center gap-1 group">
                  <button type="button" onClick={() => toggle(t.name)} className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-md px-1 py-1 hover:bg-muted/50">
                    <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                      {on && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className={cn("text-[12px] font-body px-2 py-0.5 rounded-full border truncate", TAG_COLOR_CLS[t.color] ?? TAG_COLOR_CLS.slate)}>{t.name}</span>
                  </button>
                  <button type="button" onClick={() => { setEditId(t.id); setEditName(t.name); }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-primary shrink-0 p-1" aria-label="Editar etiqueta">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={async () => { if (await confirmar({ titulo: `Excluir a etiqueta "${t.name}"?`, descricao: "Ela sai de todos os clientes que a tinham." })) delTag.mutate(t.id); }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 p-1" aria-label="Excluir etiqueta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {faltamPadrao && (
            <button type="button" onClick={() => seed.mutate(tags)} disabled={seed.isPending}
              className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] px-2 py-2 mb-2 text-left hover:bg-primary/[0.07] transition-colors">
              <p className="text-[12px] font-body font-semibold text-foreground">Usar as etiquetas padrão</p>
              <p className="text-[10.5px] font-body text-muted-foreground leading-tight">
                {DEFAULT_CRM_TAGS.map((t) => t.name).join(", ")}, depois é só editar ou excluir.
              </p>
            </button>
          )}

          <div className="border-t border-border pt-2 space-y-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etiqueta…" className="h-8 text-sm rounded-lg"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doCreate(); } }} />
            <div className="flex items-center gap-1 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  className={cn("h-5 w-5 rounded-full border", TAG_COLOR_CLS[c], newColor === c && "ring-2 ring-primary ring-offset-1")} aria-label={c} />
              ))}
            </div>
            <Button size="sm" className="w-full h-8" disabled={!newName.trim() || createTag.isPending} onClick={doCreate}>Criar etiqueta</Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

// Aniversário só precisa de dia e mês. Guarda como "2000-MM-DD" (coluna date).
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function BirthdayPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  // Dia e mês em estado LOCAL: só grava quando as duas metades estão preenchidas.
  const partsIni = (value ?? "").split("-");
  const [dd, setDd] = useState(partsIni.length === 3 ? partsIni[2] : "");
  const [mm, setMm] = useState(partsIni.length === 3 ? partsIni[1] : "");
  useEffect(() => {
    const p = (value ?? "").split("-");
    setDd(p.length === 3 ? p[2] : "");
    setMm(p.length === 3 ? p[1] : "");
  }, [value]);
  const set = (nd: string, nm: string) => {
    setDd(nd); setMm(nm);
    if (nd && nm) onChange(`2000-${nm}-${nd.padStart(2, "0")}`);
    else if (!nd && !nm) onChange(null);
  };
  const selCls = "h-10 rounded-xl border border-input bg-background px-2 text-sm";
  return (
    <div className="flex gap-2">
      <select value={dd} onChange={(e) => set(e.target.value, mm)} className={cn(selCls, "w-[88px]")} aria-label="Dia">
        <option value="">Dia</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={mm} onChange={(e) => set(dd, e.target.value)} className={cn(selCls, "flex-1")} aria-label="Mês">
        <option value="">Mês</option>
        {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>)}
      </select>
    </div>
  );
}

// Sim/Não do checklist "Arrumando a casa" (clicar de novo limpa).
function SimNao({ label, value, on }: { label: string; value: string; on: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[13px] font-body text-foreground">{label}</span>
      <div className="flex gap-1 shrink-0">
        {(["sim", "nao"] as const).map((v) => (
          <button key={v} type="button" onClick={() => on(value === v ? "" : v)}
            className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors",
              value === v
                ? v === "sim"
                  ? "bg-[hsl(var(--cria-verde)/0.15)] text-[hsl(var(--cria-verde))] border-[hsl(var(--cria-verde)/0.4)]"
                  : "bg-destructive/10 text-destructive border-destructive/30"
                : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            {v === "sim" ? "Sim" : "Não"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Rating({ label, value, on, bold }: { label: string; value: string; on: (x: string) => void; bold?: boolean }) {
  const opts: [string, string, string][] = [["baixo", "Baixo", "bg-red-100 text-red-700 border-red-200"], ["medio", "Médio", "bg-amber-100 text-amber-700 border-amber-200"], ["alto", "Alto", "bg-green-100 text-green-700 border-green-200"]];
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 border-b border-border last:border-0">
      <span className={cn("text-foreground", bold ? "font-display font-bold text-base" : "text-sm font-medium")}>{label}</span>
      <div className="flex gap-1.5">
        {opts.map(([val, lbl, on_cls]) => (
          <button key={val} type="button" onClick={() => on(val)} className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors", value === val ? on_cls : "bg-card border-border text-muted-foreground/60 hover:text-foreground")}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}
