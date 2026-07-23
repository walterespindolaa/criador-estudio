import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Save, Trash2, Plus, X, ImagePlus, Pencil, Camera, Upload, Download,
  Instagram, Mail, Phone, Palette, Type, MessageSquare, Image as ImageIcon,
  Brain, HeartCrack, Heart, Lightbulb, Activity, NotebookPen, Target, Building2, Mic, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/AccountContext";
import {
  useCrmClient, useUpdateCrmClient, useDeleteCrmClient, useCrmClientRefs, useAddCrmRef, useDeleteCrmRef,
  useUploadCrmAsset, useSyncCrmFromCria, useCrmTags, useCreateCrmTag, useDeleteCrmTag,
  useUpdateCrmTag, useSeedDefaultCrmTags, DEFAULT_CRM_TAGS,
  CLIENT_STATUSES, CLIENT_STATUS_META, TAG_COLORS, TAG_COLOR_CLS, CLIENT_COLORS,
  type CrmClient, type ClientStatus, type CrmTag,
} from "@/hooks/useCrm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { useScrapes, useHasHubCria, useDeleteScrape } from "@/hooks/useHubCria";
import { SummaryCard } from "@/components/hubcria/CriativoTab";
import { BrandbookImport } from "@/components/brandbook/BrandbookImport";
import { ClientTasks } from "@/components/accounts/crm/ClientTasks";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/finance";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { confirmar } from "@/components/shared/Confirm";

const CONSCIOUSNESS = ["Inconsciente do problema", "Consciente do problema", "Consciente da solução", "Consciente do produto", "Totalmente consciente"];
const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
// Campos que o autosave persiste. persona vai como ARRAY (antes ia só a persona ativa, apagava as outras).
const payloadOf = (f: CrmClient) => ({
  name: f.name, instagram: f.instagram, email: f.email, phone: f.phone,
  segment: f.segment, monthly_value: f.monthly_value, contract_date: f.contract_date,
  renewal_date: f.renewal_date, contract_end_date: f.contract_end_date, notes: f.notes, logo: f.logo, color: f.color,
  company_name: f.company_name, cnpj: f.cnpj, owner_name: f.owner_name, whatsapp: f.whatsapp, address: f.address,
  plan_name: f.plan_name, payment_day: f.payment_day, payment_method: f.payment_method, birthday: f.birthday,
  status: f.status, tags: f.tags,
  brand_core: f.brand_core, persona: f.persona, diagnosis: f.diagnosis, competitors: f.competitors,
});
const monthYear = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "-";
const parseHex = (s?: string) => (s ?? "").split(/[\s,;]+/).filter((x) => /^#([0-9a-f]{3,8})$/i.test(x)).slice(0, 8);
const DIAG = { baixo: { l: "Baixo", c: "text-red-600" }, medio: { l: "Médio", c: "text-amber-600" }, alto: { l: "Alto", c: "text-green-600" } } as const;

export default function CriaCrmClient() {
  return <ModuleGate code="crm"><ClientWorkspace /></ModuleGate>;
}

// Ditado por voz (Web Speech API, Chrome). Anexa o texto reconhecido ao campo.
function MicButton({ onText }: { onText: (t: string) => void }) {
  const recRef = useRef<any>(null);
  const [on, setOn] = useState(false);
  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Ditado por voz não suportado neste navegador (use o Chrome)."); return; }
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (t.trim()) onText(t.trim());
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    r.start(); recRef.current = r; setOn(true);
  };
  const stop = () => { try { recRef.current?.stop(); } catch { /* ignore */ } setOn(false); };
  return (
    <button type="button" onClick={() => (on ? stop() : start())} title={on ? "Parar" : "Ditar por voz"}
      className={cn("shrink-0 h-8 w-8 grid place-items-center rounded-lg border transition-colors", on ? "bg-red-500 text-white border-red-500 animate-pulse" : "border-border text-muted-foreground hover:text-primary hover:border-primary/40")}>
      <Mic className="h-4 w-4" />
    </button>
  );
}
function MicTextarea({ value, onChange, rows = 2, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="relative">
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-xl text-sm pr-11" />
      <div className="absolute top-2 right-2"><MicButton onText={(t) => onChange((value ? value.trim() + " " : "") + t)} /></div>
    </div>
  );
}

function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveAccount, managedAccounts } = useActiveAccount();
  const { data: client, isLoading } = useCrmClient(id);
  const { allowed: hasHubCria } = useHasHubCria();
  const { data: hubScrapes = [] } = useScrapes(id);
  const hubDone = hubScrapes.filter((s) => s.status === "done" && s.result_summary);
  const delScrape = useDeleteScrape();
  const update = useUpdateCrmClient();
  const del = useDeleteCrmClient();
  const uploadAsset = useUploadCrmAsset();
  const sync = useSyncCrmFromCria();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const syncedOnce = useRef(false);

  const [form, setForm] = useState<CrmClient | null>(null);
  const [personaIdx, setPersonaIdx] = useState(0);
  const lastServer = useRef<string>("");   // último estado vindo do servidor
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Sincroniza do servidor SEM atropelar o que o usuário está digitando.
  // (Antes, qualquer refetch resetava o form → "coloco a info, saio e volta zerado".)
  useEffect(() => {
    if (!client) return;
    const srv = JSON.stringify(client);
    setForm((cur) => {
      if (!cur || cur.id !== client.id) { lastServer.current = srv; return client; }   // trocou de cliente
      const clean = JSON.stringify(cur) === lastServer.current;                        // sem edição pendente?
      lastServer.current = srv;
      return clean ? client : cur;                                                     // só adota o servidor se estou limpo
    });
  }, [client]);

  // Auto-sync uma vez ao abrir um cliente que usa o Cria (puxa Brandbook/nome atualizados).
  useEffect(() => {
    if (client?.cria_owner_id && id && !syncedOnce.current) {
      syncedOnce.current = true;
      sync.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.cria_owner_id, id]);

  // AUTOSAVE: salva sozinho ~0,8s depois da última tecla. Sem botão, sem perder dado.
  useEffect(() => {
    if (!form || !client || form.id !== client.id) return;
    if (JSON.stringify(payloadOf(form)) === JSON.stringify(payloadOf(client))) return; // nada mudou
    setSaveState("saving");
    const t = setTimeout(() => {
      update.mutate({ id: form.id, ...payloadOf(form) }, {
        onSuccess: () => { setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1600); },
        onError: () => setSaveState("idle"),
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, client]);

  if (isLoading || !form) {
    return <div className="space-y-4"><div className="h-32 rounded-3xl bg-muted animate-pulse" /><div className="h-72 rounded-3xl bg-muted animate-pulse" /></div>;
  }

  const isCria = !!form.cria_owner_id;
  const bc = form.brand_core ?? {};
  // Persona agora é uma LISTA (até 3). Compatível com o formato antigo (objeto único).
  const rawPersona = form.persona as unknown;
  const personas: Record<string, string>[] = Array.isArray(rawPersona)
    ? (rawPersona as Record<string, string>[])
    : (rawPersona && typeof rawPersona === "object" && Object.keys(rawPersona).length ? [rawPersona as Record<string, string>] : [{}]);
  const idx = Math.min(personaIdx, personas.length - 1);
  const pe = personas[idx] ?? {};
  const dg = form.diagnosis ?? {};
  const comps = form.competitors ?? [];
  const criaAvatar = form.cria_owner_id ? (managedAccounts.find((a) => a.owner_id === form.cria_owner_id)?.avatar_url ?? null) : null;
  const shownAvatar = form.logo && /^https?:\/\//.test(form.logo) ? form.logo : criaAvatar;
  const setBc = (k: string, v: string) => setForm({ ...form, brand_core: { ...bc, [k]: v } });
  const setPe = (k: string, v: string) => {
    const arr = personas.slice(); arr[idx] = { ...(arr[idx] ?? {}), [k]: v };
    setForm({ ...form, persona: arr as unknown as CrmClient["persona"] });
  };
  const addPersona = () => {
    if (personas.length >= 3) return;
    const arr = [...personas, {}]; setForm({ ...form, persona: arr as unknown as CrmClient["persona"] }); setPersonaIdx(arr.length - 1);
  };
  const delPersona = (i: number) => {
    const arr = personas.filter((_, j) => j !== i);
    setForm({ ...form, persona: (arr.length ? arr : [{}]) as unknown as CrmClient["persona"] });
    setPersonaIdx(0);
  };
  const setDg = (k: string, v: string) => setForm({ ...form, diagnosis: { ...dg, [k]: v } });
  const setComp = (i: number, patch: Partial<CrmClient["competitors"][number]>) => {
    const arr = comps.slice(); arr[i] = { ...arr[i], ...patch }; setForm({ ...form, competitors: arr });
  };

  // Salvamento manual (o autosave já cobre; o botão só força na hora).
  const save = async () => {
    await update.mutateAsync({ id: form.id, ...payloadOf(form) });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1600);
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => toast.error("Erro ao ler a imagem.");
    reader.readAsDataURL(file);
  };
  const onCroppedAvatar = async (blob: Blob) => {
    setCropSrc(null);
    try {
      const file = new File([blob], "logo.jpg", { type: "image/jpeg" });
      const url = await uploadAsset.mutateAsync({ clientId: form.id, file, kind: "avatar" });
      await update.mutateAsync({ id: form.id, logo: url });
      setForm({ ...form, logo: url });
      toast.success("Foto atualizada!");
    } catch { /* hook já avisa */ }
  };
  const onPickFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadAsset.mutateAsync({ clientId: form.id, file, kind: "font" });
      const nbc = { ...bc, typographyFileUrl: url, typographyFileName: file.name };
      setForm({ ...form, brand_core: nbc });
      await update.mutateAsync({ id: form.id, brand_core: nbc });
      toast.success("Fonte enviada!");
    } catch { /* hook já avisa */ }
  };

  const swatches = parseHex(bc.colorPalette);
  const diagOverall = dg.overall && DIAG[dg.overall as keyof typeof DIAG];

  return (
    <div className="pb-4">
      <button onClick={() => navigate("/socialmidia/criacrm")} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar pra carteira
      </button>

      {/* HERO
          No mobile isto era um `flex-wrap` com tudo dentro: nome, chips e os
          botões brigavam pela mesma linha e o resultado era o do print, sem
          hierarquia nenhuma. Agora são três blocos empilhados e óbvios:
          1) quem é (foto + nome)  2) o que é (chips, numa tira que rola)
          3) o que fazer (ações, botões de verdade). No desktop volta pro lado. */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-7 shadow-sm mb-6">
        {/* 1. Quem é */}
        <div className="flex items-start gap-4 sm:gap-5">
          <button type="button" onClick={() => avatarInputRef.current?.click()}
            className="relative w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-3xl p-[3px] bg-gradient-to-br from-primary via-purple-500 to-pink-400 shrink-0 hover:scale-[1.02] transition-transform" aria-label="Trocar foto do cliente">
            <div className="w-full h-full rounded-[20px] bg-card flex items-center justify-center overflow-hidden">
              {shownAvatar ? <img src={shownAvatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <span className="font-display font-extrabold text-2xl sm:text-3xl text-primary">{form.logo && form.logo.length <= 2 ? form.logo : initial(form.name)}</span>}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm"><Camera className="h-3.5 w-3.5 text-primary-foreground" /></div>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <ImageCropModal open={!!cropSrc} onOpenChange={(o) => { if (!o) setCropSrc(null); }} imageSrc={cropSrc ?? ""} onCropComplete={onCroppedAvatar} aspectRatio={1} />

          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="font-display font-bold text-xl sm:text-3xl tracking-tight text-foreground leading-tight">{form.name || "Sem nome"}</h1>
            {form.instagram && (
              <p className="text-[13px] font-body text-muted-foreground mt-0.5 inline-flex items-center gap-1 min-w-0">
                <Instagram className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{form.instagram.replace(/^@/, "")}</span>
              </p>
            )}
          </div>

          {/* Desktop: as ações ficam aqui em cima, como sempre foram. */}
          <div className="hidden sm:flex gap-2 shrink-0 items-center">
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1.5 rounded-lg transition-colors",
              saveState === "saving" ? "text-muted-foreground bg-muted"
              : saveState === "saved" ? "text-emerald-600 bg-emerald-500/10"
              : "text-muted-foreground")}>
              {saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo ✓" : "Salva automático"}
            </span>
            {isCria && <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setActiveAccount(form.cria_owner_id!); navigate("/app"); }}>Abrir no cria <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
            <Button variant="outline" size="sm" className="rounded-xl" onClick={save} disabled={update.isPending}><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar</Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={async () => { if (await confirmar({ titulo: "Excluir este cliente?", descricao: "A ficha, as tarefas, os contratos e o financeiro dele vão junto." })) { await del.mutateAsync(form.id); navigate("/socialmidia/criacrm"); } }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* 2. O que é: chips numa tira só, que rola no mobile em vez de empilhar. */}
        <div className="flex items-center gap-2 mt-3.5 overflow-x-auto scrollbar-none scroll-snap-x sm:flex-wrap sm:overflow-visible pb-0.5">
          <select value={form.status ?? "ativo"} onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
            className={cn("shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer outline-none", CLIENT_STATUS_META[(form.status ?? "ativo") as ClientStatus].cls)}>
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{CLIENT_STATUS_META[s].label}</option>)}
          </select>
          {form.segment && <span className="shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/15">{form.segment}</span>}
          {isCria && <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-muted text-foreground/70 border border-border">cria</span>}
          {/* Etiquetas VARIÁVEIS (multi-seleção) */}
          <TagPicker selected={form.tags ?? []} onChange={(tags) => setForm({ ...form, tags })} />
        </div>

        {/* 3. O que fazer: no mobile as ações viram botões de verdade, lado a lado. */}
        <div className="flex sm:hidden items-center gap-2 mt-3.5">
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={save} disabled={update.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo ✓" : "Salvar"}
          </Button>
          {isCria && (
            <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => { setActiveAccount(form.cria_owner_id!); navigate("/app"); }}>
              Abrir no cria <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={async () => { if (await confirmar({ titulo: "Excluir este cliente?", descricao: "A ficha, as tarefas, os contratos e o financeiro dele vão junto." })) { await del.mutateAsync(form.id); navigate("/socialmidia/criacrm"); } }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 sm:mt-6 sm:pt-5 border-t border-border">
          <Stat k="Valor mensal" v={formatBRL(form.monthly_value)} s="por mês" accent />
          <Stat k="Cliente desde" v={monthYear(form.contract_date)} />
          <Stat k="Renovação" v={monthYear(form.renewal_date)} />
          <Stat k="Diagnóstico" v={diagOverall ? diagOverall.l : "-"} cls={diagOverall ? diagOverall.c : ""} />
        </div>
      </div>

      {/* TABS */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-6 flex-wrap h-auto shadow-sm">
          {[["resumo", "Resumo"], ["tarefas", "Tarefas"], ["brand", "Brandbook"], ["persona", "Persona"], ["diag", "Diagnóstico"], ["conc", "Concorrência"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="rounded-xl px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none font-display">{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="mt-0 space-y-4">
          <Card icon={<NotebookPen />} title="Sobre o cliente">
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, objetivo, observações..." className="rounded-xl text-sm" />
          </Card>
          {/* Informações gerais da empresa */}
          <Card icon={<NotebookPen />} title="Informações gerais">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Nome da empresa (razão social)"><Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="rounded-xl" /></F>
              <F label="CNPJ"><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="rounded-xl" /></F>
              <F label="Responsável principal"><Input value={form.owner_name ?? ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="rounded-xl" /></F>
              <F label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(DDD) 90000-0000" className="rounded-xl" /></F>
              <F label="Endereço" className="sm:col-span-2"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, nº, sala, bairro / cidade" className="rounded-xl" /></F>
              <F label="Aniversário (lembrete)"><BirthdayPicker value={form.birthday ?? null} onChange={(v) => setForm({ ...form, birthday: v })} /></F>
              <F label="Cor do cliente (destaque no card)" className="sm:col-span-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {CLIENT_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: form.color === c ? null : c })}
                      className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", form.color === c ? "border-foreground ring-2 ring-offset-2 ring-foreground/30" : "border-white shadow-sm")}
                      style={{ background: c }} aria-label={`Cor ${c}`} />
                  ))}
                  {form.color && <button type="button" onClick={() => setForm({ ...form, color: null })} className="text-xs text-muted-foreground underline">limpar</button>}
                </div>
              </F>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card icon={<Phone />} title="Contato">
              <div className="grid grid-cols-1 gap-3">
                <F label="Instagram"><Input value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="rounded-xl" /></F>
                <F label="E-mail"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" /></F>
                <F label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" /></F>
              </div>
            </Card>
            <Card icon={<Activity />} title="Comercial">
              <div className="grid grid-cols-2 gap-3">
                <F label="Segmento"><Input value={form.segment ?? ""} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="rounded-xl" /></F>
                <F label="Valor mensal"><MoneyInput value={form.monthly_value} onChange={(v) => setForm({ ...form, monthly_value: v })} /></F>
                <F label="Plano contratado"><Input value={form.plan_name ?? ""} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Ex.: Gestão completa" className="rounded-xl" /></F>
                <F label="Dia de pagamento">
                  <Input type="number" min={1} max={31} value={form.payment_day ?? ""} placeholder="Ex.: 15"
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
                <F label="Data de encerramento"><Input type="date" value={(form as { contract_end_date?: string | null }).contract_end_date ?? ""} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value || null } as CrmClient)} className="rounded-xl" /></F>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAREFAS */}
        <TabsContent value="tarefas" className="mt-0 space-y-4">
          <ClientTasks clientId={form.id} />
        </TabsContent>

        {/* BRAND CORE */}
        <TabsContent value="brand" className="mt-0 space-y-4">
          {isCria && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 flex-wrap">
              <Instagram className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[12px] font-body text-foreground/80 flex-1 min-w-0">Este cliente usa o Cria, o Brandbook e o nome são sincronizados do que ele preenche na conta dele.</p>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => id && sync.mutate(id, { onSuccess: () => toast.success("Sincronizado do Cria!") })} disabled={sync.isPending}>
                {sync.isPending ? <Save className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Sincronizar do Cria
              </Button>
            </div>
          )}
          {/* ── SUBIR O BRANDBOOK EM PDF ─────────────────────────────────────
              Esta aba é um formulário de vinte campos. Ninguém preenche
              formulário de vinte campos — e por isso o brandbook do cliente
              vive vazio, e TODA a IA que depende dele (ideias, legenda, prompt
              de arte, briefing) sai genérica.

              Só que o dado já existe: a social mídia tem o moodboard do cliente
              em PDF. Então a gente para de pedir pra digitar e passa a pedir o
              arquivo. "Digite vinte campos" vira "confere o que eu entendi". */}
          {!isCria && (
            <BrandbookImport
              alvo="cliente"
              atual={bc as Record<string, string | undefined>}
              titulo={`Sobe o moodboard d${form.name?.match(/^[AaEeIiOoUu]/) ? "" : "o"} ${form.name}. O Cria preenche.`}
              descricao="Se você já tem o brandbook deste cliente em PDF, não digite nada: a gente lê as cores, as fontes, o tom de voz e a direção de arte, e você só confere."
              onSalvar={async (valores) => {
                const nbc = { ...bc, ...valores };
                setForm({ ...form, brand_core: nbc });
                await update.mutateAsync({ id: form.id, brand_core: nbc });
                toast.success("Brandbook do cliente atualizado.");
              }}
            />
          )}

          {/* Mensagem & estratégia, é isso que alimenta as ideias de post da IA */}
          <Card icon={<Brain />} title="Mensagem & estratégia (alimenta as ideias de post)">
            <p className="text-[11px] font-body text-muted-foreground mb-3 -mt-1">Quanto mais completo, melhores as ideias que a IA gera pra este cliente. Toque no 🎤 pra ditar por voz.</p>
            <F label="O que a marca vende (produto/serviço)"><MicTextarea value={bc.offer ?? ""} onChange={(v) => setBc("offer", v)} placeholder="Ex.: consultoria financeira pra casais; app de organização..." /></F>
            <F label="Proposta de valor / diferencial" className="mt-3"><MicTextarea value={bc.valueProp ?? ""} onChange={(v) => setBc("valueProp", v)} placeholder="Por que escolher essa marca e não outra?" /></F>
            <F label="Público-alvo" className="mt-3"><MicTextarea value={bc.audience ?? ""} onChange={(v) => setBc("audience", v)} placeholder="Pra quem é? Dores, desejos, momento de vida..." /></F>
            <F label="Temas / pilares de conteúdo" className="mt-3"><MicTextarea value={bc.contentThemes ?? ""} onChange={(v) => setBc("contentThemes", v)} placeholder="Sobre o que a marca posta? Ex.: educação financeira, bastidores, dicas..." /></F>
            <F label="O que evitar" className="mt-3"><MicTextarea value={bc.avoid ?? ""} onChange={(v) => setBc("avoid", v)} placeholder="Assuntos, palavras ou tom que a marca não usa." /></F>
          </Card>
          {bc.criaBrandbook && (
            <Card icon={<Instagram />} title="Brandbook do cliente (sincronizado do Cria)">
              <p className="text-[13px] font-body text-muted-foreground whitespace-pre-wrap leading-relaxed">{bc.criaBrandbook}</p>
            </Card>
          )}
          {bc.archetype && (
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-card p-5 flex items-center gap-4">
              <span className="font-display font-extrabold text-sm text-primary-foreground bg-primary px-4 py-2 rounded-xl">{bc.archetype}</span>
              <span className="text-sm text-muted-foreground">Arquétipo da marca</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card icon={<MessageSquare />} title="Voz & personalidade">
              <F label="Arquétipo da marca"><Input value={bc.archetype ?? ""} onChange={(e) => setBc("archetype", e.target.value)} className="rounded-xl" /></F>
              <F label="Tom de voz" className="mt-3"><Input value={bc.toneOfVoice ?? ""} onChange={(e) => setBc("toneOfVoice", e.target.value)} className="rounded-xl" /></F>
              <F label="Personalidade" className="mt-3"><Textarea rows={2} value={bc.personality ?? ""} onChange={(e) => setBc("personality", e.target.value)} className="rounded-xl text-sm" /></F>
              <F label="Estilo de comunicação" className="mt-3"><Textarea rows={2} value={bc.communicationStyle ?? ""} onChange={(e) => setBc("communicationStyle", e.target.value)} className="rounded-xl text-sm" /></F>
            </Card>
            <Card icon={<Type />} title="Tipografia & visual">
              <div className="rounded-xl border border-border bg-muted/40 p-5 mb-3">
                <p className="font-display font-bold text-3xl tracking-tight text-foreground">Aa Bb Cc</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2">{bc.typography || "tipografia não definida"}</p>
              </div>
              <F label="Tipografia"><Input value={bc.typography ?? ""} onChange={(e) => setBc("typography", e.target.value)} placeholder="Ex: Fraunces + Inter" className="rounded-xl" /></F>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => fontInputRef.current?.click()} disabled={uploadAsset.isPending}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Subir arquivo da fonte
                </Button>
                {bc.typographyFileUrl && (
                  <a href={bc.typographyFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    <Download className="h-3.5 w-3.5" /> {bc.typographyFileName || "arquivo da fonte"}
                  </a>
                )}
                <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={onPickFont} />
              </div>
              <F label="Expressão visual" className="mt-3"><Textarea rows={2} value={bc.visualExpression ?? ""} onChange={(e) => setBc("visualExpression", e.target.value)} className="rounded-xl text-sm" /></F>
            </Card>
          </div>
          <Card icon={<Palette />} title="Paleta de cores">
            {swatches.length > 0 && (
              <div className="flex gap-2.5 flex-wrap mb-3">
                {swatches.map((hex, i) => (
                  <div key={i} className="text-center">
                    <div className="w-14 h-14 rounded-xl border border-black/5" style={{ background: hex }} />
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1.5 uppercase">{hex}</p>
                  </div>
                ))}
              </div>
            )}
            <F label="Paleta (cole os HEX separados por vírgula)"><Input value={bc.colorPalette ?? ""} onChange={(e) => setBc("colorPalette", e.target.value)} placeholder="#7A3B2E, #D98E5A, #F3E7D6" className="rounded-xl" /></F>
          </Card>
          <Moodboard clientId={form.id} />
        </TabsContent>

        {/* PERSONA */}
        <TabsContent value="persona" className="mt-0 space-y-4">
          {isCria && <CriaHint />}
          {/* Seletor de personas (até 3) */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-display font-bold text-foreground">Personas</p>
              <span className="text-[11px] font-body text-muted-foreground">({personas.length}/3)</span>
              <Button variant="outline" size="sm" className="ml-auto h-8 text-xs" onClick={addPersona} disabled={personas.length >= 3}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova persona
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {personas.map((p, i) => (
                <button key={i} onClick={() => setPersonaIdx(i)}
                  className={cn("text-left rounded-xl border p-3 transition-colors relative", i === idx ? "border-primary bg-primary/[0.06] ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/40")}>
                  <p className="text-[13px] font-body font-semibold text-foreground truncate pr-6">{p.name || `Persona ${i + 1}`}</p>
                  <p className="text-[11px] font-body text-muted-foreground line-clamp-1 mt-0.5">{(p.pains || "").split("\n")[0] || "sem dor definida"}</p>
                  {personas.length > 1 && (
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); delPersona(i); }}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" aria-label="Excluir persona"><Trash2 className="h-3.5 w-3.5" /></span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <Card icon={<Target />} title={`Editando: ${pe.name || `Persona ${idx + 1}`}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Nome / apelido da persona"><Input value={pe.name ?? ""} onChange={(e) => setPe("name", e.target.value)} placeholder="Ex.: Ana, a empreendedora ocupada" className="rounded-xl" /></F>
              <F label="Faixa etária"><Input value={pe.ageRange ?? ""} onChange={(e) => setPe("ageRange", e.target.value)} placeholder="Ex.: 28-40" className="rounded-xl" /></F>
            </div>
          </Card>
          <Card icon={<Brain />} title="Estado de consciência">
            <div className="flex gap-1.5 flex-wrap">
              {CONSCIOUSNESS.map((c) => (
                <button key={c} onClick={() => setPe("consciousness", pe.consciousness === c ? "" : c)}
                  className={cn("text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex-1 min-w-[120px]", pe.consciousness === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{c}</button>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card icon={<HeartCrack />} title="Dores"><MicTextarea rows={4} value={pe.pains ?? ""} onChange={(v) => setPe("pains", v)} placeholder="Uma dor por linha... (🎤 pra ditar)" /></Card>
            <Card icon={<Heart />} title="Desejos"><MicTextarea rows={4} value={pe.desires ?? ""} onChange={(v) => setPe("desires", v)} placeholder="Um desejo por linha... (🎤 pra ditar)" /></Card>
          </div>
          <Card icon={<Lightbulb />} title="Estratégia">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Objetivos"><MicTextarea value={pe.objectives ?? ""} onChange={(v) => setPe("objectives", v)} /></F>
              <F label="Promessas"><MicTextarea value={pe.promises ?? ""} onChange={(v) => setPe("promises", v)} /></F>
              <F label="Gatilhos"><MicTextarea value={pe.triggers ?? ""} onChange={(v) => setPe("triggers", v)} /></F>
              <F label="Estratégia de conteúdo"><MicTextarea value={pe.contentStrategy ?? ""} onChange={(v) => setPe("contentStrategy", v)} /></F>
            </div>
          </Card>
        </TabsContent>

        {/* DIAGNÓSTICO */}
        <TabsContent value="diag" className="mt-0 space-y-4">
          <Card icon={<Activity />} title="Diagnóstico do perfil">
            {[["visualIdentity", "Identidade visual"], ["bio", "Bio do perfil"], ["highlights", "Destaques (Highlights)"], ["positioning", "Clareza de posicionamento"]].map(([k, l]) => (
              <Rating key={k} label={l} value={dg[k] ?? ""} on={(x) => setDg(k, x)} />
            ))}
            <Rating label="Classificação geral" value={dg.overall ?? ""} on={(x) => setDg("overall", x)} bold />
          </Card>
          <Card icon={<NotebookPen />} title="Notas do diagnóstico"><Textarea rows={3} value={dg.notes ?? ""} onChange={(e) => setDg("notes", e.target.value)} className="rounded-xl text-sm" /></Card>
        </TabsContent>

        {/* CONCORRÊNCIA */}
        <TabsContent value="conc" className="mt-0 space-y-3">
          {/* Análises do HUB (pesquisa real de concorrentes) */}
          {hasHubCria && (
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-display font-bold text-foreground">Análises do Cria Radar</p>
                <span className="text-[11px] font-body text-muted-foreground">({hubDone.length})</span>
                <Button variant="outline" size="sm" className="ml-auto h-8 text-xs" onClick={() => navigate(`/socialmidia/clientes/${id}/criativo`)}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1" /> Nova análise no Criativo
                </Button>
              </div>
              {hubDone.length === 0 ? (
                <p className="text-[12px] font-body text-muted-foreground">Nenhuma pesquisa ainda. Rode uma análise de concorrente na aba <strong>Criativo</strong>, os resultados aparecem aqui pra consulta.</p>
              ) : (
                <div className="space-y-2">
                  {hubDone.map((s, i) => (
                    <SummaryCard key={s.id} summary={s.result_summary as Record<string, unknown>} handle={s.input_handle} defaultOpen={i === 0} onDelete={() => delScrape.mutate(s.id)} />
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setForm({ ...form, competitors: comps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <CF label="Nome" v={c.name ?? ""} on={(x) => setComp(i, { name: x })} />
                <CF label="Instagram" v={c.instagram ?? ""} on={(x) => setComp(i, { instagram: x })} />
                <CF label="Seguidores" v={c.followers ?? ""} on={(x) => setComp(i, { followers: x })} />
                <CF label="Frequência" v={c.frequency ?? ""} on={(x) => setComp(i, { frequency: x })} />
                <CF label="Conteúdo" v={c.contentType ?? ""} on={(x) => setComp(i, { contentType: x })} />
              </div>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, competitors: [...comps, {}] })} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-[1.5px] border-dashed border-primary/25 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors">
            <Plus className="h-4 w-4" /> Adicionar concorrente
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Etiquetas personalizadas: multi-seleção + criar/excluir (catálogo por agência).
function TagPicker({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) {
  const { data: tags = [] } = useCrmTags();
  const createTag = useCreateCrmTag();
  const delTag = useDeleteCrmTag();
  const updTag = useUpdateCrmTag();
  const seed = useSeedDefaultCrmTags();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("violet");
  const [editId, setEditId] = useState<string | null>(null);   // etiqueta em edição
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

          {/* Etiquetas padrão: ponto de partida pra não encarar tela em branco. */}
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

function Stat({ k, v, s, accent, cls }: { k: string; v: string; s?: string; accent?: boolean; cls?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{k}</p>
      <p className={cn("font-display font-bold text-xl mt-1 tracking-tight", accent ? "text-primary" : "text-foreground", cls)}>{v}</p>
      {s && <p className="text-xs text-muted-foreground">{s}</p>}
    </div>
  );
}
function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2.5 mb-4">
        <span className="text-primary [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}
function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
// Aniversário só precisa de dia e mês (o ano é ignorado no lembrete). Guarda como
// "2000-MM-DD" pra manter a coluna date e tudo que lê birthday (calendário/robô).
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function BirthdayPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const parts = (value ?? "").split("-"); // ["YYYY","MM","DD"]
  const mm = parts.length === 3 ? parts[1] : "";
  const dd = parts.length === 3 ? parts[2] : "";
  const set = (nd: string, nm: string) => {
    if (!nd || !nm) { onChange(null); return; }
    onChange(`2000-${nm}-${nd.padStart(2, "0")}`);
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
function CF({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">{label}</Label><Input value={v} onChange={(e) => on(e.target.value)} className="rounded-lg h-9 text-sm" /></div>;
}
function Rating({ label, value, on, bold }: { label: string; value: string; on: (x: string) => void; bold?: boolean }) {
  const opts: [string, string, string][] = [["baixo", "Baixo", "bg-red-100 text-red-700 border-red-200"], ["medio", "Médio", "bg-amber-100 text-amber-700 border-amber-200"], ["alto", "Alto", "bg-green-100 text-green-700 border-green-200"]];
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 border-b border-border last:border-0">
      <span className={cn("text-foreground", bold ? "font-display font-bold text-base" : "text-sm font-medium")}>{label}</span>
      <div className="flex gap-1.5">
        {opts.map(([val, lbl, on_cls]) => (
          <button key={val} onClick={() => on(val)} className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors", value === val ? on_cls : "bg-card border-border text-muted-foreground/60 hover:text-foreground")}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}
function CriaHint() {
  return <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-foreground/80 flex items-center gap-2.5"><Pencil className="h-4 w-4 text-primary shrink-0" /> Esse cliente tem brandbook no cria, o conteúdo "oficial" vive lá. Use "Abrir no cria".</div>;
}
function Moodboard({ clientId }: { clientId: string }) {
  const { data: refs = [] } = useCrmClientRefs(clientId);
  const addRef = useAddCrmRef(); const delRef = useDeleteCrmRef();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2.5"><ImageIcon className="h-[18px] w-[18px] text-primary" /> Moodboard</h3>
          <p className="text-xs text-muted-foreground mt-1">Imagens de referência do cliente, prints, paleta, inspirações visuais.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => fileRef.current?.click()} disabled={addRef.isPending}><ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar imagem</Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await addRef.mutateAsync({ crmClientId: clientId, file: f }); }} />
      {refs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma referência ainda.</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {refs.map((r) => (
            <div key={r.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
              <img src={r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button onClick={() => delRef.mutate(r)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
