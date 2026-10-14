import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, FileDown, Handshake, Loader2, Paperclip, PackageCheck, Send, Star, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ACEITA_ANEXO, anexoPermitido, useAcaoProposta, useBaseCriakut, useConversa, useMandarMensagem, useMinhasPropostas,
} from "@/hooks/useCriakut";
import {
  PONTE_TEXTO, STATUS_PROPOSTA, UNIDADES, iniciais, nomeFuncao, precoTexto, reaisParaCentavos,
  type Conversa, type ResumoProposta, type Unidade,
} from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* PROPOSTAS. Lista de todas as negociações (as que eu pedi e as que me
   pediram) e a conversa de cada uma. O que cada um pode fazer depende do
   papel e do momento, e o banco confere tudo de novo:
     negociando → aceitar, contrapropor, recusar (ou retirar a minha);
     fechado    → quem foi contratado entrega com arquivo; quem contratou
                  conclui (só com entrega registrada) e marca "paguei";
     concluído  → os dois avaliam, às cegas.
   O pagamento é combinado entre os dois: o Cria só registra. */

const Avatar = ({ nome, foto, className }: { nome: string; foto: string | null; className?: string }) =>
  foto ? <img src={foto} alt="" className={cn("rounded-full object-cover", className)} />
    : <span className={cn("grid place-items-center rounded-full bg-primary font-extrabold text-primary-foreground", className)}>{iniciais(nome)}</span>;

const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dataBr = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null);

export function Propostas() {
  const [params, setParams] = useSearchParams();
  const aberta = params.get("p");
  const lista = useMinhasPropostas();
  const [filtro, setFiltro] = useState<"todas" | "vez" | "andamento" | "fim">("todas");
  const abrir = (id: string | null) => {
    const n = new URLSearchParams(params);
    if (id) n.set("p", id); else n.delete("p");
    setParams(n, { replace: !id });
  };
  const itens = (lista.data ?? []).filter((p) =>
    filtro === "todas" ? true
      : filtro === "vez" ? p.minha_vez || (p.status === "concluida" && !p.ja_avaliei)
      : filtro === "andamento" ? p.status === "aberta" || p.status === "fechada"
      : p.status === "concluida" || p.status === "recusada" || p.status === "cancelada");

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className={cn("min-w-0", aberta && "max-lg:hidden")}>
        <h1 className="font-display text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.05]">Propostas</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {([["todas", "Todas"], ["vez", "Sua vez"], ["andamento", "Em andamento"], ["fim", "Encerradas"]] as const).map(([k, n]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              className={cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", filtro === k ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground")}>{n}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          {lista.isLoading ? <Loader2 className="mx-auto my-10 h-5 w-5 animate-spin text-muted-foreground" />
            : itens.length === 0 ? <p className="py-10 text-center text-[13.5px] text-muted-foreground">Nada aqui. Peça orçamento numa página ou mande proposta no mural.</p>
            : itens.map((p) => <ItemLista key={p.id} p={p} ativo={p.id === aberta} onClick={() => abrir(p.id)} />)}
        </div>
      </div>
      <div className={cn("min-w-0", !aberta && "max-lg:hidden")}>
        {aberta ? <PainelConversa id={aberta} onVoltar={() => abrir(null)} />
          : <div className="grid h-full min-h-[320px] place-items-center rounded-[22px] border border-dashed border-border text-[13.5px] text-muted-foreground">Escolha uma proposta pra ver a conversa.</div>}
      </div>
    </div>
  );
}

function ItemLista({ p, ativo, onClick }: { p: ResumoProposta; ativo: boolean; onClick: () => void }) {
  const st = STATUS_PROPOSTA[p.status];
  const avaliar = p.status === "concluida" && !p.ja_avaliei;
  return (
    <button type="button" onClick={onClick}
      className={cn("grid grid-cols-[auto_1fr] gap-3 rounded-[18px] border bg-card p-3 text-left transition-colors", ativo ? "border-foreground" : "border-border hover:border-foreground/40")}>
      <Avatar nome={p.outro_nome} foto={p.outro_foto} className="h-11 w-11 text-[13px]" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <b className="truncate text-[14px]">{p.outro_nome}</b>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{p.papel === "contratante" ? "você contrata" : "você é contratada(o)"}</span>
        </span>
        <span className="block truncate text-[13px] font-semibold">{p.titulo}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{p.ultima_msg ?? ""}</span>
        <span className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] font-bold">
          <span className={cn("rounded-md px-1.5 py-0.5", st.cor)}>{st.nome}</span>
          {(p.minha_vez || avaliar) && <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">{avaliar ? "Avalie" : "Sua vez"}</span>}
          {p.parada && <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950/50 dark:text-red-300">15 dias sem entrega</span>}
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">{precoTexto(p.valor_centavos, p.unidade)}</span>
        </span>
      </span>
    </button>
  );
}

function PainelConversa({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const q = useConversa(id);
  const acao = useAcaoProposta();
  const msg = useMandarMensagem();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [contra, setContra] = useState(false);
  const [entregar, setEntregar] = useState(false);
  const [avaliar, setAvaliar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const n = q.data?.mensagens.length ?? 0;
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [n, id]);
  useEffect(() => { setTexto(""); setArquivo(null); }, [id]);

  if (q.isLoading) return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const c = q.data;
  if (!c) return <div className="rounded-[22px] border border-border p-8 text-center text-[13.5px] text-muted-foreground">Essa conversa não existe ou não é sua.</div>;

  const p = c.proposta;
  const souContratante = c.papel === "contratante";
  const ativa = p.status === "aberta" || p.status === "fechada" || p.status === "concluida";
  const st = STATUS_PROPOSTA[p.status];

  const enviar = async () => {
    if (!texto.trim() && !arquivo) return;
    const r = await msg.mutateAsync({ proposta: id, texto: texto.trim(), arquivo });
    setTexto(""); setArquivo(null);
    if (r?.aviso_contato) toast.warning("Combinar por fora tira a proteção do histórico e da avaliação. Se der problema, só vale o que está aqui.", { duration: 7000 });
  };

  const ponteLink = (() => {
    if (!p.ponte || base !== "/socialmidia/criakut") return null;
    if (p.ponte === "parceiros") return souContratante ? { txt: "Abrir Equipe", to: "/socialmidia/equipe" } : { txt: "Minhas demandas", to: "/socialmidia/demandas" };
    if (p.ponte === "carteira" && !souContratante) return { txt: "Abrir Clientes", to: "/socialmidia/clientes" };
    return null;
  })();

  return (
    <div className="flex min-h-[560px] flex-col rounded-[22px] border border-border bg-card">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 border-b border-border p-4">
        <button type="button" onClick={onVoltar} className="mt-1 lg:hidden" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => navigate(`${base}/${c.outro.slug}`)}><Avatar nome={c.outro.nome} foto={c.outro.foto_url} className="h-11 w-11 text-[13px]" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted-foreground">{c.outro.nome} · {nomeFuncao(c.outro.funcao)}</p>
          <h2 className="font-display text-[19px] font-bold leading-snug">{p.titulo}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
            <span className={cn("rounded-md px-2 py-0.5", st.cor)}>{st.nome}</span>
            <span className="rounded-md bg-muted px-2 py-0.5">{precoTexto(p.valor_centavos, p.unidade)}{p.recorrente && " · todo mês"}</span>
            {p.prazo && <span className="rounded-md bg-muted px-2 py-0.5">prazo {dataBr(p.prazo)}</span>}
            {p.pago_em && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">pago</span>}
            {p.recebido_em && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">recebido</span>}
          </div>
        </div>
      </div>

      {p.ponte && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2.5 text-[12.5px]">
          <Handshake className="h-4 w-4 text-primary" /><b>{PONTE_TEXTO[p.ponte]}</b>
          {ponteLink && <Button size="sm" variant="outline" className="ml-auto h-7 rounded-lg" onClick={() => navigate(ponteLink.to)}>{ponteLink.txt}</Button>}
        </div>
      )}

      {/* Mensagens */}
      <div className="max-h-[52vh] min-h-[220px] flex-1 space-y-2 overflow-y-auto p-4">
        {c.mensagens.map((m) => m.sistema ? (
          <div key={m.id} className="mx-auto max-w-[90%] rounded-xl bg-muted px-3 py-2 text-center text-[12px] text-muted-foreground">{m.texto}<span className="ml-1.5 opacity-60">{hora(m.criado_em)}</span></div>
        ) : (
          <div key={m.id} className={cn("flex", m.meu ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2 text-[13.5px]", m.meu ? "bg-foreground text-background" : "bg-muted", m.eh_entrega && "ring-2 ring-emerald-500")}>
              {m.eh_entrega && <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-emerald-500"><PackageCheck className="h-3.5 w-3.5" /> ENTREGA</p>}
              {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
              {m.anexo_url && (
                <a href={m.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-background/15 px-2 py-1 text-[12.5px] font-semibold underline">
                  <FileDown className="h-3.5 w-3.5" /> {m.anexo_nome ?? "arquivo"}
                </a>
              )}
              {m.tem_contato && <p className="mt-1 flex items-center gap-1 text-[10.5px] opacity-70"><AlertTriangle className="h-3 w-3" /> contato fora do Cria</p>}
              <p className="mt-0.5 text-right text-[10px] opacity-60">{hora(m.criado_em)}</p>
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Ações do momento */}
      <AcoesDoMomento c={c} pendente={acao.isPending}
        onAceitar={() => acao.mutate({ tipo: "aceitar", id }, { onSuccess: () => toast.success("Fechado!") })}
        onRecusar={() => { if (window.confirm(c.minha_vez ? "Recusar essa proposta?" : "Retirar sua proposta?")) acao.mutate({ tipo: "recusar", id }); }}
        onContra={() => setContra(true)}
        onEntregar={() => setEntregar(true)}
        onMarcar={(a) => {
          const pergunta = a === "concluir" ? "Concluir o trabalho? Depois disso os dois avaliam." : a === "paguei" ? "Marcar que você pagou?" : "Confirmar que o valor caiu?";
          if (window.confirm(pergunta)) acao.mutate({ tipo: "marcar", id, acao: a });
        }}
        onAvaliar={() => setAvaliar(true)} />

      {/* Escrever */}
      {ativa ? (
        <div className="border-t border-border p-3">
          {arquivo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-[12px]">
              <Paperclip className="h-3.5 w-3.5" /><span className="truncate">{arquivo.name}</span>
              <button type="button" className="ml-auto" onClick={() => setArquivo(null)} aria-label="Tirar anexo"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border" onClick={() => fileRef.current?.click()} aria-label="Anexar"><Paperclip className="h-4 w-4" /></button>
            <input ref={fileRef} type="file" accept={ACEITA_ANEXO} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const erro = anexoPermitido(f); if (erro) toast.error(erro); else setArquivo(f); }} />
            <Textarea rows={1} value={texto} maxLength={2000} placeholder="Escreva..." className="min-h-10 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar().catch(() => undefined); } }}
              onChange={(e) => setTexto(e.target.value)} />
            <Button className="h-10 w-10 shrink-0 rounded-xl p-0" disabled={msg.isPending || (!texto.trim() && !arquivo)} onClick={() => void enviar().catch(() => undefined)} aria-label="Mandar">
              {msg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : <p className="border-t border-border p-3 text-center text-[12.5px] text-muted-foreground">Conversa encerrada.</p>}

      <Contraproposta open={contra} onOpenChange={setContra} c={c} />
      <EnviarEntrega open={entregar} onOpenChange={setEntregar} propostaId={id} />
      <Avaliar open={avaliar} onOpenChange={setAvaliar} c={c} />
    </div>
  );
}

function AcoesDoMomento({ c, pendente, onAceitar, onRecusar, onContra, onEntregar, onMarcar, onAvaliar }: {
  c: Conversa; pendente: boolean; onAceitar: () => void; onRecusar: () => void; onContra: () => void;
  onEntregar: () => void; onMarcar: (a: "concluir" | "paguei" | "recebi") => void; onAvaliar: () => void;
}) {
  const p = c.proposta;
  const souContratante = c.papel === "contratante";
  const botoes: JSX.Element[] = [];
  let dica: string | null = null;

  if (p.status === "aberta") {
    if (c.minha_vez) {
      botoes.push(<Button key="a" size="sm" className="rounded-lg" disabled={pendente} onClick={onAceitar}><Check className="mr-1 h-4 w-4" /> Aceitar</Button>);
      botoes.push(<Button key="c" size="sm" variant="outline" className="rounded-lg" disabled={pendente} onClick={onContra}>Contrapropor</Button>);
      botoes.push(<Button key="r" size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={pendente} onClick={onRecusar}>Recusar</Button>);
    } else {
      dica = "Esperando a resposta da outra pessoa.";
      botoes.push(<Button key="r" size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={pendente} onClick={onRecusar}>Retirar</Button>);
    }
  }
  if (p.status === "fechada" || p.status === "concluida") {
    if (!souContratante && p.status === "fechada") botoes.push(<Button key="e" size="sm" className="rounded-lg" disabled={pendente} onClick={onEntregar}><PackageCheck className="mr-1 h-4 w-4" /> Enviar entrega</Button>);
    if (souContratante && p.status === "fechada") {
      botoes.push(<Button key="k" size="sm" className="rounded-lg" disabled={pendente || !c.tem_entrega} onClick={() => onMarcar("concluir")}><CheckCircle2 className="mr-1 h-4 w-4" /> Concluir trabalho</Button>);
      if (!c.tem_entrega) dica = p.ponte === "parceiros" ? "Concluir libera quando chegar uma entrega (aqui ou no Cria Post)." : "Concluir libera quando chegar uma entrega com arquivo.";
    }
    if (souContratante && !p.pago_em) botoes.push(<Button key="p" size="sm" variant="outline" className="rounded-lg" disabled={pendente} onClick={() => onMarcar("paguei")}><Wallet className="mr-1 h-4 w-4" /> Paguei</Button>);
    if (!souContratante && !p.recebido_em) botoes.push(<Button key="rb" size="sm" variant="outline" className="rounded-lg" disabled={pendente} onClick={() => onMarcar("recebi")}><Wallet className="mr-1 h-4 w-4" /> Recebi</Button>);
    if (p.status === "concluida" && !c.ja_avaliei) botoes.push(<Button key="av" size="sm" className="rounded-lg" disabled={pendente} onClick={onAvaliar}><Star className="mr-1 h-4 w-4" /> Avaliar</Button>);
    if (p.status === "concluida" && c.ja_avaliei) dica = "Você já avaliou. A nota aparece na página quando os dois avaliarem (ou em 14 dias).";
  }
  if (!botoes.length && !dica) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
      {botoes}
      {dica && <span className="text-[12px] text-muted-foreground">{dica}</span>}
    </div>
  );
}

function Contraproposta({ open, onOpenChange, c }: { open: boolean; onOpenChange: (o: boolean) => void; c: Conversa }) {
  const acao = useAcaoProposta();
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState<Unidade>(c.proposta.unidade);
  const [prazo, setPrazo] = useState("");
  const [escopo, setEscopo] = useState("");
  useEffect(() => {
    if (open) {
      setValor(c.proposta.valor_centavos != null ? String(c.proposta.valor_centavos / 100).replace(".", ",") : "");
      setUnidade(c.proposta.unidade); setPrazo(c.proposta.prazo ?? ""); setEscopo("");
    }
  }, [open, c.proposta]);
  const hoje = new Date().toISOString().slice(0, 10);
  const gravar = () => {
    if (prazo && prazo < hoje) { toast.error("O prazo já passou."); return; }
    acao.mutate({ tipo: "contrapropor", id: c.proposta.id, valor_centavos: reaisParaCentavos(valor), unidade, prazo: prazo || null, escopo: escopo.trim() || null },
      { onSuccess: () => { toast.success("Contraproposta enviada."); onOpenChange(false); } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Contraproposta</DialogTitle><DialogDescription>Depois disso a vez é da outra pessoa.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="grid gap-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={valor} placeholder="em branco = a combinar" onChange={(e) => setValor(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Por</Label>
              <select className="h-10 rounded-md border border-input bg-background px-2 text-[13px]" value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)}>
                {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.sufixo.replace("/", "").trim()}</option>)}
              </select></div>
          </div>
          <div className="grid gap-1.5"><Label>Prazo</Label><Input type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Mudou o escopo? (opcional)</Label><Textarea rows={3} maxLength={2000} value={escopo} onChange={(e) => setEscopo(e.target.value)} /></div>
          <Button className="rounded-xl" disabled={acao.isPending} onClick={gravar}>{acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar contraproposta</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnviarEntrega({ open, onOpenChange, propostaId }: { open: boolean; onOpenChange: (o: boolean) => void; propostaId: string }) {
  const msg = useMandarMensagem();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  useEffect(() => { if (open) { setArquivo(null); setTexto(""); } }, [open]);
  const gravar = () => {
    if (!arquivo) { toast.error("Escolha o arquivo da entrega."); return; }
    msg.mutate({ proposta: propostaId, texto: texto.trim(), arquivo, entrega: true },
      { onSuccess: () => { toast.success("Entrega registrada!"); onOpenChange(false); } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Enviar entrega</DialogTitle>
          <DialogDescription>Fica marcada como entrega na conversa: é o que libera a conclusão e a avaliação. Imagem, vídeo, PDF, áudio ou ZIP até 200 MB.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-4 text-[13px]">
            <Paperclip className="h-4 w-4" /> <span className="truncate">{arquivo ? arquivo.name : "Escolher arquivo"}</span>
            <input type="file" accept={ACEITA_ANEXO} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const erro = anexoPermitido(f); if (erro) toast.error(erro); else setArquivo(f); }} />
          </label>
          <Textarea rows={3} maxLength={2000} value={texto} placeholder="Recado da entrega (opcional)" onChange={(e) => setTexto(e.target.value)} />
          <Button className="rounded-xl" disabled={msg.isPending || !arquivo} onClick={gravar}>{msg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar entrega</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Escala({ valor, max, onChange, rotulos }: { valor: number; max: number; onChange: (v: number) => void; rotulos?: string[] }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={cn("rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold", valor === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
          {rotulos ? rotulos[v - 1] : "★".repeat(v)}
        </button>
      ))}
    </div>
  );
}

function Avaliar({ open, onOpenChange, c }: { open: boolean; onOpenChange: (o: boolean) => void; c: Conversa }) {
  const acao = useAcaoProposta();
  const [nota, setNota] = useState(5);
  const [prazo, setPrazo] = useState(3);
  const [cria, setCria] = useState(3);
  const [com, setCom] = useState(3);
  const [dep, setDep] = useState("");
  useEffect(() => { if (open) { setNota(5); setPrazo(3); setCria(3); setCom(3); setDep(""); } }, [open]);
  const tres = ["Abaixo", "Ok", "Ótimo"];
  const avaliandoContratado = c.papel === "contratante";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Avaliar {c.outro.nome.split(" ")[0]}</DialogTitle>
          <DialogDescription>Às cegas: ninguém vê a nota do outro antes de avaliar. Aparece na página depois que os dois avaliarem (ou em 14 dias). Não dá pra mudar depois.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nota geral</Label><div className="mt-1.5"><Escala valor={nota} max={5} onChange={setNota} /></div></div>
          <div><Label>{avaliandoContratado ? "Cumpriu o prazo" : "Respeitou os combinados"}</Label><div className="mt-1.5"><Escala valor={prazo} max={3} onChange={setPrazo} rotulos={tres} /></div></div>
          <div><Label>{avaliandoContratado ? "Criatividade" : "Clareza no pedido"}</Label><div className="mt-1.5"><Escala valor={cria} max={3} onChange={setCria} rotulos={tres} /></div></div>
          <div><Label>Comunicação</Label><div className="mt-1.5"><Escala valor={com} max={3} onChange={setCom} rotulos={tres} /></div></div>
          <div className="grid gap-1.5"><Label>Depoimento (aparece na página)</Label><Textarea rows={3} maxLength={600} value={dep} onChange={(e) => setDep(e.target.value)} placeholder="Como foi trabalhar junto?" /></div>
          <Button className="rounded-xl" disabled={acao.isPending}
            onClick={() => acao.mutate({ tipo: "avaliar", id: c.proposta.id, nota, no_prazo: prazo, criatividade: cria, comunicacao: com, depoimento: dep.trim() },
              { onSuccess: () => { toast.success("Avaliação registrada. Obrigado!"); onOpenChange(false); } })}>
            {acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar avaliação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
