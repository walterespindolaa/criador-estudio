import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Loader2, TrendingUp, ChevronRight, Lightbulb, ChevronDown,
  AlertTriangle, Radar, Search, CheckCircle2,
} from "lucide-react";
import { useCrmClients } from "@/hooks/useCrm";
import {
  useAllCreativeIdeas, useHasHubCria, useAllCompetitors, useHubCredits, diasSemLeitura,
} from "@/hooks/useHubCria";
import { CriativoTab } from "@/components/hubcria/CriativoTab";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
const DIAS_FRIO = 21;

/* ═══════════════════════════════════════════════════════════════════════════
   O DASHBOARD DO CRIA RADAR

   Esta página era uma LISTA DE CLIENTES. Ela não fazia nada que a tela de
   Clientes já não fizesse — era um menu pra chegar noutro lugar.

   Agora ela responde a única pergunta que importa aqui: ONDE EU PRECISO AGIR?
   Quem está com concorrente esfriando, quem nunca foi lido, e quantas pautas
   você pagou pra gerar e ninguém abriu. Esse último número é o mais honesto do
   sistema: é ele que mostra quando o módulo está sendo desperdiçado.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HubCria() {
  const navigate = useNavigate();
  const [avulsa, setAvulsa] = useState(false);
  const { allowed, isLoading: gateLoading } = useHasHubCria();
  const { data: clients = [], isLoading } = useCrmClients();
  const { data: ideas = [] } = useAllCreativeIdeas();
  const { data: competidores = [] } = useAllCompetitors();
  const { data: credits } = useHubCredits();

  const quota = credits?.quota ?? 0;
  const usados = credits?.used ?? 0;
  const restantes = Math.max(0, quota - usados);
  const pctUso = quota > 0 ? Math.min(100, Math.round((usados / quota) * 100)) : 0;

  // O placar do módulo. "Nunca abertas" é o número que dói — e é de propósito.
  const placar = useMemo(() => {
    const usadas = ideas.filter((i) => i.status === "usada").length;
    const marcadas = ideas.filter((i) => i.status === "usar").length;
    const novas = ideas.filter((i) => i.status === "novo").length;
    return { total: ideas.length, usadas, marcadas, novas };
  }, [ideas]);

  // Quem precisa de atenção: concorrente esfriando, ou cliente sem radar nenhum.
  const atencao = useMemo(() => {
    const porCliente = new Map<string, typeof competidores>();
    for (const c of competidores) {
      if (!c.crm_client_id) continue;
      const arr = porCliente.get(c.crm_client_id) ?? [];
      arr.push(c);
      porCliente.set(c.crm_client_id, arr);
    }

    const ativos = clients.filter((c) => (c.status ?? "ativo") !== "inativo");

    return ativos
      .map((cli) => {
        const comps = porCliente.get(cli.id) ?? [];
        const frios = comps.filter((c) => {
          const d = diasSemLeitura(c);
          return d == null || d >= DIAS_FRIO;
        });
        const paradas = ideas.filter((i) => i.crm_client_id === cli.id && i.status === "novo").length;
        const semRadar = comps.length === 0;
        // Peso: sem radar é o pior (o módulo nem começou a trabalhar por ele).
        const peso = (semRadar ? 100 : 0) + frios.length * 10 + Math.min(paradas, 9);
        return { cli, comps, frios, paradas, semRadar, peso };
      })
      .filter((r) => r.peso > 0)
      .sort((a, b) => b.peso - a.peso);
  }, [clients, competidores, ideas]);

  const emDia = useMemo(
    () => clients.filter((c) => (c.status ?? "ativo") !== "inativo").length - atencao.length,
    [clients, atencao],
  );

  if (!gateLoading && !allowed) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-body text-muted-foreground">Você não tem acesso ao Cria Radar.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/socialmidia/clientes")}>Ir para Clientes</Button>
      </div>
    );
  }

  const hex = CRIA_HEX.lilas;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0 space-y-6">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7">
        <OrganicBlobs color="lilas" />
        <div className="relative flex items-start justify-between gap-5 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 mb-2.5">
              <Radar className="h-3.5 w-3.5" />
              <span className="text-[10px] font-body font-bold uppercase tracking-wider">Cria Radar</span>
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Onde você precisa agir hoje
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
              Os concorrentes dos seus clientes não avisam quando mudam de estratégia. Aqui você vê
              quem está esfriando — e o que já foi lido e ninguém aproveitou.
            </p>
          </div>

          {quota > 0 && (
            <div className="relative w-full sm:w-auto sm:shrink-0 rounded-2xl border border-border bg-background/70 backdrop-blur-sm px-4 py-3 sm:min-w-[172px]">
              <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Créditos do mês</p>
              <p className="font-display text-2xl font-extrabold text-foreground tabular-nums leading-none mt-1">
                {restantes}<span className="text-sm font-bold text-muted-foreground">/{quota}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", restantes === 0 ? "bg-destructive" : pctUso > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${100 - pctUso}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRECISA DE ATENÇÃO */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" /></div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl py-16 px-6 text-center">
          <TrendingUp className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-display font-bold text-foreground">Nenhum cliente ainda</p>
          <p className="text-[13px] font-body text-muted-foreground mt-1 mb-4">Cadastre um cliente pra começar a espiar os concorrentes dele.</p>
          <Button onClick={() => navigate("/socialmidia/clientes")}>Ir para Clientes</Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-display font-extrabold text-foreground">Precisa de atenção</h2>
            {emDia > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-[12px] font-body text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {emDia} {emDia === 1 ? "cliente em dia" : "clientes em dia"}
              </span>
            )}
          </div>

          {atencao.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-display font-bold text-foreground">Está tudo em dia</p>
              <p className="text-[13px] font-body text-muted-foreground mt-1">
                Todos os clientes têm concorrente no radar e leitura recente. Bom momento pra usar as pautas paradas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {atencao.map(({ cli, comps, frios, paradas, semRadar }) => (
                <button
                  key={cli.id}
                  onClick={() => navigate(`/socialmidia/clientes/${cli.id}/pesquisa`)}
                  className={cn(
                    "text-left rounded-2xl border-2 bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                    semRadar ? "border-destructive/30 bg-destructive/[0.03]" : "border-amber-500/30 bg-amber-500/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full font-display font-extrabold text-white text-sm"
                      style={{ background: `linear-gradient(135deg, ${hex}, #a6b4f6)` }}
                    >
                      {initial(cli.name)}
                      {cli.logo && <img src={cli.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-display font-bold text-foreground truncate">{cli.name}</span>
                      <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                        {semRadar ? "nenhum concorrente no radar" : `${comps.length} ${comps.length === 1 ? "concorrente" : "concorrentes"}`}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {semRadar ? (
                      <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-destructive/12 text-destructive">
                        nunca foi lido
                      </span>
                    ) : (
                      frios.length > 0 && (
                        <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">
                          {frios.length} {frios.length === 1 ? "esfriando" : "esfriando"}
                        </span>
                      )
                    )}
                    {paradas > 0 && (
                      <span className="text-[11px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {paradas} {paradas === 1 ? "pauta parada" : "pautas paradas"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* O PLACAR: o que o HUB já te deu — e o que você deixou na mesa. */}
      {placar.total > 0 && (
        <div>
          <h2 className="text-sm font-display font-extrabold text-foreground mb-3">O que o HUB já te deu</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Placar label="Pautas geradas" valor={placar.total} />
            <Placar label="Viraram post" valor={placar.usadas} cor="text-emerald-600" />
            <Placar label="Marcadas “usar”" valor={placar.marcadas} cor="text-primary" />
            <Placar label="Ninguém abriu" valor={placar.novas} cor={placar.novas > 0 ? "text-amber-600" : undefined} />
          </div>
          {placar.novas > 0 && (
            <p className="text-[12.5px] font-body text-muted-foreground mt-2.5 leading-relaxed">
              <strong className="text-foreground">{placar.novas} pautas prontas estão paradas.</strong>{" "}
              Cada uma custou crédito e ninguém olhou — é aqui que o módulo deixa de se pagar.
            </p>
          )}
        </div>
      )}

      {/* PESQUISA AVULSA — ela não é de cliente nenhum, então mora aqui, e não
          dentro da ficha. */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setAvulsa((v) => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground/70">
            <Search className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-display font-extrabold text-foreground">Espiar alguém que não é cliente</span>
            <span className="block text-[12.5px] font-body text-muted-foreground">
              Uma prospecção, uma referência de outro nicho. Fica guardado aqui no HUB — não entra na ficha de ninguém.
            </span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", avulsa && "rotate-180")} />
        </button>
        {avulsa && (
          <div className="border-t border-border p-5">
            <CriativoTab />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Placar({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className={cn("font-display text-2xl font-extrabold tabular-nums leading-none", cor ?? "text-foreground")}>{valor}</p>
      <p className="text-[11.5px] font-body text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}
