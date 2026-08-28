import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* O histórico do parceiro: tudo que já saiu da mão dele, mais recente em cima.
   É o portfólio do trabalho e a base da conversa de cobrança com cada agência
   ("entreguei X peças pra você este mês"). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string) => (supabase as any).rpc(fn);

type Entrega = {
  post_id: string; titulo: string; formato: string | null;
  entregue_em: string; publica_em: string | null;
  agencia_id: string; agencia_nome: string;
  cliente_nome: string; cliente_cor: string | null; cliente_logo: string | null;
};

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

export default function Entregues() {
  const { user } = useAuth();
  const { data: entregas = [], isLoading } = useQuery<Entrega[]>({
    queryKey: ["parceiro-entregues", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_entregues");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Entrega[];
    },
  });

  // Agrupado por agência: é assim que a conversa de cobrança acontece.
  const porAgencia = new Map<string, Entrega[]>();
  for (const e of entregas) porAgencia.set(e.agencia_nome, [...(porAgencia.get(e.agencia_nome) ?? []), e]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-sm shrink-0">
          <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Entregues</h1>
          <p className="text-muted-foreground font-body mt-0.5 text-sm">
            {entregas.length === 0 ? "Suas entregas aparecem aqui, agrupadas por agência."
              : `${entregas.length} peça${entregas.length === 1 ? "" : "s"} entregues, o seu histórico de trabalho.`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entregas.length === 0 ? (
        <Card className="p-10 rounded-2xl border-dashed text-center">
          <p className="text-sm font-body text-muted-foreground">
            Nada entregue ainda. Quando você marcar um card como entregue, ele entra aqui.
          </p>
        </Card>
      ) : (
        [...porAgencia.entries()].map(([agencia, lista]) => (
          <section key={agencia} className="mb-5">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
              {agencia} · {lista.length} entrega{lista.length === 1 ? "" : "s"}
            </p>
            <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
              {lista.map((e) => (
                <div key={e.post_id} className="flex items-center gap-3.5 px-4 py-3">
                  <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden"
                    style={{ background: e.cliente_cor || "#01A652" }}>
                    {e.cliente_logo
                      ? <img src={e.cliente_logo} alt="" className="w-full h-full object-cover" />
                      : (e.cliente_nome || "C").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-bold text-[14px] text-foreground truncate">{e.titulo || "Sem título"}</span>
                    <span className="block text-xs font-body text-muted-foreground mt-0.5">
                      {e.cliente_nome}
                      {e.formato && ` · ${FORMATO[e.formato] ?? e.formato}`}
                    </span>
                  </span>
                  <span className="text-[11px] font-body font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1 shrink-0">
                    ✓ {new Date(e.entregue_em).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
