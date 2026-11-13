import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   JORNADA DO USUÁRIO (Walter, 04/11/2026, mockup aprovado:
   CRIA/3-produto/mockups/mockup-jornada-admin.html)

   "Onde a pessoa parou": cadastro, e-mail, onboarding, planos, pagamento,
   teste e primeira cobrança. Tudo vem do banco já calculado
   (jornada_base, migração 20261104000001): o front só desenha.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type Tom = "verde" | "ambar" | "vermelho" | "cinza";
export type OndeParou = { id: string; onde: string; tom: Tom; origem: string };

const COR: Record<Tom, string> = {
  verde: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ambar: "bg-amber-100 text-amber-800 border-amber-200",
  vermelho: "bg-red-100 text-red-700 border-red-200",
  cinza: "bg-muted text-muted-foreground border-border",
};

export function ChipJornada({ onde, tom, className }: { onde: string; tom: Tom; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-body font-semibold whitespace-nowrap", COR[tom] ?? COR.cinza, className)}>
      {onde}
    </span>
  );
}

/** "Onde parou" das contas de uma página da lista. */
export function useOndeParou(ids: string[]) {
  return useQuery<Record<string, OndeParou>>({
    queryKey: ["admin-onde-parou", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("admin_onde_parou", { _ids: ids });
      if (error) return {};
      const m: Record<string, OndeParou> = {};
      for (const r of (data as OndeParou[] | null) ?? []) m[r.id] = r;
      return m;
    },
  });
}

type Jornada = {
  id: string; nome: string | null; criado_em: string; tipo: "criador" | "social" | "parceiro"; origem: string; plano_lp: string | null;
  email_ok: boolean; email_em: string | null; onboarding_ok: boolean; onboarding_em: string | null;
  planos_em: string | null; checkout_em: string | null; checkout_plano: string | null; checkout_vezes: number;
  teste_inicio: string | null; teste_ate: string | null; primeira_cobranca_em: string | null;
  assinante: boolean; plano: string | null; ultimo_acesso: string | null; aparelho: string | null; n_clientes: number;
  passo: number; onde: string; tom: Tom;
  dias: { dia: string; telas: { modulo: string; n: number }[] }[];
  /** Uso de verdade (13/11/2026). Só vem depois da migração 20261113000001. */
  uso?: {
    ferramentas: number; primeira_ferramenta_dia: string | null; dias_ativos: number;
    n_posts: number; primeiro_post_em: string | null;
    email_novo: boolean; email_novo_em: string | null;
  } | null;
};

export function useJornada(userId: string | null) {
  return useQuery<Jornada | null>({
    queryKey: ["admin-jornada", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await rpc("admin_jornada", { _id: userId });
      if (error) return null;
      return (data as Jornada | null) ?? null;
    },
  });
}

const NOME_PLANO: Record<string, string> = { essencial: "Essencial", pro: "Pro", studio: "Studio", agency: "Agência" };
const TELA: Record<string, string> = {
  assinar: "Planos", dashboard: "Início", inicio: "Início", ideias: "Ideias", criando: "Criando", brandbook: "Brandbook", autopilot: "Cria Plano",
  prompter: "Prompter", stories: "Stories", insights: "Insights", configuracoes: "Configurações", linkinbio: "Link na bio",
  clientes: "Clientes", agenda: "Agenda", aprovacoes: "Aprovações", criapost: "Cria Post", captacao: "Captação", criacaixa: "Cria Caixa",
  criacrm: "Cria Gestão", equipe: "Equipe", demandas: "Demandas", tendencias: "Tendências", feed: "Meu Feed", "media-kit": "Media Kit",
  tutoriais: "Tutoriais", metas: "Metas", tarefas: "Tarefas", hubcria: "Radar", criakut: "Criakut",
};
const nomeTela = (m: string) => TELA[m] ?? (m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, " "));

function hora(v: string | null, soDia = false): string | null {
  if (!v) return null;
  try { return format(new Date(v), soDia ? "dd/MM" : "dd/MM HH:mm", { locale: ptBR }); } catch { return null; }
}

/** Explicação em uma frase do ponto onde a pessoa está. */
function frase(j: Jornada): string {
  const plano = j.checkout_plano ? NOME_PLANO[j.checkout_plano] ?? j.checkout_plano : null;
  if (j.tom === "verde" && j.assinante) return "Assinatura ativa e paga.";
  if (j.onde.startsWith("Parou no pagamento")) {
    const vezes = j.checkout_vezes > 1 ? ` (${j.checkout_vezes} vezes)` : "";
    return `${plano ? `Escolheu o plano ${plano} e a` : "A"}briu a página de pagamento do Stripe${j.checkout_em ? ` em ${hora(j.checkout_em)}` : ""}${vezes}, mas não concluiu. Está sem acesso ao app, preso na tela de planos.`;
  }
  if (j.onde.startsWith("Em teste")) return `Teste ativo até ${hora(j.teste_ate, true)}. ${j.teste_inicio ? "Cartão cadastrado: a cobrança é automática no fim." : "Teste grátis, sem cartão: usa o app inteiro e não precisa passar pelos planos."}`;
  if (j.onde === "Não confirmou o e-mail") return "Criou a conta mas não clicou no link de confirmação. Sem isso não entra no app.";
  if (j.onde === "Não fez o onboarding") return "Entrou mas parou nas telas do começo.";
  if (j.onde === "Viu os planos, não clicou") return "Chegou na tela de planos e não clicou em nenhum.";
  if (j.onde === "Não chegou aos planos") return "Terminou o começo mas não chegou na tela de planos.";
  if (j.onde === "Teste acabou sem assinar") return "Usou o teste antigo (sem cartão) e não assinou.";
  if (j.onde === "Social mídia sem cliente") return "Conta de social mídia criada, ainda sem nenhum cliente cadastrado.";
  return j.onde;
}

export function AbaJornada({ userId }: { userId: string | null }) {
  const { data: j, isLoading } = useJornada(userId);
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-28 w-full rounded-2xl" /></div>;
  if (!j) return <p className="text-sm font-body text-muted-foreground">Sem dados de jornada pra esta conta.</p>;

  const social = j.tipo === "social";
  const passos: { t: string; quando: string | null; feito: boolean; extra?: string }[] = social ? [
    { t: "Cadastrou", quando: hora(j.criado_em), feito: true },
    { t: "Confirmou e-mail", quando: hora(j.email_em), feito: j.email_ok },
    { t: "Fez o onboarding", quando: hora(j.onboarding_em), feito: j.onboarding_ok },
    { t: "1º cliente", quando: j.n_clientes > 0 ? `${j.n_clientes} ${j.n_clientes === 1 ? "cliente" : "clientes"}` : null, feito: j.n_clientes > 0 },
  ] : j.uso ? [
    /* CRIADOR, FUNIL DE USO (Walter, 13/11/2026). Desde 12/11 a pessoa entra
       direto e tem 7 dias sem cartão: ver os planos deixou de ser o passo
       seguinte ao onboarding. O painel marcava "parou aqui" nos planos pra
       quem estava só usando o teste, e não mostrava o que importa: abriu
       alguma ferramenta? criou post? voltou? */
    { t: "Cadastrou", quando: hora(j.criado_em), feito: true },
    ...(j.uso.email_novo ? [] : [{ t: "Confirmou e-mail", quando: hora(j.email_em), feito: j.email_ok }]),
    { t: "Fez o onboarding", quando: hora(j.onboarding_em), feito: j.onboarding_ok },
    { t: "Abriu uma ferramenta", feito: j.uso.ferramentas > 0,
      quando: j.uso.ferramentas > 0 ? `${j.uso.ferramentas} ${j.uso.ferramentas === 1 ? "ferramenta" : "ferramentas"}${j.uso.primeira_ferramenta_dia ? `, a primeira em ${hora(j.uso.primeira_ferramenta_dia + "T12:00:00", true)}` : ""}` : null },
    { t: "Criou o 1º post", feito: j.uso.n_posts > 0,
      quando: j.uso.n_posts > 0 ? `${hora(j.uso.primeiro_post_em) ?? ""}${j.uso.n_posts > 1 ? ` · ${j.uso.n_posts} posts` : ""}`.trim() : null },
    { t: "Voltou em outro dia", feito: j.uso.dias_ativos >= 2, quando: j.uso.dias_ativos >= 2 ? `${j.uso.dias_ativos} dias com uso` : null },
    { t: "Viu os planos", quando: hora(j.planos_em, hora(j.planos_em)?.endsWith("12:00") ?? false), feito: j.passo >= 4 },
    { t: "Abriu o pagamento", quando: hora(j.checkout_em), feito: j.passo >= 5,
      extra: j.checkout_plano ? NOME_PLANO[j.checkout_plano] ?? j.checkout_plano : undefined },
    { t: "Assinou", quando: hora(j.primeira_cobranca_em) ?? hora(j.teste_inicio), feito: j.passo >= 6 },
  ] : [
    { t: "Cadastrou", quando: hora(j.criado_em), feito: true },
    { t: "Confirmou e-mail", quando: hora(j.email_em), feito: j.email_ok },
    { t: "Fez o onboarding", quando: hora(j.onboarding_em), feito: j.onboarding_ok },
    // Sem horário exato (contagem por dia, antes de 04/11) o banco manda meio-dia: mostra só o dia.
    { t: "Viu os planos", quando: hora(j.planos_em, hora(j.planos_em)?.endsWith("12:00") ?? false), feito: j.passo >= 4 },
    { t: "Abriu o pagamento", quando: hora(j.checkout_em), feito: j.passo >= 5,
      extra: j.checkout_plano ? NOME_PLANO[j.checkout_plano] ?? j.checkout_plano : undefined },
    { t: "Começou o teste", quando: hora(j.teste_inicio), feito: j.passo >= 6 },
    { t: "1ª cobrança", quando: hora(j.primeira_cobranca_em), feito: j.passo >= 7 },
  ];
  // Passo onde parou: o primeiro não feito (se ainda não chegou ao fim).
  const parada = passos.findIndex((p) => !p.feito);
  const corCaixa = j.tom === "verde" ? "bg-emerald-50 border-emerald-200" : j.tom === "vermelho" ? "bg-red-50 border-red-200" : j.tom === "ambar" ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border";

  return (
    <div className="space-y-4">
      <div className={cn("rounded-2xl border px-4 py-3.5", corCaixa)}>
        <p className="font-display font-extrabold text-[17px] leading-tight">{j.onde}</p>
        <p className="text-[13px] font-body text-foreground/80 mt-1 leading-relaxed">{frase(j)}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-4">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Os passos</h3>
        <ol className="space-y-0">
          {passos.map((p, i) => {
            const eParada = i === parada;
            return (
              <li key={p.t} className="flex items-start gap-3 relative pb-3 last:pb-0">
                {i < passos.length - 1 && <span className={cn("absolute left-[13px] top-7 bottom-0 w-[2px]", p.feito ? "bg-emerald-600" : "bg-border")} />}
                <span className={cn("relative z-[1] w-7 h-7 shrink-0 rounded-full grid place-items-center text-[12px] font-bold",
                  p.feito ? "bg-emerald-600 text-white" : eParada ? "bg-card border-[3px] border-amber-500 text-amber-700" : "bg-muted text-muted-foreground")}>
                  {p.feito ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={cn("text-[13.5px] font-body font-semibold", !p.feito && !eParada && "text-muted-foreground")}>
                    {p.t}{p.extra ? <span className="font-normal text-muted-foreground"> · {p.extra}</span> : null}
                  </p>
                  <p className="text-[11.5px] font-body text-muted-foreground">
                    {p.feito ? (p.quando ?? "feito (sem horário: antes de 04/11)") : eParada ? "parou aqui" : "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {!social && j.uso?.email_novo && (
          <p className="mt-3 border-t border-dashed border-border/70 pt-2.5 text-[12px] font-body text-muted-foreground">
            E-mail: {j.uso.email_novo_em ? <>confirmado em {hora(j.uso.email_novo_em)}.</> : <>ainda não confirmou. Entrou direto pelo cadastro novo; a conta trava no 4º dia se não confirmar.</>}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
          <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">De onde veio</h3>
          {[
            ["Origem", j.origem],
            ["Plano clicado na LP", j.plano_lp ? NOME_PLANO[j.plano_lp] ?? j.plano_lp : "nenhum"],
            ["Tipo de conta", social ? "social mídia" : j.tipo === "parceiro" ? "parceiro" : "criador"],
            ["Aparelho", j.aparelho ?? "não gravado"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1.5 border-b border-dashed border-border/70 last:border-b-0 text-[13px] font-body">
              <span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
          <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">O que abriu, dia a dia</h3>
          {j.dias.length === 0 ? (
            <p className="text-[12.5px] font-body italic text-muted-foreground">Nenhuma tela do app nos últimos 14 dias.</p>
          ) : j.dias.map((d) => (
            <div key={d.dia} className="flex gap-2.5 py-1.5 border-b border-dashed border-border/70 last:border-b-0">
              <span className="w-11 shrink-0 text-[12px] font-body font-semibold text-muted-foreground">{hora(d.dia + "T12:00:00", true)}</span>
              <div className="flex flex-wrap gap-1">
                {d.telas.map((t) => (
                  <span key={t.modulo} className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-body">{nomeTela(t.modulo)}{t.n > 1 ? ` ${t.n}x` : ""}</span>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] font-body text-muted-foreground mt-2">Últimos 14 dias, por tela e por dia.</p>
        </div>
      </div>
    </div>
  );
}
