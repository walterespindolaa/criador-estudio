import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChipJornada, type Tom } from "@/components/admin/JornadaUsuario";

/* ═══════════════════════════════════════════════════════════════════════════
   NOVOS ACESSOS (Walter, 04/11/2026): a visão geral de quem entrou no
   período e onde parou. Funil por passo, origem de cada um e a lista de quem
   travou em cada ponto. Clicar numa pessoa abre a ficha dela (aba Jornada).
   Dados: admin_funil_novos (migração 20261104000001).
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Linha = {
  id: string; nome: string | null; criado_em: string; tipo: "criador" | "social" | "parceiro"; origem: string; plano_lp: string | null;
  passo: number; onde: string; tom: Tom; checkout_plano: string | null; checkout_vezes: number; ultimo_acesso: string | null; aparelho: string | null;
};

const PASSOS_CRIADOR = ["Cadastrou", "Confirmou e-mail", "Fez o onboarding", "Viu os planos", "Abriu o pagamento", "Começou o teste", "1ª cobrança"];
const PASSOS_SOCIAL = ["Cadastrou", "Confirmou e-mail", "Fez o onboarding", "Cadastrou cliente"];
const NOME_PLANO: Record<string, string> = { essencial: "Essencial", pro: "Pro", studio: "Studio" };

function Pilula({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-body font-semibold border transition-colors",
        on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}

export function AdminFunil({ aoAbrirConta }: { aoAbrirConta: (id: string) => void }) {
  const [dias, setDias] = useState(14);
  const [tipo, setTipo] = useState<"criador" | "social">("criador");
  const [filtro, setFiltro] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Linha[]>({
    queryKey: ["admin-funil-novos", dias],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("admin_funil_novos", { _dias: dias });
      if (error) throw new Error(error.message);
      return (data as Linha[] | null) ?? [];
    },
  });

  const linhas = useMemo(() => (data ?? []).filter((l) => l.tipo === tipo), [data, tipo]);
  const passosNomes = tipo === "criador" ? PASSOS_CRIADOR : PASSOS_SOCIAL;
  const alcancou = (l: Linha, k: number) => tipo === "criador" ? l.passo >= k
    : k <= 3 ? l.passo >= k : l.onde.startsWith("Conta grátis ativa");
  const funil = passosNomes.map((nome, i) => ({ nome, n: linhas.filter((l) => alcancou(l, i + 1)).length }));
  const total = linhas.length;

  const grupos = useMemo(() => {
    const m = new Map<string, { onde: string; tom: Tom; n: number }>();
    for (const l of linhas) {
      const chave = l.onde.replace(/ · .*$/, "").replace(/ · faltam.*$/, "");
      const g = m.get(chave) ?? { onde: chave, tom: l.tom, n: 0 };
      g.n += 1; m.set(chave, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [linhas]);

  const origens = useMemo(() => {
    const m = new Map<string, { origem: string; n: number; pagamento: number; teste: number }>();
    for (const l of linhas) {
      const g = m.get(l.origem) ?? { origem: l.origem, n: 0, pagamento: 0, teste: 0 };
      g.n += 1;
      if (l.passo >= 5) g.pagamento += 1;
      if (l.passo >= 6) g.teste += 1;
      m.set(l.origem, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [linhas]);

  const lista = filtro ? linhas.filter((l) => l.onde.startsWith(filtro)) : linhas;
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((d) => <Pilula key={d} on={dias === d} onClick={() => { setDias(d); setFiltro(null); }}>Últimos {d} dias</Pilula>)}
        <span className="mx-1 h-5 w-px bg-border" />
        <Pilula on={tipo === "criador"} onClick={() => { setTipo("criador"); setFiltro(null); }}>Criadores</Pilula>
        <Pilula on={tipo === "social"} onClick={() => { setTipo("social"); setFiltro(null); }}>Social mídia</Pilula>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Novos cadastros", total, null],
              tipo === "criador"
                ? ["Pararam no pagamento", linhas.filter((l) => l.onde.startsWith("Parou no pagamento")).length, "ambar"]
                : ["Sem cliente cadastrado", linhas.filter((l) => l.onde === "Social mídia sem cliente").length, "ambar"],
              tipo === "criador"
                ? ["Em teste ou assinantes", linhas.filter((l) => l.passo >= 6).length, "verde"]
                : ["Com cliente cadastrado", linhas.filter((l) => l.onde.startsWith("Conta grátis ativa")).length, "verde"],
              ["Não confirmaram o e-mail", linhas.filter((l) => l.onde === "Não confirmou o e-mail").length, null],
            ].map(([t, n, tom]) => (
              <div key={t as string} className={cn("rounded-2xl border px-4 py-3",
                tom === "verde" ? "bg-emerald-50 border-emerald-200" : tom === "ambar" ? "bg-amber-50 border-amber-200" : "bg-card border-border")}>
                <p className="font-display font-extrabold text-2xl tabular-nums">{n as number}</p>
                <p className="text-[12px] font-body text-muted-foreground">{t as string}{total && n !== total ? ` · ${pct(n as number)}%` : ""}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Até onde chegaram</h3>
              {total === 0 ? <p className="text-sm font-body text-muted-foreground">Ninguém se cadastrou nesse período.</p> : (
                <div className="space-y-2.5">
                  {funil.map((f, i) => {
                    const perdeu = i > 0 ? funil[i - 1].n - f.n : 0;
                    return (
                      <div key={f.nome}>
                        <div className="flex justify-between text-[13px] font-body mb-1">
                          <span className="font-semibold">{f.nome}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {f.n} · {pct(f.n)}%{perdeu > 0 && <span className="text-red-600 font-semibold"> · perdeu {perdeu}</span>}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct(f.n), f.n ? 3 : 0)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] font-body text-muted-foreground mt-3">Horário de onboarding, planos e pagamento só é gravado a partir de 04/11. Antes disso o passo aparece pelo que ficou registrado (tela aberta, cadastro no Stripe).</p>
            </div>

            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">De onde vieram</h3>
              <table className="w-full text-[13px] font-body">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-semibold">Origem</th><th className="pb-2 font-semibold text-right">Cadastros</th>
                  {tipo === "criador" && <><th className="pb-2 font-semibold text-right">Pagamento</th><th className="pb-2 font-semibold text-right">Teste</th></>}
                </tr></thead>
                <tbody>
                  {origens.map((o) => (
                    <tr key={o.origem} className="border-t border-dashed border-border/70">
                      <td className="py-2 capitalize">{o.origem}</td><td className="py-2 text-right tabular-nums">{o.n}</td>
                      {tipo === "criador" && <><td className="py-2 text-right tabular-nums">{o.pagamento}</td><td className="py-2 text-right tabular-nums">{o.teste}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex flex-wrap gap-1.5 items-center">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mr-2">Onde pararam</h3>
              <Pilula on={!filtro} onClick={() => setFiltro(null)}>Todos ({total})</Pilula>
              {grupos.map((g) => <Pilula key={g.onde} on={filtro === g.onde} onClick={() => setFiltro(g.onde)}>{g.onde} ({g.n})</Pilula>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-y border-border"><tr className="text-left">
                  {["Nome", "Onde parou", "Origem", "Plano", "Cadastro", "Último acesso"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={l.id} onClick={() => aoAbrirConta(l.id)} className="border-b border-border/60 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-2.5 font-body font-semibold">{l.nome || "-"}</td>
                      <td className="px-4 py-2.5"><ChipJornada onde={l.onde} tom={l.tom} /></td>
                      <td className="px-4 py-2.5 font-body text-muted-foreground capitalize">{l.origem}</td>
                      <td className="px-4 py-2.5 font-body text-muted-foreground">
                        {l.checkout_plano ? NOME_PLANO[l.checkout_plano] ?? l.checkout_plano : l.plano_lp ? `${NOME_PLANO[l.plano_lp] ?? l.plano_lp} (LP)` : "-"}
                      </td>
                      <td className="px-4 py-2.5 font-body text-muted-foreground whitespace-nowrap">{format(new Date(l.criado_em), "dd/MM HH:mm", { locale: ptBR })}</td>
                      <td className="px-4 py-2.5 font-body text-muted-foreground whitespace-nowrap">
                        {l.ultimo_acesso ? formatDistanceToNow(new Date(l.ultimo_acesso), { locale: ptBR, addSuffix: true }) : "nunca"}
                      </td>
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-body text-muted-foreground">Ninguém aqui.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
