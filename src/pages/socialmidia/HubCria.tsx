import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, TrendingUp, ChevronRight, Lightbulb, ChevronDown } from "lucide-react";
import { useCrmClients } from "@/hooks/useCrm";
import { useAllCreativeIdeas, useHasHubCria } from "@/hooks/useHubCria";
import { CriativoTab } from "@/components/hubcria/CriativoTab";
import { Button } from "@/components/ui/button";

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");

export default function HubCria() {
  const navigate = useNavigate();
  const [avulsa, setAvulsa] = useState(false);
  const { allowed, isLoading: gateLoading } = useHasHubCria();
  const { data: clients = [], isLoading } = useCrmClients();
  const { data: ideas = [] } = useAllCreativeIdeas();

  const byClient = useMemo(() => {
    const m: Record<string, { pendentes: number; total: number }> = {};
    for (const i of ideas) {
      if (!i.crm_client_id) continue;
      const e = (m[i.crm_client_id] ??= { pendentes: 0, total: 0 });
      e.total += 1;
      if (i.status === "novo" || i.status === "usar") e.pendentes += 1;
    }
    return m;
  }, [ideas]);

  if (!gateLoading && !allowed) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-body text-muted-foreground">Você não tem acesso ao HUB CRIA.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/socialmidia/clientes")}>Ir para Clientes</Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">HUB CRIA</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Analise concorrentes e gere ideias por cliente.</p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" /></div>
        ) : clients.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center">
            <TrendingUp className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nenhum cliente ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1 mb-4">Cadastre um cliente pra começar a analisar concorrentes.</p>
            <Button onClick={() => navigate("/socialmidia/clientes")}>Ir para Clientes</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map((c) => {
              const stat = byClient[c.id] ?? { pendentes: 0, total: 0 };
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/socialmidia/clientes/${c.id}/criativo`)}
                  className="text-left bg-card border border-border rounded-2xl p-4 hover:shadow-warm-md transition-shadow flex flex-col"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative w-11 h-11 rounded-full grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                      {initial(c.name)}
                      {c.logo && <img src={c.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-body font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-body truncate">{c.instagram ? `@${c.instagram.replace(/^@/, "")}` : c.segment || "—"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/60">
                    <span className="flex items-center gap-1.5 text-xs font-body">
                      <Lightbulb className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold text-foreground">{stat.pendentes}</span>
                      <span className="text-muted-foreground">pendentes</span>
                    </span>
                    <span className="text-xs font-body text-muted-foreground ml-auto">{stat.total} ideias no total</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Análise avulsa (sem cliente) */}
      <div className="mt-8 border-t border-border pt-5">
        <button onClick={() => setAvulsa((v) => !v)} className="flex items-center gap-2 text-sm font-display font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" /> Análise avulsa (sem cliente)
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${avulsa ? "rotate-180" : ""}`} />
        </button>
        <p className="text-xs font-body text-muted-foreground mt-1">Rode um scrape exploratório sem amarrar a um cliente — as ideias ficam guardadas aqui no HUB.</p>
        {avulsa && <div className="mt-4"><CriativoTab /></div>}
      </div>
    </motion.div>
  );
}
