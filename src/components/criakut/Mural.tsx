import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Pin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useBaseCriakut, useCancelarPedido, useDestaquesIds, useMeuPerfilCriakut, useMural, usePropor, usePublicarPedido,
} from "@/hooks/useCriakut";
import { SeloDestaque } from "./Pecas";
import {
  ESTILOS, FUNCOES, NICHOS, UNIDADES, faixaTexto, iniciais, nomeFuncao, reaisParaCentavos,
  type FuncaoCriakut, type PedidoMural, type Unidade,
} from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* MURAL DE TRABALHOS. Quem precisa de alguém pendura o trabalho; quem faz
   manda proposta. Cada proposta vira uma conversa (aba Propostas). O mural
   mostra quem pendurou pelo nome da página, nunca o nome do cliente final. */

const FUNCOES_MURAL = FUNCOES.filter((f) => f.valor !== "criadora");
const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold",
  on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground");

function quando(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "hoje";
  if (d < 2) return "ontem";
  return `há ${Math.floor(d)} dias`;
}

export function Mural() {
  const [funcao, setFuncao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => { const t = setTimeout(() => setBusca(texto), 350); return () => clearTimeout(t); }, [texto]);
  const q = useMural({ funcao, tipo, texto: busca });
  const [pendurar, setPendurar] = useState(false);
  const [propondo, setPropondo] = useState<PedidoMural | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05]">Mural de <span className="text-primary">trabalhos</span>.</h1>
        <Button className="rounded-xl" onClick={() => setPendurar(true)}><Pin className="mr-1.5 h-4 w-4" /> Pendurar um trabalho</Button>
      </div>
      <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">Precisa de designer, editor, filmmaker, copy ou social mídia? Pendure aqui. Faz isso? Mande proposta. Tudo fica registrado na conversa.</p>

      <div className="mt-4 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" placeholder="Palavra (ex.: reels, clínica)" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FUNCOES_MURAL.map((f) => <button key={f.valor} type="button" className={chip(funcao === f.valor)} onClick={() => setFuncao(funcao === f.valor ? null : f.valor)}>{f.nome}</button>)}
        <span className="mx-1 w-px bg-border" />
        <button type="button" className={chip(tipo === "recorrente")} onClick={() => setTipo(tipo === "recorrente" ? null : "recorrente")}>Todo mês</button>
        <button type="button" className={chip(tipo === "avulso")} onClick={() => setTipo(tipo === "avulso" ? null : "avulso")}>Avulso</button>
      </div>

      {q.isLoading ? <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        : q.isError ? <p className="py-14 text-center text-[14px] text-muted-foreground">Não consegui abrir o mural. Recarregue.</p>
        : (q.data ?? []).length === 0
          ? <p className="py-14 text-center text-[14px] text-muted-foreground">Nenhum trabalho pendurado com esse filtro. Que tal pendurar o primeiro?</p>
          : <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(q.data ?? []).map((p) => <CartaoPedido key={p.id} p={p} onPropor={() => setPropondo(p)} />)}
            </div>}

      <PendurarTrabalho open={pendurar} onOpenChange={setPendurar} />
      <MandarProposta pedido={propondo} onClose={() => setPropondo(null)} />
    </div>
  );
}

function CartaoPedido({ p, onPropor }: { p: PedidoMural; onPropor: () => void }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const cancelar = useCancelarPedido();
  /* No mural o Destaque só põe o selo: não fura fila (mockup Fase 3). */
  const idsDestaque = useDestaquesIds();
  return (
    <div className={cn("relative rounded-[20px] border bg-card p-4", p.eh_meu ? "border-primary/40" : "border-border", p.status !== "aberto" && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">Procura {nomeFuncao(p.funcao).toLowerCase()}</span>
        <span className="rounded-md bg-muted px-2 py-0.5">{p.tipo === "recorrente" ? "Todo mês" : "Avulso"}</span>
        {p.eh_meu && <span className="rounded-md bg-foreground px-2 py-0.5 text-background">{p.status === "aberto" ? "Seu trabalho" : "Fechado"}</span>}
        <span className="ml-auto font-medium text-muted-foreground">{quando(p.criado_em)}</span>
      </div>
      <h3 className="mt-2 font-display text-[18px] font-bold leading-snug">{p.titulo}</h3>
      {p.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-foreground/80">{p.descricao}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {[p.nicho, ...p.estilos].filter(Boolean).slice(0, 5).map((t) => <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}
        {p.presencial && <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"><MapPin className="h-3 w-3" />{p.cidade || "presencial"}</span>}
        {p.prazo_texto && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px]">prazo: {p.prazo_texto}</span>}
      </div>
      <div className="mt-3 flex items-center gap-2.5 border-t border-dashed border-border pt-3">
        <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => navigate(`${base}/${p.autor_slug}`)}>
          {p.autor_foto ? <img src={p.autor_foto} alt="" className="h-8 w-8 rounded-full object-cover" />
            : <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground">{iniciais(p.autor_nome)}</span>}
          <span className="min-w-0 text-[12px] leading-tight"><b className="block truncate">{p.autor_nome}{idsDestaque.has(p.autor_id) && <SeloDestaque curto className="ml-1" />}</b><span className="text-muted-foreground">{nomeFuncao(p.autor_funcao)}</span></span>
        </button>
        <span className="ml-auto text-right">
          <b className="block font-display text-[15px] font-extrabold">{faixaTexto(p.valor_min_centavos, p.valor_max_centavos, p.unidade)}</b>
          <span className="text-[11px] text-muted-foreground">{p.propostas} {p.propostas === 1 ? "proposta" : "propostas"}</span>
        </span>
      </div>
      <div className="mt-3">
        {p.eh_meu ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => navigate(`${base}?aba=propostas`)}>Ver propostas</Button>
            {p.status === "aberto" && (
              <Button variant="ghost" className="rounded-xl text-muted-foreground" disabled={cancelar.isPending}
                onClick={() => { if (window.confirm("Retirar esse trabalho do mural? As propostas abertas são avisadas.")) cancelar.mutate(p.id, { onSuccess: () => toast.success("Trabalho retirado.") }); }}>
                <X className="mr-1 h-4 w-4" /> Retirar
              </Button>
            )}
          </div>
        ) : p.ja_propus ? (
          <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate(`${base}?aba=propostas`)}>Você já mandou proposta · ver conversa</Button>
        ) : (
          <Button className="w-full rounded-xl" onClick={onPropor}>Mandar proposta</Button>
        )}
      </div>
    </div>
  );
}

const PEDIDO_VAZIO = { funcao: "designer" as FuncaoCriakut, titulo: "", descricao: "", nicho: "", estilos: [] as string[], min: "", max: "",
  unidade: "peca" as Unidade, prazo: "", tipo: "avulso" as "avulso" | "recorrente", presencial: false, cidade: "" };

function PendurarTrabalho({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const meu = useMeuPerfilCriakut();
  const publicar = usePublicarPedido();
  const [f, setF] = useState(PEDIDO_VAZIO);
  useEffect(() => { if (open) setF(PEDIDO_VAZIO); }, [open]);
  const set = <K extends keyof typeof PEDIDO_VAZIO>(k: K, v: (typeof PEDIDO_VAZIO)[K]) => setF((x) => ({ ...x, [k]: v }));

  const gravar = async () => {
    if (f.titulo.trim().length < 4) { toast.error("Dê um título com pelo menos 4 letras."); return; }
    const min = reaisParaCentavos(f.min); const max = reaisParaCentavos(f.max);
    if (min != null && max != null && max < min) { toast.error("O valor máximo está menor que o mínimo."); return; }
    if (f.presencial && f.cidade.trim().length < 2) { toast.error("Presencial: diga a cidade."); return; }
    await publicar.mutateAsync({ funcao: f.funcao, titulo: f.titulo.trim(), descricao: f.descricao.trim(), nicho: f.nicho || null, estilos: f.estilos,
      valor_min: min, valor_max: max, unidade: f.unidade, prazo_texto: f.prazo.trim(), tipo: f.tipo, presencial: f.presencial, cidade: f.cidade.trim() });
    toast.success("Trabalho pendurado no mural!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pendurar um trabalho</DialogTitle>
          <DialogDescription>Aparece pra quem está no Criakut. Não coloque o nome do seu cliente: descreva o nicho.</DialogDescription>
        </DialogHeader>
        {!meu.isLoading && !meu.data ? (
          <div className="rounded-xl bg-muted p-4 text-[13.5px]">
            Pra pendurar trabalho você precisa ter sua página no Criakut.
            <Button className="mt-3 w-full rounded-xl" onClick={() => { onOpenChange(false); navigate(base); }}>Criar minha página</Button>
          </div>
        ) : (
          <div className="grid gap-3.5">
            <div><Label>Procuro</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{FUNCOES_MURAL.map((x) => <button key={x.valor} type="button" className={chip(f.funcao === x.valor)} onClick={() => set("funcao", x.valor)}>{x.nome}</button>)}</div></div>
            <div className="grid gap-1.5"><Label>Título</Label>
              <Input value={f.titulo} maxLength={120} placeholder="Ex.: Editor pra 12 reels por mês, nicho saúde" onChange={(e) => set("titulo", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Descrição</Label>
              <Textarea rows={4} value={f.descricao} maxLength={1000} placeholder="O que precisa, volume, estilo, como é a rotina" onChange={(e) => set("descricao", e.target.value)} /></div>
            <div><Label>Nicho</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{NICHOS.map((n) => <button key={n} type="button" className={chip(f.nicho === n)} onClick={() => set("nicho", f.nicho === n ? "" : n)}>{n}</button>)}</div></div>
            <div><Label>Estilo</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{ESTILOS.map((e) => <button key={e} type="button" className={chip(f.estilos.includes(e))}
                onClick={() => set("estilos", f.estilos.includes(e) ? f.estilos.filter((x) => x !== e) : [...f.estilos, e].slice(0, 4))}>{e}</button>)}</div></div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <div className="grid gap-1.5"><Label>De (R$)</Label><Input inputMode="decimal" value={f.min} placeholder="opcional" onChange={(e) => set("min", e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Até (R$)</Label><Input inputMode="decimal" value={f.max} placeholder="opcional" onChange={(e) => set("max", e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Por</Label>
                <select className="h-10 rounded-md border border-input bg-background px-2 text-[13px]" value={f.unidade} onChange={(e) => set("unidade", e.target.value as Unidade)}>
                  {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.sufixo.replace("/", "").trim()}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5"><Label>Prazo</Label><Input value={f.prazo} maxLength={60} placeholder="Ex.: começar em novembro" onChange={(e) => set("prazo", e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Frequência</Label>
                <div className="flex gap-1.5">
                  <button type="button" className={chip(f.tipo === "avulso")} onClick={() => setF((x) => ({ ...x, tipo: "avulso", unidade: x.unidade === "mes" ? "peca" : x.unidade }))}>Avulso</button>
                  <button type="button" className={chip(f.tipo === "recorrente")} onClick={() => setF((x) => ({ ...x, tipo: "recorrente", unidade: "mes" }))}>Todo mês</button>
                </div></div>
            </div>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={f.presencial} onCheckedChange={(v) => set("presencial", v)} /> Precisa ser presencial</label>
            {f.presencial && <Input value={f.cidade} maxLength={80} placeholder="Cidade" onChange={(e) => set("cidade", e.target.value)} />}
            <Button className="h-11 rounded-xl" disabled={publicar.isPending} onClick={() => void gravar().catch(() => undefined)}>
              {publicar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Pendurar no mural
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MandarProposta({ pedido, onClose }: { pedido: PedidoMural | null; onClose: () => void }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const meu = useMeuPerfilCriakut();
  const propor = usePropor();
  const [escopo, setEscopo] = useState("");
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("peca");
  const [prazo, setPrazo] = useState("");
  useEffect(() => {
    if (pedido) { setEscopo(""); setValor(""); setUnidade(pedido.unidade); setPrazo(""); }
  }, [pedido]);
  const hoje = new Date().toISOString().slice(0, 10);
  const naoPublicada = !!meu.data && !meu.data.publicado;

  const mandar = async () => {
    if (!pedido) return;
    if (escopo.trim().length < 10) { toast.error("Conte em poucas linhas como você faria."); return; }
    if (prazo && prazo < hoje) { toast.error("O prazo já passou."); return; }
    const id = await propor.mutateAsync({ pedido: pedido.id, escopo: escopo.trim(), valor_centavos: reaisParaCentavos(valor), unidade, prazo: prazo || null });
    toast.success("Proposta enviada!");
    onClose();
    navigate(`${base}?aba=propostas&p=${id}`);
  };

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mandar proposta</DialogTitle>
          <DialogDescription>{pedido?.titulo}</DialogDescription>
        </DialogHeader>
        {!meu.isLoading && (!meu.data || naoPublicada) ? (
          <div className="rounded-xl bg-muted p-4 text-[13.5px]">
            {meu.data ? "Sua página está escondida. Quem pendurou o trabalho precisa conseguir ver seu portfólio: ligue \"Mostrar na busca\" em Editar minha página." : "Pra mandar proposta você precisa ter sua página no Criakut."}
            <Button className="mt-3 w-full rounded-xl" onClick={() => { onClose(); navigate(base); }}>Ir pra minha página</Button>
          </div>
        ) : (
          <div className="grid gap-3.5">
            <div className="grid gap-1.5"><Label>Como você faria</Label>
              <Textarea rows={5} value={escopo} maxLength={2000} placeholder="O que entra, quantas revisões, como você trabalha, links do portfólio..." onChange={(e) => setEscopo(e.target.value)} /></div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-1.5"><Label>Seu valor (R$)</Label>
                <Input inputMode="decimal" value={valor} placeholder={pedido ? `pedido: ${faixaTexto(pedido.valor_min_centavos, pedido.valor_max_centavos, pedido.unidade)}` : ""} onChange={(e) => setValor(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Por</Label>
                <select className="h-10 rounded-md border border-input bg-background px-2 text-[13px]" value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)}>
                  {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.sufixo.replace("/", "").trim()}</option>)}
                </select></div>
            </div>
            <div className="grid gap-1.5"><Label>Entrego até (opcional)</Label><Input type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
            <Button className="h-11 rounded-xl" disabled={propor.isPending} onClick={() => void mandar().catch(() => undefined)}>
              {propor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar proposta
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
