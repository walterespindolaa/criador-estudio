import { Check, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBioBlocks } from "@/hooks/useBioBlocks";
import { FormBloco } from "@/components/bio/EditorBlocos";
import { foneWhats, telefoneDaPagina } from "@/lib/bioLoja";
import { txt } from "@/lib/bioBlocks";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 1 · SEU NEGÓCIO (22/10/2026)

   Nome, WhatsApp, e-mail, endereço e Instagram, preenchidos UMA vez. Moram no
   bloco Contato (que também é o rodapé), e é dali que pedido, botão fixo,
   serviços e chamada final pegam o WhatsApp quando não têm um próprio. Antes
   isso estava espalhado: cada seção pedia o telefone de novo.
   ═══════════════════════════════════════════════════════════════════════════ */

export function PassoNegocio({ slugPublico, aoIrSecoes }: { slugPublico?: string | null; aoIrSecoes: () => void }) {
  const { blocos, isLoading, criar, atualizar } = useBioBlocks("site");
  const contato = blocos.find((b) => b.kind === "contato" && b.is_active) ?? blocos.find((b) => b.kind === "contato") ?? null;
  const tel = telefoneDaPagina(blocos);
  const usa = [
    { kind: "cardapio", nome: "Pedidos do cardápio" },
    { kind: "acao_fixa", nome: "Botão fixo" },
    { kind: "servicos", nome: "Botão de cada serviço" },
    { kind: "chamada", nome: "Chamada final" },
    { kind: "destaque", nome: "Destaque da semana" },
  ].filter((u) => blocos.some((b) => b.kind === u.kind && b.is_active));

  if (isLoading) return <p className="text-sm font-body text-muted-foreground py-8 text-center">Carregando...</p>;

  if (!contato) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
        <Store className="h-6 w-6 text-primary mx-auto" />
        <p className="text-sm font-body font-medium">Comece pelos dados do negócio</p>
        <p className="text-xs font-body text-muted-foreground max-w-sm mx-auto">
          Nome, WhatsApp, e-mail e endereço. Você preenche uma vez e eles aparecem em todas as seções que precisam, e no rodapé.
        </p>
        <Button size="sm" disabled={criar.isPending} onClick={() => criar.mutate("contato")}>
          {criar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Preencher meus dados
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] font-body text-muted-foreground leading-snug">
        Preenche uma vez e aparece em todas as seções que precisam. Tudo salva sozinho.
      </p>
      <div className="rounded-2xl border border-border bg-card p-4">
        <FormBloco bloco={contato} salvar={(data) => atualizar.mutate({ id: contato.id, patch: { data } })} slugPublico={slugPublico} />
        <label className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border/60 cursor-pointer">
          <span className="text-[12.5px] font-body">
            <b className="block font-semibold">Mostrar o rodapé com esses dados</b>
            <span className="text-muted-foreground">Desligado, os dados continuam valendo pros botões.</span>
          </span>
          <Switch checked={contato.is_active} onCheckedChange={(v) => atualizar.mutate({ id: contato.id, patch: { is_active: v } })} />
        </label>
      </div>

      <div className={cn("rounded-2xl px-4 py-3 text-[12.5px] font-body leading-snug",
        foneWhats(tel) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900")}>
        {foneWhats(tel) ? (
          <>
            <p className="font-semibold mb-1">O WhatsApp {tel} vale pra:</p>
            {usa.length ? (
              <ul className="space-y-0.5">
                {usa.map((u) => <li key={u.kind} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" aria-hidden />{u.nome}</li>)}
              </ul>
            ) : <p>Os botões de WhatsApp que você adicionar nas seções.</p>}
            <p className="mt-1.5 opacity-80">Uma seção com número próprio usa o dela.</p>
          </>
        ) : (
          <p><b>Falta o WhatsApp.</b> Sem ele, pedido, botão fixo e serviços não têm pra onde mandar a pessoa.</p>
        )}
      </div>

      {txt(contato.data ?? {}, "titulo").trim() && foneWhats(tel) && (
        <Button type="button" onClick={aoIrSecoes} className="w-full sm:w-auto">Próximo: as seções da página →</Button>
      )}
    </div>
  );
}
