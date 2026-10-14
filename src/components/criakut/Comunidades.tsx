import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Flag, Loader2, MessageSquare, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { useAcaoAdminCriakut, useAcaoComunidade, useBaseCriakut, useComunidade, useComunidades, useMeuPerfilCriakut, useTopico } from "@/hooks/useCriakut";
import { nomeFuncao, quandoFoi, type AutorMini, type ComunidadeItem } from "@/lib/criakut";
import { Avatar, DenunciarDialog, SeloDestaque } from "./Pecas";
import { cn } from "@/lib/utils";

/* COMUNIDADES (Fase 3, versão simples aprovada em 14/10/2026). Só o admin
   cria comunidade; quem tem página entra, abre tópico e responde. Telefone,
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
  const minhas = (q.data ?? []).filter((x) => x.sou_membro).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05]">Comunidades</h1>
        <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          {minhas > 0 && `Você está em ${minhas}`}
          {admin && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditando("nova")}><Plus className="mr-1 h-4 w-4" /> Nova comunidade</Button>}
        </span>
      </div>
      {q.isLoading ? <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />
        : <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((x) => (
              <div key={x.id} className={cn("overflow-hidden rounded-[20px] border border-border bg-card text-left transition-colors hover:border-foreground/40", !x.ativa && "opacity-60")}>
                <button type="button" className="block w-full text-left" onClick={() => onAbrir(x.slug)}>
                  <div className="grid h-[86px] place-items-center text-[34px]" style={{ background: x.cor }}>{x.emoji}</div>
                  <div className="p-3.5 pb-2">
                    <h3 className="font-display text-[17px] font-bold">{x.nome}{!x.ativa && <span className="ml-1 text-[11px] font-normal">(desativada)</span>}</h3>
                    {x.descricao && <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{x.descricao}</p>}
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
    </div>
  );
}

function EditarComunidade({ item, onClose }: { item: ComunidadeItem | "nova" | null; onClose: () => void }) {
  const acao = useAcaoAdminCriakut();
  const [f, setF] = useState({ slug: "", nome: "", descricao: "", emoji: "💬", cor: "#FFE6DC", ativa: true, ordem: 0 });
  useEffect(() => {
    if (item === "nova") setF({ slug: "", nome: "", descricao: "", emoji: "💬", cor: "#FFE6DC", ativa: true, ordem: 0 });
    else if (item) setF({ slug: item.slug, nome: item.nome, descricao: item.descricao ?? "", emoji: item.emoji, cor: item.cor, ativa: item.ativa, ordem: 0 });
  }, [item]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const salvar = () => {
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(f.slug)) { toast.error("Endereço: letras minúsculas, números e hífen (3 a 40)."); return; }
    if (f.nome.trim().length < 3) { toast.error("Dê um nome."); return; }
    acao.mutate({ tipo: "comunidade", id: item && item !== "nova" ? item.id : null, ...f }, { onSuccess: () => { toast.success("Comunidade salva."); onClose(); } });
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item === "nova" ? "Nova comunidade" : "Editar comunidade"}</DialogTitle><DialogDescription>Só admin vê isto.</DialogDescription></DialogHeader>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[64px_1fr] gap-2"><Input value={f.emoji} maxLength={4} onChange={(e) => set("emoji", e.target.value)} /><Input value={f.nome} maxLength={60} placeholder="Nome" onChange={(e) => set("nome", e.target.value)} /></div>
          <Input value={f.slug} maxLength={40} placeholder="endereco-da-comunidade" onChange={(e) => set("slug", e.target.value.toLowerCase())} />
          <Textarea rows={2} maxLength={240} value={f.descricao} placeholder="Descrição curta" onChange={(e) => set("descricao", e.target.value)} />
          <label className="flex items-center gap-2 text-[13px]">Cor <input type="color" value={f.cor} onChange={(e) => set("cor", e.target.value.toUpperCase())} />
            <span className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={f.ativa} onChange={(e) => set("ativa", e.target.checked)} /> ativa</span></label>
          <Button className="rounded-xl" disabled={acao.isPending} onClick={salvar}>{acao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
        </div>
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
            <div className="grid h-[110px] place-items-center rounded-2xl text-5xl" style={{ background: c.cor }}>{c.emoji}</div>
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
      <button type="button" onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"><ArrowLeft className="h-4 w-4" /> {t.comunidade.emoji} {t.comunidade.nome}</button>
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
