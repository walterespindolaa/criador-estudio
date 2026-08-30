import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, Layers, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFilaDoParceiro } from "@/hooks/useParceiro";
import { Logo } from "@/components/shared/Logo";
import { BgShapes } from "@/components/BgShapes";
import { statusRamp } from "@/lib/statusRamp";
import { deriveTier } from "@/hooks/useTier";

/* ═══════════════════════════════════════════════════════════════════════════
   A CASCA DO PARCEIRO, NA LÍNGUA DO CRIA

   Primeira versão saiu genérica (roxo, branco chapado, "C" inventado) e o
   Walter apontou na hora: "totalmente diferente da essência do Cria". Esta
   versão fala o idioma do resto do app: logo de verdade, faixa hero com as
   formas orgânicas na cor do accent (mesma do painel da social mídia),
   app-canvas com blobs ao fundo e a sidebar no padrão do AppSidebar (título
   de seção com a barrinha, item ativo no primary).

   O menu continua curto de propósito: demandas, entregues, marcas. Parceiro
   não vê módulo de criador; quem também É criador tem o atalho "Meu Cria".
   ═══════════════════════════════════════════════════════════════════════════ */

const ITENS = [
  { to: "/parceiro", fim: true, rotulo: "Minhas demandas", Icone: Briefcase, comBadge: true },
  { to: "/parceiro/entregues", fim: false, rotulo: "Entregues", Icone: CheckCircle2, comBadge: false },
  { to: "/parceiro/marcas", fim: false, rotulo: "Marcas que atendo", Icone: Layers, comBadge: false },
];

const FAIXA: Record<string, { titulo: string; sub: string }> = {
  "/parceiro": { titulo: "Minhas demandas", sub: "Tudo que as agências mandaram pra sua mão." },
  "/parceiro/entregues": { titulo: "Entregues", sub: "O seu histórico de trabalho, agrupado por agência." },
  "/parceiro/marcas": { titulo: "Marcas que atendo", sub: "Quem te acoplou e o trabalho em cada relação." },
};

/** A faixa hero do parceiro: mesmo desenho da HeroBand da social mídia
 *  (gradiente no hue do accent + blobs da identidade), sem o recuo do rail. */
function FaixaParceiro({ titulo, sub, extra }: { titulo: string; sub: string; extra?: string }) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  return (
    <header className="relative overflow-hidden rounded-b-[26px] px-5 pt-5 pb-5 md:px-8 text-white shadow-[0_18px_50px_-24px_rgba(35,25,70,0.5)]"
      style={{ background: grad }}>
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 120% at 88% -10%, rgba(255,255,255,.18), transparent 60%)" }} />
      <div aria-hidden className="cria-blob pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-[38%_62%_55%_45%/48%_42%_58%_52%] bg-[#FFCF03] opacity-70" />
      <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-20 right-[18%] h-40 w-40 rounded-[55%_45%_40%_60%/50%_60%_40%_50%] bg-[#FF77B9] opacity-60" />
      <div aria-hidden className="cria-blob cria-blob-fast pointer-events-none absolute top-[26%] right-[40%] hidden h-10 w-10 rounded-full bg-[#FDFBF5] opacity-70 md:block" />
      <div className="relative">
        {extra && <p className="text-sm font-body text-white/80">{extra}</p>}
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{titulo}</h1>
        <p className="mt-1 text-sm font-body text-white/85">{sub}</p>
      </div>
    </header>
  );
}

export default function ParceiroLayout() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: fila = [] } = useFilaDoParceiro();

  const sair = async () => { await signOut(); navigate("/"); };
  const nome = profile?.name || user?.email || "Parceiro";
  const faixa = FAIXA[location.pathname] ?? FAIXA["/parceiro"];
  const abertos = fila.length;
  const extra = location.pathname === "/parceiro" && abertos > 0
    ? `${abertos} card${abertos === 1 ? "" : "s"} na sua mão`
    : undefined;

  return (
    <div className="min-h-screen flex w-full app-canvas relative">
      <BgShapes styleKey={(profile as { theme_bg?: string | null } | null | undefined)?.theme_bg ?? "organico"} />

      {/* ── Menu lateral: card flutuante arredondado, como o rail do app ── */}
      <aside className="hidden md:flex w-[236px] flex-none flex-col rounded-[24px] border border-border bg-card/95 backdrop-blur-xl px-3 py-5 sticky top-4 self-start ml-4 my-4 max-h-[calc(100vh-2rem)] z-[2] shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)]">
        <div className="flex items-end gap-2 px-2.5 pb-5">
          <Logo className="h-7 w-auto" />
          <span className="text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-primary pb-0.5">Parceiros</span>
        </div>

        <p className="flex items-center gap-1.5 text-[12px] font-display font-extrabold uppercase tracking-[0.1em] text-primary px-3 mb-2 before:content-[''] before:h-[3px] before:w-3 before:rounded-full before:bg-primary/70">
          Trabalho
        </p>
        <nav className="space-y-1">
          {ITENS.map(({ to, fim, rotulo, Icone, comBadge }) => (
            <NavLink key={to} to={to} end={fim}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-body font-semibold transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
          {/* Quem também é criador/social mídia (plano vigente) volta pro app
              por aqui. Quem é SÓ parceiro nem vê o atalho: sem plano, o /app é
              um paywall, e foi nele que o PeJota ficou preso. O convite pra
              assinar mora na home, com contexto, não escondido num link. */}
          {profile?.onboarding_completed && deriveTier(profile) !== "none" && (
            <NavLink to="/app"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-body font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Layers className="h-4 w-4" strokeWidth={1.75} /> Meu Cria (criador)
            </NavLink>
          )}
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-display font-bold shrink-0 overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : nome.charAt(0).toUpperCase()}
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

      <div className="flex-1 min-w-0 relative z-[1]">
        {/* Topo do celular: logo real + os três destinos. */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 backdrop-blur-sm px-3 py-2.5">
          <Logo className="h-6 w-auto" />
          <span className="text-[8.5px] font-display font-extrabold uppercase tracking-[0.14em] text-primary">Parceiros</span>
          <nav className="ml-auto flex gap-1">
            {ITENS.map(({ to, fim, Icone }) => (
              <NavLink key={to} to={to} end={fim}
                className={({ isActive }) => cn("p-2 rounded-lg", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                <Icone className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </NavLink>
            ))}
          </nav>
        </div>

        <FaixaParceiro titulo={faixa.titulo} sub={faixa.sub} extra={extra} />

        <main className="max-w-5xl mx-auto px-4 py-5 md:px-7 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
