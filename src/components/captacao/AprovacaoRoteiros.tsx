import { useState } from "react";
import { Send, Link2, Check, Loader2, Trash2, Clock, MessageSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import { cenasParaTexto, type CaptureScene, type CaptureScript } from "@/hooks/useCaptureScripts";
import {
  useScriptApprovals, useCreateScriptApproval, useApplyScriptApproval, useDeleteScriptApproval,
  mudancasDoItem, itemFoiTocado, type ScriptApproval, type ScriptApprovalItem,
} from "@/hooks/useScriptApprovals";

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIAR OS ROTEIROS PRO CLIENTE E RECEBER DE VOLTA

   O botão gera o link e copia. Quando o cliente finaliza, aparece aqui um
   painel com o que ele mudou, lado a lado com o texto original, e um botão que
   aplica tudo de uma vez no roteiro de verdade.
   ═══════════════════════════════════════════════════════════════════════════ */

const textoDe = (titulo: string | null, conteudo: string | null, cenas: CaptureScene[] | null) => {
  const c = Array.isArray(cenas) && cenas.length ? cenasParaTexto(cenas) : (conteudo ?? "");
  return c.trim();
};

export function BotaoEnviarAprovacao({
  month, crmClientId, clientName, roteiros, className,
}: {
  month: string;
  crmClientId?: string | null;
  clientName?: string | null;
  roteiros: CaptureScript[];
  className?: string;
}) {
  const criar = useCreateScriptApproval();

  const enviar = async () => {
    if (roteiros.length === 0) { toast.error("Escreva pelo menos um roteiro deste mês pra mandar pro cliente."); return; }
    try {
      const a = await criar.mutateAsync({ month, crmClientId, clientName, roteiros });
      const url = `${window.location.origin}/roteiros/${a.token}`;
      try { await navigator.clipboard.writeText(url); toast.success("Link copiado! Mande pro cliente revisar."); }
      catch { toast.success("Link gerado."); }
    } catch { /* o hook já avisa */ }
  };

  return (
    <Button size="sm" variant="outline" onClick={() => void enviar()} disabled={criar.isPending || roteiros.length === 0}
      className={cn("rounded-xl h-9", className)}
      title={roteiros.length === 0
        ? "Escreva pelo menos um roteiro deste mês."
        : `Gera um link onde o cliente lê os ${roteiros.length} roteiros, ajusta o texto e a ordem, e devolve pra você conferir.`}>
      {criar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
      Enviar pro cliente
    </Button>
  );
}

/** Painel dos envios: link aberto, revisão que voltou, e o histórico. */
export function PainelAprovacoes({
  month, crmClientId, clientName,
}: { month: string; crmClientId?: string | null; clientName?: string | null }) {
  const { data: envios = [] } = useScriptApprovals(month, crmClientId, clientName);
  const [vendo, setVendo] = useState<ScriptApproval | null>(null);
  const aplicar = useApplyScriptApproval();
  const excluir = useDeleteScriptApproval();

  if (envios.length === 0) return null;

  const copiarLink = async (a: ScriptApproval) => {
    const url = `${window.location.origin}/roteiros/${a.token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado."); }
    catch { toast.error("Copie manualmente: " + url); }
  };

  return (
    <>
      <div className="space-y-2">
        {envios.map((a) => {
          const mudou = (a.itens ?? []).filter(itemFoiTocado).length;
          const comentarios = (a.itens ?? []).filter((i) => !!i.client_comment?.trim()).length;
          const voltou = a.status === "enviado";
          const feito = a.status === "aplicado";
          return (
            <div key={a.id}
              className={cn("rounded-2xl border p-3.5",
                voltou ? "border-primary/40 bg-primary/5" : "border-border bg-card")}>
              <div className="flex items-start gap-2.5 flex-wrap">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                  voltou ? "bg-primary text-primary-foreground" : feito ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                  {voltou ? <MessageSquare className="h-4 w-4" /> : feito ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-display font-bold text-foreground">
                    {voltou ? "O cliente revisou os roteiros" : feito ? "Revisão aplicada" : "Aguardando o cliente"}
                  </p>
                  <p className="text-[11.5px] font-body text-muted-foreground mt-0.5">
                    {(a.itens ?? []).length} roteiro(s) enviados
                    {voltou && (mudou > 0 ? ` · ${mudou} com ajuste` : " · nada foi alterado")}
                    {comentarios > 0 && ` · ${comentarios} comentário(s)`}
                    {a.submitted_at && ` · devolvido em ${new Date(a.submitted_at).toLocaleDateString("pt-BR")}`}
                  </p>
                  {a.client_note && (
                    <p className="mt-1.5 text-[12px] font-body text-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                      Recado do cliente: {a.client_note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant={voltou ? "default" : "outline"} onClick={() => setVendo(a)}
                    className="rounded-xl h-8"
                    title="Abre o que o cliente escreveu: texto, ordem e comentários">
                    {voltou ? "Ver o que mudou" : feito ? "Ver a revisão" : "Acompanhar"}
                  </Button>
                  {!feito && (
                    <Button size="sm" variant="outline" onClick={() => void copiarLink(a)} className="rounded-xl h-8">
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Link
                    </Button>
                  )}
                  <button type="button" aria-label="Excluir este envio" title="Excluir este envio"
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: "Excluir este envio?",
                        descricao: "O link para de funcionar. Os roteiros não são afetados.",
                        acao: "Excluir",
                      });
                      if (ok) excluir.mutate(a.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!vendo} onOpenChange={(o) => { if (!o) setVendo(null); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {vendo?.status === "aberto" ? "O que o cliente já escreveu" : "O que o cliente mudou"}
            </DialogTitle>
            <DialogDescription className="font-body">
              {vendo?.status === "aberto"
                ? "O cliente ainda não finalizou: isto é o rascunho dele até agora. Dá pra aplicar assim mesmo se já estiver bom."
                : "Confirmando, o texto do cliente vira o texto oficial do roteiro. O que ele não tocou fica como está."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(vendo?.itens ?? [])
              .slice()
              .sort((a, b) => (a.client_position ?? a.position) - (b.client_position ?? b.position))
              .map((i, idx) => <LinhaDiff key={i.id} item={i} numero={idx + 1} />)}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {vendo?.status !== "aplicado" && (
              <Button className="rounded-xl flex-1" disabled={aplicar.isPending}
                onClick={() => { if (vendo) aplicar.mutate(vendo.id, { onSuccess: () => setVendo(null) }); }}>
                {aplicar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Confirmar e aplicar nos roteiros
              </Button>
            )}
            <Button variant="ghost" className="rounded-xl" onClick={() => setVendo(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinhaDiff({ item, numero }: { item: ScriptApprovalItem; numero: number }) {
  const m = mudancasDoItem(item);
  const antes = textoDe(item.orig_title, item.orig_content, item.orig_scenes);
  const depois = textoDe(item.client_title, item.client_content, item.client_scenes);
  const mudouTexto = m.texto || m.cenas;

  return (
    <div className={cn("rounded-xl border p-3", itemFoiTocado(item) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20")}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-display font-extrabold text-primary">{numero}</span>
        <span className="text-[13px] font-display font-bold text-foreground truncate">
          {item.client_title?.trim() || item.orig_title?.trim() || `Vídeo ${numero}`}
        </span>
        {m.removido && <Etiqueta tom="ruim">o cliente tirou este vídeo</Etiqueta>}
        {m.ordem && <Etiqueta>mudou de posição</Etiqueta>}
        {m.titulo && <Etiqueta>título</Etiqueta>}
        {mudouTexto && <Etiqueta>texto</Etiqueta>}
        {!itemFoiTocado(item) && <Etiqueta tom="neutro">sem alteração</Etiqueta>}
      </div>

      {item.client_comment && (
        <p className="mt-2 text-[12px] font-body text-foreground bg-card border border-border rounded-lg px-2.5 py-1.5 leading-relaxed">
          Comentário: {item.client_comment}
        </p>
      )}

      {mudouTexto && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1">Seu texto</p>
            <p className="text-[11.5px] font-body text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-[12] bg-card border border-border rounded-lg p-2">
              {antes || "(vazio)"}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[10px] font-body font-bold uppercase tracking-wider text-primary mb-1">
              <ArrowRight className="h-3 w-3" /> Como o cliente quer
            </p>
            <p className="text-[11.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed line-clamp-[12] bg-card border border-primary/30 rounded-lg p-2">
              {depois || "(vazio)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Etiqueta({ children, tom = "bom" }: { children: React.ReactNode; tom?: "bom" | "ruim" | "neutro" }) {
  return (
    <span className={cn("shrink-0 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-md",
      tom === "ruim" ? "bg-destructive/10 text-destructive"
        : tom === "neutro" ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary")}>
      {children}
    </span>
  );
}
