import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, KanbanSquare, Check } from "lucide-react";
import { useKanbanImport, type KanbanPost, type DestinoImport } from "@/hooks/useKanbanImport";
import { parseDateOnly } from "@/lib/date-br";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";
import { getThumbnailUrl } from "@/lib/driveMedia";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PUXAR DO KANBAN DO CLIENTE (Walter, 06/11/2026; mockup aprovado)

   A social mídia cria post no kanban do cliente (numa reunião, por exemplo) e
   precisa mandar pra aprovação sem recriar. Abre em "Criados por você" (quem
   da agência criou, não o cliente) e nos últimos 30 dias. Marca vários e
   escolhe: só puxar (Em produção) ou puxar e mandar pro link do cliente.
   "Dispensar" tira da lista sem importar (fica guardado neste aparelho).
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s.label]));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDate(d: string | null): string {
  if (!d) return "sem data";
  return parseDateOnly(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diasDesde(iso: string | null): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const chaveDispensa = (cliente: string) => `kanban_dispensados_${cliente}`;
function lerDispensados(cliente: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(chaveDispensa(cliente)) || "[]") as string[]); } catch { return new Set(); }
}
function gravarDispensados(cliente: string, s: Set<string>) {
  try { localStorage.setItem(chaveDispensa(cliente), JSON.stringify([...s])); } catch { /* sem storage */ }
}

/** Quantos posts criados pela agência, nos últimos 30 dias, ainda não foram puxados nem dispensados. */
export function contarPraPuxar(kanban: KanbanPost[], externalClientId: string): number {
  const disp = lerDispensados(externalClientId);
  return kanban.filter((p) => p.criado_pela_agencia && !p.ja_importado && !disp.has(p.id) && diasDesde(p.created_at) <= 30).length;
}

export function ImportKanbanDialog({ open, onOpenChange, externalClientId, criaOwnerId, nomeCliente }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  externalClientId: string;
  criaOwnerId: string | null;
  nomeCliente?: string | null;
  /** Mantido por compatibilidade; a marcação "já puxado" agora vem do banco. */
  existingTitles?: Set<string>;
}) {
  const { kanban, isLoading, isError, importPosts } = useKanbanImport(criaOwnerId, externalClientId);
  const [quem, setQuem] = useState<"agencia" | "todos">("agencia");
  const [periodo, setPeriodo] = useState<30 | 90 | 0>(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispensados, setDispensados] = useState<Set<string>>(() => lerDispensados(externalClientId));

  useEffect(() => {
    if (open) { setSelected(new Set()); setQuem("agencia"); setPeriodo(30); setDispensados(lerDispensados(externalClientId)); }
  }, [open, externalClientId]);

  const noPeriodo = (p: KanbanPost) => periodo === 0 || diasDesde(p.created_at) <= periodo;
  const daAgencia = useMemo(() => kanban.filter((p) => p.criado_pela_agencia), [kanban]);
  const base = quem === "agencia" ? daAgencia : kanban;
  const visiveis = base.filter(noPeriodo);
  const foraDoPeriodo = base.length - visiveis.length;

  const toggle = (id: string) => {
    if (dispensados.has(id)) return;
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const dispensar = (id: string) => {
    setDispensados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      gravarDispensados(externalClientId, n);
      return n;
    });
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const puxar = async (destino: DestinoImport) => {
    const posts = kanban.filter((p) => selected.has(p.id));
    if (!posts.length) return;
    try {
      await importPosts.mutateAsync({ posts, destino });
      setSelected(new Set());
      onOpenChange(false);
    } catch { /* o toast de erro já saiu no hook */ }
  };

  const n = selected.size;
  const contagem = (lista: KanbanPost[]) => lista.filter(noPeriodo).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-lg rounded-3xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="font-display text-xl">Puxar do kanban {nomeCliente ? `de ${nomeCliente}` : "do cliente"}</DialogTitle>
            <DialogDescription className="font-body text-[13px]">
              Vêm com título, legenda, roteiro, data e mídias. O kanban do cliente continua igual.
            </DialogDescription>
          </DialogHeader>

          {criaOwnerId && !isLoading && !isError && kanban.length > 0 && (
            <>
              <div className="flex rounded-full bg-muted p-1 mt-3">
                {([["agencia", `Criados por você · ${contagem(daAgencia)}`], ["todos", `Todos do kanban · ${contagem(kanban)}`]] as const).map(([k, rot]) => (
                  <button key={k} type="button" onClick={() => setQuem(k)}
                    className={cn("flex-1 rounded-full py-2 text-[13px] font-body font-bold transition-colors",
                      quem === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>{rot}</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[12px] font-body font-semibold text-muted-foreground mr-0.5">Período</span>
                {([[30, "30 dias"], [90, "90 dias"], [0, "Tudo"]] as const).map(([v, rot]) => (
                  <button key={v} type="button" onClick={() => setPeriodo(v)}
                    className={cn("rounded-full border px-3 py-1 text-[12px] font-body font-bold transition-colors",
                      periodo === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>{rot}</button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-[120px]">
          {!criaOwnerId ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><KanbanSquare className="h-5 w-5 text-muted-foreground" /></div>
              <p className="text-sm font-body text-foreground font-medium">Este cliente não tem conta no Cria vinculada</p>
              <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">Vincule a conta dele no cadastro do cliente (botão Editar) pra puxar os posts do kanban.</p>
            </div>
          ) : isLoading ? (
            <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
          ) : isError ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-body text-foreground font-medium">Não deu pra carregar o kanban do cliente</p>
              <p className="text-xs text-muted-foreground font-body mt-1">Confira se você ainda gerencia esta conta e tente de novo.</p>
            </div>
          ) : visiveis.length === 0 ? (
            <p className="text-center text-[13px] font-body text-muted-foreground py-8">
              {quem === "agencia" ? "Nada criado por você no kanban dele nesse período." : "O kanban está vazio nesse período."}
            </p>
          ) : (
            <div className="space-y-2">
              {visiveis.map((p) => {
                const sel = selected.has(p.id);
                const disp = dispensados.has(p.id);
                const thumb = p.media?.[0] ? getThumbnailUrl(p.media[0], 160) : null;
                const st = p.status ?? "ideia";
                return (
                  <div key={p.id} role="button" tabIndex={0} onClick={() => toggle(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(p.id); } }}
                    className={cn("flex items-start gap-2.5 rounded-2xl border bg-card p-2.5 transition-colors cursor-pointer",
                      sel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40", disp && "opacity-45 cursor-default")}>
                    <span className={cn("mt-0.5 grid place-items-center h-[22px] w-[22px] rounded-md border-2 shrink-0",
                      sel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
                      {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="h-14 w-11 rounded-lg bg-muted shrink-0 overflow-hidden">
                      {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-[14px] leading-snug">{p.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[FORMAT_LABELS[p.format] ?? cap(p.format), STATUS_LABELS[st] ?? cap(st), fmtDate(p.scheduled_date),
                          ...(p.media?.length ? [`${p.media.length} ${p.media.length === 1 ? "mídia" : "mídias"}`] : [])].map((t) => (
                          <span key={t} className="text-[10.5px] font-body font-bold rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{t}</span>
                        ))}
                        {p.created_by ? (
                          <span className={cn("text-[10.5px] font-body font-bold rounded-full px-2 py-0.5",
                            p.criado_pela_agencia ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-700")}>
                            criado por {p.criado_pela_agencia ? (p.criado_por_nome?.split(" ")[0] ?? "você") : "o cliente"}
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">criado antes</span>
                        )}
                        {p.ja_importado && <span className="text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-green-100 text-green-700">já está no Cria Post</span>}
                      </div>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); dispensar(p.id); }}
                      className="shrink-0 text-[12px] font-body font-semibold text-muted-foreground hover:text-foreground px-1">
                      {disp ? "Voltar" : "Dispensar"}
                    </button>
                  </div>
                );
              })}
              {foraDoPeriodo > 0 && periodo !== 0 && (
                <p className="text-center text-[12.5px] font-body text-muted-foreground pt-1">
                  {foraDoPeriodo} mais {foraDoPeriodo === 1 ? "antigo" : "antigos"} fora do período.{" "}
                  <button type="button" onClick={() => setPeriodo(0)} className="text-primary font-bold">Ver tudo</button>
                </p>
              )}
            </div>
          )}
        </div>

        {criaOwnerId && kanban.length > 0 && (
          <div className="border-t border-border px-5 pt-3 pb-4 space-y-2">
            <p className="text-[13px] font-body font-semibold">{n ? `${n} ${n === 1 ? "selecionado" : "selecionados"}` : "Nenhum selecionado"}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full h-11" disabled={!n || importPosts.isPending} onClick={() => void puxar("producao")}>Só puxar</Button>
              <Button className="flex-1 rounded-full h-11" disabled={!n || importPosts.isPending} onClick={() => void puxar("aprovacao")}>
                {importPosts.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Puxar e mandar pra aprovação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

