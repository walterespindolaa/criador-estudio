import { Loader2 } from "lucide-react";
import { useDecidirPortfolioCliente, usePedidosPortfolioDoCliente } from "@/hooks/usePortfolioCria";
import { cn } from "@/lib/utils";

/* PORTFÓLIO: O CLIENTE DECIDE (Walter, 30/10/2026, mockup aprovado).
   Aparece no link de aprovação quando a social mídia repassou o pedido de um
   parceiro pra mostrar uma peça no portfólio dele. Três escolhas, e dá pra
   mudar depois: tirando a autorização, a peça sai da página na hora. */

const OPCOES = [
  { v: "nao", rot: "Não mostrar" },
  { v: "sem_marca", rot: "Mostrar sem a minha marca" },
  { v: "com_marca", rot: "Mostrar com a minha marca" },
] as const;

export function PedidosPortfolio({ token }: { token: string | undefined }) {
  const q = usePedidosPortfolioDoCliente(token);
  const decidir = useDecidirPortfolioCliente(token);
  const pedidos = q.data ?? [];
  if (pedidos.length === 0) return null;
  const pendentes = pedidos.filter((p) => !p.escolha).length;

  return (
    <section className="mt-8 rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-[0_8px_30px_rgba(27,26,24,0.05)]">
      <p className="font-display font-extrabold text-[16px] text-foreground">Posso mostrar no meu portfólio?</p>
      <p className="mt-0.5 text-[13px] font-body text-muted-foreground">
        {pendentes > 0
          ? "Quem criou estas peças pediu pra mostrar no portfólio. Nada aparece sem você deixar."
          : "Suas escolhas sobre o portfólio de quem criou suas peças. Dá pra mudar quando quiser."}
      </p>
      <div className="mt-4 space-y-4">
        {pedidos.map((p) => (
          <div key={p.id} className="flex gap-3">
            {p.capa
              ? <img src={p.capa} alt="" loading="lazy" className="h-28 w-[90px] shrink-0 rounded-xl object-cover bg-muted" />
              : <div className="h-28 w-[90px] shrink-0 rounded-xl bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-body text-foreground"><b>{p.prestador}</b> quer mostrar{p.titulo ? <> "<span className="italic">{p.titulo}</span>"</> : " esta peça"}</p>
              <div className="mt-2 space-y-1.5">
                {OPCOES.map((o) => {
                  const on = p.escolha === o.v;
                  return (
                    <button key={o.v} type="button" disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ id: p.id, escolha: o.v })}
                      className={cn("flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-body transition-colors",
                        on ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/40")}>
                      <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full", on ? "border-[5px] border-primary" : "border-2 border-muted-foreground/40")} />
                      <span>
                        <b className="font-semibold text-foreground">{o.rot}</b>
                        {o.v === "sem_marca" && <span className="block text-[11.5px] text-muted-foreground">aparece como "{p.rotulo_sem_marca.toLowerCase()}"</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      {decidir.isPending && <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />}
      <p className="mt-4 text-[11.5px] font-body text-muted-foreground">"Sem a marca" mostra a peça como ela é. Se o seu logo está dentro da arte, escolha "não mostrar".</p>
    </section>
  );
}

export default PedidosPortfolio;
