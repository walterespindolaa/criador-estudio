import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Check, ChevronDown, Clapperboard, FolderOpen, Kanban, Loader2, Mic, MoreHorizontal, Pencil, Play, Plus, Sparkles, Trash2, Undo2, Video,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { confirmar } from "@/components/shared/Confirm";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePosts, type Post } from "@/hooks/usePosts";
import {
  usePrompterScripts, useSavePrompterScript, useDeletePrompterScript,
  useRenamePrompterFolder, useDeletePrompterFolder, useSendPostToPrompter,
  useFilaPrompterScript, type PrompterScript,
} from "@/hooks/usePrompterScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PROMPTER BIBLIOTECA
   O roteiro nasce aqui (manual) ou chega pronto dos outros módulos: a seção
   "Na fase Produzindo" espelha a coluna do Criando (status = gravando) e
   transforma o post em roteiro com 1 toque, sempre na versão mais recente.
   A trava de plano mora na rota (App.tsx → UpgradeGate feature="prompter").
   ═══════════════════════════════════════════════════════════════════════════ */

const SOURCE_LABEL: Record<PrompterScript["source"], string | null> = {
  manual: null, criando: "Em produção", stories: "Cria Stories", ia: "Cria IA",
};

/* O que se FALA no vídeo: hook (destacado no prompter) + roteiro + CTA.
   Legenda fica de fora é texto escrito, não falado. */
function postToSpokenScript(p: Post): string {
  const parts: string[] = [];
  if (p.hook?.trim()) parts.push("**" + p.hook.trim() + "**");
  if (p.script?.trim()) parts.push(p.script.trim());
  if (p.cta?.trim()) parts.push(p.cta.trim());
  return parts.join("\n\n");
}

type EditorState = { open: false } | { open: true; id?: string; title: string; script: string; folder: string };

export default function CriaPrompter() {
  const navigate = useNavigate();
  const { data: scripts = [], isLoading } = usePrompterScripts();
  const { posts, updatePost, deletePost } = usePosts();
  const { user } = useAuth();
  const saveMut = useSavePrompterScript();
  const delMut = useDeletePrompterScript();
  const renameFolderMut = useRenamePrompterFolder();
  const delFolderMut = useDeletePrompterFolder();
  const sendPost = useSendPostToPrompter();
  const filaMut = useFilaPrompterScript();

  const [curFolder, setCurFolder] = useState<string>("all");
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [confirmDel, setConfirmDel] = useState<PrompterScript | null>(null);
  const [renameFolder, setRenameFolder] = useState<{ from: string; value: string } | null>(null);
  const [confirmDelFolder, setConfirmDelFolder] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const folders = useMemo(
    () => Array.from(new Set(scripts.map((s) => s.folder).filter(Boolean))).sort() as string[],
    [scripts],
  );
  const visible = curFolder === "all" ? scripts : scripts.filter((s) => s.folder === curFolder);
  const producing = useMemo(() => posts.filter((p) => p.status === "gravando"), [posts]);

  const gravar = (id: string) => navigate(`/app/prompter/gravar/${id}`);

  const gravarPost = (p: Post) => {
    const spoken = postToSpokenScript(p);
    if (!spoken.trim()) {
      toast.error("Esse post ainda não tem roteiro escrito. Abre ele no Criando e preenche o gancho/roteiro primeiro.");
      return;
    }
    setSendingId(p.id);
    sendPost.mutate(
      { postId: p.id, title: p.title, script: spoken },
      { onSuccess: (id) => gravar(id), onSettled: () => setSendingId(null) },
    );
  };

  const salvar = () => {
    if (!editor.open) return;
    saveMut.mutate(
      {
        id: editor.id,
        title: editor.title.trim() || "Sem título",
        script: editor.script,
        folder: editor.folder.trim() || null,
      },
      {
        onSuccess: () => {
          const novo = !editor.id;
          setEditor({ open: false });
          /* roteiro novo nasce na fila: leva a pessoa pra onde ele está */
          if (novo) { setAba("gravar"); toast.success("Roteiro salvo. Ele está em Pra gravar."); }
        },
      },
    );
  };

  const wordCount = (s: string) => (s.trim().match(/\S+/g) || []).length;
  const minutos = (w: number) => Math.max(1, Math.ceil(w / 140));

  /* ═══ PROMPTER REPAGINADO (mockup aprovado pelo Walter, 25/10/2026) ═══
     Antes era uma parede de cards iguais: sem data, sem como tirar um card
     dali e com o selo do formato quase invisível. Agora são três abas:
       Pra gravar     os posts da fase Produzindo do Criando, o mais urgente
                      (data de postar mais perto) primeiro
       Meus roteiros  os roteiros avulsos, por pasta
       Já gravados    o que foi marcado "Já gravei" AQUI e foi pra Pronto
     "Já gravei" anda o post pra Pronto (status editando) e guarda a marca no
     aparelho só pra lista de gravados; "Desfazer" devolve pra Produzindo. */
  const [aba, setAba] = useState<"gravar" | "roteiros" | "gravados">("gravar");
  const chaveGravados = `cria.prompter.gravados.${user?.id ?? "anon"}`;
  const [gravadosAqui, setGravadosAqui] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(chaveGravados) ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const salvarGravados = (m: Record<string, string>) => {
    setGravadosAqui(m);
    try { localStorage.setItem(chaveGravados, JSON.stringify(m)); } catch { /* modo privado */ }
  };

  const hoje = parseDateOnly(hojeBR());
  const diasAte = (iso: string | null | undefined) =>
    iso ? Math.round((parseDateOnly(iso.slice(0, 10)).getTime() - hoje.getTime()) / 86400000) : null;
  const dataCurta = (iso: string) => {
    const d = parseDateOnly(iso.slice(0, 10));
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  };
  const criadoEm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

  const producingOrdenados = useMemo(() => {
    const com = producing.filter((p) => p.scheduled_date).sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));
    const sem = producing.filter((p) => !p.scheduled_date).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { com, sem };
  }, [producing]);
  const gravados = useMemo(
    () => posts.filter((p) => gravadosAqui[p.id] && p.status !== "gravando").sort((a, b) => (gravadosAqui[b.id] ?? "").localeCompare(gravadosAqui[a.id] ?? "")),
    [posts, gravadosAqui],
  );
  // Roteiro que nasceu de um post do Criando já aparece como card do post.
  const roteirosAvulsos = useMemo(() => scripts.filter((s) => s.source !== "criando"), [scripts]);
  const foldersAvulsos = useMemo(
    () => Array.from(new Set(roteirosAvulsos.map((s) => s.folder).filter(Boolean))).sort() as string[],
    [roteirosAvulsos],
  );
  const roteirosVisiveis = curFolder === "all" ? roteirosAvulsos : roteirosAvulsos.filter((s) => s.folder === curFolder);
  /* FILA DE ROTEIROS AVULSOS (25/10/2026). Antes "Pra gravar" só mostrava
     posts do Criando e o roteiro subido aqui ficava só na biblioteca. Agora
     roteiro novo nasce na fila (na_fila) e sai dela no "Já gravei". */
  const filaRoteiros = useMemo(
    () => roteirosAvulsos.filter((s) => s.na_fila && !s.gravado_em).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [roteirosAvulsos],
  );
  const roteirosGravados = useMemo(
    () => roteirosAvulsos.filter((s) => !!s.gravado_em).sort((a, b) => (b.gravado_em ?? "").localeCompare(a.gravado_em ?? "")),
    [roteirosAvulsos],
  );
  const roteiroJaGravei = (s: PrompterScript) =>
    filaMut.mutate({ id: s.id, na_fila: false, gravado_em: new Date().toISOString() }, { onSuccess: () => toast.success("Marcado como gravado.") });
  const roteiroPraFila = (s: PrompterScript) =>
    filaMut.mutate({ id: s.id, na_fila: true, gravado_em: null }, { onSuccess: () => toast.success("Foi pra Pra gravar.") });
  const roteiroTirarDaFila = (s: PrompterScript) =>
    filaMut.mutate({ id: s.id, na_fila: false, gravado_em: s.gravado_em ?? null }, { onSuccess: () => toast.success("Saiu da fila. Continua em Meus roteiros.") });

  const jaGravei = (p: Post) => {
    updatePost.mutate({ id: p.id, updates: { status: "editando" } }, {
      onSuccess: () => {
        salvarGravados({ ...gravadosAqui, [p.id]: new Date().toISOString() });
        toast.success("Gravado. O post foi pra Pronto no Criando.");
      },
    });
  };
  const desfazerGravado = (p: Post) => {
    updatePost.mutate({ id: p.id, updates: { status: "gravando" } }, {
      onSuccess: () => {
        const m = { ...gravadosAqui }; delete m[p.id]; salvarGravados(m);
      },
    });
  };
  const voltarPraRoteiro = (p: Post) => {
    updatePost.mutate({ id: p.id, updates: { status: "roteiro" } }, {
      onSuccess: () => toast.success("Voltou pra fase Roteiro no Criando."),
    });
  };
  const mandarPraLixeira = async (p: Post) => {
    if (!(await confirmar({ titulo: `Mandar "${p.title}" pra lixeira?`, descricao: "O post sai do Criando e do Prompter. Dá pra recuperar na Lixeira.", acao: "Mandar pra lixeira", destrutivo: true }))) return;
    deletePost.mutate(p.id, { onSuccess: () => toast.success("Foi pra Lixeira.") });
  };

  const seloPrazo = (iso: string | null) => {
    const d = diasAte(iso);
    if (d === null) return <span className="text-[11.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">sem data pra postar</span>;
    const texto = d < 0 ? `era pra ${dataCurta(iso!)}` : d === 0 ? "posta hoje" : d === 1 ? "posta amanhã" : `posta ${dataCurta(iso!)}`;
    return (
      <span className={cn("text-[11.5px] font-body font-semibold px-2 py-0.5 rounded-full",
        d <= 2 ? "bg-[#FDE7DF] text-[#9A2E0E]" : "bg-[#E6EEFA] text-[#1F4E9A]")}>{texto}</span>
    );
  };

  const cardDoPost = (p: Post, gravado = false) => {
    const spoken = postToSpokenScript(p);
    const words = wordCount(spoken);
    return (
      <div key={p.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.format && (
            <span className="text-[10.5px] font-body font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.format}</span>
          )}
          {seloPrazo(p.scheduled_date)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/app/criando?post=${p.id}`)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar roteiro no Criando
              </DropdownMenuItem>
              {!gravado && (
                <DropdownMenuItem onClick={() => voltarPraRoteiro(p)}>
                  <Undo2 className="h-3.5 w-3.5 mr-2" /> Voltar pra Roteiro
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void mandarPraLixeira(p)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Mandar pra lixeira
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[15px] font-body font-semibold text-foreground leading-snug">{p.title}</p>
        <p className="text-[13px] font-body text-muted-foreground leading-relaxed line-clamp-2">
          {spoken ? spoken.replace(/\*\*/g, "") : "Sem roteiro ainda: preencha gancho e roteiro no post."}
        </p>
        <p className="text-[11.5px] font-body text-muted-foreground">
          Criado em {criadoEm(p.created_at)}{spoken ? ` · ${words} palavras · ~${minutos(words)} min` : " · roteiro vazio"}
        </p>
        <div className="mt-auto pt-2.5 border-t border-border/60 flex items-center gap-2 flex-wrap">
          {gravado ? (
            <>
              <span className="text-[12.5px] font-body font-semibold text-primary inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Gravado em {criadoEm(gravadosAqui[p.id] ?? p.updated_at)} · está em Pronto
              </span>
              <Button size="sm" variant="outline" className="ml-auto h-9" onClick={() => desfazerGravado(p)}>Desfazer</Button>
            </>
          ) : (
            <>
              <Button size="sm" className="h-9" disabled={sendingId === p.id} onClick={() => gravarPost(p)}>
                {sendingId === p.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                Gravar
              </Button>
              <Button size="sm" variant="outline" className="h-9" disabled={updatePost.isPending} onClick={() => jaGravei(p)}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Já gravei
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  /* Card do roteiro avulso. "fila" = Pra gravar, "gravado" = Já gravados,
     "biblioteca" = Meus roteiros (mostra onde ele está). */
  const cardDoRoteiro = (s: PrompterScript, ctx: "fila" | "gravado" | "biblioteca") => {
    const words = wordCount(s.script);
    const srcLabel = SOURCE_LABEL[s.source];
    const naFila = !!s.na_fila && !s.gravado_em;
    const abrirEditor = () => setEditor({ open: true, id: s.id, title: s.title, script: s.script, folder: s.folder ?? "" });
    return (
      <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-body font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{srcLabel ?? "Roteiro"}</span>
          {s.folder && <span className="text-[11.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1"><FolderOpen className="h-3 w-3" /> {s.folder}</span>}
          {ctx === "biblioteca" && naFila && <span className="text-[11.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-[#FDE7DF] text-[#9A2E0E]">pra gravar</span>}
          {ctx === "biblioteca" && s.gravado_em && <span className="text-[11.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-[#E3F4EA] text-[#13663A]">gravado {criadoEm(s.gravado_em)}</span>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={abrirEditor}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar roteiro
              </DropdownMenuItem>
              {!naFila && (
                <DropdownMenuItem onClick={() => roteiroPraFila(s)}>
                  <Kanban className="h-3.5 w-3.5 mr-2" /> {s.gravado_em ? "Gravar de novo (volta pra fila)" : "Mandar pra gravar"}
                </DropdownMenuItem>
              )}
              {naFila && (
                <DropdownMenuItem onClick={() => roteiroTirarDaFila(s)}>
                  <Undo2 className="h-3.5 w-3.5 mr-2" /> Tirar de Pra gravar
                </DropdownMenuItem>
              )}
              {!s.gravado_em && ctx !== "fila" && (
                <DropdownMenuItem onClick={() => roteiroJaGravei(s)}>
                  <Check className="h-3.5 w-3.5 mr-2" /> Já gravei
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(s)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[15px] font-body font-semibold text-foreground leading-snug">{s.title}</p>
        <p className="text-[13px] font-body text-muted-foreground leading-relaxed line-clamp-2">
          {s.script.slice(0, 200) || "Roteiro vazio"}
        </p>
        <p className="text-[11.5px] font-body text-muted-foreground">
          Criado em {criadoEm(s.created_at)} · {words} palavras · ~{minutos(words)} min
        </p>
        <div className="mt-auto pt-2.5 border-t border-border/60 flex items-center gap-2 flex-wrap">
          {ctx === "gravado" ? (
            <>
              <span className="text-[12.5px] font-body font-semibold text-primary inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Gravado em {criadoEm(s.gravado_em ?? s.updated_at)}
              </span>
              <Button size="sm" variant="outline" className="ml-auto h-9" disabled={filaMut.isPending} onClick={() => roteiroPraFila(s)}>Desfazer</Button>
            </>
          ) : (
            <>
              <Button size="sm" className="h-9" onClick={() => gravar(s.id)}>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Gravar
              </Button>
              {ctx === "fila" ? (
                <Button size="sm" variant="outline" className="h-9" disabled={filaMut.isPending} onClick={() => roteiroJaGravei(s)}>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Já gravei
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-9" onClick={abrirEditor}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const ABAS = [
    { k: "gravar" as const, nome: "Pra gravar", n: producing.length + filaRoteiros.length, dica: "Roteiro novo e post na fase Produzindo do Criando entram aqui sozinhos." },
    { k: "roteiros" as const, nome: "Meus roteiros", n: roteirosAvulsos.length, dica: "Roteiros avulsos, separados por pasta." },
    { k: "gravados" as const, nome: "Já gravados", n: gravados.length + roteirosGravados.length, dica: "Desfazer devolve pra Pra gravar." },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl md:text-2xl font-extrabold text-foreground tracking-tight">Cria Prompter</h1>
            <p className="text-[13px] font-body text-muted-foreground">
              Teleprompter com comando de voz: o texto segue a sua fala. Grave direto daqui.
            </p>
          </div>
        </div>
        <Button data-tour="prompter-novo" onClick={() => { setEditor({ open: true, title: "", script: "", folder: curFolder === "all" ? "" : curFolder }); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo roteiro
        </Button>
      </div>

      {/* Abas */}
      <div data-tour="prompter-abas" role="tablist" aria-label="Seções do Prompter" className="mt-6 flex items-center gap-2 flex-wrap border-b border-border pb-3">
        {ABAS.map((a) => (
          <button key={a.k} role="tab" aria-selected={aba === a.k} onClick={() => setAba(a.k)}
            className={cn("h-10 px-3.5 rounded-full border text-[13.5px] font-body font-semibold inline-flex items-center gap-2 transition-colors",
              aba === a.k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80 hover:text-foreground")}>
            {a.k === "gravar" ? <Kanban className="h-4 w-4" /> : a.k === "roteiros" ? <FolderOpen className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {a.nome}
            <span className={cn("min-w-[22px] h-[22px] px-1.5 rounded-full grid place-items-center text-[11.5px]",
              aba === a.k ? "bg-white/20" : "bg-muted")}>{a.n}</span>
          </button>
        ))}
        <span className="ml-auto text-[12.5px] font-body text-muted-foreground hidden md:inline">{ABAS.find((a) => a.k === aba)?.dica}</span>
      </div>

      {/* Pra gravar */}
      {aba === "gravar" && (
        producing.length === 0 && filaRoteiros.length === 0 ? (
          <div className="mt-6 border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Clapperboard className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">Nada pra gravar agora</p>
            <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Roteiro novo que você cria aqui e post do Criando que chega em Produzindo aparecem nesta aba.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Button onClick={() => setEditor({ open: true, title: "", script: "", folder: "" })}><Plus className="h-4 w-4 mr-1.5" /> Novo roteiro</Button>
              <Button variant="outline" onClick={() => navigate("/app/criando")}>Abrir o Criando</Button>
            </div>
          </div>
        ) : (
          <div data-tour="prompter-lista" className="mt-5 space-y-6">
            {producingOrdenados.com.length > 0 && (
              <section>
                <h2 className="text-sm font-display font-bold text-foreground mb-2.5">Com data pra postar <span className="text-xs font-body font-normal text-muted-foreground">· o mais urgente primeiro</span></h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {producingOrdenados.com.map((p) => cardDoPost(p))}
                </div>
              </section>
            )}
            {producingOrdenados.sem.length > 0 && (
              <section>
                <h2 className="text-sm font-display font-bold text-foreground mb-2.5">Sem data marcada <span className="text-xs font-body font-normal text-muted-foreground">· mais novos primeiro</span></h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {producingOrdenados.sem.map((p) => cardDoPost(p))}
                </div>
              </section>
            )}
            {filaRoteiros.length > 0 && (
              <section>
                <h2 className="text-sm font-display font-bold text-foreground mb-2.5">Roteiros avulsos <span className="text-xs font-body font-normal text-muted-foreground">· mais novos primeiro</span></h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filaRoteiros.map((r) => cardDoRoteiro(r, "fila"))}
                </div>
              </section>
            )}
          </div>
        )
      )}

      {/* Já gravados */}
      {aba === "gravados" && (
        gravados.length === 0 && roteirosGravados.length === 0 ? (
          <div className="mt-6 border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Check className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">Nada marcado como gravado ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Depois de gravar, toca em "Já gravei" no card. Post do Criando anda pra Pronto; roteiro avulso fica listado aqui.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {gravados.map((p) => cardDoPost(p, true))}
            {roteirosGravados.map((r) => cardDoRoteiro(r, "gravado"))}
          </div>
        )
      )}

      {/* Meus roteiros */}
      {aba === "roteiros" && (<>
      <div data-tour="prompter-pastas" className="mt-5 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCurFolder("all")}
          className={cn(
            "px-3.5 h-8 rounded-full text-[13px] font-body font-medium border transition-colors",
            curFolder === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Todos
        </button>
        {foldersAvulsos.map((f) => (
          <div
            key={f}
            className={cn(
              "flex items-center rounded-full border transition-colors overflow-hidden",
              curFolder === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground",
            )}
          >
            <button onClick={() => setCurFolder(f)} className={cn("pl-3.5 pr-1 h-8 text-[13px] font-body font-medium", curFolder !== f && "hover:text-foreground")}>
              {f}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 pr-2 pl-0.5 opacity-70 hover:opacity-100" aria-label={`Opções da pasta ${f}`}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setRenameFolder({ from: f, value: f })}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear pasta
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelFolder(f)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir pasta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <span className="text-[11px] font-body text-muted-foreground inline-flex items-center gap-1">
          <FolderOpen className="h-3.5 w-3.5" /> pasta se define ao salvar o roteiro
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 text-primary mx-auto animate-spin" /></div>
        ) : roteirosVisiveis.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Clapperboard className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">
              {curFolder === "all" ? "Nenhum roteiro aqui ainda" : `Nada na pasta "${curFolder}"`}
            </p>
            <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Crie um roteiro do zero, ou gere um no Cria IA / Cria Stories e mande pra cá. Depois é só tocar em Gravar e ler olhando pra câmera.
            </p>
            <Button className="mt-4" onClick={() => setEditor({ open: true, title: "", script: "", folder: curFolder === "all" ? "" : curFolder })}>
              <Plus className="h-4 w-4 mr-1.5" /> Criar o primeiro
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roteirosVisiveis.map((s) => cardDoRoteiro(s, "biblioteca"))}
          </div>
        )}
      </div>
      </>)}

      {/* Como funciona */}
      <div data-tour="prompter-voz" className="mt-8 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground">Como usar na gravação</h2>
        </div>
        {/* 25/10/2026: o modo por voz voltou a seguir palavra por palavra, pela
            transcrição na nuvem (edge prompter-voz + vozNuvem.ts), que usa o
            mesmo microfone da gravação. Sem conexão, cai no modo por volume. */}
        <ul className="text-[13px] font-body text-muted-foreground leading-relaxed space-y-1.5">
          <li><span className="font-semibold text-foreground">Por voz:</span> o texto segue as suas palavras, inclusive gravando no iPhone. Pulou um trecho ou voltou pra repetir, ele acha. Sem internet, anda enquanto você fala e para quando você para.</li>
          <li><span className="font-semibold text-foreground">Rolagem:</span> anda sozinho na velocidade que você escolhe no − / + da lateral (em palavras por minuto).</li>
          <li><span className="font-semibold text-foreground">Toque no texto</span> pra pausar e continuar. As setas ← → pulam de cena num teclado ou controle Bluetooth.</li>
          <li>
            No roteiro: <span className="font-semibold text-foreground">**trecho**</span> destaca na cor da marca,{" "}
            <span className="font-semibold text-foreground">[pausa]</span> marca uma respirada, uma linha{" "}
            <span className="font-semibold text-foreground">Cena 2:</span> vira título de cena e uma linha{" "}
            <span className="font-semibold text-foreground">[close no rosto]</span> vira direção (aparece, mas não é pra ler).
          </li>
        </ul>
      </div>

      {/* Editor */}
      <Dialog open={editor.open} onOpenChange={(o) => { if (!o) setEditor({ open: false }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editor.open && editor.id ? "Editar roteiro" : "Novo roteiro"}</DialogTitle>
          </DialogHeader>
          {editor.open && (
            <div className="space-y-3">
              <Input
                placeholder="Título do roteiro"
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              />
              <div>
                <Input
                  list="prompter-folders"
                  placeholder="Pasta (opcional) digite pra criar uma nova"
                  value={editor.folder}
                  onChange={(e) => setEditor({ ...editor, folder: e.target.value })}
                />
                <datalist id="prompter-folders">
                  {folders.map((f) => <option key={f} value={f} />)}
                </datalist>
              </div>
              <Textarea
                placeholder="Cole ou escreva seu roteiro aqui..."
                value={editor.script}
                onChange={(e) => setEditor({ ...editor, script: e.target.value })}
                className="min-h-[200px] font-body text-[15px] leading-relaxed"
              />
              <p className="text-[11px] font-body text-muted-foreground">
                {wordCount(editor.script)} palavras · ~{Math.max(1, Math.ceil(wordCount(editor.script) / 140))} min a 140 wpm ·
                Dica: <b>**destaque**</b> e <b>[pausa]</b>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor({ open: false })}>Cancelar</Button>
            <Button onClick={salvar} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear pasta */}
      <Dialog open={!!renameFolder} onOpenChange={(o) => { if (!o) setRenameFolder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Renomear pasta</DialogTitle>
          </DialogHeader>
          <Input
            value={renameFolder?.value ?? ""}
            onChange={(e) => renameFolder && setRenameFolder({ ...renameFolder, value: e.target.value })}
            placeholder="Nome da pasta"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolder(null)}>Cancelar</Button>
            <Button
              disabled={!renameFolder?.value.trim() || renameFolderMut.isPending}
              onClick={() => {
                if (!renameFolder) return;
                const to = renameFolder.value.trim();
                renameFolderMut.mutate({ from: renameFolder.from, to }, {
                  onSuccess: () => { if (curFolder === renameFolder.from) setCurFolder(to); setRenameFolder(null); },
                });
              }}
            >
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de pasta */}
      <AlertDialog open={!!confirmDelFolder} onOpenChange={(o) => { if (!o) setConfirmDelFolder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir a pasta "{confirmDelFolder}"?</AlertDialogTitle>
            <AlertDialogDescription>Os roteiros não são apagados: eles voltam pra "Todos".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelFolder) {
                  delFolderMut.mutate(confirmDelFolder);
                  if (curFolder === confirmDelFolder) setCurFolder("all");
                }
                setConfirmDelFolder(null);
              }}
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão de roteiro */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir "{confirmDel?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>O roteiro some da biblioteca. Isso não apaga vídeos já gravados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDel) delMut.mutate(confirmDel.id); setConfirmDel(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
