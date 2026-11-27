import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   PLACAR "O QUE TRAVOU?" (Walter, 27/11/2026)

   O que quem voltou depois de 3+ dias fora respondeu na folha do Início, nos
   últimos 30 dias. "Agora não" aparece separado: diz quantos viram a pergunta
   e não quiseram responder. O texto livre de "Faltou uma função" e "Outro
   motivo" também cai em Rede e conteúdo > Feedback.
   ═══════════════════════════════════════════════════════════════════════════ */

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

const ROTULOS: Record<string, { rotulo: string; cor: string }> = {
  sem_ideia: { rotulo: "Não sabia o que postar", cor: "#FFCF03" },
  sem_tempo: { rotulo: "Faltou tempo", cor: "#FF77B9" },
  nao_entendi: { rotulo: "Não entendi como usar", cor: "#9BB8FF" },
  faltou_funcao: { rotulo: "Faltou uma função", cor: "#01A652" },
  outro: { rotulo: "Outro motivo", cor: "#B5AD9C" },
};

type Linha = { motivo: string; dias_fora: number | null; detalhe: string | null; avisar: boolean };

export function AdminMotivosVolta() {
  const { data = [], isLoading } = useQuery<Linha[]>({
    queryKey: ["admin-motivos-volta"],
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await sbFrom("motivos_saida")
        .select("motivo, dias_fora, detalhe, avisar")
        .eq("origem", "volta").gte("criado_em", desde)
        .order("criado_em", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  const respostas = data.filter((l) => l.motivo !== "agora_nao");
  const agoraNao = data.length - respostas.length;
  const total = respostas.length;
  const ordem = Object.keys(ROTULOS)
    .map((k) => ({ k, n: respostas.filter((l) => l.motivo === k).length }))
    .sort((a, b) => b.n - a.n);
  const comDias = respostas.filter((l) => typeof l.dias_fora === "number");
  const mediaDias = comDias.length ? Math.round(comDias.reduce((s, l) => s + (l.dias_fora ?? 0), 0) / comDias.length) : null;
  const querAviso = respostas.filter((l) => l.avisar).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display font-bold text-[16px] text-foreground">O que travou? · últimos 30 dias</h3>
        <p className="text-[12px] font-body text-muted-foreground">
          {isLoading ? "carregando..." : `${total} ${total === 1 ? "resposta" : "respostas"} · ${agoraNao} "agora não"${mediaDias !== null ? ` · ${mediaDias} dias fora em média` : ""}${querAviso ? ` · ${querAviso} querem aviso de função nova` : ""}`}
        </p>
      </div>
      {!isLoading && total === 0 ? (
        <p className="mt-3 text-[13px] font-body text-muted-foreground">Ninguém respondeu ainda. A folha aparece pra criador que volta depois de 3 dias ou mais sem abrir o app.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ordem.map(({ k, n }) => {
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="text-[13px] font-body text-foreground truncate">{ROTULOS[k].rotulo}</span>
                <span className="text-[12px] font-body tabular-nums text-muted-foreground">{n} · {pct}%</span>
                <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted">
                  <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: ROTULOS[k].cor }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
