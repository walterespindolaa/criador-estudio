import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Clapperboard, Loader2, Mic, Pencil, Play, Plus, Sparkles, Trash2, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePrompterScripts, useSavePrompterScript, useDeletePrompterScript, type PrompterScript,
} from "@/hooks/usePrompterScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PROMPTER — BIBLIOTECA
   O roteiro nasce aqui (manual) ou chega pronto dos outros módulos (Criando /
   Cria Stories). "Gravar" abre o player fullscreen com teleprompter por voz.
   A trava de plano mora na rota (App.tsx → UpgradeGate feature="prompter").
   ═══════════════════════════════════════════════════════════════════════════ */

const SOURCE_LABEL: Record<PrompterScript["source"], string | null> = {
  manual: null, criando: "Em produção", stories: "Cria Stories", ia: "Cria IA",
};

type EditorState = { open: false } | { open: true; id?: string; title: string; script: string };

export default function CriaPrompter() {
  const navigate = useNavigate();
  const { data: scripts = [], isLoading } = usePrompterScripts();
  const saveMut = useSavePrompterScript();
  const delMut = useDeletePrompterScript();

  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [confirmDel, setConfirmDel] = useState<PrompterScript | null>(null);

  const gravar = (id: string) => navigate(`/app/prompter/gravar/${id}`);

  const salvar = () => {
    if (!editor.open) return;
    const title = editor.title.trim() || "Sem título";
    const script = editor.script;
    saveMut.mutate({ id: editor.id, title, script }, {
      onSuccess: (id) => {
        setEditor({ open: false });
        /* roteiro novo: já oferece gravar em seguida indo direto pro player? Não —
           deixa a pessoa na biblioteca com o card no topo. Gravar é 1 toque. */
        void id;
      },
    });
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
        <Button onClick={() => setEditor({ open: true, title: "", script: "" })}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo roteiro
        </Button>
      </div>

      {/* Lista */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 text-primary mx-auto animate-spin" /></div>
        ) : scripts.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Clapperboard className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">Nenhum roteiro aqui ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Crie um roteiro do zero, ou gere um no Cria IA / Cria Stories e mande pra cá. Depois é só tocar em Gravar e ler olhando pra câmera.
            </p>
            <Button className="mt-4" onClick={() => setEditor({ open: true, title: "", script: "" })}>
              <Plus className="h-4 w-4 mr-1.5" /> Criar o primeiro
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scripts.map((s) => {
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
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2">
                    <Button size="sm" className="h-8" onClick={() => gravar(s.id)}>
                      <Play className="h-3.5 w-3.5 mr-1.5" /> Gravar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => setEditor({ open: true, id: s.id, title: s.title, script: s.script })}>
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
      <div className="mt-8 bg-card border border-border rounded-2xl p-4">
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
              <Textarea
                placeholder="Cole ou escreva seu roteiro aqui..."
                value={editor.script}
                onChange={(e) => setEditor({ ...editor, script: e.target.value })}
                className="min-h-[220px] font-body text-[15px] leading-relaxed"
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

      {/* Confirmar exclusão */}
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
