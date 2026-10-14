import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Flag, Loader2, MessageSquare, Pin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { useAcaoAdminCriakut, useAcaoComunidade, useBaseCriakut, useComunidade, useComunidades, useComunidadesParecidas, useMeuPerfilCriakut, useTopico } from "@/hooks/useCriakut";
import { PUBLICOS, nomeFuncao, quandoFoi, type AutorMini, type ComunidadeItem, type PublicoComunidade } from "@/lib/criakut";
import { Avatar, DenunciarDialog, SeloDestaque } from "./Pecas";
import { CapaComunidade, EscolherTemaComunidade, palpiteTema, temaComunidade } from "./CapaComunidade";
import { cn } from "@/lib/utils";

/* COMUNIDADES (Fase 3, versão simples aprovada em 14/10/2026). O admin cria;
   quem tem página sugere (o admin aprova), entra, abre tópico e responde. Telefone,
   e-mail e link viram "••••" no banco. 3 denúncias escondem até o admin olhar.
   Endereços: ?aba=comunidades · &c=slug (dentro) · &t=id (um tópico). */

const card = "rounded-[22px] border border-border bg-card p-[18px]";

export function Comunidades() {
  const [params, setParams] = useSearchParams();
  const c = params.get("c");
  const t = params.get("t");
  const ir = (novo: { c?: string | null; t?: string | null }) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(novo)) { if (v) n.set(k, v); else n.delete(k); }
    setParams(n);
    window.scrollTo(0, 0);
  };
  if (t) return <Topico id={t} onVoltar={() => ir({ t: null })} />;
  if (c) return <Dentro slug={c} onVoltar={() => ir({ c: null })} onTopico={(id) => ir({ t: id })} />;
  return <Lista onAbrir={(slug) => ir({ c: slug })} />;
}

function Lista({ onAbrir }: { onAbrir: (slug: string) => void }) {
  const q = useComunidades();
  const { profile } = useProfile();
  const admin = profile?.role === "admin";
  const [editando, setEditando] = useState<ComunidadeItem | "nova" | null>(null);
  const [sugerindo, setSugerindo] = useState(false);
  const minhas = (q.data ?? []).filter((x) => x.sou_membro).length;
  /* FILTRO (Walter, 14/10/2026): texto, público e "só as minhas". Cada pessoa
     já só recebe as comunidades do lado dela (criador ou prestador) e as de
     todos; o admin vê tudo, por isso o filtro de público aparece pra ele. */
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "minhas" | PublicoComunidade>("todas");
  const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const lista = (q.data ?? []).filter((x) =>
    (filtro === "todas" || (filtro === "minhas" ? x.sou_membro : x.publico === filtro))
    && (!busca.trim() || semAcento(`${x.nome} ${x.descricao ?? ""}`).includes(semAcento(busca.trim()))));
  const publicosVistos = new Set((q.data ?? []).map((x) => x.publico));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05]">Comunidades</h1>
        <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          {minhas > 0 && `Você está em ${minhas}`}
          {admin
            ? <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditando("nova")}><Plus className="mr-1 h-4 w-4" /> Nova comunidade</Button>
            : <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setSugerindo(true)}><Plus className="mr-1 h-4 w-4" /> Sugerir comunidade</Button>}
        </span>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary sm:max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" placeholder="Buscar comunidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([["todas", "Todas"], ["minhas", "Minhas"], ...PUBLICOS.filter((p) => p.valor !== "todos" && publicosVistos.has(p.valor)).map((p) => [p.valor, `Pra ${p.nome.toLowerCase()}`])] as [typeof filtro, string][]).map(([k, n]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              className={cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", filtro === k ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{n}</button>
          ))}
        </div>
      </div>
      {q.isLoading ? <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />
        : lista.length === 0 ? <p className="py-14 text-center text-[14px] text-muted-foreground">Nenhuma comunidade com esse filtro.</p>
        : <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((x) => (
              <div key={x.id} className={cn("overflow-hidden rounded-[20px] border bg-card text-left transition-colors hover:border-foreground/40",
                x.status !== "aprovada" ? "border-dashed border-amber-400" : "border-border", !x.ativa && "opacity-60")}>
                <button type="button" className="block w-full text-left" disabled={x.status !== "aprovada" && !admin} onClick={() => onAbrir(x.slug)}>
                  <div className="relative h-[96px]">
                    <CapaComunidade tema={x.emoji} className="absolute inset-0 h-full w-full" />
                    {x.publico !== "todos" && <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-foreground">Pra {x.publico}</span>}
                    {x.status === "pendente" && <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">{x.minha_sugestao ? "Sua sugestão: em análise" : "Em análise"}</span>}
                    {x.status === "recusada" && <span className="absolute right-2.5 top-2.5 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">Não aprovada</span>}
                  </div>
                  <div className="p-3.5 pb-2">
                    <h3 className="font-display text-[17px] font-bold">{x.nome}{!x.ativa && <span className="ml-1 text-[11px] font-normal">(desativada)</span>}</h3>
                    {x.descricao && <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{x.descricao}</p>}
                    {x.status === "recusada" && x.motivo_recusa && <p className="mt-1 text-[12px] text-muted-foreground"><b>Motivo:</b> {x.motivo_recusa}</p>}
                  </div>
                </button>
                <div className="flex items-center justify-between px-3.5 pb-3.5 text-[12px] text-muted-foreground">
                  <span>{x.membros} {x.membros === 1 ? "membro" : "membros"} · {x.topicos} {x.topicos === 1 ? "tópico" : "tópicos"}</span>
                  <span className="flex items-center gap-2">
                    {admin && <button type="button" className="hover:text-foreground" onClick={() => setEditando(x)}>editar</button>}
                    {x.sou_membro && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-semibold text-background">Você está</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>}
      {admin && <EditarComunidade item={editando} onClose={() => setEditando(null)} />}
      <SugerirComunidade open={sugerindo} onOpenChange={setSugerindo} onAbrir={(slug) => { setSugerindo(false); onAbrir(slug); }} />
    </div>
  );
}

function EditarComunidade({ item, onClose }: { item: ComunidadeItem | "nova" | null; onClose: () => void }) {
  const acao = useAcaoAdminCriakut();
  const meu = useMeuPerfilCriakut();
  /* Público já vem marcado pelo lado de quem cria (criadora = criadores). */
  const ladoPadrao: PublicoComunidade = meu.data?.funcao === "criadora" ? "criadores" : meu.data ? "prestadores" : "todos";
  const vazio = { slug: "", nome: "", descricao: "", emoji: "papo", cor: "#FFE6DC", ativa: true, ordem: 0, publico: ladoPadrao as PublicoComunidade };
  const [f, setF] = useState(vazio);
  useEffect(() => {
    if (item === "nova") setF({ ...vazio, publico: ladoPadrao });
    else if (item) setF({ slug: item.slug, nome: item.nome, descricao: item.descricao ?? "", emoji: temaComunidade(item.emoji).tema, cor: item.cor, ativa: item.ativa, ordem: 0, publico: item.publico });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, ladoPadrao]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const salvar = () => {
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(f.slug)) { toast.error("Endereço: letras minúsculas, números e hífen (3 a 40)."); return; }
    if (f.nome.trim().length < 3) { toast.error("Dê um nome."); return; }
    acao.mutate({ tipo: "comunidade", id: item && item !== "nova" ? item.id : null, ...f }, { onSuccess: () => { toast.success("Comunidade salva."); onClose(); } });
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{item === "nova" ? "Nova comunidade" : "Editar comunidade"}</DialogTitle><DialogDescription>Só admin vê isto.</DialogDescription></DialogHeader>
        <div className="grid gap-2.5">
          <Input value={f.nome} maxLength={60} placeholder="Nome" onChange={(e) => set("nome", e.target.value)} />
          <EscolherTemaComunidade valor={f.emoji} onChange={(v) => set("emoji", v)} />
          <Input value={f.slug} maxLength={40} placeholder="endereco-da-comunidade" onChange={(e) => set("slug", e.target.value.toLowerCase())} />
          <Textarea rows={2} maxLength={240} value={f.descricao} placeholder="Descrição curta" onChange={(e) => set("descricao", e.target.value)} />
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold">Pra quem é</p>
            <div className="flex gap-1.5">
              {PUBLICOS.map((p) => (
                <button key={p.valor} type="button" onClick={() => set("publico", p.valor)}
                  className={cn("flex-1 rounded-xl border px-2 py-2 text-[12.5px] font-semibold", f.publico === p.valor ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  {p.nome}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Criadores = quem cria conteúdo. Prestadores = social mídia, designer, editor, filmmaker e copy. Cada lado só vê as suas e as de todos.</p>
          </div>
          <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={f.ativa} onChange={(e) => set("ativa", e.target.checked)} /> ativa</label>
          <Button className="rounded-xl" disabled={acao.isPending} onClick={salvar}>{acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* SUGERIR COMUNIDADE (Walter, 14/10/2026): qualquer pessoa com página sugere,
   o admin aprova. Antes de mandar, mostra as parecidas que já existem pra
   ninguém criar a quinta "Quanto cobrar". Público vem marcado pelo lado da
   pessoa (criadora = criadores). */
function SugerirComunidade({ open, onOpenChange, onAbrir }: { open: boolean; onOpenChange: (o: boolean) => void; onAbrir: (slug: string) => void }) {
  const acao = useAcaoComunidade();
  const meu = useMeuPerfilCriakut();
  const lado: PublicoComunidade = meu.data?.funcao === "criadora" ? "criadores" : "prestadores";
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [emoji, setEmoji] = useState("papo");
  const [escolheuCapa, setEscolheuCapa] = useState(false);
  const [publico, setPublico] = useState<PublicoComunidade>(lado);
  const [mesmoAssim, setMesmoAssim] = useState(false);
  useEffect(() => { if (open) { setNome(""); setDescricao(""); setEmoji("papo"); setEscolheuCapa(false); setPublico(lado); setMesmoAssim(false); } }, [open, lado]);
  const parecidas = useComunidadesParecidas(nome);
  const temParecida = (parecidas.data ?? []).length > 0;
  const semPagina = !meu.isLoading && !meu.data;
  const mandar = () => {
    if (nome.trim().length < 3) { toast.error("Dê um nome com pelo menos 3 letras."); return; }
    acao.mutate({ tipo: "sugerir", nome: nome.trim(), descricao: descricao.trim(), emoji, publico },
      { onSuccess: () => { toast.success("Sugestão enviada! O Cria aprova e te avisa."); onOpenChange(false); } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Sugerir comunidade</DialogTitle><DialogDescription>O Cria olha antes de ir pro ar. Você entra nela automaticamente quando for aprovada.</DialogDescription></DialogHeader>
        {semPagina ? <p className="rounded-xl bg-muted p-3 text-[13px]">Crie sua página no Criakut antes de sugerir uma comunidade.</p> : (
          <div className="grid gap-2.5">
            <Input value={nome} maxLength={60} placeholder="Nome (ex.: Reels de nutrição)"
              onChange={(e) => { setNome(e.target.value); setMesmoAssim(false); if (!escolheuCapa) setEmoji(palpiteTema(e.target.value)); }} />
            {temParecida && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">Já tem comunidade parecida. Não é uma dessas?</p>
                <div className="mt-2 grid gap-1.5">
                  {(parecidas.data ?? []).map((c) => (
                    <div key={c.slug} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5">
                      <CapaComunidade tema={c.emoji} forma="mini" className="h-8 w-8 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.nome}{c.status === "pendente" && <span className="ml-1 text-[11px] font-normal text-muted-foreground">(em análise)</span>}</span>
                      {c.status === "aprovada" && <Button size="sm" variant="outline" className="h-7 rounded-lg text-[12px]" onClick={() => onAbrir(c.slug)}>Ver</Button>}
                    </div>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-[12px]"><input type="checkbox" checked={mesmoAssim} onChange={(e) => setMesmoAssim(e.target.checked)} /> A minha é diferente, quero sugerir mesmo assim</label>
              </div>
            )}
            <EscolherTemaComunidade valor={emoji} onChange={(v) => { setEmoji(v); setEscolheuCapa(true); }} />
            <Textarea rows={2} maxLength={240} value={descricao} placeholder="Sobre o que é (uma frase)" onChange={(e) => setDescricao(e.target.value)} />
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold">Pra quem é</p>
              <div className="flex gap-1.5">
                {PUBLICOS.map((p) => (
                  <button key={p.valor} type="button" onClick={() => setPublico(p.valor)}
                    className={cn("flex-1 rounded-xl border px-2 py-2 text-[12.5px] font-semibold", publico === p.valor ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                    {p.nome}
                  </button>
                ))}
              </div>
            </div>
            <Button className="rounded-xl" disabled={acao.isPending || nome.trim().length < 3 || (temParecida && !mesmoAssim)} onClick={mandar}>
              {acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar pra aprovação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NomeAutor({ autor }: { autor: AutorMini }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  if (!autor) return <b>Alguém</b>;
  return (
    <>
      <button type="button" className="font-bold hover:underline" onClick={() => navigate(`${base}/${autor.slug}`)}>{autor.nome}</button>
      {autor.destaque && <SeloDestaque curto className="ml-1" />}
      <span className="text-muted-foreground"> · {nomeFuncao(autor.funcao).toLowerCase()}</span>
    </>
  );
}

function Dentro({ slug, onVoltar, onTopico }: { slug: string; onVoltar: () => void; onTopico: (id: string) => void }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const q = useComunidade(slug);
  const meu = useMeuPerfilCriakut();
  const acao = useAcaoComunidade();
  const [novo, setNovo] = useState(false);
  if (q.isLoading) return <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />;
  const c = q.data;
  if (!c) return <p className="py-16 text-center text-muted-foreground">Comunidade não encontrada.</p>;
  const semPagina = !meu.isLoading && !meu.data;
  return (
    <div>
      <button type="button" onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"><ArrowLeft className="h-4 w-4" /> comunidades</button>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className={cn(card, "text-center")}>
            <CapaComunidade tema={c.emoji} forma="bloco" className="h-[120px] w-full overflow-hidden rounded-2xl" />
            <h2 className="mt-2.5 font-display text-[20px] font-bold">{c.nome}</h2>
            {c.descricao && <p className="mt-1 text-[12.5px] text-muted-foreground">{c.descricao}</p>}
            <p className="mt-1 text-[12px] text-muted-foreground">{c.membros} {c.membros === 1 ? "membro" : "membros"} · {c.topicos.length} {c.topicos.length === 1 ? "tópico" : "tópicos"}</p>
            {semPagina
              ? <Button className="mt-3 w-full rounded-xl" onClick={() => navigate(base)}>Crie sua página pra entrar</Button>
              : <Button className="mt-3 w-full rounded-xl" variant={c.sou_membro ? "outline" : "default"} disabled={acao.isPending}
                  onClick={() => acao.mutate({ tipo: "entrar", comunidade: c.id, entrar: !c.sou_membro }, { onSuccess: () => toast.success(c.sou_membro ? "Você saiu da comunidade." : "Você entrou!") })}>
                  {c.sou_membro ? "Sair da comunidade" : "Entrar na comunidade"}
                </Button>}
          </div>
          {c.amostra.length > 0 && (
            <div className={card}>
              <p className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">Membros</p>
              <div className="grid grid-cols-3 gap-2.5">
                {c.amostra.map((m) => (
                  <button key={m.slug} type="button" className="text-center text-[11.5px] font-semibold" onClick={() => navigate(`${base}/${m.slug}`)}>
                    <Avatar nome={m.nome} foto={m.foto_url} className="mb-1 aspect-square h-auto w-full rounded-2xl text-lg" />
                    <span className="block truncate">{m.nome.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">Tópicos</p>
            {c.sou_membro && <Button size="sm" className="rounded-xl" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" /> Novo tópico</Button>}
          </div>
          {c.topicos.length === 0
            ? <p className="py-8 text-center text-[13px] text-muted-foreground">{c.sou_membro ? "Nenhum tópico ainda. Abra o primeiro!" : "Nenhum tópico ainda. Entre na comunidade pra abrir o primeiro."}</p>
            : c.topicos.map((t) => (
                <button key={t.id} type="button" onClick={() => onTopico(t.id)}
                  className={cn("grid w-full grid-cols-[1fr_auto] items-center gap-3 border-t border-dashed border-border py-3 text-left first:border-0", t.oculto && "opacity-50")}>
                  <span className="min-w-0">
                    <b className="block text-[14.5px] leading-snug">{t.fixo && <span className="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">FIXO</span>}{t.oculto && <span className="mr-1.5 text-[10px] text-red-600">OCULTO</span>}{t.titulo}</b>
                    <span className="text-[12px] text-muted-foreground">{t.autor?.nome ?? "Alguém"} · {t.respostas > 0 ? `última resposta ${quandoFoi(t.ultima_em)}` : quandoFoi(t.criado_em)}</span>
                  </span>
                  <span className="text-right text-[12px] text-muted-foreground"><b className="block font-display text-[18px] text-foreground">{t.respostas}</b>{t.respostas === 1 ? "resposta" : "respostas"}</span>
                </button>
              ))}
        </div>
      </div>
      <NovoTopico open={novo} onOpenChange={setNovo} comunidadeId={c.id} onCriado={onTopico} />
    </div>
  );
}

function NovoTopico({ open, onOpenChange, comunidadeId, onCriado }: { open: boolean; onOpenChange: (o: boolean) => void; comunidadeId: string; onCriado: (id: string) => void }) {
  const acao = useAcaoComunidade();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  useEffect(() => { if (open) { setTitulo(""); setTexto(""); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo tópico</DialogTitle><DialogDescription>Telefone, e-mail e link aparecem como "••••". Até 5 tópicos por dia.</DialogDescription></DialogHeader>
        <div className="grid gap-2.5">
          <Input value={titulo} maxLength={140} placeholder="Título (ex.: quanto vocês cobram por reels?)" onChange={(e) => setTitulo(e.target.value)} />
          <Textarea rows={5} maxLength={3000} value={texto} placeholder="Conte o contexto" onChange={(e) => setTexto(e.target.value)} />
          <Button className="rounded-xl" disabled={acao.isPending || titulo.trim().length < 4}
            onClick={() => acao.mutate({ tipo: "topico", comunidade: comunidadeId, titulo: titulo.trim(), texto: texto.trim() },
              { onSuccess: (id) => { onOpenChange(false); if (typeof id === "string") onCriado(id); } })}>
            {acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Abrir tópico
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Topico({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const q = useTopico(id);
  const acao = useAcaoComunidade();
  const admin = useAcaoAdminCriakut();
  const { profile } = useProfile();
  const souAdmin = profile?.role === "admin";
  const [texto, setTexto] = useState("");
  const [denuncia, setDenuncia] = useState<{ tipo: "topico" | "resposta"; id: string } | null>(null);
  if (q.isLoading) return <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />;
  const t = q.data;
  if (!t) return <div className="py-16 text-center text-muted-foreground">Tópico não encontrado. <button type="button" className="underline" onClick={onVoltar}>voltar</button></div>;
  const responder = () => {
    if (!texto.trim()) return;
    acao.mutate({ tipo: "responder", topico: t.id, texto: texto.trim() }, { onSuccess: () => setTexto("") });
  };
  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"><ArrowLeft className="h-4 w-4" /> <CapaComunidade tema={t.comunidade.emoji} forma="mini" className="h-6 w-6 rounded-md" /> {t.comunidade.nome}</button>
      <div className={card}>
        <h1 className="font-display text-[24px] font-bold leading-snug">{t.fixo && <Pin className="mr-1 inline h-4 w-4 text-violet-600" />}{t.titulo}</h1>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2.5">
          <Avatar nome={t.autor?.nome ?? "?"} foto={t.autor?.foto_url} className="h-9 w-9 text-[12px]" />
          <div className="min-w-0">
            <p className="text-[12.5px]"><NomeAutor autor={t.autor} /> <span className="text-muted-foreground">· {quandoFoi(t.criado_em)}</span></p>
            {t.texto && <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{t.texto}</p>}
            <div className="mt-1.5 flex gap-3 text-[11.5px] text-muted-foreground">
              {(t.meu || souAdmin) && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => { if (window.confirm("Apagar esse tópico e as respostas dele?")) acao.mutate({ tipo: "apagar", alvo: "topico", id: t.id }, { onSuccess: onVoltar }); }}><Trash2 className="h-3 w-3" /> apagar</button>}
              {!t.meu && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setDenuncia({ tipo: "topico", id: t.id })}><Flag className="h-3 w-3" /> denunciar</button>}
              {souAdmin && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => admin.mutate({ tipo: "fixar", topico: t.id, fixo: !t.fixo })}><Pin className="h-3 w-3" /> {t.fixo ? "desafixar" : "fixar"}</button>}
              {souAdmin && t.oculto && <button type="button" className="text-red-600" onClick={() => admin.mutate({ tipo: "moderar", qual: "topico", alvo: t.id, ocultar: false })}>reexibir</button>}
            </div>
          </div>
        </div>
      </div>

      <div className={cn(card, "mt-4")}>
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary"><MessageSquare className="h-3.5 w-3.5" /> {t.respostas.length} {t.respostas.length === 1 ? "resposta" : "respostas"}</p>
        {t.respostas.map((r) => (
          <div key={r.id} className={cn("grid grid-cols-[auto_1fr] gap-2.5 border-t border-dashed border-border py-3 first:border-0", r.oculto && "opacity-50")}>
            <Avatar nome={r.autor?.nome ?? "?"} foto={r.autor?.foto_url} className="h-9 w-9 text-[12px]" />
            <div className="min-w-0">
              <p className="text-[12.5px]"><NomeAutor autor={r.autor} /> <span className="text-muted-foreground">· {quandoFoi(r.criado_em)}</span>{r.oculto && <span className="ml-1 text-[10px] font-bold text-red-600">OCULTA</span>}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{r.texto}</p>
              <div className="mt-1 flex gap-3 text-[11.5px] text-muted-foreground">
                {(r.meu || souAdmin) && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => { if (window.confirm("Apagar essa resposta?")) acao.mutate({ tipo: "apagar", alvo: "resposta", id: r.id }); }}><Trash2 className="h-3 w-3" /> apagar</button>}
                {!r.meu && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setDenuncia({ tipo: "resposta", id: r.id })}><Flag className="h-3 w-3" /> denunciar</button>}
                {souAdmin && r.oculto && <button type="button" className="text-red-600" onClick={() => admin.mutate({ tipo: "moderar", qual: "resposta", alvo: r.id, ocultar: false })}>reexibir</button>}
              </div>
            </div>
          </div>
        ))}
        {t.sou_membro ? (
          <div className="mt-3 flex items-start gap-2">
            <Textarea rows={2} maxLength={3000} value={texto} placeholder="Responder" className="min-h-[44px]" onChange={(e) => setTexto(e.target.value)} />
            <Button className="h-[44px] rounded-xl" disabled={acao.isPending || !texto.trim()} onClick={responder}>
              {acao.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Responder"}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted p-3 text-[13px]">
            Entre na comunidade pra responder.
            <Button size="sm" className="rounded-xl" disabled={acao.isPending} onClick={() => acao.mutate({ tipo: "entrar", comunidade: t.comunidade.id, entrar: true })}>Entrar</Button>
          </div>
        )}
      </div>
      <DenunciarDialog alvo={denuncia} onClose={() => setDenuncia(null)} />
    </div>
  );
}
