import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { PreviaWhatsApp } from "@/components/shared/PreviaWhatsApp";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   INDIQUE O CRIA, O PAINEL DA PARCEIRA (Walter, 07/11/2026, mockup aprovado)

   A tela antiga empilhava tudo num cartão com cara de formulário. Agora o
   dinheiro vem no topo, o cupom e o link viram um ingresso destacável (com o
   acordo no canhoto), cada cliente mostra quantos meses de comissão já
   correram e o extrato vira recibos por mês com carimbo de pago. No celular,
   abas Clientes, Extrato e Divulgar pra não virar uma rolagem sem fim.

   Tudo sai da RPC parceira_meu_extrato (a mesma do PartnerCommissions, que
   continua na home antiga). Nada novo no banco.
   ═══════════════════════════════════════════════════════════════════════════ */

type Cliente = { nome: string; desde: string; faturas: number; em_carencia: boolean; ativo: boolean; ja_rendeu: number };
type Fechamento = { competencia: string; total_cents: number; status: string; pago_em: string | null };
type Extrato = {
  regra: { pct: number; meses: number; fatura_inicial: number; cupom: string | null; cache_cents: number };
  totais: { a_receber: number; recebido: number; lancamentos: number };
  clientes: Cliente[];
  fechamentos: Fechamento[];
};

const C = { laranja: "#EB4918", verde: "#00A652", azul: "#0061EE", rosa: "#FF77B9", amarelo: "#FFCF03", creme: "#FFF6CC" };
const CORES_AV = [C.azul, C.rosa, C.amarelo, C.laranja, C.verde];

const brl = (c: number | null | undefined) => ((c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesLongo = (iso: string) => {
  const [a, m] = iso.split("-").map(Number);
  const s = new Date(a, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const mesCurto = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
// "2026-11-05" (só data) não pode passar pelo fuso: vira 04/11 no Brasil.
const ddmm = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const ordinal = (n: number) => `${n}ª`;

export function useExtratoParceira() {
  const { user } = useAuth();
  return useQuery<Extrato | null>({
    queryKey: ["parceira-extrato", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string, args?: unknown,
      ) => Promise<{ data: Extrato | null; error: { message: string } | null }>)("parceira_meu_extrato");
      if (error) {
        if (/does not exist|schema cache|could not find/i.test(error.message)) return null;
        throw error;
      }
      return data ?? null;
    },
  });
}

export function PainelParceira() {
  const { partner } = usePartner();
  const { data, isLoading } = useExtratoParceira();
  const [aba, setAba] = useState<"clientes" | "extrato" | "divulgar">("clientes");
  const [copiado, setCopiado] = useState<string | null>(null);

  const r = data?.regra;
  const cupom = r?.cupom ?? partner?.coupon_code ?? null;
  const link = cupom ? `${window.location.origin.replace(/^https?:\/\/app\./, "https://")}/p/${cupom}` : null;
  const desconto = partner?.coupon_type === "client_discount" && partner?.coupon_discount_pct ? partner.coupon_discount_pct : null;
  const mensagem = useMemo(() => {
    if (!link) return "";
    const ganho = desconto ? ` Entrando pelo meu link você já ganha ${desconto}% de desconto.` : "";
    return `Uso o Cria Social Club pra organizar clientes, aprovação e conteúdo num lugar só.${ganho} ${link}`;
  }, [link, desconto]);

  const copiar = async (txt: string, qual: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(qual); toast.success(msg);
      window.setTimeout(() => setCopiado(null), 1800);
    } catch { toast.error("O navegador não deixou copiar. Selecione e copie na mão."); }
  };
  const whats = () => { if (mensagem) window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener"); };

  if (isLoading) {
    return <div className="rounded-3xl border border-border bg-card/50 py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!data || !r) {
    return (
      <div className="rounded-3xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm font-display font-bold text-foreground">Seu painel está quase pronto</p>
        <p className="text-xs font-body text-muted-foreground mt-1">Se você acabou de ser aprovada, recarregue em alguns minutos.</p>
      </div>
    );
  }

  const { totais, clientes, fechamentos } = data;
  const rendendo = clientes.filter((c) => c.ativo && !c.em_carencia).length;
  const proximoAberto = fechamentos.find((f) => f.status !== "pago");

  /* ── PEÇAS ── */
  const numeros = (
    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
      <Numero rotulo={proximoAberto ? `A receber · ${mesLongo(proximoAberto.competencia).split(" ")[0].toLowerCase()}` : "A receber"}
        valor={brl(totais.a_receber)} sub="no próximo fechamento" destaque />
      <Numero rotulo="Já recebido" valor={brl(totais.recebido)} sub="desde o começo" />
      <Numero rotulo="Clientes" valor={String(clientes.length)} sub={`${rendendo} rendendo`} />
    </div>
  );

  const ingresso = (
    <div className="relative rounded-[22px] border-2 border-foreground bg-[#FFCF03] text-[#0A0A0A] shadow-[5px_5px_0_hsl(var(--foreground))] overflow-hidden flex flex-col sm:flex-row">
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <p className="text-[10px] font-body font-extrabold uppercase tracking-[.08em]">
          Seu cupom{desconto ? ` · ${desconto}% pra quem entra` : ""}
        </p>
        <p className="font-display font-extrabold text-[34px] sm:text-[40px] leading-[1.05] tracking-[.04em] break-all">{cupom ?? "sem cupom"}</p>
        {link && <p className="text-[12.5px] font-body truncate mt-0.5">{link.replace(/^https?:\/\//, "")}</p>}
        {link && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button type="button" onClick={() => void copiar(link, "link", "Link copiado. Cola no story.")}
              className="h-9 rounded-full bg-[#0A0A0A] text-white px-4 text-[12.5px] font-body font-bold inline-flex items-center gap-1.5">
              {copiado === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado === "link" ? "Copiado" : "Copiar link"}
            </button>
            <button type="button" onClick={whats}
              className="h-9 rounded-full bg-white border-2 border-[#0A0A0A] px-4 text-[12.5px] font-body font-bold inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <PreviaWhatsApp url={link} className="h-9 rounded-full bg-white/70 border border-[#0A0A0A]/30 text-[#0A0A0A]" />
          </div>
        )}
      </div>
      {/* Canhoto: a regra em uma olhada. */}
      <div className="relative shrink-0 sm:w-[170px] bg-[#FFF6CC] border-t-2 sm:border-t-0 sm:border-l-2 border-dashed border-[#0A0A0A] px-4 py-3 sm:py-5 flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-1 text-left sm:text-center">
        <span aria-hidden className="hidden sm:block absolute -top-3 -left-3 h-6 w-6 rounded-full bg-background border-2 border-[#0A0A0A]" />
        <span aria-hidden className="hidden sm:block absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-background border-2 border-[#0A0A0A]" />
        <p className="hidden sm:block text-[10px] font-body font-extrabold uppercase tracking-[.08em]">Seu acordo</p>
        <p className="font-display font-extrabold text-[30px] sm:text-[40px] leading-none">{r.pct}%</p>
        <p className="text-[11.5px] font-body leading-snug">
          de cada mensalidade por {r.meses} meses, a partir da {ordinal(r.fatura_inicial)} fatura
          {r.cache_cents > 0 && <><br />mais {brl(r.cache_cents)} de cachê</>}
        </p>
      </div>
    </div>
  );

  const listaClientes = clientes.length === 0 ? (
    <p className="text-[13px] font-body text-muted-foreground py-3">Ninguém ainda. Manda o link ali em cima que a gente conta o resto.</p>
  ) : (
    <div className="divide-y divide-dashed divide-border">
      {clientes.map((c, i) => {
        const corridos = Math.min(r.meses, Math.max(0, c.faturas - r.fatura_inicial + 1));
        const pct = c.em_carencia ? Math.max(4, Math.min(100, (c.faturas / Math.max(1, r.fatura_inicial)) * 8)) : (corridos / Math.max(1, r.meses)) * 100;
        const cor = CORES_AV[i % CORES_AV.length];
        return (
          <div key={`${c.nome}-${i}`} className={cn("flex items-center gap-3 py-3", !c.ativo && "opacity-55")}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-foreground font-display font-extrabold text-sm"
              style={{ background: c.ativo ? cor : "#9CA3AF", color: cor === C.amarelo ? "#0A0A0A" : "#fff" }}>
              {c.nome.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-body font-bold text-foreground truncate">{c.nome}</p>
              <p className="text-[11.5px] font-body text-muted-foreground truncate">
                desde {mesCurto(c.desde)}
                {c.faturas > 0 && ` · ${ordinal(c.faturas)} fatura`}
                {" · "}{!c.ativo ? "cancelou, parou de render" : c.em_carencia ? "em carência" : "rendendo"}
              </p>
              {c.ativo && (
                <>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.em_carencia ? C.amarelo : C.verde }} />
                  </div>
                  <p className="text-[10.5px] font-body text-muted-foreground mt-1">
                    {c.em_carencia ? `começa a contar na ${ordinal(r.fatura_inicial)} fatura` : `${corridos} de ${r.meses} meses`}
                  </p>
                </>
              )}
            </div>
            <p className={cn("shrink-0 text-[14px] font-display font-extrabold", c.ja_rendeu ? "text-foreground" : "text-muted-foreground")}>{brl(c.ja_rendeu)}</p>
          </div>
        );
      })}
    </div>
  );

  const recibos = fechamentos.length === 0 ? (
    <p className="text-[13px] font-body text-muted-foreground py-3">O primeiro fechamento aparece aqui quando um cliente seu pagar.</p>
  ) : (
    <div className="space-y-3">
      {fechamentos.map((f, i) => {
        const pago = f.status === "pago";
        return (
          <div key={f.competencia} className="relative rounded-[6px] bg-card border border-border px-4 py-3.5 shadow-[2px_3px_0_rgba(0,0,0,.08)]"
            style={{ transform: `rotate(${i % 2 ? 0.4 : -0.4}deg)` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-body font-extrabold text-foreground">{mesLongo(f.competencia)}</p>
                <p className="text-[11.5px] font-body text-muted-foreground">{pago ? "PIX na sua chave" : "em aberto, fecha no fim do mês"}</p>
              </div>
              <p className="shrink-0 text-[15px] font-display font-extrabold text-foreground">{brl(f.total_cents)}</p>
            </div>
            {pago && (
              <span className="absolute right-24 top-1/2 -translate-y-1/2 -rotate-[8deg] rounded-[8px] border-2 border-[#00A652] px-2 py-0.5 font-display font-extrabold italic text-[13px] text-[#00A652]">
                pago{f.pago_em ? ` ${ddmm(f.pago_em)}` : ""}
              </span>
            )}
            {/* serrilha do recibo */}
            <span aria-hidden className="absolute inset-x-0 -bottom-[5px] h-[6px]"
              style={{ background: "radial-gradient(circle at 5px -1px, transparent 4px, hsl(var(--card)) 4.5px) 0 0/10px 6px repeat-x" }} />
          </div>
        );
      })}
    </div>
  );

  const divulgar = (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[14px] font-display font-extrabold text-foreground">Mensagem pronta</p>
      <p className="text-[12px] font-body text-muted-foreground mt-0.5">Pra colar no WhatsApp, no direct ou na legenda.</p>
      <p className="mt-2.5 rounded-xl bg-muted/50 px-3 py-2.5 text-[13px] font-body text-foreground leading-relaxed">{mensagem || "Seu link aparece aqui quando o cupom estiver ativo."}</p>
      {mensagem && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <button type="button" onClick={() => void copiar(mensagem, "msg", "Mensagem copiada.")}
            className="h-9 rounded-full bg-foreground text-background px-4 text-[12.5px] font-body font-bold inline-flex items-center gap-1.5">
            {copiado === "msg" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar mensagem
          </button>
          <button type="button" onClick={whats} className="h-9 rounded-full border border-border px-4 text-[12.5px] font-body font-bold inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> Mandar no WhatsApp
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-3xl border border-border bg-[#FBF8F0] dark:bg-card p-4 sm:p-6">
      {/* TOPO: título e dinheiro */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="min-w-0">
          <span className="inline-block rounded-full px-3 py-1 text-[11px] font-body font-bold text-white" style={{ background: C.laranja }}>Parceira aprovada</span>
          <h2 className="mt-2 font-display font-extrabold text-[26px] sm:text-[32px] leading-[1.05] text-foreground">
            Sua indicação <span className="lg:block italic" style={{ color: C.laranja }}>virando renda.</span>
          </h2>
        </div>
        <div className="lg:ml-auto lg:w-[560px]">{numeros}</div>
      </div>

      <div className="mt-5 grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="min-w-0">
          <div data-tour="parceria-acao">{ingresso}</div>
          <p className="text-[12px] font-body text-muted-foreground mt-3">
            Quem abrir o link já entra com o seu código, mesmo que assine dias depois. Sai por PIX na chave do seu cadastro, fechando por mês.
          </p>

          {/* Celular: abas. */}
          <div className="lg:hidden mt-4 flex gap-1.5">
            {([["clientes", `Clientes ${clientes.length}`], ["extrato", "Extrato"], ["divulgar", "Divulgar"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setAba(k)}
                className={cn("h-8 rounded-full border px-3.5 text-xs font-body font-bold",
                  aba === k ? "bg-foreground text-background border-foreground" : "border-border bg-card text-foreground/80")}>{t}</button>
            ))}
          </div>
          <div className="lg:hidden mt-3">
            {aba === "clientes" && listaClientes}
            {aba === "extrato" && recibos}
            {aba === "divulgar" && divulgar}
          </div>

          <div className="hidden lg:block mt-5">
            <p className="text-[15px] font-display font-extrabold text-foreground">Quem entrou pelo seu link</p>
            {listaClientes}
          </div>
        </div>

        <div className="hidden lg:block min-w-0 space-y-5">
          <div>
            <p className="text-[15px] font-display font-extrabold text-foreground mb-3">Extrato por mês</p>
            {recibos}
          </div>
          {divulgar}
        </div>
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border-2 border-foreground px-2.5 py-2.5 sm:px-4 sm:py-3 shadow-[3px_3px_0_hsl(var(--foreground))] min-w-0",
      destaque ? "bg-[#00A652] text-white" : "bg-card text-foreground")}>
      <p className={cn("text-[9.5px] sm:text-[10px] font-body font-extrabold uppercase tracking-[.08em] truncate", destaque ? "text-white/90" : "text-muted-foreground")}>
        <span className="sm:hidden">{rotulo.split(" · ")[0]}</span><span className="hidden sm:inline">{rotulo}</span>
      </p>
      <p className="font-display font-extrabold text-[15px] sm:text-[24px] leading-tight mt-0.5 whitespace-nowrap">{valor}</p>
      <p className={cn("hidden sm:block text-[11px] font-body truncate", destaque ? "text-white/85" : "text-muted-foreground")}>{sub}</p>
    </div>
  );
}
