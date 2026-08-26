import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity, Brain, Building2, Download, Heart, HeartCrack, HelpCircle, Image as ImageIcon,
  ImagePlus, Instagram, Lightbulb, MessageSquare, Mic, Palette, Pencil, Plus, Save,
  ShieldAlert, Target, Trash2, Type, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddCrmRef, useCrmClient, useCrmClientRefs, useDeleteCrmRef, useUpdateCrmClient,
  useUploadCrmAsset, type CrmClient,
} from "@/hooks/useCrm";
import { BrandbookImport } from "@/components/brandbook/BrandbookImport";
import { RelatorioImport } from "@/components/brandbook/RelatorioImport";
import { BriefingCliente } from "@/components/accounts/crm/BriefingCliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O EDITOR DO BRANDBOOK, UMA IMPLEMENTAÇÃO SÓ

   O formulário de Brandbook e Persona nasceu dentro da ficha do CRM. Só que
   quem escreve post vive no cockpit do cliente, e lá a aba Brandbook era só
   leitura: dava pra olhar, não dava pra corrigir. A pessoa via o campo errado,
   ia até outra tela, e na prática não ia.

   Então o formulário saiu da página e virou este arquivo: os MESMOS campos, o
   MESMO autosave, usados nos dois lugares. Uma cópia só, pra nunca acontecer de
   um campo novo existir num lugar e faltar no outro.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Tons de voz: pares de opostos. A pessoa marca o que a marca é e o campo de
   texto ao lado fica pro detalhe ("informal, mas sem gíria"). */
const TONS = ["Formal", "Informal", "Emocional", "Racional", "Otimista e positivo", "Sério e objetivo", "Divertido", "Acolhedor", "Provocativo", "Técnico"];
const CONSCIOUSNESS = ["Inconsciente do problema", "Consciente do problema", "Consciente da solução", "Consciente do produto", "Totalmente consciente"];

// Campos que o autosave persiste. persona vai como ARRAY (antes ia só a persona ativa, apagava as outras).
export const payloadOf = (f: CrmClient) => ({
  name: f.name, instagram: f.instagram, email: f.email, phone: f.phone,
  segment: f.segment, monthly_value: f.monthly_value, contract_date: f.contract_date,
  renewal_date: f.renewal_date, contract_end_date: f.contract_end_date, notes: f.notes, logo: f.logo, color: f.color,
  company_name: f.company_name, cnpj: f.cnpj, owner_name: f.owner_name, whatsapp: f.whatsapp, address: f.address, city: f.city,
  plan_name: f.plan_name, payment_day: f.payment_day, payment_method: f.payment_method, birthday: f.birthday,
  status: f.status, tags: f.tags,
  brand_core: f.brand_core, persona: f.persona, diagnosis: f.diagnosis, competitors: f.competitors,
});

export const parseHex = (s?: string) => (s ?? "").split(/[\s,;]+/).filter((x) => /^#([0-9a-f]{3,8})$/i.test(x)).slice(0, 8);

// A persona virou LISTA (até 3), mas ficha antiga guardou um objeto só. Ler pelos
// dois formatos é o que evita que a persona "suma" pra quem preencheu antes.
export const personasDaFicha = (f: CrmClient): Record<string, string>[] => {
  const raw = f.persona as unknown;
  if (Array.isArray(raw)) return raw as Record<string, string>[];
  if (raw && typeof raw === "object" && Object.keys(raw).length) return [raw as Record<string, string>];
  return [{}];
};

type SetFicha = (f: CrmClient) => void;

/* ─── ESTADO + AUTOSAVE DA FICHA ─────────────────────────────────────────────
   Mora aqui porque o editor é usado em duas telas e as duas precisam do mesmo
   contrato: digitou, salvou sozinho, e um refetch no meio não apaga o que a
   pessoa está escrevendo. */
export function useFichaEditavel(id: string | undefined, opcoes?: {
  /* QUAIS campos este editor pode gravar.
     Na ficha do CRM o form é um só pra todas as abas, então grava tudo. No
     cockpit não: o cabeçalho do cliente (status, cor, foto, valor) fica montado
     ao lado e escreve no MESMO registro. Se o autosave do brandbook mandasse a
     ficha inteira, clicar em "Pausar" no cabeçalho enquanto os 800ms do debounce
     corriam devolvia `status: "ativo"` por cima, e isso mexe em Caixa, Home e
     mensalidade. Limitando o payload, os dois convivem sem se atropelar. */
  campos?: (keyof CrmClient)[];
}) {
  const { data: client, isLoading } = useCrmClient(id);
  const update = useUpdateCrmClient();
  const [form, setForm] = useState<CrmClient | null>(null);
  const lastServer = useRef<string>("");   // último estado vindo do servidor
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

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

  const campos = opcoes?.campos;
  const recorta = useCallback((f: CrmClient) => {
    const cheio = payloadOf(f) as Record<string, unknown>;
    if (!campos) return cheio;
    const so: Record<string, unknown> = {};
    for (const k of campos) so[k as string] = cheio[k as string];
    return so;
  }, [campos]);

  /* Grava agora, sem esperar o debounce. Usado no desmonte: sair da aba não
     pode jogar fora os últimos 800ms de digitação, que é justamente o texto que
     a pessoa acabou de escrever. */
  const gravarAgora = useCallback((f: CrmClient) => {
    update.mutate({ id: f.id, ...recorta(f) }, {
      onSuccess: () => { setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1600); },
      onError: () => setSaveState("idle"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorta]);

  // Guarda o form atual pra o cleanup do desmonte poder gravá-lo.
  const formRef = useRef<CrmClient | null>(null);
  const sujoRef = useRef(false);
  formRef.current = form;

  // AUTOSAVE: salva sozinho ~0,8s depois da última tecla. Sem botão, sem perder dado.
  useEffect(() => {
    if (!form || !client || form.id !== client.id) { sujoRef.current = false; return; }
    if (JSON.stringify(recorta(form)) === JSON.stringify(recorta(client))) { sujoRef.current = false; return; }
    sujoRef.current = true;
    setSaveState("saving");
    const t = setTimeout(() => {
      sujoRef.current = false;
      gravarAgora(form);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, client, recorta]);

  // Desmontou com alteração pendente? Grava antes de sumir.
  useEffect(() => () => {
    if (sujoRef.current && formRef.current) gravarAgora(formRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // setSaveState sai junto porque a ficha do CRM tem um botão "Salvar" manual que
  // força a gravação na hora: sem ele o selo ficaria preso em "Salvando…".
  return { client, form, setForm, saveState, setSaveState, isLoading, gravarAgora };
}

/* ─── PEÇAS DE FORMULÁRIO ────────────────────────────────────────────────── */

/* A Web Speech API não existe no lib.dom padrão (é prefixada no Chrome), então
   descrevemos aqui só o pedaço que a gente usa, em vez de espalhar `any`. */
type FalaEvento = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Reconhecedor = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: FalaEvento) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void; stop: () => void;
};
type JanelaComVoz = Window & {
  SpeechRecognition?: new () => Reconhecedor;
  webkitSpeechRecognition?: new () => Reconhecedor;
};

// Ditado por voz (Web Speech API, Chrome). Anexa o texto reconhecido ao campo.
export function MicButton({ onText }: { onText: (t: string) => void }) {
  const recRef = useRef<Reconhecedor | null>(null);
  const [on, setOn] = useState(false);
  const start = () => {
    const janela = window as JanelaComVoz;
    const SR = janela.SpeechRecognition || janela.webkitSpeechRecognition;
    if (!SR) { toast.error("Ditado por voz não suportado neste navegador (use o Chrome)."); return; }
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
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

export function MicTextarea({ value, onChange, rows = 2, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="relative">
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-xl text-sm pr-11" />
      <div className="absolute top-2 right-2"><MicButton onText={(t) => onChange((value ? value.trim() + " " : "") + t)} /></div>
    </div>
  );
}

export function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2.5 mb-4">
        <span className="text-primary [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}

export function F({ label, ajuda, children, className }: { label: string; ajuda?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* A linha de ajuda é o que faz o campo virar pergunta de briefing. */}
      {ajuda && <p className="text-[11px] font-body text-muted-foreground/80 leading-snug -mt-0.5">{ajuda}</p>}
      {children}
    </div>
  );
}

export function CF({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">{label}</Label><Input value={v} onChange={(e) => on(e.target.value)} className="rounded-lg h-9 text-sm" /></div>;
}

export function CriaHint() {
  return <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-foreground/80 flex items-center gap-2.5"><Pencil className="h-4 w-4 text-primary shrink-0" /> Esse cliente tem brandbook no cria, o conteúdo "oficial" vive lá. Use "Abrir no cria".</div>;
}

export function Moodboard({ clientId }: { clientId: string }) {
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

/* ─── BRANDBOOK ──────────────────────────────────────────────────────────── */

export function BrandbookEditor({ form, setForm, isCria, aoSincronizar, sincronizando }: {
  form: CrmClient;
  setForm: SetFicha;
  isCria: boolean;
  /** Só existe pra cliente que usa o Cria: puxa o brandbook da conta dele. */
  aoSincronizar?: () => void;
  sincronizando?: boolean;
}) {
  const update = useUpdateCrmClient();
  const uploadAsset = useUploadCrmAsset();
  const fontInputRef = useRef<HTMLInputElement>(null);

  const bc = form.brand_core ?? {};
  const setBc = (k: string, v: string) => setForm({ ...form, brand_core: { ...bc, [k]: v } });
  const personas = personasDaFicha(form);
  // O briefing usa a PRIMEIRA persona: é a principal, e aqui não existe o
  // seletor de personas (ele vive na seção de Persona, logo abaixo).
  const pe = personas[0] ?? {};
  const dg = form.diagnosis ?? {};
  const comps = form.competitors ?? [];

  /* TOM DE VOZ: os selecionados moram no MESMO campo de texto (toneOfVoice),
     separados por vírgula. Assim nada muda pra quem já preencheu na mão, e toda
     a IA que já lê esse campo continua lendo uma frase. */
  const tonsMarcados = (bc.toneOfVoice ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const tomAtivo = (t: string) => tonsMarcados.some((x) => x.toLowerCase() === t.toLowerCase());
  const alternarTom = (t: string) => {
    const novos = tomAtivo(t)
      ? tonsMarcados.filter((x) => x.toLowerCase() !== t.toLowerCase())
      : [...tonsMarcados, t];
    setBc("toneOfVoice", novos.join(", "));
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

  /* O DOCUMENTO DO BRIEFING mora no cliente. Antes ele ficava no Drive ou no
     WhatsApp de alguém, e quem pegava o cliente depois não sabia que existia. */
  const anexarBriefing = async (file: File) => {
    try {
      const url = await uploadAsset.mutateAsync({ clientId: form.id, file, kind: "doc" });
      const nbc = { ...bc, briefingFileUrl: url, briefingFileName: file.name };
      setForm({ ...form, brand_core: nbc });
      await update.mutateAsync({ id: form.id, brand_core: nbc });
      toast.success("Briefing anexado!");
    } catch { /* o hook já avisa */ }
  };
  const removerBriefing = async () => {
    const nbc = { ...bc, briefingFileUrl: "", briefingFileName: "" };
    setForm({ ...form, brand_core: nbc });
    await update.mutateAsync({ id: form.id, brand_core: nbc });
  };

  const swatches = parseHex(bc.colorPalette);

  return (
    <div className="space-y-4">
      {isCria && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 flex-wrap">
          <Instagram className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[12px] font-body text-foreground/80 flex-1 min-w-0">Este cliente usa o Cria, o Brandbook e o nome são sincronizados do que ele preenche na conta dele.</p>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => aoSincronizar?.()} disabled={sincronizando}>
            {sincronizando ? <Save className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            Sincronizar do Cria
          </Button>
        </div>
      )}
      {/* ── SUBIR O BRANDBOOK EM PDF ─────────────────────────────────────
          Esta aba é um formulário de vinte campos. Ninguém preenche
          formulário de vinte campos e por isso o brandbook do cliente
          vive vazio, e TODA a IA que depende dele (ideias, legenda, prompt
          de arte, briefing) sai genérica.

          Só que o dado já existe: a social mídia tem o moodboard do cliente
          em PDF. Então a gente para de pedir pra digitar e passa a pedir o
          arquivo. "Digite vinte campos" vira "confere o que eu entendi". */}
      {/* Relatório MESTRE / briefing completo: preenche AS QUATRO ABAS de uma
          vez (Brandbook, Persona, Diagnóstico, Concorrência). O import COMPLETA
          a ficha, nunca apaga o que já foi escrito à mão. */}
      <RelatorioImport
        onSalvar={async (r) => {
          const nbc = { ...bc };
          for (const [k, v] of Object.entries(r.brand)) if (v.trim()) nbc[k] = v.trim();
          // Personas: mantém as preenchidas à mão e completa as vagas (até 3).
          const atuais = personas.filter((p) => Object.values(p).some((v) => (v ?? "").trim()));
          const novasPersonas = [...atuais];
          for (const p of r.personas) { if (novasPersonas.length >= 3) break; novasPersonas.push(p); }
          const ndg = { ...dg };
          for (const [k, v] of Object.entries(r.diagnostico)) if (v.trim()) ndg[k] = v.trim();
          // Concorrentes: adiciona sem duplicar por nome.
          const nomes = new Set(comps.map((c) => (c.name ?? "").trim().toLowerCase()).filter(Boolean));
          const ncomps = [...comps];
          for (const c of r.concorrentes) {
            const key = c.name.trim().toLowerCase();
            if (!key || nomes.has(key)) continue;
            nomes.add(key);
            ncomps.push(c as (typeof comps)[number]);
          }
          setForm({
            ...form, brand_core: nbc, diagnosis: ndg,
            persona: novasPersonas as unknown as CrmClient["persona"],
            competitors: ncomps as CrmClient["competitors"],
          });
          await update.mutateAsync({
            id: form.id, brand_core: nbc, diagnosis: ndg,
            persona: novasPersonas, competitors: ncomps,
          } as never);
          toast.success("Ficha preenchida com o relatório. Confere as abas Persona, Diagnóstico e Concorrência também.");
        }}
      />

      {!isCria && (
        <BrandbookImport
          alvo="cliente"
          compacto
          atual={bc as Record<string, string | undefined>}
          titulo="Só o brandbook em PDF (cores, fontes, tom de voz)"
          descricao="A gente lê e preenche esta aba. Você só confere antes de salvar."
          onSalvar={async (valores) => {
            const nbc = { ...bc, ...valores };
            setForm({ ...form, brand_core: nbc });
            await update.mutateAsync({ id: form.id, brand_core: nbc });
            toast.success("Brandbook do cliente atualizado.");
          }}
        />
      )}

      <BriefingCliente
        cliente={form.name ?? "este cliente"}
        bc={bc as Record<string, string>}
        pe={pe as Record<string, string>}
        arquivoUrl={bc.briefingFileUrl || null}
        arquivoNome={bc.briefingFileName || null}
        onAnexar={anexarBriefing}
        onRemoverAnexo={() => void removerBriefing()}
        anexando={uploadAsset.isPending}
      />

      {/* História & essência: as perguntas do briefing inicial (Relatório MESTRE)
          que dão contexto REAL pra IA e pra qualquer pessoa do time que pegar
          o cliente: por que a marca existe, no que acredita e aonde quer chegar. */}
      <Card icon={<Building2 />} title="História & essência (briefing)">
        <F label="Como e por que a empresa nasceu"><MicTextarea value={bc.history ?? ""} onChange={(v) => setBc("history", v)} placeholder="A origem da marca: quem fundou, por quê, o que motivou..." /></F>
        <F label="Valores da marca" className="mt-3"><MicTextarea value={bc.brandValues ?? ""} onChange={(v) => setBc("brandValues", v)} placeholder="No que a empresa acredita e não abre mão." /></F>
        <F label="Impacto / transformação que quer gerar" className="mt-3"><MicTextarea value={bc.impact ?? ""} onChange={(v) => setBc("impact", v)} placeholder="O que muda no mercado e na vida do cliente por causa da marca." /></F>
        <F label="Onde a marca quer chegar (visão)" className="mt-3"><MicTextarea value={bc.vision ?? ""} onChange={(v) => setBc("vision", v)} placeholder="A visão de longo prazo: onde quer estar nos próximos anos." /></F>
        <F label="Marcas que admira (referências)" className="mt-3"><MicTextarea value={bc.admiredBrands ?? ""} onChange={(v) => setBc("admiredBrands", v)} placeholder="Uma por linha: @marca e por que é referência." /></F>
      </Card>

      {/* A ESTRATÉGIA vem antes da mensagem: é ela que diz pra que o conteúdo
          existe. Sem meta, todo post é bonito e nenhum serve pra nada. */}
      <Card icon={<Target />} title="Estratégia do conteúdo">
        <p className="text-[11px] font-body text-muted-foreground mb-3 -mt-1">As três respostas que fazem o resto do brandbook virar plano.</p>
        <F label="Meta principal" ajuda="A principal meta desta estratégia de conteúdo, em uma frase."><MicTextarea value={bc.mainGoal ?? ""} onChange={(v) => setBc("mainGoal", v)} placeholder="Ex.: encher a agenda de avaliação; virar referência em X na cidade..." /></F>
        <F label="A Big Idea" ajuda="A ideia master que norteia toda a produção. Precisa ser original, intrigante e contraintuitiva." className="mt-3"><MicTextarea value={bc.bigIdea ?? ""} onChange={(v) => setBc("bigIdea", v)} placeholder="A tese da marca. Ex.: 'estética não é vaidade, é manutenção'." /></F>
        <F label="Promessa" ajuda="A transformação que o cliente vive com o produto ou serviço." className="mt-3"><MicTextarea value={bc.promise ?? ""} onChange={(v) => setBc("promise", v)} placeholder="O que a pessoa sente ou consegue depois de comprar." /></F>
        <F label="Como a marca quer ser percebida em 6 a 12 meses" className="mt-3"><MicTextarea value={bc.perception6m ?? ""} onChange={(v) => setBc("perception6m", v)} placeholder="O lugar que ela quer ocupar na cabeça do público." /></F>
        <F label="Como o cliente vai saber que o conteúdo funcionou" ajuda="O critério dele, não o seu: é por isso que a renovação é decidida." className="mt-3"><MicTextarea value={bc.successMetric ?? ""} onChange={(v) => setBc("successMetric", v)} placeholder="Ex.: mais vendas, marca mais forte, virar referência." /></F>
      </Card>

      {/* Mensagem & estratégia, é isso que alimenta as ideias de post da IA */}
      <Card icon={<Brain />} title="Mensagem & estratégia (alimenta as ideias de post)">
        <p className="text-[11px] font-body text-muted-foreground mb-3 -mt-1">Quanto mais completo, melhores as ideias que a IA gera pra este cliente. Use o botão do microfone pra ditar por voz.</p>
        <F label="O que a marca vende (produto/serviço)"><MicTextarea value={bc.offer ?? ""} onChange={(v) => setBc("offer", v)} placeholder="Ex.: consultoria financeira pra casais; app de organização..." /></F>
        <F label="Proposta de valor / diferencial" className="mt-3"><MicTextarea value={bc.valueProp ?? ""} onChange={(v) => setBc("valueProp", v)} placeholder="Por que escolher essa marca e não outra?" /></F>
        <F label="Público-alvo" className="mt-3"><MicTextarea value={bc.audience ?? ""} onChange={(v) => setBc("audience", v)} placeholder="Pra quem é? Dores, desejos, momento de vida..." /></F>
        <F label="Temas / pilares de conteúdo" className="mt-3"><MicTextarea value={bc.contentThemes ?? ""} onChange={(v) => setBc("contentThemes", v)} placeholder="Sobre o que a marca posta? Ex.: educação financeira, bastidores, dicas..." /></F>
        <F label="O que evitar" className="mt-3"><MicTextarea value={bc.avoid ?? ""} onChange={(v) => setBc("avoid", v)} placeholder="Assuntos, palavras ou tom que a marca não usa." /></F>
        <F label="Principais produtos / serviços (categorias)" className="mt-3"><MicTextarea value={bc.products ?? ""} onChange={(v) => setBc("products", v)} placeholder="As categorias e o que cada uma entrega." /></F>
        <F label="Especialidade / domínio técnico" className="mt-3"><MicTextarea value={bc.specialty ?? ""} onChange={(v) => setBc("specialty", v)} placeholder="No que a empresa é realmente forte tecnicamente." /></F>
        <F label="Mensagem central do conteúdo" className="mt-3"><MicTextarea value={bc.coreMessage ?? ""} onChange={(v) => setBc("coreMessage", v)} placeholder="A ideia que TODO conteúdo deve transmitir + a transformação que o público deve sentir." /></F>
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
          {/* Campo em branco pedindo "tom de voz" trava qualquer briefing:
              ninguém sabe responder do zero. Escolher entre opostos é fácil,
              e o texto continua livre pra quem quiser detalhar. */}
          <F label="Tom de voz" className="mt-3">
            <div className="flex gap-1.5 flex-wrap mb-2">
              {TONS.map((t) => {
                const on = tomAtivo(t);
                return (
                  <button key={t} type="button" onClick={() => alternarTom(t)}
                    className={cn("text-[11.5px] font-body font-semibold px-2.5 py-1.5 rounded-lg border transition-colors",
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40")}>
                    {t}
                  </button>
                );
              })}
            </div>
            <Input value={bc.toneOfVoice ?? ""} onChange={(e) => setBc("toneOfVoice", e.target.value)}
              placeholder="Ex.: informal e otimista, sem gíria" className="rounded-xl" />
          </F>
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
    </div>
  );
}

/* ─── PERSONA ────────────────────────────────────────────────────────────── */

export function PersonaEditor({ form, setForm, isCria }: { form: CrmClient; setForm: SetFicha; isCria: boolean }) {
  // Qual persona está aberta é assunto interno daqui: ninguém de fora precisa saber.
  const [personaIdx, setPersonaIdx] = useState(0);

  const personas = personasDaFicha(form);
  const idx = Math.min(personaIdx, personas.length - 1);
  const pe = personas[idx] ?? {};

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

  return (
    <div className="space-y-4">
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
              {/* Alvo de toque real (40px): era um ícone de 14px colado na
                  borda, dentro de um card clicável, numa ação destrutiva. */}
              {personas.length > 1 && (
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); delPersona(i); }}
                  className="absolute top-0.5 right-0.5 grid h-10 w-10 place-items-center text-muted-foreground hover:text-destructive cursor-pointer"
                  aria-label="Excluir persona"><Trash2 className="h-4 w-4" /></span>
              )}
            </button>
          ))}
        </div>
      </div>
      <Card icon={<Target />} title={`Editando: ${pe.name || `Persona ${idx + 1}`}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Nome / apelido da persona"><Input value={pe.name ?? ""} onChange={(e) => setPe("name", e.target.value)} placeholder="Ex.: Ana, a empreendedora ocupada" className="rounded-xl" /></F>
          <F label="Faixa etária"><Input value={pe.ageRange ?? ""} onChange={(e) => setPe("ageRange", e.target.value)} placeholder="Ex.: 28-40" className="rounded-xl" /></F>
          <F label="Gênero predominante"><Input value={pe.gender ?? ""} onChange={(e) => setPe("gender", e.target.value)} placeholder="Se fizer sentido pro negócio" className="rounded-xl" /></F>
          <F label="Cidade / região"><Input value={pe.region ?? ""} onChange={(e) => setPe("region", e.target.value)} placeholder="Onde esse público está" className="rounded-xl" /></F>
          <F label="Faixa de gasto médio"><Input value={pe.spend ?? ""} onChange={(e) => setPe("spend", e.target.value)} placeholder="Quanto costuma investir no segmento" className="rounded-xl" /></F>
        </div>
      </Card>
      {/* Comportamento: as perguntas de persona do briefing (Relatório MESTRE). */}
      <Card icon={<Activity />} title="Comportamento & rotina">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Quem é essa pessoa (estilo de vida)"><MicTextarea value={pe.lifestyle ?? ""} onChange={(v) => setPe("lifestyle", v)} placeholder="Rotina, comportamentos, características..." /></F>
          <F label="O que ela valoriza"><MicTextarea value={pe.valuesWhat ?? ""} onChange={(v) => setPe("valuesWhat", v)} placeholder="O que pesa na decisão de compra." /></F>
          <F label="Interesses e hábitos"><MicTextarea value={pe.habits ?? ""} onChange={(v) => setPe("habits", v)} placeholder="Atividades, conteúdos que consome, hobbies..." /></F>
          <F label="Como costuma comprar"><MicTextarea value={pe.buying ?? ""} onChange={(v) => setPe("buying", v)} placeholder="Online, presencial, por indicação, pesquisa antes..." /></F>
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
        <Card icon={<HeartCrack />} title="Dores"><MicTextarea rows={4} value={pe.pains ?? ""} onChange={(v) => setPe("pains", v)} placeholder="Uma dor por linha (dá pra ditar por voz)..." /></Card>
        <Card icon={<Heart />} title="Desejos"><MicTextarea rows={4} value={pe.desires ?? ""} onChange={(v) => setPe("desires", v)} placeholder="Um desejo por linha (dá pra ditar por voz)..." /></Card>
        {/* Dúvida é o que ela PERGUNTA antes de comprar: cada uma vira pauta.
            Objeção é o que a IMPEDE de comprar: cada uma vira argumento.
            Sem esses dois, o conteúdo fala da dor e nunca destrava a venda. */}
        <Card icon={<HelpCircle />} title="Dúvidas"><MicTextarea rows={4} value={pe.doubts ?? ""} onChange={(v) => setPe("doubts", v)} placeholder="Uma dúvida por linha: o que sempre chegam perguntando." /></Card>
        <Card icon={<ShieldAlert />} title="Objeções"><MicTextarea rows={4} value={pe.objections ?? ""} onChange={(v) => setPe("objections", v)} placeholder="Uma objeção por linha: 'é caro', 'não tenho tempo', 'será que funciona pra mim?'" /></Card>
      </div>
      {/* Relação com a marca: fecha o ciclo dor -> desejo -> por que a NOSSA marca. */}
      <Card icon={<Heart />} title="Relação com a marca">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="O que busca ao escolher uma empresa assim"><MicTextarea value={pe.seeks ?? ""} onChange={(v) => setPe("seeks", v)} placeholder="Necessidades e problemas que espera resolver." /></F>
          <F label="O que faria virar cliente fiel"><MicTextarea value={pe.loyalty ?? ""} onChange={(v) => setPe("loyalty", v)} placeholder="Atendimento, qualidade, experiência, confiança..." /></F>
          <F label="Como a empresa atende essa persona"><MicTextarea value={pe.howWeServe ?? ""} onChange={(v) => setPe("howWeServe", v)} placeholder="Como produto, atendimento e experiência resolvem as dores dela." /></F>
        </div>
      </Card>
      <Card icon={<Lightbulb />} title="Estratégia">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Objetivos"><MicTextarea value={pe.objectives ?? ""} onChange={(v) => setPe("objectives", v)} /></F>
          <F label="Promessas"><MicTextarea value={pe.promises ?? ""} onChange={(v) => setPe("promises", v)} /></F>
          <F label="Gatilhos"><MicTextarea value={pe.triggers ?? ""} onChange={(v) => setPe("triggers", v)} /></F>
          <F label="Estratégia de conteúdo"><MicTextarea value={pe.contentStrategy ?? ""} onChange={(v) => setPe("contentStrategy", v)} /></F>
        </div>
      </Card>
    </div>
  );
}
