import { useState } from "react";
import { Mic, StickyNote, ImageIcon, Type, TrendingUp, Loader2, X, Circle, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CrIA } from "@/components/brand/CrIA";
import { TrendPickerDialog, Chip } from "@/components/tendencias/TrendPickerDialog";
import { tendenciasParaIA, registrarUsoTendencias, type Tendencia } from "@/hooks/useTendencias";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  ROTULOS_STORY, lerRoteiro, montarRoteiro, tipoDoFormato, formatoDoTipo, storyDaIA, type TipoStory, type StoryIA,
} from "@/lib/storyRoteiro";
import type { StorySlot } from "@/hooks/useStoryPlan";

/* ═══════════════════════════════════════════════════════════════════════════
   NOVO STORY (28/10/2026, mockup aprovado, aba 1)

   O tipo decide o caminho: falado vai pro Prompter, figurinha sai pelo celular
   com lembrete, foto/vídeo pronto abre a mídia do post, texto na tela vira
   arte. Roteiro em 3 partes com rótulo por tipo (src/lib/storyRoteiro.ts).
   "Escrever com a CrIA" preenche pela marca; "Usar uma tendência" escolhe até
   3 tendências como base.
   ═══════════════════════════════════════════════════════════════════════════ */

export type NovoStoryEstado =
  | { mode: "closed" }
  | { mode: "edit"; slot: StorySlot }
  | { mode: "create"; date: string; tipo?: TipoStory };

export type StorySalvo = {
  slot_date: string;
  title: string;
  script: string | null;
  format: string;
  slot_time: string | null;
  notify_title: string | null;
  notify_body: string | null;
  weekdays?: number[];
  weeks?: number;
};

const TIPOS: Array<{ t: TipoStory; nome: string; desc: string; Icone: typeof Mic }> = [
  { t: "falado", nome: "Falado", desc: "Você na câmera: bastidor, dica, opinião", Icone: Mic },
  { t: "figurinha", nome: "Com figurinha", desc: "Enquete, caixinha, quiz, contagem", Icone: StickyNote },
  { t: "midia", nome: "Foto ou vídeo pronto", desc: "Algo que você já tem no rolo", Icone: ImageIcon },
  { t: "texto", nome: "Texto na tela", desc: "Frase, aviso, lista curta", Icone: Type },
];

const GUIA: Record<TipoStory, { selo: string; seloCls: string; txt: string; ex: string; botao: string; nota: string }> = {
  falado: {
    selo: "Grava no Prompter", seloCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    txt: "Story falado funciona com até 15 segundos por tela. Abra com a frase que prende, mostre uma coisa só e feche pedindo uma ação.",
    ex: "Três coisas que eu faço antes de gravar e ninguém vê.",
    botao: "Salvar e gravar agora", nota: "Vai pro Prompter em “Pra gravar”.",
  },
  figurinha: {
    selo: "Posta pelo celular", seloCls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    txt: "O Instagram não deixa publicar figurinha por sistema. O Cria guarda a mídia e o texto e te avisa na hora de postar pelo app.",
    ex: "Enquete: você grava tudo num dia ou um pouco por dia?",
    botao: "Salvar e criar a figurinha", nota: "Lembrete ligado: a figurinha sai pelo app do Instagram.",
  },
  midia: {
    selo: "Sobe a mídia", seloCls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    txt: "Use o que já está no rolo. Uma frase curta por cima ajuda quem assiste sem som.",
    ex: "Foto do set montado com a legenda: dia de gravação.",
    botao: "Salvar e subir mídia", nota: "Pode sair agendado pelo Cria quando a mídia estiver no post.",
  },
  texto: {
    selo: "Sai pelo Cria", seloCls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    txt: "Uma ideia por tela, com letra grande. Se passar de três linhas, divida em dois stories.",
    ex: "Lembrete: o roteiro de amanhã já está no Cria.",
    botao: "Salvar e montar a arte", nota: "Pode sair agendado pelo Cria.",
  },
};

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dataLonga(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Props = {
  state: NovoStoryEstado;
  onClose: () => void;
  /** acao "principal" = o botão do tipo (gravar, subir mídia...); "salvar" = só guarda no plano. */
  onSalvar: (dados: StorySalvo, acao: "salvar" | "principal", tipo: TipoStory, slotId?: string) => Promise<void> | void;
  ocupado?: boolean;
  /** Só na edição. Pede confirmação no próprio botão (o post do story vai junto). */
  onExcluir?: () => void;
};

export function NovoStoryDialog({ state, onClose, onSalvar, ocupado, onExcluir }: Props) {
  const { profile } = useActiveProfile();
  const open = state.mode !== "closed";
  const editando = state.mode === "edit" ? state.slot : null;

  const [tipo, setTipo] = useState<TipoStory>("falado");
  const [titulo, setTitulo] = useState("");
  const [b1, setB1] = useState(""); const [b2, setB2] = useState(""); const [b3, setB3] = useState("");
  const [mostrar, setMostrar] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [repetir, setRepetir] = useState(false);
  const [dias, setDias] = useState<number[]>([]);
  const [semanas, setSemanas] = useState(4);
  const [tendencias, setTendencias] = useState<Tendencia[]>([]);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [chave, setChave] = useState("");
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);

  const k = state.mode === "edit" ? `e:${state.slot.id}` : state.mode === "create" ? `c:${state.date}:${state.tipo ?? ""}` : "";
  if (open && k !== chave) {
    setChave(k);
    const s = editando;
    const t = s ? tipoDoFormato(s.format) : (state.mode === "create" && state.tipo) || "falado";
    const p = lerRoteiro(s?.script);
    setTipo(t); setTitulo(s?.title ?? "");
    setB1(p.b1); setB2(p.b2); setB3(p.b3); setMostrar(p.mostrar);
    setData(s?.slot_date ?? (state.mode === "create" ? state.date : ""));
    setHora(s?.slot_time ? s.slot_time.slice(0, 5) : "");
    setLembrar(s ? !!s.notify_title : true);
    setRepetir(false); setDias([]); setSemanas(4); setTendencias([]); setConfirmaExcluir(false);
  }
  if (!open && chave) setChave("");

  const g = GUIA[tipo];
  const [l1, l2, l3] = ROTULOS_STORY[tipo];
  const lembreteFixo = tipo === "figurinha";
  const lembreteOn = lembreteFixo || lembrar;

  const escreverComCria = async (base: Tendencia[] = tendencias) => {
    if (escrevendo) return;
    setEscrevendo(true);
    try {
      const ideia = [titulo, montarRoteiro(tipo, { b1, b2, b3, mostrar })].filter((x) => x.trim()).join("\n");
      const res = (await callAIContextBuilder({
        operation: "story-escrever",
        data: { tipo, ideia: ideia || undefined, escolhidas: base.length ? tendenciasParaIA(base) : undefined, nicho: profile?.niche ?? undefined },
      })) as StoryIA;
      const st = storyDaIA({ ...res, tipo });
      const p = lerRoteiro(st.script);
      if (!titulo.trim() || !ideia) setTitulo(st.title);
      setB1(p.b1); setB2(p.b2); setB3(p.b3); setMostrar(p.mostrar);
      if (base.length) registrarUsoTendencias(base, "novo-story");
      toast.success("A Cria IA escreveu. Ajuste o que quiser.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/upgrade/i.test(m) ? "Escrever com a Cria IA é do plano Studio." : "Não consegui escrever agora. Tente de novo.");
    } finally {
      setEscrevendo(false);
    }
  };

  const montar = (): StorySalvo | null => {
    if (!titulo.trim()) { toast.error("Dê um título pro story."); return null; }
    const slot_time = /^\d{1,2}:\d{2}$/.test(hora) ? hora : null;
    return {
      slot_date: data,
      title: titulo.trim(),
      script: montarRoteiro(tipo, { b1, b2, b3, mostrar: tipo === "falado" ? mostrar : "" }) || null,
      format: formatoDoTipo(tipo, editando?.format),
      slot_time,
      notify_title: lembreteOn ? titulo.trim().slice(0, 160) : null,
      notify_body: lembreteOn
        ? (tipo === "figurinha" ? "Este story tem figurinha: poste pelo app do Instagram. A mídia e o texto estão no Cria Stories." : editando?.notify_body ?? null)
        : null,
      weekdays: repetir && dias.length ? dias : undefined,
      weeks: repetir ? semanas : undefined,
    };
  };

  const salvar = async (acao: "salvar" | "principal") => {
    const d = montar();
    if (!d) return;
    if (lembreteOn && !d.slot_time) toast.message("Sem horário, o lembrete não toca. Dá pra pôr depois.");
    await onSalvar(d, acao, tipo, editando?.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[660px] rounded-[28px] gap-[18px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editando ? "Editar story" : "Novo story"}</DialogTitle>
          {data && <p className="text-[13px] font-body text-muted-foreground">{dataLonga(data)} · entra no plano da semana</p>}
        </DialogHeader>

        <section>
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">1. Que story é esse?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Tipo de story">
            {TIPOS.map(({ t, nome, desc, Icone }) => (
              <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
                className={cn("rounded-2xl border-[1.5px] p-3 text-left flex flex-col gap-1.5 transition-colors",
                  tipo === t ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40")}>
                <span className="h-[30px] w-[30px] rounded-[10px] grid place-items-center bg-muted"><Icone className="h-4 w-4" /></span>
                <b className="font-display font-semibold text-[13.5px] text-foreground">{nome}</b>
                <span className="text-[11.5px] font-body text-muted-foreground leading-tight">{desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-muted/60 px-4 py-3.5 flex flex-col gap-2.5">
          <span className={cn("self-start text-[11px] font-body font-bold rounded-full px-2.5 py-0.5", g.seloCls)}>{g.selo}</span>
          <p className="text-[13px] font-body text-foreground">{g.txt}</p>
          <p className="text-[12.5px] font-body text-muted-foreground">Exemplo de abertura: <q className="italic text-foreground">{g.ex}</q></p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => escreverComCria()} disabled={escrevendo}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3.5 h-8 text-[12.5px] font-body font-bold disabled:opacity-60">
              {escrevendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span aria-hidden>✦</span>}
              {escrevendo ? "Escrevendo…" : <>Escrever com a <CrIA /></>}{!escrevendo && tendencias.length > 0 && ` usando ${tendencias.length} tendência${tendencias.length > 1 ? "s" : ""}`}
            </button>
            <button type="button" onClick={() => setPickerAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-3.5 h-8 text-[12.5px] font-body font-bold">
              <TrendingUp className="h-3.5 w-3.5" /> Usar uma tendência
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-body text-muted-foreground">
            A Cria IA usa:
            <span className="rounded-full bg-card px-2 py-0.5 text-foreground">sua marca</span>
            {profile?.niche && <span className="rounded-full bg-card px-2 py-0.5 text-foreground">{profile.niche}</span>}
            {tendencias.map((t) => (
              <span key={t.chave} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 inline-flex items-center gap-1">
                {t.titulo}
                <button type="button" aria-label={`Tirar ${t.titulo}`} onClick={() => setTendencias((l) => l.filter((x) => x.chave !== t.chave))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </section>

        <div>
          <label htmlFor="ns-titulo" className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
            2. Título <em className="normal-case tracking-normal font-normal">(só pra você achar no plano)</em>
          </label>
          <Input id="ns-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1.5 rounded-2xl h-11" placeholder="Ex.: Bastidor: como eu preparo a gravação" />
        </div>

        <section>
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">3. Roteiro</p>
          <div className="flex flex-col gap-2.5">
            <Bloco n={1} id="ns-b1" rotulo={l1}><Textarea id="ns-b1" value={b1} onChange={(e) => setB1(e.target.value)} rows={3} className="rounded-2xl" /></Bloco>
            <Bloco n={2} id="ns-b2" rotulo={l2}><Input id="ns-b2" value={b2} onChange={(e) => setB2(e.target.value)} className="rounded-2xl h-11" /></Bloco>
            <Bloco n={3} id="ns-b3" rotulo={l3}><Input id="ns-b3" value={b3} onChange={(e) => setB3(e.target.value)} className="rounded-2xl h-11" /></Bloco>
            {tipo === "falado" && (
              <div className="pl-[38px]">
                <label htmlFor="ns-mostrar" className="text-[12px] font-body text-muted-foreground">O que mostrar no vídeo <em>(opcional, aparece como etiqueta no Prompter)</em></label>
                <Input id="ns-mostrar" value={mostrar} onChange={(e) => setMostrar(e.target.value)} className="mt-1 rounded-2xl h-10" placeholder="Ex.: o set montado enquanto fala" />
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-border pt-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ns-data" className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Quando</label>
            <Input id="ns-data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-[150px] h-10 rounded-xl" />
            <Input aria-label="Horário" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-[110px] h-10 rounded-xl" />
            <Chip on={lembreteOn} onClick={() => { if (!lembreteFixo) setLembrar((v) => !v); }} className={lembreteFixo ? "cursor-not-allowed" : ""}>
              Me lembrar na hora
            </Chip>
            <Chip on={repetir} onClick={() => setRepetir((v) => !v)}><Repeat className="h-3.5 w-3.5 inline mr-1" />{editando ? "Repetir em mais dias" : "Repetir toda semana"}</Chip>
          </div>
          {lembreteFixo && <p className="text-[11.5px] font-body text-muted-foreground">Com figurinha, o lembrete fica ligado: é ele que te chama pra postar pelo app.</p>}
          {repetir && (
            <div className="flex flex-wrap items-center gap-1.5">
              {WD.map((d, i) => (
                <Chip key={d} on={dias.includes(i)} onClick={() => setDias((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]))}>{d}</Chip>
              ))}
              <span className="text-[12px] font-body text-muted-foreground ml-1">por</span>
              <Input type="number" inputMode="numeric" min={1} max={12} value={semanas} aria-label="Semanas"
                onChange={(e) => setSemanas(Math.max(1, Math.min(12, Number(e.target.value) || 4)))} className="h-9 w-16 rounded-xl" />
              <span className="text-[12px] font-body text-muted-foreground">semanas</span>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onExcluir && (
            <button type="button" onClick={() => (confirmaExcluir ? onExcluir() : setConfirmaExcluir(true))}
              className={cn("text-[12px] font-body font-semibold rounded-full px-3 h-9", confirmaExcluir ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-destructive")}>
              {confirmaExcluir ? "Confirmar: excluir story e post" : "Excluir"}
            </button>
          )}
          <span className="flex-1 min-w-[160px] text-[12px] font-body text-muted-foreground">{g.nota}</span>
          <Button variant="outline" className="rounded-full" disabled={ocupado} onClick={() => salvar("salvar")}>Salvar no plano</Button>
          <Button className="rounded-full gap-1.5" disabled={ocupado} onClick={() => salvar("principal")}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : tipo === "falado" ? <Circle className="h-4 w-4 fill-current" /> : null}
            {g.botao}
          </Button>
        </div>

        <TrendPickerDialog open={pickerAberto} onOpenChange={setPickerAberto} titulo="Tendências pra stories"
          subtitulo="Marque até 3. A Cria IA escreve o story usando elas como base." botao="Escrever com essas"
          iniciais={tendencias.map((t) => t.chave)} preferir="story"
          onConfirmar={(l) => { setTendencias(l); void escreverComCria(l); }} />
      </DialogContent>
    </Dialog>
  );
}

function Bloco({ n, id, rotulo, children }: { n: number; id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5">
      <span className="h-7 w-7 rounded-[9px] bg-primary/10 text-primary font-display font-extrabold text-xs grid place-items-center mt-6">{n}</span>
      <div>
        <label htmlFor={id} className="text-[12.5px] font-body font-semibold text-foreground">{rotulo}</label>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
