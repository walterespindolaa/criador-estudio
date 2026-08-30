import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase, Camera, CheckCircle2, ChevronsLeft, ChevronsRight, Gem, Layers,
  Lock, LogOut, Search, Send, Trash2, Users, Wallet,
} from "lucide-react";
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

   Rail flutuante à esquerda (cantos de 24px, centrado na vertical), HeroBand
   sangrando em largura total por trás, e o menu com as MESMAS seções do
   painel da social mídia: Trabalho (o dia a dia dele), Módulos (Cria Post,
   Gestão, Caixa, Captação, com cadeado pra quem ainda não tem plano; o
   cadeado leva pros planos, na casca dele) e Conta (planos, lixeira pra quem
   tem o lado criador, sair).

   Expande no hover E tem o botão de fixar (ChevronsRight/Left), igual ao
   menu da social mídia: fixado fica aberto até a pessoa recolher, e a
   escolha persiste no aparelho.
   ═══════════════════════════════════════════════════════════════════════════ */

const LS_RAIL = "cria_parceiro_rail_fixado";

const TRABALHO = [
  { to: "/parceiro", fim: true, rotulo: "Minhas demandas", Icone: Briefcase, comBadge: true },
  { to: "/parceiro/entregues", fim: false, rotulo: "Entregues", Icone: CheckCircle2, comBadge: false },
  { to: "/parceiro/marcas", fim: false, rotulo: "Marcas que atendo", Icone: Layers, comBadge: false },
];

/* Os módulos do Cria, no menu do parceiro como estão no da social mídia. Sem
   plano ficam com cadeado e levam pros planos: o menu inteiro vira vitrine
   do caminho de crescimento, não só a home. */
const MODULOS = [
  // O parceiro JÁ É uma conta de gestão apontada pra parceiros (toque do
  // Walter, 30/08): com o lado gestão destravado, o módulo abre DE VERDADE
  // no /socialmidia (onde o ModuleGate vende cada módulo com os benefícios).
  // Sem destravar, o clique abre a vitrine do módulo na voz do parceiro.
  { rotulo: "Cria Post", Icone: Send, slug: "criapost", gestao: "/socialmidia/criapost" },
  { rotulo: "Cria Gestão", Icone: Users, slug: "gestao", gestao: "/socialmidia/criacrm" },
  { rotulo: "Cria Caixa", Icone: Wallet, slug: "caixa", gestao: "/socialmidia/criacaixa" },
  { rotulo: "Cria Captação", Icone: Camera, slug: "captacao", gestao: "/socialmidia/captacao" },
  { rotulo: "Cria Radar", Icone: Search, slug: "radar", gestao: "/socialmidia/hubcria" },
];

const FAIXA: Record<string, { titulo: string; sub: string }> = {
  "/parceiro": { titulo: "Minhas demandas", sub: "Tudo que as agências mandaram pra sua mão." },
  "/parceiro/entregues": { titulo: "Entregues", sub: "O seu histórico de trabalho, agrupado por agência." },
  "/parceiro/marcas": { titulo: "Marcas que atendo", sub: "Quem te acoplou e o trabalho em cada relação." },
  "/parceiro/planos": { titulo: "Cresça com o Cria", sub: "O trabalho das agências é grátis pra sempre. Isto aqui é pra ir além." },
  "/parceiro/modulos/criapost": { titulo: "Cria Post", sub: "As ferramentas de produção pros clientes que são SEUS." },
  "/parceiro/modulos/gestao": { titulo: "Cria Gestão", sub: "CRM, propostas e contratos pra fechar e manter os seus jobs." },
  "/parceiro/modulos/caixa": { titulo: "Cria Caixa", sub: "O dinheiro de cada agência e cliente, com imposto e lucro." },
  "/parceiro/modulos/captacao": { titulo: "Cria Captação", sub: "Roteiro, teleprompter e guia de gravação pra quem filma." },
  "/parceiro/modulos/radar": { titulo: "Cria Radar", sub: "Referências e concorrência do nicho de cada cliente." },
};

export default function ParceiroLayout() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: fila = [] } = useFilaDoParceiro();
  const [fixado, setFixado] = useState(() => localStorage.getItem(LS_RAIL) === "1");
  const [hover, setHover] = useState(false);
  const aberto = fixado || hover;

  const alternarFixado = () => {
    const v = !fixado;
    setFixado(v);
    localStorage.setItem(LS_RAIL, v ? "1" : "0");
  };

  const sair = async () => { await signOut(); navigate("/"); };
  const nome = profile?.name || user?.email || "Parceiro";
  const faixa = FAIXA[location.pathname] ?? FAIXA["/parceiro"];
  const abertos = fila.length;
  const eyebrow = location.pathname === "/parceiro" && abertos > 0
    ? `${abertos} card${abertos === 1 ? "" : "s"} na sua mão`
    : faixa.sub;
  const temLadoCriador = !!profile?.onboarding_completed && deriveTier(profile) !== "none";
  // Conta de gestão no MESMO login: o parceiro não "vira" outra coisa, ele
  // destrava o lado que já era dele.
  const temLadoGestao = profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0;

  const avatar = (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 font-display font-bold text-white shadow-sm">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : nome.charAt(0).toUpperCase()}
    </div>
  );

  const Secao = ({ nome: n }: { nome: string }) =>
    aberto ? (
      <p className="px-2.5 pt-3 pb-1 text-[10px] font-display font-extrabold uppercase tracking-[0.1em] text-muted-foreground/70 whitespace-nowrap">
        {n}
      </p>
    ) : <div className="my-2 mx-2 border-t border-border" />;

  const itemCls = (ativo: boolean) => cn(
    "relative flex items-center rounded-2xl transition-colors w-full",
    aberto ? "gap-2.5 px-3 py-2" : "justify-center p-2.5",
    ativo ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  return (
    <div className="min-h-screen app-canvas relative">
      <BgShapes styleKey={(profile as { theme_bg?: string | null } | null | undefined)?.theme_bg ?? "organico"} />

      {/* ── O RAIL: flutuante, hover + fixável, padrão do app ── */}
      <nav
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] px-2 py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex max-h-[calc(100vh-3rem)] overflow-y-auto",
          aberto ? "w-[240px] items-stretch" : "w-[64px] items-stretch",
        )}
      >
        <div className={cn("mb-1 flex items-center gap-2", aberto ? "px-1" : "justify-center")}>
          <Logo icon className="h-8 w-8 shrink-0" />
          {aberto && (
            <>
              <span className="text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-primary whitespace-nowrap">
                Parceiros
              </span>
              {/* Fixar/recolher, igual ao menu da social mídia. */}
              <button type="button" onClick={alternarFixado} title={fixado ? "Recolher o menu" : "Manter aberto"}
                className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {fixado ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>

        <Secao nome="Trabalho" />
        <div className="space-y-1">
          {TRABALHO.map(({ to, fim, rotulo, Icone, comBadge }) => (
            <NavLink key={to} to={to} end={fim} title={rotulo}
              className={({ isActive }) => itemCls(isActive)}>
              <Icone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">{rotulo}</span>}
              {comBadge && fila.length > 0 && (
                aberto ? (
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

        <Secao nome="Módulos" />
        <div className="space-y-1">
          {MODULOS.map(({ rotulo, Icone, slug, gestao }) => {
            const destravado = temLadoGestao || temLadoCriador;
            const destino = temLadoGestao ? gestao : temLadoCriador ? "/app" : `/parceiro/modulos/${slug}`;
            return (
              <button key={rotulo} type="button" title={destravado ? rotulo : `${rotulo} (conhecer)`}
                onClick={() => navigate(destino)}
                className={itemCls(false)}>
                <Icone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {aberto && (
                  <>
                    <span className="text-[13px] font-body font-semibold whitespace-nowrap">{rotulo}</span>
                    {!destravado && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                  </>
                )}
                {!aberto && !destravado && (
                  <Lock className="absolute right-1 bottom-1 h-2.5 w-2.5 text-muted-foreground/50" />
                )}
              </button>
            );
          })}
        </div>

        <Secao nome="Conta" />
        <div className="space-y-1 pb-1">
          <NavLink to="/parceiro/planos" title="Planos" className={({ isActive }) => itemCls(isActive)}>
            <Gem className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Planos</span>}
          </NavLink>
          {temLadoGestao && (
            <button type="button" title="Minha área de gestão" onClick={() => navigate("/socialmidia/dashboard")} className={itemCls(false)}>
              <Users className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Minha área de gestão</span>}
            </button>
          )}
          {temLadoCriador && (
            <>
              <button type="button" title="Lixeira" onClick={() => navigate("/app/lixeira")} className={itemCls(false)}>
                <Trash2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Lixeira</span>}
              </button>
              <button type="button" title="Meu Cria (criador)" onClick={() => navigate("/app")} className={itemCls(false)}>
                <Layers className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Meu Cria (criador)</span>}
              </button>
            </>
          )}
          {aberto && (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-display font-bold shrink-0 overflow-hidden">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : nome.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-body font-bold text-foreground truncate">{nome}</span>
                <span className="block text-[10px] font-body text-muted-foreground truncate">{user?.email}</span>
              </span>
            </div>
          )}
          <button onClick={() => void sair()} title="Sair" className={itemCls(false)}>
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {aberto && <span className="text-[13px] font-body font-semibold whitespace-nowrap">Sair</span>}
          </button>
        </div>
      </nav>

      <div className="flex min-h-screen flex-col md:pl-[104px]">
        {/* HeroBand (desktop): sangra em largura total por trás do rail. */}
        <div className="hidden md:block md:-ml-[104px] md:w-[calc(100%+104px)]">
          <HeroBand eyebrow={eyebrow} title={faixa.titulo} avatar={avatar} />
        </div>

        {/* Celular: barra compacta + faixa colorida própria. */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 backdrop-blur-sm px-3 py-2.5">
          <Logo className="h-6 w-auto" />
          <span className="text-[8.5px] font-display font-extrabold uppercase tracking-[0.14em] text-primary">Parceiros</span>
          <nav className="ml-auto flex gap-1">
            {TRABALHO.map(({ to, fim, Icone }) => (
              <NavLink key={to} to={to} end={fim}
                className={({ isActive }) => cn("p-2 rounded-lg", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                <Icone className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </NavLink>
            ))}
            <NavLink to="/parceiro/planos"
              className={({ isActive }) => cn("p-2 rounded-lg", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <Gem className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </NavLink>
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
