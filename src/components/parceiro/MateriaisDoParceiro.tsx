import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { brlReais } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { MaterialAbertoDialog } from "@/components/parceiro/MaterialAbertoDialog";
import { TIPO_MATERIAL, useMateriaisDoParceiro, type MaterialDaFila } from "@/hooks/useMaterialParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MATERIAIS NA TELA DO PARCEIRO (29/09/2026)

   Apresentação, cartão de visita, flyer: trabalho que não é post e por isso
   não cabe na fila por prazo nem no quadro de etapas (que são de posts, com
   data de postagem e formato de feed). Fica numa faixa própria em cima, só
   quando existe, pra não empurrar a fila de posts pra baixo sem motivo.

   `?material=<id>` (vindo do sino) abre o card direto e some da URL, como o
   `?post=` da fila.
   ═══════════════════════════════════════════════════════════════════════════ */

const ETAPA: Record<string, { txt: string; cls: string }> = {
  aguardando: { txt: "Novo", cls: "bg-foreground text-background" },
  em_producao: { txt: "Fazendo", cls: "bg-blue-100 text-blue-700" },
  ajuste: { txt: "Ajuste", cls: "bg-violet-100 text-violet-700" },
  entregue: { txt: "Entregue", cls: "bg-green-100 text-green-700" },
};

function rotuloPrazo(prazo: string | null, hoje: string) {
  if (!prazo) return { txt: "prazo a combinar", cls: "text-muted-foreground" };
  const [, m, d] = prazo.split("-");
  const br = `${d}/${m}`;
  if (prazo < hoje) return { txt: `atrasado · ${br}`, cls: "bg-red-600 text-white px-2 py-0.5 rounded-full font-bold" };
  if (prazo === hoje) return { txt: "vence hoje", cls: "bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold" };
  return { txt: `prazo ${br}`, cls: "text-muted-foreground" };
}

export function MateriaisDoParceiro({ hoje, soAgencia }: { hoje: string; soAgencia?: string | null }) {
  const { data = [] } = useMateriaisDoParceiro();
  const [aberto, setAberto] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const id = params.get("material");
    if (!id) return;
    setAberto(id);
    const limpo = new URLSearchParams(params);
    limpo.delete("material");
    setParams(limpo, { replace: true });
  }, [params, setParams]);

  const lista = (soAgencia ? data.filter((m) => m.agencia_id === soAgencia) : data);
  const abertos = lista.filter((m) => m.producao_status !== "entregue");
  const entregues = lista.filter((m) => m.producao_status === "entregue");

  const linha = (m: MaterialDaFila) => {
    const p = rotuloPrazo(m.prazo_producao, hoje);
    return (
      <button key={m.material_id} type="button" onClick={() => setAberto(m.material_id)}
        className={cn("w-full flex items-center gap-3.5 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
          m.producao_status === "entregue" && "opacity-70")}>
        <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden"
          style={{ background: m.cliente_cor || "#7C90F0" }}>
          {m.cliente_logo ? <img src={m.cliente_logo} alt="" className="w-full h-full object-cover" /> : (m.cliente_nome || "C").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-[14px] leading-tight truncate">{m.titulo}</span>
          <span className="flex items-center gap-2 mt-1 flex-wrap text-[12px] font-body">
            <span className="font-semibold text-foreground/85 truncate">{m.cliente_nome}</span>
            <span className="text-muted-foreground">via {m.agencia_nome}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">{TIPO_MATERIAL[m.tipo ?? ""] ?? "Material"}</span>
            {m.cache != null && Number(m.cache) > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{brlReais(Number(m.cache))}</span>
            )}
            {m.revisoes > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{m.revisoes}ª rev.</span>}
            {m.producao_status !== "entregue" && (
              <span className={cn("inline-flex items-center gap-1 text-[11px]", p.cls)}><Clock className="h-3 w-3" /> {p.txt}</span>
            )}
          </span>
        </span>
        <span className={cn("shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-full", ETAPA[m.producao_status]?.cls)}>
          {ETAPA[m.producao_status]?.txt ?? "Novo"}
        </span>
      </button>
    );
  };

  return (
    <>
      {lista.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-2.5 mb-2 px-0.5">
            <h2 className="font-display font-bold text-[15px] text-foreground flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" /> Materiais
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
              {abertos.length} na mão
            </span>
            <span className="text-[11.5px] font-body text-muted-foreground hidden sm:inline">apresentação, flyer, cartão e outras peças fora do feed</span>
          </div>
          <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
            {abertos.map(linha)}
            {entregues.map(linha)}
          </Card>
        </section>
      )}
      <MaterialAbertoDialog materialId={aberto} aoFechar={() => setAberto(null)} />
    </>
  );
}
