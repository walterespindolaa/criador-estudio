import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CalendarDays, Image as ImageIcon, KanbanSquare } from "lucide-react";
import { useKanbanImport, type KanbanPost } from "@/hooks/useKanbanImport";
import { parseDateOnly } from "@/lib/date-br";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATUS_CLS: Record<string, string> = {
  ideia: "bg-muted text-muted-foreground",
  roteiro: "bg-blue-100 text-blue-700",
  gravando: "bg-pink-100 text-primary",
  editando: "bg-green-100 text-green-700",
  agendado: "bg-amber-100 text-amber-700",
  publicado: "bg-slate-200 text-slate-600",
};
const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s.label]));

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return parseDateOnly(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ImportKanbanDialog({ open, onOpenChange, externalClientId, criaOwnerId, existingTitles }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  externalClientId: string;
  criaOwnerId: string | null;
  existingTitles?: Set<string>;
}) {
  const { kanban, isLoading, isError, importPosts } = useKanbanImport(criaOwnerId, externalClientId);
  // Prioriza o que está pronto pra aprovação: Pronto (editando) e Agendado.
  const [statusFilter, setStatusFilter] = useState<string[]>(["editando", "agendado"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) { setSelected(new Set()); setStatusFilter(["editando", "agendado"]); }
  }, [open]);

  const visible = useMemo(
    () => (statusFilter.length === 0 ? kanban : kanban.filter((p) => statusFilter.includes(p.status ?? "ideia"))),
    [kanban, statusFilter]
  );

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleStatus = (key: string) => setStatusFilter((prev) =>
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  );
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
    else visible.forEach((p) => next.add(p.id));
    return next;
  });

  const doImport = async () => {
    const posts = kanban.filter((p) => selected.has(p.id));
    if (!posts.length) return;
    try {
      await importPosts.mutateAsync(posts);
      setSelected(new Set());
      onOpenChange(false);
    } catch {
      // O toast de erro já foi mostrado pelo hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Importar do kanban</DialogTitle>
          <DialogDescription className="font-body">
            Traz os posts prontos do CRIA do cliente pra cá, sem subir nada de novo: título, legenda, roteiro, data e mídias vêm juntos.
          </DialogDescription>
        </DialogHeader>

        {!criaOwnerId ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><KanbanSquare className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-body text-foreground font-medium">Este cliente não tem conta CRIA vinculada</p>
            <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">
              A importação puxa os posts do kanban da conta CRIA do cliente. Vincule a conta dele no cadastro central (botão Editar do cliente) pra usar este atalho.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-body text-foreground font-medium">Não deu pra carregar o kanban do cliente</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Confira se você ainda gerencia esta conta e tente de novo.</p>
          </div>
        ) : kanban.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-body text-foreground font-medium">O kanban deste cliente está vazio</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Quando houver posts no Criando, eles aparecem aqui pra importar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Filtro por status */}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setStatusFilter([])}
                className={`rounded-full border text-xs px-2.5 py-1 transition-colors ${statusFilter.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                Todos
              </button>
              {STATUS_OPTIONS.map((s) => (
                <button key={s.key} type="button" onClick={() => toggleStatus(s.key)}
                  className={`rounded-full border text-xs px-2.5 py-1 transition-colors ${statusFilter.includes(s.key) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-body">{visible.length} {visible.length === 1 ? "post" : "posts"} no filtro</p>
              {visible.length > 0 && (
                <button type="button" onClick={toggleAllVisible} className="text-xs font-body font-semibold text-primary hover:underline">
                  {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              )}
            </div>

            <ScrollArea className="max-h-[45vh] pr-2">
              {visible.length === 0 ? (
                <p className="text-xs text-muted-foreground font-body text-center py-8">Nenhum post nesse filtro. Ajuste os status acima.</p>
              ) : (
                <div className="space-y-2">
                  {visible.map((p: KanbanPost) => {
                    const st = p.status ?? "ideia";
                    const date = fmtDate(p.scheduled_date);
                    const dup = existingTitles?.has(p.title);
                    return (
                      <div key={p.id} onClick={() => toggle(p.id)} role="button" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(p.id); } }}
                        className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-colors cursor-pointer ${selected.has(p.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display font-bold text-sm text-foreground truncate">{p.title}</p>
                            {dup && <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">já existe aqui</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                            {cap(p.platform)} · {FORMAT_LABELS[p.format] ?? cap(p.format)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge className={`text-[10px] font-body font-bold px-2 py-0.5 rounded-full border-0 pointer-events-none ${STATUS_CLS[st] ?? STATUS_CLS.ideia}`}>{STATUS_LABELS[st] ?? cap(st)}</Badge>
                            {date && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-body"><CalendarDays className="h-3 w-3" /> {date}</span>}
                            {p.media.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-body"><ImageIcon className="h-3 w-3" /> {p.media.length} {p.media.length === 1 ? "mídia" : "mídias"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {criaOwnerId && kanban.length > 0 && (
            <Button onClick={doImport} disabled={selected.size === 0 || importPosts.isPending}>
              {importPosts.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Importar {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? "selecionado" : "selecionados"}` : "selecionados"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
