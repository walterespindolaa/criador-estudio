import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   RESULTADO NO LINKEDIN, DIGITADO À MÃO (mockup aprovado em 25/11/2026)

   A API do perfil pessoal do LinkedIn não libera métrica de post (precisa da
   Community Management API, que pede análise). Então a pessoa copia os
   números da aba Estatísticas do post e guarda aqui. Fica em social_insights
   (RPCs linkedin_resultado e linkedin_resultado_salvar). Só o master.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

const CAMPOS = [
  { k: "impressoes", rotulo: "Impressões" },
  { k: "reacoes", rotulo: "Reações" },
  { k: "comentarios", rotulo: "Comentários" },
  { k: "compartilhamentos", rotulo: "Compartilhamentos" },
] as const;

type Resultado = { metrics: Record<string, unknown> | null; permalink: string | null; captured_at: string | null };

export function ResultadoLinkedIn({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const r = useQuery<Resultado | null>({
    queryKey: ["linkedin-resultado", postId],
    queryFn: async () => {
      const { data, error } = await sbRpc("linkedin_resultado", { _post_id: postId });
      if (error) return null;
      return ((data as Resultado[] | null) ?? [])[0] ?? null;
    },
  });
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    const m = r.data?.metrics ?? {};
    setValores(Object.fromEntries(CAMPOS.map(({ k }) => [k, m[k] != null ? String(m[k]) : ""])));
  }, [r.data]);

  const salvar = useMutation({
    mutationFn: async () => {
      const metricas = Object.fromEntries(CAMPOS.flatMap(({ k }) => {
        const n = Number(String(valores[k] ?? "").replace(/\D/g, ""));
        return valores[k]?.trim() && Number.isFinite(n) ? [[k, n]] : [];
      }));
      const { error } = await sbRpc("linkedin_resultado_salvar", { _post_id: postId, _metricas: metricas });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Resultado guardado."); qc.invalidateQueries({ queryKey: ["linkedin-resultado", postId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (r.isLoading) return null;
  if (r.data === null && r.isFetched) return null; // sem permissão ou sem LinkedIn: não mostra
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 space-y-3">
      <div>
        <p className="text-[13px] font-body font-bold text-foreground">Resultado no LinkedIn</p>
        <p className="text-[12px] font-body text-muted-foreground leading-snug">Copie os números do post no LinkedIn (Estatísticas do post). A API do perfil pessoal não manda esses números sozinha.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CAMPOS.map(({ k, rotulo }) => (
          <label key={k} className="rounded-xl border border-border px-3 py-2">
            <span className="block text-[10.5px] font-body font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</span>
            <input inputMode="numeric" value={valores[k] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value.replace(/\D/g, "") }))}
              placeholder="0" className="w-full bg-transparent text-[18px] font-body font-bold text-foreground outline-none" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-xl flex-1 sm:flex-none" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar resultado"}
        </Button>
        {r.data?.permalink && (
          <Button asChild size="sm" variant="outline" className="rounded-xl flex-1 sm:flex-none">
            <a href={r.data.permalink} target="_blank" rel="noreferrer">Ver o post no LinkedIn <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></a>
          </Button>
        )}
      </div>
    </div>
  );
}
