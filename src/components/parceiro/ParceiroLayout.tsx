import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, Layers, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFilaDoParceiro } from "@/hooks/useParceiro";
import { Logo } from "@/components/shared/Logo";
import { BgShapes } from "@/components/BgShapes";
import { HeroBand } from "@/components/HeroBand";
import { statusRamp } from "@/lib/statusRamp";
import { deriveTier } from "@/hooks/useTier";

/* ═══════════════════════════════════════════════════════════════════════════
   A CASCA DO PARCEIRO, NO MESMO DESENHO DA SOCIAL MÍDIA

   O Walter mostrou lado a lado: o app real usa um RAIL flutuante de ícones à
   esquerda (centrado na vertical, cantos de 24px, expande no hover mostrando
   os nomes) com a HeroBand sangrando em largura total por trás dele. A minha
   primeira sidebar era um cartão estático que não conversava com nada. Esta
   versão copia a gramática do ManagerLayout: mesmo rail, mesma HeroBand,
   mesmo recuo de 104px no conteúdo.

   O menu continua curto de propósito: demandas, entregues, marcas. Parceiro
   sem plano não vê atalho pro app de criador (era o caminho do paywall).
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
  "/parceiro/planos": { titulo: "Cresça com o Cria", sub: "O trabalho das agências é grátis pra sempre. Isto aqui é pra ir além." },
};

export default function ParceiroLayout() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: fila = [] } = useFilaDoParceiro();
  const [railAberto, setRailAberto] = useState(false);

  const sair = async () => { await signOut(); navigate("/"); };
  const nome = profile?.name || user?.email || "Parceiro";
  const faixa = FAIXA[location.pathname] ?? FAIXA["/parceiro"];
  const abertos = fila.length;
  const eyebrow = location.pathname === "/parceiro" && abertos > 0
    ? `${abertos} card${abertos === 1 ? "" : "s"} na sua mão`
    : faixa.sub;
  const temLadoCriador = !!profile?.onboarding_completed && deriveTier(profile) !== "none";

  const avatar = (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 font-display font-bold text-white shadow-sm">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : nome.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="min-h-screen app-canvas relative">
      <BgShapes styleKey={(profile as { theme_bg?: string | null } | null | undefined)?.theme_bg ?? "organico"} />

      {/* ── O RAIL: flutuante, centrado, expande no hover (padrão do app) ── */}
      <nav
        onMouseEnter={() => setRailAberto(true)}
        onMouseLeave={() => setRailAberto(false)}
        className={cn(
          "fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] px-2 py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex",
          railAberto ? "w-[240px] items-stretch" : "w-[64px] items-stretch",
        )}
      >
        <div className={cn("mb-2 flex items-center gap-2", railAberto ? "px-1" : "justify-center")}>
          <Logo icon className="h-8 w-8 shrink-0" />
          {railAberto && (
            <span className="text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-primary whitespace-nowrap">
              Parceiros
            </span>
          )}
        </div>

        {railAberto && (
          <p className="px-2.5 pb-1 text-[10px] font-display font-extrabold uppercase tracking-[0.1em] text-muted-foreground/70 whitespace-nowrap">
            Trabalho
          </p>
        )}
        <div className="space-y-1">
          {ITENS.map(({ to, fim, rotulo, Icone, comBadge }) => (
            <NavLink key={to} to={to} end={fim}
              title={rotulo}
              className={({ isActive }) => cn(
                "relative flex items-center rounded-2xl transition-colors",
                railAberto ? "gap-2.5 px-3 py-2.5" : "justify-center p-2.5",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
              <Icone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {railAberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">{rotulo}</span>}
              {comBadge && fila.length > 0 && (
                railAberto ? (
                  <span className="ml-auto min-w-[19px] h-[19px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                    {fila.length}
                  </span>
                ) : (
                  <span className="absolute right-1.5 top-1.5 w-2 h-2 rounded-full bg-red-500" />
                )
              )}
            </NavLink>
          ))}
        </div>

        <div className="mt-2 border-t border-border pt-2 space-y-1">
          {/* Quem também é criador (plano vigente) volta pro app por aqui. Quem
              é só parceiro nem vê: sem plano, o /app é um paywall. */}
          {temLadoCriador && (
            <NavLink to="/app" title="Meu Cria (criador)"
              className={cn("flex items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                railAberto ? "gap-2.5 px-3 py-2" : "justify-center p-2.5")}>
              <Layers className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {railAberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Meu Cria (criador)</span>}
            </NavLink>
          )}
          <button onClick={() => void sair()} title="Sair"
            className={cn("w-full flex items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              railAberto ? "gap-2.5 px-3 py-2" : "justify-center p-2.5")}>
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {railAberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Sair</span>}
          </button>
        </div>
      </nav>

      <div className="flex min-h-screen flex-col md:pl-[104px]">
        {/* HeroBand (desktop): sangra em largura total por trás do rail,
            exatamente como no painel da social mídia. */}
        <div className="hidden md:block md:-ml-[104px] md:w-[calc(100%+104px)]">
          <HeroBand eyebrow={eyebrow} title={faixa.titulo} avatar={avatar} />
        </div>

        {/* Celular: barra compacta + faixa colorida própria. */}
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
        <FaixaMobile titulo={faixa.titulo} sub={eyebrow} />

        <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** A faixa do celular: mesma linguagem da HeroBand (gradiente no hue do
 *  accent + blobs), sem o recuo do rail, que não existe no mobile. */
function FaixaMobile({ titulo, sub }: { titulo: string; sub: string }) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  return (
    <header className="md:hidden relative overflow-hidden rounded-b-[26px] px-5 pt-4 pb-4 text-white shadow-[0_18px_50px_-24px_rgba(35,25,70,0.5)]"
      style={{ background: grad }}>
      <div aria-hidden className="cria-blob pointer-events-none absolute -top-20 -right-12 h-40 w-40 rounded-[38%_62%_55%_45%/48%_42%_58%_52%] bg-[#FFCF03] opacity-70" />
      <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-16 right-[24%] h-28 w-28 rounded-[55%_45%_40%_60%/50%_60%_40%_50%] bg-[#FF77B9] opacity-60" />
      <div className="relative">
        <h1 className="font-display text-xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-0.5 text-[13px] font-body text-white/85">{sub}</p>
      </div>
    </header>
  );
}
