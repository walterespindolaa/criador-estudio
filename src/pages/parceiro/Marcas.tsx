import { Layers, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROTULO_PAPEL, useMinhasAgencias } from "@/hooks/useParceiro";

/* Quem acoplou o parceiro, com a carga e as entregas de cada relação. É o "com
   quem eu trabalho" que faltava na área dele, e a tela que vira a base do
   relatório de cobrança da fase 3. */

export default function Marcas() {
  const { data: agencias = [], isLoading } = useMinhasAgencias();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center shadow-sm shrink-0">
          <Layers className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Marcas que atendo</h1>
          <p className="text-muted-foreground font-body mt-0.5 text-sm">
            As agências e social mídias que te acoplaram, e o trabalho em cada uma.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : agencias.length === 0 ? (
        <Card className="p-10 rounded-2xl border-dashed text-center">
          <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
            Nenhuma agência te acoplou ainda. Quando uma social mídia te convidar como parceiro,
            ela aparece aqui e os posts dela caem em Minhas demandas.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {agencias.map((a) => (
            <Card key={a.agencia_id} className="rounded-2xl border-border p-5">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white grid place-items-center font-display font-bold shrink-0">
                  {a.agencia_nome.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-display font-bold text-[15px] text-foreground truncate">{a.agencia_nome}</span>
                  <span className="block text-xs font-body text-muted-foreground">
                    Você atende como {ROTULO_PAPEL[a.meu_papel] ?? a.meu_papel}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                  <p className="font-display font-extrabold text-lg leading-none">{a.abertos}</p>
                  <p className="text-[11px] font-body font-semibold text-muted-foreground mt-1">na sua mão agora</p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                  <p className="font-display font-extrabold text-lg leading-none text-green-700">{a.entregues_30d}</p>
                  <p className="text-[11px] font-body font-semibold text-green-800/70 mt-1">entregues em 30 dias</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
