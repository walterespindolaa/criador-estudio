import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, Clapperboard, FolderOpen, Kanban, Loader2, Mic, Pencil, Play, Plus, Sparkles, Trash2, Video,
} from "lucide-react";
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
  type PrompterScript,
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
  const { posts } = usePosts();
  const saveMut = useSavePrompterScript();
  const delMut = useDeletePrompterScript();
  const renameFolderMut = useRenamePrompterFolder();
  const delFolderMut = useDeletePrompterFolder();
  const sendPost = useSendPostToPrompter();

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
      { onSuccess: () => setEditor({ open: false }) },
    );
  };

  const wordCount = (s: string) => (s.trim().match(/\S+/g) || []).length;

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
        <Button data-tour="prompter-novo" onClick={() => setEditor({ open: true, title: "", script: "", folder: curFolder === "all" ? "" : curFolder })}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo roteiro
        </Button>
      </div>

      {/* Na fase Produzindo (espelho do Criando) */}
      {producing.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Kanban className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground">Na fase Produzindo</h2>
            <span className="text-xs font-body text-muted-foreground">seus posts prontos pra gravar, direto do Criando</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {producing.map((p) => {
              const spoken = postToSpokenScript(p);
              const words = wordCount(spoken);
              return (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-body font-semibold text-foreground leading-snug">{p.title}</p>
                    <span className="text-[10px] font-body font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground shrink-0 capitalize">
                      {p.format}
                    </span>
                  </div>
                  <p className="text-[13px] font-body text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 flex-1">
                    {spoken ? spoken.replace(/\*\*/g, "") : "Sem roteiro ainda: preencha gancho e roteiro no post."}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-body text-muted-foreground">
                      {spoken ? `${words} palavras · ~${Math.max(1, Math.ceil(words / 140))} min` : "roteiro vazio"}
                    </span>
                    <Button size="sm" className="h-8" disabled={sendingId === p.id} onClick={() => gravarPost(p)}>
                      {sendingId === p.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                      Gravar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pastas */}
      <div data-tour="prompter-pastas" className="mt-6 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCurFolder("all")}
          className={cn(
            "px-3.5 h-8 rounded-full text-[13px] font-body font-medium border transition-colors",
            curFolder === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Todos
        </button>
        {folders.map((f) => (
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

      {/* Lista */}
      <div data-tour="prompter-lista" className="mt-4">
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 text-primary mx-auto animate-spin" /></div>
        ) : visible.length === 0 ? (
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
            {visible.map((s) => {
              const words = wordCount(s.script);
              const srcLabel = SOURCE_LABEL[s.source];
              return (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-body font-semibold text-foreground leading-snug">{s.title}</p>
                    {srcLabel && (
                      <span className="text-[10px] font-body font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                        {srcLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-body text-muted-foreground mt-1.5 leading-relaxed line-clamp-3 flex-1">
                    {s.script.slice(0, 200) || "Roteiro vazio"}
                  </p>
                  <p className="text-[11px] font-body text-muted-foreground mt-2">
                    {words} palavras · ~{Math.max(1, Math.ceil(words / 140))} min a 140 wpm
                    {s.folder ? <> · <FolderOpen className="h-3 w-3 inline -mt-0.5" /> {s.folder}</> : null}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2">
                    <Button size="sm" className="h-8" onClick={() => gravar(s.id)}>
                      <Play className="h-3.5 w-3.5 mr-1.5" /> Gravar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => setEditor({ open: true, id: s.id, title: s.title, script: s.script, folder: s.folder ?? "" })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-destructive hover:text-destructive" onClick={() => setConfirmDel(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Como funciona */}
      <div data-tour="prompter-voz" className="mt-8 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground">Como funciona o modo Por voz</h2>
        </div>
        <p className="text-[13px] font-body text-muted-foreground leading-relaxed">
          Toque em Play e comece a ler em voz alta: o texto acompanha a sua fala palavra por palavra.
          Improvisou algo fora do roteiro? Ele espera. Voltou a ler? Continua do ponto certo.
          No roteiro, use <span className="font-semibold text-foreground">**trecho**</span> pra destacar em amarelo e{" "}
          <span className="font-semibold text-foreground">[pausa]</span> pra marcar uma pausa visual.
        </p>
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
