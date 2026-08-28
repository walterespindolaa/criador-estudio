import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, Layers, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFilaDoParceiro } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   A CASCA DO PARCEIRO

   O designer, o editor e o copy NÃO usam o app do criador: cair lá era o erro
   que o Walter apontou em 28/08, com o PeJota vendo Cria Post, módulos e
   dashboard de criador que não dizem nada pra ele. Aqui é a casca do mockup:
   menu curto (demandas, entregues, marcas que atendo), a marca "Cria
   Parceiros", e nada de módulo de criador.

   Quem também é criador ou social mídia continua com o resto do app: esta
   casca só envolve as rotas /parceiro/*.
   ═══════════════════════════════════════════════════════════════════════════ */

const ITENS = [
  { to: "/parceiro", fim: true, rotulo: "Minhas demandas", Icone: Briefcase, comBadge: true },
  { to: "/parceiro/entregues", fim: false, rotulo: "Entregues", Icone: CheckCircle2, comBadge: false },
  { to: "/parceiro/marcas", fim: false, rotulo: "Marcas que atendo", Icone: Layers, comBadge: false },
];

export default function ParceiroLayout() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: fila = [] } = useFilaDoParceiro();

  const sair = async () => { await signOut(); navigate("/"); };
  const nome = profile?.name || user?.email || "Parceiro";

  return (
    <div className="min-h-screen flex w-full app-canvas">
      {/* ── Menu lateral, curto de propósito ── */}
      <aside className="hidden md:flex w-[220px] flex-none flex-col border-r border-border bg-card px-3 py-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 grid place-items-center text-white font-display font-extrabold">
            C
          </div>
          <div className="leading-tight">
            <p className="font-display font-extrabold text-[15px]">Cria</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-violet-600">Parceiros</p>
          </div>
        </div>

        <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 px-2.5 pb-1.5">Trabalho</p>
        <nav className="space-y-1">
          {ITENS.map(({ to, fim, rotulo, Icone, comBadge }) => (
            <NavLink key={to} to={to} end={fim}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-body font-semibold transition-colors",
                isActive ? "bg-violet-100 text-violet-800" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
              <Icone className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {rotulo}
              {comBadge && fila.length > 0 && (
                <span className="ml-auto min-w-[19px] h-[19px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                  {fila.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border pt-3 space-y-1">
          {/* Quem também é criador/social mídia volta pro app por aqui. Quem é
              SÓ parceiro nem vê o atalho: o app de criador devolveria ele pra
              cá (o gate pula o onboarding de criador pra parceiro), então o
              link seria um botão que não leva a lugar nenhum. */}
          {profile?.onboarding_completed && (
            <NavLink to="/app"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-body font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Layers className="h-4 w-4" strokeWidth={1.75} /> Meu Cria (criador)
            </NavLink>
          )}
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[11px] font-bold shrink-0">
              {nome.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-body font-bold text-foreground truncate">{nome}</span>
              <span className="block text-[10.5px] font-body text-muted-foreground truncate">{user?.email}</span>
            </span>
          </div>
          <button onClick={() => void sair()}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-body font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Topo do celular: sem menu lateral, o essencial vira uma barra. */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 backdrop-blur-sm px-3 py-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 grid place-items-center text-white font-display font-extrabold text-sm">C</div>
          <p className="font-display font-extrabold text-[15px]">Cria Parceiros</p>
          <nav className="ml-auto flex gap-1">
            {ITENS.map(({ to, fim, Icone }) => (
              <NavLink key={to} to={to} end={fim}
                className={({ isActive }) => cn("p-2 rounded-lg", isActive ? "bg-violet-100 text-violet-700" : "text-muted-foreground")}>
                <Icone className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="max-w-5xl mx-auto px-4 py-5 md:px-7 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
