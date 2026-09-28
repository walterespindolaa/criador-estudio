import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMediaLabel } from "@/components/insights/insightsUtils";

/* ═══════════════════════════════════════════════════════════════════════════
   LIGAR PUBLICAÇÃO ↔ POST DO CRIA (ciclo 2 dos dados do Instagram, 28/09/2026)

   O Cria já liga sozinho quando tem certeza (publicado pelo Cria ou legenda
   praticamente igual). O que ficou na dúvida aparece aqui como sugestão:
   "este post do Instagram parece ser o seu post X" com o motivo (mesmo dia,
   mesmo formato, legenda parecida). Um toque confirma; "Não é" some pra
   sempre. Cada post ligado alimenta a análise por pilar, gancho e linha
   editorial, e os números entram no próprio post.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Sugestao = {
  insight_id: string; media_type: string | null; caption: string | null; thumbnail_url: string | null;
  posted_at: string | null; post_id: string; post_title: string | null; post_format: string | null;
  post_date: string | null; nota: number; motivo: string | null;
};

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "sem data";

export function SugestoesVinculo({ conta, crmClientId = null }: { conta: string | null | undefined; crmClientId?: string | null }) {
  const qc = useQueryClient();
  const chave = ["ig-sugestoes-vinculo", conta, crmClientId];
  const { data: lista = [], isLoading } = useQuery<Sugestao[]>({
    queryKey: chave,
    enabled: !!conta,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("ig_sugestoes_vinculo", { _conta: conta, _crm: crmClientId });
      if (error) return []; // sem permissão/sem dado: a caixa só não aparece
      return (data as Sugestao[]) ?? [];
    },
  });

  const decidir = useMutation({
    mutationFn: async ({ s, aceitar }: { s: Sugestao; aceitar: boolean }) => {
      const { error } = await sbRpc("ig_decidir_vinculo", { _insight_id: s.insight_id, _post_id: s.post_id, _aceitar: aceitar });
      if (error) throw new Error(error.message);
      return aceitar;
    },
    onSuccess: (aceitou) => {
      if (aceitou) toast.success("Ligado. Os números do Instagram entraram no post.");
      qc.invalidateQueries({ queryKey: chave });
      // Análise e listas de mídia mudam quando liga.
      qc.invalidateQueries({ queryKey: ["social-media-insights"] });
      qc.invalidateQueries({ queryKey: ["managed-client-instagram"] });
      qc.invalidateQueries({ queryKey: ["cria-client-instagram"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || lista.length === 0) return null;

  return (
    <section className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 sm:p-4">
      <div className="flex items-start gap-2.5 mb-2.5">
        <span className="w-8 h-8 rounded-xl bg-violet-100 grid place-items-center shrink-0"><Link2 className="h-4 w-4 text-violet-700" /></span>
        <div className="min-w-0">
          <p className="text-sm font-display font-bold text-foreground">Esses posts do Instagram são do Cria?</p>
          <p className="text-xs font-body text-muted-foreground">
            Confirme e o Cria passa a saber o pilar, o gancho e a linha editorial de cada um. É isso que deixa a análise certeira.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {lista.slice(0, 8).map((s) => (
          <li key={s.insight_id} className="rounded-xl border border-border bg-card p-2.5 flex gap-2.5 items-center">
            {s.thumbnail_url
              ? <img src={s.thumbnail_url} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-muted" />
              : <span className="w-12 h-12 rounded-lg bg-muted shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-body text-muted-foreground truncate">
                Instagram · {formatMediaLabel(s.media_type)} · {dataCurta(s.posted_at)}
              </p>
              <p className="text-[13px] font-body font-bold text-foreground truncate">→ {s.post_title || "Post sem título"}</p>
              {s.motivo && <p className="text-[11px] font-body text-violet-700 truncate">{s.motivo}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
              <Button size="sm" className="h-9 rounded-lg px-3" disabled={decidir.isPending}
                onClick={() => decidir.mutate({ s, aceitar: true })} aria-label="É esse post">
                {decidir.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">É esse</span></>}
              </Button>
              <Button size="sm" variant="ghost" className="h-9 rounded-lg px-3 text-muted-foreground" disabled={decidir.isPending}
                onClick={() => decidir.mutate({ s, aceitar: false })} aria-label="Não é esse post">
                <X className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Não é</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {lista.length > 8 && (
        <p className="text-xs font-body text-muted-foreground mt-2">Mais {lista.length - 8} pra conferir depois destes.</p>
      )}
    </section>
  );
}
