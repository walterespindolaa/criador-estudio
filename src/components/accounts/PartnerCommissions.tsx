import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Check, CircleDollarSign, Clock, Copy, Link2, Loader2, Users, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O PAINEL DA PARCEIRA  (Walter, 22/09/2026)

   O que tinha aqui antes: três totais e uma lista de indicações, tudo somando
   um campo (net_amount_cents) que no modelo novo é sempre zero, porque o valor
   passou a viver nos LANÇAMENTOS. E a regra da comissão não aparecia em lugar
   nenhum, apesar de o FAQ da página de parceria prometer que "as regras de
   comissão, carência e repasse aparecem no seu painel assim que o cadastro for
   aprovado".

   Ninguém promove o que não entende. Então a tela abre pela REGRA, em
   português, com o número dela dentro. Depois vem o link pra compartilhar, que
   é a única coisa que ela realmente precisa ter na mão. Os números vêm depois.

   Tudo sai de uma RPC só (parceira_meu_extrato), que já devolve a regra
   efetiva dela: o override da parceira se existir, senão o padrão global.
   ═══════════════════════════════════════════════════════════════════════════ */

type Cliente = {
  nome: string; desde: string; faturas: number;
  em_carencia: boolean; ativo: boolean; ja_rendeu: number;
};
type Fechamento = { competencia: string; total_cents: number; status: string; pago_em: string | null };
type Extrato = {
  regra: { pct: number; meses: number; fatura_inicial: number; cupom: string | null; cache_cents: number };
  totais: { a_receber: number; recebido: number; lancamentos: number };
  clientes: Cliente[];
  fechamentos: Fechamento[];
};

const brl = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const mesBR = (iso: string) => {
  try {
    const [a, m] = iso.split("-");
    return new Date(Number(a), Number(m) - 1, 1)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  } catch { return iso; }
};

/* A regra em uma frase que ela consegue repetir pro público dela. Escrita a
   partir dos números de verdade, nunca fixa no código: se o admin mudar o
   percentual dela, a frase muda junto. */
function frase(r: Extrato["regra"]) {
  const ord = r.fatura_inicial === 1 ? "primeira" : r.fatura_inicial === 2 ? "segunda"
    : r.fatura_inicial === 3 ? "terceira" : `${r.fatura_inicial}ª`;
  return `Você recebe ${r.pct}% de tudo que cada cliente indicado pagar, todo mês, por até ${r.meses} meses. A contagem começa na ${ord} mensalidade dele.`;
}

export function PartnerCommissions() {
  const { user } = useAuth();
  const [copiado, setCopiado] = useState(false);

  const { data, isLoading } = useQuery<Extrato | null>({
    queryKey: ["parceira-extrato", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string, args?: unknown,
      ) => Promise<{ data: Extrato | null; error: { message: string } | null }>)("parceira_meu_extrato");
      if (error) {
        // Migration ainda não rodou: melhor tela vazia que tela quebrada.
        if (/does not exist|schema cache|could not find/i.test(error.message)) return null;
        throw error;
      }
      return data ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 px-5 py-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center">
        <p className="text-sm font-display font-bold text-foreground">Seu painel está quase pronto</p>
        <p className="text-xs font-body text-muted-foreground mt-1">
          Se você acabou de ser aprovada, recarregue em alguns minutos.
        </p>
      </div>
    );
  }

  const { regra, totais, clientes, fechamentos } = data;
  const link = regra.cupom
    ? `${window.location.origin.replace(/^https?:\/\/app\./, "https://")}/p/${regra.cupom}`
    : null;
  const emCarencia = clientes.filter((c) => c.em_carencia && c.ativo).length;
  const rendendo = clientes.filter((c) => !c.em_carencia && c.ativo).length;

  const copiar = async (txt: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true); toast.success(msg);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch { toast.error("O navegador não deixou copiar. Selecione e copie na mão."); }
  };

  return (
    <div className="space-y-3 mb-4">
      {/* 1. A REGRA. Vem primeiro porque é o que ela precisa saber pra falar. */}
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] px-5 py-4">
        <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-primary">O seu acordo</p>
        <p className="text-[14px] font-body text-foreground leading-relaxed mt-1.5">{frase(regra)}</p>
        {regra.cache_cents > 0 && (
          <p className="text-[12.5px] font-body text-muted-foreground mt-1.5">
            Mais o cachê combinado de <b className="text-foreground">{brl(regra.cache_cents)}</b>, pago à parte.
          </p>
        )}
        <p className="text-[11px] font-body text-muted-foreground mt-2">
          Sai por PIX na chave do seu cadastro, fechando por mês.
        </p>
      </section>

      {/* 2. O LINK. A única coisa que ela precisa ter na mão. */}
      {link && (
        <section className="rounded-2xl border border-border bg-card/50 px-5 py-4">
          <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Seu link
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <code className="flex-1 min-w-0 truncate text-[13px] font-mono bg-muted rounded-xl px-3 py-2.5 text-foreground">{link}</code>
            <button type="button" onClick={() => copiar(link, "Link copiado. Cola no story.")}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2.5 text-[12.5px] font-body font-bold hover:opacity-90 transition-opacity">
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-2">
            Quem abrir este link já entra com o seu código aplicado, mesmo que assine dias depois.
            {regra.cupom && <> Se preferir falar o código: <b className="text-foreground">{regra.cupom}</b>.</>}
          </p>
        </section>
      )}

      {/* 3. OS NÚMEROS. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-body font-bold flex items-center gap-1">
            <Wallet className="h-3 w-3" /> A receber
          </p>
          <p className="text-[22px] leading-none font-display font-extrabold text-foreground mt-1.5">{brl(totais.a_receber)}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">no próximo fechamento</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-bold flex items-center gap-1">
            <Check className="h-3 w-3" /> Já recebido
          </p>
          <p className="text-[22px] leading-none font-display font-extrabold text-foreground mt-1.5">{brl(totais.recebido)}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">desde o começo</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-bold flex items-center gap-1">
            <Users className="h-3 w-3" /> Clientes
          </p>
          <p className="text-[22px] leading-none font-display font-extrabold text-foreground mt-1.5">{clientes.length}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">
            {rendendo} rendendo{emCarencia > 0 ? ` · ${emCarencia} em carência` : ""}
          </p>
        </div>
      </div>

      {/* 4. OS CLIENTES. */}
      <section className="rounded-2xl border border-border bg-card/50 px-5 py-4">
        <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Quem entrou pelo seu link
        </p>

        {clientes.length === 0 ? (
          <p className="text-[12.5px] font-body text-muted-foreground mt-2.5">
            Ninguém ainda. Compartilha o link ali em cima que a gente conta o resto.
          </p>
        ) : (
          <div className="space-y-1.5 mt-2.5">
            {clientes.map((c, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 min-w-0",
                c.ativo ? "border-border bg-card/60" : "border-border/50 bg-muted/20 opacity-70",
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-body font-semibold text-foreground truncate">{c.nome}</p>
                  <p className="text-[11px] font-body text-muted-foreground">
                    desde {new Date(c.desde).toLocaleDateString("pt-BR")}
                    {c.faturas > 0 && ` · ${c.faturas} ${c.faturas === 1 ? "mensalidade paga" : "mensalidades pagas"}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-display font-bold text-foreground">{brl(c.ja_rendeu)}</p>
                  {!c.ativo ? (
                    <span className="text-[10px] font-body text-muted-foreground">cancelou</span>
                  ) : c.em_carencia ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-body font-semibold text-amber-700">
                      <Clock className="h-2.5 w-2.5" /> começa na {regra.fatura_inicial}ª
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-body font-semibold text-emerald-700">
                      <CircleDollarSign className="h-2.5 w-2.5" /> rendendo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. O HISTÓRICO DE PAGAMENTO. */}
      {fechamentos.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/50 px-5 py-4">
          <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground">
            Fechamentos
          </p>
          <div className="space-y-1 mt-2.5">
            {fechamentos.map((f) => (
              <div key={f.competencia} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                <span className="text-[12.5px] font-body text-foreground capitalize">{mesBR(f.competencia)}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-display font-bold text-foreground">{brl(f.total_cents)}</span>
                  <span className={cn(
                    "text-[10px] font-body font-semibold px-2 py-0.5 rounded-full",
                    f.status === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                  )}>
                    {f.status === "pago" ? "pago" : "em aberto"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
