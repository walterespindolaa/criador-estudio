import { useState } from "react";
import { Send, Link2, Check, Loader2, Trash2, Clock, MessageSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import {
  useClientIntakes, useCreateClientIntake, useApplyClientIntake, useDeleteClientIntake,
  type ClientIntake,
} from "@/hooks/useClientIntakes";
import { ETAPAS_INTAKE, CAMPOS_CADASTRO, quantasRespondidas, TODOS_CAMPOS_INTAKE } from "@/lib/formularioCadastro";

/* ═══════════════════════════════════════════════════════════════════════════
   PEDIR OS DADOS PRO CLIENTE

   Gera o link, acompanha, e aplica o que voltou na ficha. A aplicação é
   conservadora de propósito: preenche só o que está VAZIO. O cliente escreve a
   razão social de um jeito, a social mídia já tinha ajustado de outro, e o
   formulário não pode desfazer isso calado. Quando ela quiser mesmo trocar,
   existe o botão de sobrescrever.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LinkCadastroCliente({ crmClientId, clienteNome }: { crmClientId: string; clienteNome: string }) {
  const { data: envios = [] } = useClientIntakes(crmClientId);
  const criar = useCreateClientIntake();
  const aplicar = useApplyClientIntake();
  const excluir = useDeleteClientIntake();
  const [vendo, setVendo] = useState<ClientIntake | null>(null);

  const linkDe = (t: string) => `${window.location.origin}/cadastro/${t}`;

  const copiar = async (t: string) => {
    const url = linkDe(t);
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado! Mande pro cliente."); }
    catch { toast.error("Copie manualmente: " + url); }
  };

  const gerar = async () => {
    try {
      const i = await criar.mutateAsync(crmClientId);
      await copiar(i.token);
    } catch { /* o hook já avisa */ }
  };

  const aberto = envios.find((e) => e.status === "aberto");
  const voltou = envios.filter((e) => e.status === "enviado");

  return (
    <>
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
        <div className="flex items-start gap-2.5 flex-wrap">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Send className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-display font-bold text-foreground">Peça os dados pro cliente</p>
            <p className="text-[11.5px] font-body text-muted-foreground mt-0.5 leading-relaxed">
              Um link onde ele preenche CNPJ, razão social, endereço, responsável e já conta do negócio dele.
              Valor, vencimento e multa não aparecem: isso continua sendo só seu.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {aberto ? (
              <Button size="sm" variant="outline" onClick={() => void copiar(aberto.token)} className="rounded-xl h-9">
                <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copiar o link
              </Button>
            ) : (
              <Button size="sm" onClick={() => void gerar()} disabled={criar.isPending} className="rounded-xl h-9">
                {criar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Gerar o link
              </Button>
            )}
          </div>
        </div>

        {envios.length > 0 && (
          <div className="mt-3 space-y-2">
            {envios.map((e) => {
              const chegou = e.status === "enviado";
              const feito = e.status === "aplicado";
              const n = quantasRespondidas((e.answers ?? {}) as Record<string, string>);
              return (
                <div key={e.id}
                  className={cn("flex items-center gap-2.5 rounded-xl border p-2.5 flex-wrap",
                    chegou ? "border-primary/40 bg-card" : "border-border bg-card")}>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    chegou ? "bg-primary text-primary-foreground" : feito ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                    {chegou ? <MessageSquare className="h-3.5 w-3.5" /> : feito ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-body font-semibold text-foreground">
                      {chegou ? "O cliente respondeu" : feito ? "Respostas aplicadas na ficha" : "Aguardando o cliente"}
                    </p>
                    <p className="text-[11px] font-body text-muted-foreground">
                      {n} de {TODOS_CAMPOS_INTAKE.length} respostas
                      {e.submitted_at && ` · ${new Date(e.submitted_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <Button size="sm" variant={chegou ? "default" : "outline"} className="rounded-lg h-8"
                    onClick={() => setVendo(e)}>
                    {chegou ? "Ver e aplicar" : "Ver respostas"}
                  </Button>
                  {!feito && (
                    <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => void copiar(e.token)}>
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <button type="button" aria-label="Excluir este formulário" title="Excluir este formulário"
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: "Excluir este formulário?",
                        descricao: "O link para de funcionar e as respostas são apagadas. A ficha do cliente não muda.",
                        acao: "Excluir",
                      });
                      if (ok) excluir.mutate(e.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {voltou.length > 0 && (
          <p className="mt-2 text-[11.5px] font-body text-primary font-semibold">
            Confira as respostas antes de aplicar: só o que estiver vazio na ficha é preenchido.
          </p>
        )}
      </div>

      <Dialog open={!!vendo} onOpenChange={(o) => { if (!o) setVendo(null); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">O que {clienteNome} respondeu</DialogTitle>
            <DialogDescription className="font-body">
              Aplicar preenche só os campos que estão vazios na ficha. O que você já escreveu fica como está.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {ETAPAS_INTAKE.map((et) => {
              const respondidos = et.campos.filter((c) => ((vendo?.answers ?? {})[c.chave] || "").trim());
              if (respondidos.length === 0) return null;
              return (
                <div key={et.titulo} className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-body font-bold uppercase tracking-wider text-primary mb-2">{et.titulo}</p>
                  <div className="space-y-2">
                    {respondidos.map((c) => (
                      <div key={c.chave}>
                        <p className="text-[11px] font-body font-semibold text-muted-foreground flex items-center gap-1.5">
                          {c.label}
                          {CAMPOS_CADASTRO.has(c.chave) && (
                            <span className="text-[9.5px] font-bold uppercase text-primary/70">cadastro</span>
                          )}
                        </p>
                        <p className="text-[12.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed">
                          {(vendo?.answers ?? {})[c.chave]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {vendo?.status !== "aplicado" && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button className="rounded-xl flex-1" disabled={aplicar.isPending}
                onClick={() => { if (vendo) aplicar.mutate({ id: vendo.id }, { onSuccess: () => setVendo(null) }); }}>
                {aplicar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1.5" />}
                Aplicar na ficha
              </Button>
              <Button variant="outline" className="rounded-xl" disabled={aplicar.isPending}
                title="Substitui também o que já está preenchido na ficha"
                onClick={async () => {
                  const ok = await confirmar({
                    titulo: "Substituir o que já existe?",
                    descricao: "Os campos que você preencheu na mão serão trocados pelas respostas do cliente.",
                    acao: "Substituir",
                  });
                  if (ok && vendo) aplicar.mutate({ id: vendo.id, sobrescrever: true }, { onSuccess: () => setVendo(null) });
                }}>
                Substituir tudo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
