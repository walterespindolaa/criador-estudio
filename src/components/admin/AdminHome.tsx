import { useAdminResumo, useAdminAtencao, useAdminCustoIa, type ContaEmAtencao } from "@/hooks/useAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Clock, Flame, Ghost, Lock, TrendingDown, TrendingUp,
  UserPlus, Users, Wallet, Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   A HOME DO PAINEL DE ADMIN (Walter, 22/09/2026)

   O painel antigo abria na lista de usuários com quatro contagens em cima:
   total, ativos em 7 dias, onboarded e admins. Isso responde "quantas contas
   existem", que é a pergunta menos útil que se pode fazer de manhã.

   Esta tela responde outras três, na ordem em que a cabeça pergunta:

     1. COMO ESTÁ O NEGÓCIO  (entrada, uso, planos, dinheiro)
     2. QUEM PRECISA DE MIM HOJE  (travados, sumidos, trial vencendo, no teto)
     3. QUANTO ESTÁ CUSTANDO  (IA por fornecedor e as contas fora da curva)

   Cada nome nas listas abre o drawer da conta, que é onde se resolve. O ponto
   inteiro é sair daqui já agindo, e não ter que caçar a pessoa na lista.

   Dinheiro (MRR, inadimplência) fica na aba Dinheiro, que lê o Stripe. Aqui só
   entra o que o banco sabe responder sozinho, pra Home abrir rápido.
   ═══════════════════════════════════════════════════════════════════════════ */

const nb = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/* Um número com contexto. O contexto é o que transforma "12" em informação:
   sozinho ele não diz se é bom, e comparado ao mês passado, diz. */
function Numero({ icone: Icone, valor, rotulo, nota, tom = "neutro", delta }: {
  icone: typeof Users; valor: string; rotulo: string; nota?: string;
  tom?: "neutro" | "bom" | "atencao"; delta?: number | null;
}) {
  const cor = tom === "bom" ? "text-green-600" : tom === "atencao" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icone className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10.5px] font-body font-bold uppercase tracking-wider truncate">{rotulo}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
        <span className={`text-[26px] leading-none font-display font-extrabold ${cor}`}>{valor}</span>
        {typeof delta === "number" && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-body font-bold ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      {nota && <p className="text-[11px] font-body text-muted-foreground mt-1 leading-snug">{nota}</p>}
    </div>
  );
}

/* Uma lista de gente pra tocar. Vazia é BOA NOTÍCIA e diz isso com todas as
   letras, em vez de mostrar um quadro cinza que parece defeito. */
function ListaDeAcao({ titulo, explica, icone: Icone, tom, itens, sufixo, aoAbrir }: {
  titulo: string; explica: string; icone: typeof Users;
  tom: "vermelho" | "ambar" | "azul";
  itens: ContaEmAtencao[];
  sufixo: (c: ContaEmAtencao) => string;
  aoAbrir: (id: string) => void;
}) {
  const cores = {
    vermelho: { borda: "border-red-200", fundo: "bg-red-50/60", icone: "text-red-600", selo: "bg-red-100 text-red-700" },
    ambar: { borda: "border-amber-200", fundo: "bg-amber-50/60", icone: "text-amber-600", selo: "bg-amber-100 text-amber-700" },
    azul: { borda: "border-blue-200", fundo: "bg-blue-50/60", icone: "text-blue-600", selo: "bg-blue-100 text-blue-700" },
  }[tom];

  return (
    <div className={`rounded-2xl border ${cores.borda} ${cores.fundo} p-3.5 min-w-0`}>
      <div className="flex items-start gap-2">
        <Icone className={`h-4 w-4 mt-0.5 shrink-0 ${cores.icone}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-display font-bold text-foreground leading-tight">
            {titulo} {itens.length > 0 && <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full ${cores.selo}`}>{itens.length}</span>}
          </p>
          <p className="text-[11px] font-body text-muted-foreground leading-snug mt-0.5">{explica}</p>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-[12px] font-body text-muted-foreground mt-2.5 pl-6">Ninguém por aqui. Bom sinal.</p>
      ) : (
        <ul className="mt-2.5 space-y-1">
          {itens.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => aoAbrir(c.id)}
                className="w-full flex items-center gap-2 rounded-xl bg-card/80 px-2.5 py-1.5 text-left hover:bg-card transition-colors border border-transparent hover:border-border"
              >
                <span className="text-[12.5px] font-body font-semibold text-foreground truncate flex-1 min-w-0">
                  {c.nome || "Sem nome"}
                </span>
                <span className="text-[11px] font-body text-muted-foreground shrink-0">{sufixo(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2.5">{titulo}</h2>
      {children}
    </section>
  );
}

export function AdminHome({ aoAbrirConta }: { aoAbrirConta: (id: string) => void }) {
  const { data: resumo, isLoading } = useAdminResumo();
  const { data: atencao } = useAdminAtencao();
  const { data: custo } = useAdminCustoIa(30);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
      </div>
    );
  }

  if (!resumo) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-sm font-display font-bold text-foreground">Os números novos ainda não estão no banco</p>
        <p className="text-[12.5px] font-body text-muted-foreground mt-1">
          Rode a migration <code className="font-mono">20260922000001_painel_admin_metricas.sql</code> e recarregue. As outras abas seguem funcionando.
        </p>
      </div>
    );
  }

  // Mês contra mês NO MESMO DIA: comparar mês inteiro com mês pela metade faria
  // todo dia 2 parecer catástrofe.
  const base = resumo.novos.mes_passado_ate_hoje;
  const deltaNovos = base > 0 ? Math.round(((resumo.novos.mes_atual - base) / base) * 100) : null;
  const a = resumo.ativacao;

  return (
    <div className="space-y-6">
      <Secao titulo="Como está o negócio">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Numero icone={UserPlus} valor={nb(resumo.novos.mes_atual)} rotulo="Novos no mês" delta={deltaNovos}
            nota={`${nb(resumo.novos.d7)} nos últimos 7 dias`} />
          <Numero icone={Zap} valor={nb(resumo.ativos.d7)} rotulo="Ativos em 7 dias" tom="bom"
            nota={`${pct(resumo.ativos.d7, resumo.contas.total)}% da base · ${nb(resumo.ativos.d1)} hoje`} />
          <Numero icone={Wallet} valor={nb(resumo.assinatura.ativas)} rotulo="Assinaturas ativas"
            nota={`${nb(resumo.planos.pro)} pro · ${nb(resumo.planos.studio)} studio · ${nb(resumo.planos.agency)} agência`} />
          <Numero icone={Clock} valor={nb(resumo.trial.em_trial)} rotulo="Em trial"
            tom={resumo.trial.vence_7d > 0 ? "atencao" : "neutro"}
            nota={`${nb(resumo.trial.vence_7d)} vencem em 7 dias`} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2.5">
          <Numero icone={Users} valor={nb(resumo.contas.total)} rotulo="Contas"
            nota={`${nb(resumo.contas.social_midia)} social mídia · ${nb(resumo.contas.criadoras)} criadora`} />
          <Numero icone={Users} valor={nb(resumo.contas.parceiros)} rotulo="Parceiros"
            nota={`${nb(resumo.contas.clientes_de_agencia)} contas de cliente`} />
          <Numero icone={Flame} valor={nb(resumo.producao.publicados_30d)} rotulo="Publicados em 30d"
            nota={`de ${nb(resumo.producao.posts_30d)} peças criadas`} />
          <Numero icone={Users} valor={nb(resumo.producao.clientes_crm)} rotulo="Clientes no CRM"
            nota="somados em todas as carteiras" />
        </div>
      </Secao>

      {/* ATIVAÇÃO: o funil dos últimos 30 dias. É o que diz se o problema é
          atrair gente ou segurar quem já chegou. */}
      <Secao titulo="Ativação de quem entrou nos últimos 30 dias">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { n: a.entraram, r: "Entraram", p: 100 },
              { n: a.onboarding, r: "Terminaram o onboarding", p: pct(a.onboarding, a.entraram) },
              { n: a.voltaram, r: "Voltaram outro dia", p: pct(a.voltaram, a.entraram) },
              { n: a.produziram, r: "Criaram alguma peça", p: pct(a.produziram, a.entraram) },
            ].map((d) => (
              <div key={d.r} className="min-w-0">
                <p className="text-[22px] leading-none font-display font-extrabold text-foreground">{nb(d.n)}</p>
                <p className="text-[11px] font-body text-muted-foreground mt-1 leading-snug">{d.r}</p>
                <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${d.p}%` }} />
                </div>
                <p className="text-[10.5px] font-body text-muted-foreground mt-0.5">{d.p}%</p>
              </div>
            ))}
          </div>
          {a.entraram > 0 && a.produziram / a.entraram < 0.3 && (
            <p className="text-[11.5px] font-body text-amber-700 mt-3 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Menos de um terço de quem entrou chegou a criar uma peça. O gargalo está depois do cadastro, não na entrada.
            </p>
          )}
        </div>
      </Secao>

      <Secao titulo="Quem precisa de você hoje">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <ListaDeAcao
            titulo="Travados no começo" icone={Ghost} tom="ambar"
            explica="Entraram, não terminaram o onboarding e não voltaram. A intenção já existiu."
            itens={atencao?.travados ?? []} aoAbrir={aoAbrirConta}
            sufixo={(c) => `há ${c.dias} dias`}
          />
          <ListaDeAcao
            titulo="Trial vencendo" icone={Clock} tom="azul"
            explica="Vence nos próximos 7 dias. Falar antes de vencer custa menos que reconquistar depois."
            itens={atencao?.trial_vencendo ?? []} aoAbrir={aoAbrirConta}
            sufixo={(c) => (c.dias === 0 ? "vence hoje" : `${c.dias} dia${c.dias === 1 ? "" : "s"}`)}
          />
          <ListaDeAcao
            titulo="Bateram no teto da carteira" icone={Lock} tom="vermelho"
            explica="Não conseguem cadastrar mais clientes. É dinheiro parado na porta, dos dois lados."
            itens={atencao?.no_teto ?? []} aoAbrir={aoAbrirConta}
            sufixo={(c) => `${c.usados}/${c.teto}`}
          />
          <ListaDeAcao
            titulo="Sumiram" icone={Ghost} tom="ambar"
            explica="Pagam e não aparecem há mais de duas semanas. Costuma virar cancelamento sem aviso."
            itens={atencao?.sumidos ?? []} aoAbrir={aoAbrirConta}
            sufixo={(c) => `há ${c.dias} dias`}
          />
          <ListaDeAcao
            titulo="Batendo em erro" icone={AlertTriangle} tom="vermelho"
            explica="Três ou mais erros nos últimos 7 dias. Provavelmente não vão reclamar, só vão embora."
            itens={atencao?.com_erro ?? []} aoAbrir={aoAbrirConta}
            sufixo={(c) => `${c.erros} erros`}
          />
        </div>
      </Secao>

      {custo && (
        <Secao titulo="Custo de IA nos últimos 30 dias">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Numero icone={Wallet} valor={`US$ ${custo.radar.custo_usd.toFixed(2)}`} rotulo="Radar (Apify)"
              tom={custo.radar.custo_usd > 50 ? "atencao" : "neutro"}
              nota={`${nb(custo.radar.scrapes)} pesquisas`} />
            <Numero icone={Zap} valor={nb(custo.chamadas_ia)} rotulo="Chamadas de IA"
              nota="texto, roteiro, análise" />
            <Numero icone={Flame} valor={nb(custo.imagens_estudio)} rotulo="Imagens geradas"
              nota="Estúdio" />
            <div className="rounded-2xl border border-border bg-card p-3.5 min-w-0">
              <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground">Fora da curva</p>
              {custo.top_contas.length === 0 ? (
                <p className="text-[12px] font-body text-muted-foreground mt-2">Sem gasto no período.</p>
              ) : (
                <ul className="mt-1.5 space-y-0.5">
                  {custo.top_contas.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => aoAbrirConta(c.id)}
                        className="w-full flex items-center gap-2 text-left hover:text-primary transition-colors">
                        <span className="text-[12px] font-body truncate flex-1 min-w-0">{c.nome || "Sem nome"}</span>
                        <span className="text-[11px] font-body font-bold shrink-0">US$ {c.custo_usd.toFixed(2)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="text-[10.5px] font-body text-muted-foreground mt-2">
            Só o Radar tem custo real em dólar (é o que a Apify cobra por pesquisa). O resto é contagem de uso: ninguém cobra por chamada avulsa.
          </p>
        </Secao>
      )}
    </div>
  );
}
