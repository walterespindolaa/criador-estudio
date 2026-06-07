import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save, Plus, Trash2, ImagePlus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useCrmClient, useUpdateCrmClient, useDeleteCrmClient, useCrmClientRefs, useAddCrmRef, useDeleteCrmRef, type CrmClient } from "@/hooks/useCrm";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CONSCIOUSNESS = ["Inconsciente do problema", "Consciente do problema", "Consciente da solução", "Consciente do produto", "Totalmente consciente"];
const RATINGS = [["baixo", "Baixo"], ["medio", "Médio"], ["alto", "Alto"]] as const;

export default function CriaCrmClient() {
  return <ModuleGate code="crm"><ClientWorkspace /></ModuleGate>;
}

function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveAccount } = useActiveAccount();
  const { data: client, isLoading } = useCrmClient(id);
  const update = useUpdateCrmClient();
  const del = useDeleteCrmClient();

  const [form, setForm] = useState<CrmClient | null>(null);
  useEffect(() => { if (client) setForm(client); }, [client]);

  if (isLoading || !form) {
    return <div className="space-y-3"><div className="h-8 w-48 rounded-xl bg-muted animate-pulse" /><div className="h-64 rounded-2xl bg-muted animate-pulse" /></div>;
  }

  const isCria = !!form.cria_owner_id;
  const bc = form.brand_core ?? {};
  const pe = form.persona ?? {};
  const dg = form.diagnosis ?? {};
  const comps = form.competitors ?? [];
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/socialmidia/criacrm")} className="p-2 rounded-xl hover:bg-accent/60"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-display font-extrabold text-foreground truncate">{form.name}</h1>
              {isCria && <Badge variant="secondary" className="text-[9px] h-4">cria</Badge>}
            </div>
            {form.segment && <p className="text-sm text-muted-foreground font-body">{form.segment}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCria && <Button variant="outline" size="sm" onClick={() => { setActiveAccount(form.cria_owner_id!); navigate("/app"); }}>Abrir no cria <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={async () => { if (confirm("Excluir este cliente? Essa ação não pode ser desfeita.")) { await del.mutateAsync(form.id); navigate("/socialmidia/criacrm"); } }}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
          <Button size="sm" onClick={save} disabled={update.isPending}><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar</Button>
        </div>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex-wrap h-auto">
          {[["dados", "Dados"], ["brand", "Brand Core"], ["persona", "Persona"], ["diag", "Diagnóstico"], ["conc", "Concorrência"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dados">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Txt label="Nome" v={form.name} on={(x) => setForm({ ...form, name: x })} />
            <Txt label="Segmento" v={form.segment ?? ""} on={(x) => setForm({ ...form, segment: x })} />
            <Txt label="Instagram" v={form.instagram ?? ""} on={(x) => setForm({ ...form, instagram: x })} />
            <Txt label="Telefone" v={form.phone ?? ""} on={(x) => setForm({ ...form, phone: x })} />
            <Txt label="E-mail" v={form.email ?? ""} on={(x) => setForm({ ...form, email: x })} />
            <Txt label="Valor mensal (R$)" type="number" v={String(form.monthly_value ?? 0)} on={(x) => setForm({ ...form, monthly_value: Number(x) })} />
            <Txt label="Início do contrato" type="date" v={form.contract_date ?? ""} on={(x) => setForm({ ...form, contract_date: x || null })} />
            <Txt label="Renovação" type="date" v={form.renewal_date ?? ""} on={(x) => setForm({ ...form, renewal_date: x || null })} />
            <Area label="Notas" full v={form.notes ?? ""} on={(x) => setForm({ ...form, notes: x })} />
          </div>
        </TabsContent>

        <TabsContent value="brand">
          {isCria && <CriaHint />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Txt label="Arquétipo da marca" v={bc.archetype ?? ""} on={(x) => setBc("archetype", x)} />
            <Txt label="Tom de voz" v={bc.toneOfVoice ?? ""} on={(x) => setBc("toneOfVoice", x)} />
            <Area label="Personalidade" full v={bc.personality ?? ""} on={(x) => setBc("personality", x)} />
            <Area label="Estilo de comunicação" full v={bc.communicationStyle ?? ""} on={(x) => setBc("communicationStyle", x)} />
            <Txt label="Paleta de cores" v={bc.colorPalette ?? ""} on={(x) => setBc("colorPalette", x)} />
            <Txt label="Tipografia" v={bc.typography ?? ""} on={(x) => setBc("typography", x)} />
            <Area label="Expressão visual" full v={bc.visualExpression ?? ""} on={(x) => setBc("visualExpression", x)} />
          </div>
          <Moodboard clientId={form.id} />
        </TabsContent>

        <TabsContent value="persona">
          {isCria && <CriaHint />}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Estado de consciência</Label>
              <select value={pe.consciousness ?? ""} onChange={(e) => setPe("consciousness", e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">—</option>{CONSCIOUSNESS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Sec title="Psicologia">
              <Area label="Dores (uma por linha)" v={pe.pains ?? ""} on={(x) => setPe("pains", x)} />
              <Area label="Desejos (um por linha)" v={pe.desires ?? ""} on={(x) => setPe("desires", x)} />
              <Area label="Frases reais (uma por linha)" v={pe.realPhrases ?? ""} on={(x) => setPe("realPhrases", x)} />
              <Area label="Obstáculos internos" v={pe.internalObstacles ?? ""} on={(x) => setPe("internalObstacles", x)} />
              <Area label="Obstáculos externos" v={pe.externalObstacles ?? ""} on={(x) => setPe("externalObstacles", x)} />
            </Sec>
            <Sec title="Estratégia">
              <Area label="Objetivos" v={pe.objectives ?? ""} on={(x) => setPe("objectives", x)} />
              <Area label="Promessas irresistíveis" v={pe.promises ?? ""} on={(x) => setPe("promises", x)} />
              <Area label="Gatilhos que funcionam" v={pe.triggers ?? ""} on={(x) => setPe("triggers", x)} />
              <Area label="Exemplos de copy" v={pe.copyExamples ?? ""} on={(x) => setPe("copyExamples", x)} />
              <Area label="Estratégia de conteúdo" v={pe.contentStrategy ?? ""} on={(x) => setPe("contentStrategy", x)} />
            </Sec>
          </div>
        </TabsContent>

        <TabsContent value="diag">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            {[["visualIdentity", "Identidade visual"], ["bio", "Bio do perfil"], ["highlights", "Destaques (Highlights)"], ["positioning", "Clareza de posicionamento"]].map(([k, l]) => (
              <Rating key={k} label={l} value={dg[k] ?? ""} on={(x) => setDg(k, x)} />
            ))}
            <div className="pt-2"><Rating label="Classificação geral" value={dg.overall ?? ""} on={(x) => setDg("overall", x)} bold /></div>
          </div>
          <div className="mt-3"><Area label="Notas do diagnóstico" v={dg.notes ?? ""} on={(x) => setDg("notes", x)} /></div>
        </TabsContent>

        <TabsContent value="conc">
          <div className="space-y-3">
            {comps.map((c, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                <CompField label="Nome" v={c.name ?? ""} on={(x) => setComp(i, { name: x })} />
                <CompField label="Instagram" v={c.instagram ?? ""} on={(x) => setComp(i, { instagram: x })} />
                <CompField label="Seguidores" v={c.followers ?? ""} on={(x) => setComp(i, { followers: x })} />
                <CompField label="Frequência" v={c.frequency ?? ""} on={(x) => setComp(i, { frequency: x })} />
                <div className="flex items-end gap-2">
                  <CompField label="Conteúdo" v={c.contentType ?? ""} on={(x) => setComp(i, { contentType: x })} />
                  <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => setForm({ ...form, competitors: comps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, competitors: [...comps, {}] })}><Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar concorrente</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Moodboard({ clientId }: { clientId: string }) {
  const { data: refs = [] } = useCrmClientRefs(clientId);
  const addRef = useAddCrmRef(); const delRef = useDeleteCrmRef();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Referências (moodboard)</h3>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={addRef.isPending}><ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar</Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await addRef.mutateAsync({ crmClientId: clientId, file: f }); }} />
      </div>
      {refs.length === 0 ? <p className="text-xs text-muted-foreground font-body">Nenhuma referência ainda.</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {refs.map((r) => (
            <div key={r.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
              <img src={r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button onClick={() => delRef.mutate(r)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Txt({ label, v, on, type, full }: { label: string; v: string; on: (x: string) => void; type?: string; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={(e) => on(e.target.value)} className="rounded-xl" /></div>;
}
function Area({ label, v, on, full }: { label: string; v: string; on: (x: string) => void; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label><Textarea rows={3} value={v} onChange={(e) => on(e.target.value)} className="rounded-xl text-sm" /></div>;
}
function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>;
}
function Rating({ label, value, on, bold }: { label: string; value: string; on: (x: string) => void; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <span className={cn("text-sm font-body text-foreground", bold && "font-display font-bold")}>{label}</span>
      <div className="flex gap-1.5">
        {RATINGS.map(([val, lbl]) => (
          <button key={val} onClick={() => on(val)} className={cn("px-3 py-1 rounded-full text-xs font-body font-bold border transition-colors", value === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}
function CompField({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return <div className="space-y-1 flex-1 min-w-0"><Label className="text-[10px] text-muted-foreground">{label}</Label><Input value={v} onChange={(e) => on(e.target.value)} className="rounded-lg h-9 text-sm" /></div>;
}
function CriaHint() {
  return <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 mb-4 text-xs font-body text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0" /> Esse cliente também tem brandbook no cria — o conteúdo "oficial" vive lá. Use "Abrir no cria".</div>;
}
