import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Save, Trash2, Plus, X, ImagePlus, Pencil, Camera, Upload, Download,
  Instagram, Mail, Phone, Palette, Type, MessageSquare, Image as ImageIcon,
  Brain, HeartCrack, Heart, Lightbulb, Activity, NotebookPen, Target, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useCrmClient, useUpdateCrmClient, useDeleteCrmClient, useCrmClientRefs, useAddCrmRef, useDeleteCrmRef, useUploadCrmAsset, type CrmClient } from "@/hooks/useCrm";
import { ClientTasks } from "@/components/accounts/crm/ClientTasks";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CONSCIOUSNESS = ["Inconsciente do problema", "Consciente do problema", "Consciente da solução", "Consciente do produto", "Totalmente consciente"];
const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR")}`;
const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
const monthYear = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—";
const parseHex = (s?: string) => (s ?? "").split(/[\s,;]+/).filter((x) => /^#([0-9a-f]{3,8})$/i.test(x)).slice(0, 8);
const DIAG = { baixo: { l: "Baixo", c: "text-red-600" }, medio: { l: "Médio", c: "text-amber-600" }, alto: { l: "Alto", c: "text-green-600" } } as const;

export default function CriaCrmClient() {
  return <ModuleGate code="crm"><ClientWorkspace /></ModuleGate>;
}

function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveAccount, managedAccounts } = useActiveAccount();
  const { data: client, isLoading } = useCrmClient(id);
  const update = useUpdateCrmClient();
  const del = useDeleteCrmClient();
  const uploadAsset = useUploadCrmAsset();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CrmClient | null>(null);
  useEffect(() => { if (client) setForm(client); }, [client]);

  if (isLoading || !form) {
    return <div className="space-y-4"><div className="h-32 rounded-3xl bg-muted animate-pulse" /><div className="h-72 rounded-3xl bg-muted animate-pulse" /></div>;
  }

  const isCria = !!form.cria_owner_id;
  const bc = form.brand_core ?? {};
  const pe = form.persona ?? {};
  const dg = form.diagnosis ?? {};
  const comps = form.competitors ?? [];
  const criaAvatar = form.cria_owner_id ? (managedAccounts.find((a) => a.owner_id === form.cria_owner_id)?.avatar_url ?? null) : null;
  const shownAvatar = form.logo && /^https?:\/\//.test(form.logo) ? form.logo : criaAvatar;
  const setBc = (k: string, v: string) => setForm({ ...form, brand_core: { ...bc, [k]: v } });
  const setPe = (k: string, v: string) => setForm({ ...form, persona: { ...pe, [k]: v } });
  const setDg = (k: string, v: string) => setForm({ ...form, diagnosis: { ...dg, [k]: v } });
  const setComp = (i: number, patch: Partial<CrmClient["competitors"][number]>) => {
    const arr = comps.slice(); arr[i] = { ...arr[i], ...patch }; setForm({ ...form, competitors: arr });
  };

  const save = async () => {
    await update.mutateAsync({
      id: form.id, name: form.name, instagram: form.instagram, email: form.email, phone: form.phone,
      segment: form.segment, monthly_value: form.monthly_value, contract_date: form.contract_date,
      renewal_date: form.renewal_date, notes: form.notes, brand_core: bc, persona: pe, diagnosis: dg, competitors: comps,
    });
    toast.success("Cliente salvo!");
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
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

      {/* HERO */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm mb-6">
        <div className="flex items-start gap-4 sm:gap-5 flex-wrap">
          <button type="button" onClick={() => avatarInputRef.current?.click()}
            className="relative w-[72px] h-[72px] rounded-3xl p-[3px] bg-gradient-to-br from-primary via-purple-500 to-pink-400 shrink-0 hover:scale-[1.02] transition-transform" aria-label="Trocar foto do cliente">
            <div className="w-full h-full rounded-[20px] bg-card flex items-center justify-center overflow-hidden">
              {shownAvatar ? <img src={shownAvatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <span className="font-display font-extrabold text-3xl text-primary">{form.logo && form.logo.length <= 2 ? form.logo : initial(form.name)}</span>}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm"><Camera className="h-3.5 w-3.5 text-primary-foreground" /></div>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-foreground truncate">{form.name || "Sem nome"}</h1>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {form.segment && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/15">{form.segment}</span>}
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-foreground/70 border border-border inline-flex items-center gap-1.5">{isCria ? "cria" : <><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo</>}</span>
              {form.instagram && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-foreground/70 border border-border inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{form.instagram.replace(/^@/, "")}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={async () => { if (confirm("Excluir este cliente?")) { await del.mutateAsync(form.id); navigate("/socialmidia/criacrm"); } }}><Trash2 className="h-4 w-4" /></Button>
            {isCria && <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setActiveAccount(form.cria_owner_id!); navigate("/app"); }}>Abrir no cria <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
            <Button size="sm" className="rounded-xl shadow-sm" onClick={save} disabled={update.isPending}><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border">
          <Stat k="Valor mensal" v={brl(form.monthly_value)} s="por mês" accent />
          <Stat k="Cliente desde" v={monthYear(form.contract_date)} />
          <Stat k="Renovação" v={monthYear(form.renewal_date)} />
          <Stat k="Diagnóstico" v={diagOverall ? diagOverall.l : "—"} cls={diagOverall ? diagOverall.c : ""} />
        </div>
      </div>

      {/* TABS */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-6 flex-wrap h-auto shadow-sm">
          {[["resumo", "Resumo"], ["tarefas", "Tarefas"], ["brand", "Brand Core"], ["persona", "Persona"], ["diag", "Diagnóstico"], ["conc", "Concorrência"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="rounded-xl px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none font-display">{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="mt-0 space-y-4">
          <Card icon={<NotebookPen />} title="Sobre o cliente">
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, objetivo, observações..." className="rounded-xl text-sm" />
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
                <F label="Valor mensal (R$)"><Input type="number" value={form.monthly_value ?? 0} onChange={(e) => setForm({ ...form, monthly_value: Number(e.target.value) })} className="rounded-xl" /></F>
                <F label="Início do contrato"><Input type="date" value={form.contract_date ?? ""} onChange={(e) => setForm({ ...form, contract_date: e.target.value || null })} className="rounded-xl" /></F>
                <F label="Renovação"><Input type="date" value={form.renewal_date ?? ""} onChange={(e) => setForm({ ...form, renewal_date: e.target.value || null })} className="rounded-xl" /></F>
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
          {isCria && <CriaHint />}
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
          <Card icon={<Brain />} title="Estado de consciência">
            <div className="flex gap-1.5 flex-wrap">
              {CONSCIOUSNESS.map((c) => (
                <button key={c} onClick={() => setPe("consciousness", pe.consciousness === c ? "" : c)}
                  className={cn("text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex-1 min-w-[120px]", pe.consciousness === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{c}</button>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card icon={<HeartCrack />} title="Dores"><Textarea rows={4} value={pe.pains ?? ""} onChange={(e) => setPe("pains", e.target.value)} placeholder="Uma dor por linha..." className="rounded-xl text-sm" /></Card>
            <Card icon={<Heart />} title="Desejos"><Textarea rows={4} value={pe.desires ?? ""} onChange={(e) => setPe("desires", e.target.value)} placeholder="Um desejo por linha..." className="rounded-xl text-sm" /></Card>
          </div>
          <Card icon={<Lightbulb />} title="Estratégia">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Objetivos"><Textarea rows={2} value={pe.objectives ?? ""} onChange={(e) => setPe("objectives", e.target.value)} className="rounded-xl text-sm" /></F>
              <F label="Promessas"><Textarea rows={2} value={pe.promises ?? ""} onChange={(e) => setPe("promises", e.target.value)} className="rounded-xl text-sm" /></F>
              <F label="Gatilhos"><Textarea rows={2} value={pe.triggers ?? ""} onChange={(e) => setPe("triggers", e.target.value)} className="rounded-xl text-sm" /></F>
              <F label="Estratégia de conteúdo"><Textarea rows={2} value={pe.contentStrategy ?? ""} onChange={(e) => setPe("contentStrategy", e.target.value)} className="rounded-xl text-sm" /></F>
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
  return <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-foreground/80 flex items-center gap-2.5"><Pencil className="h-4 w-4 text-primary shrink-0" /> Esse cliente tem brandbook no cria — o conteúdo "oficial" vive lá. Use "Abrir no cria".</div>;
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
          <p className="text-xs text-muted-foreground mt-1">Imagens de referência do cliente — prints, paleta, inspirações visuais.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => fileRef.current?.click()} disabled={addRef.isPending}><ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar imagem</Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await addRef.mutateAsync({ crmClientId: clientId, file: f }); }} />
      {refs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma referência ainda.</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {refs.map((r) => (
            <div key={r.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
              <img src={r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button onClick={() => delRef.mutate(r)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
