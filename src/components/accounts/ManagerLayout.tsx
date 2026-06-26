import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { ContentSkeleton } from "@/components/shared/ContentSkeleton";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { NotificationNudge } from "@/components/NotificationNudge";
import { FeedbackButton } from "@/components/FeedbackButton";
import {
  Home, Boxes, Handshake, DollarSign, Users, ListChecks, ChevronUp,
  Settings as SettingsIcon, LogOut, Send, Users2, Wallet, Lock, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "@/contexts/AccountContext";
import { usePartner } from "@/hooks/usePartner";
import { useModules, type ModuleWithStatus } from "@/hooks/useModules";
import { cn } from "@/lib/utils";
import { ModulePopup } from "@/components/accounts/ModulePopup";
import { SettingsManagerDrawer } from "@/components/accounts/SettingsManagerDrawer";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { HeroBand } from "@/components/HeroBand";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { applyTheme } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const MODICONS: Record<string, typeof Send> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet };
const MODULE_ROUTE: Record<string, string> = {
  aprovapost_externo: "/socialmidia/criapost",
  crm: "/socialmidia/criacrm",
  financeiro: "/socialmidia/criacaixa",
};

const NAV = [
  { to: "/socialmidia/parceria", label: "Parceria", icon: Handshake },
  { to: "/socialmidia/comissoes", label: "Comissões", icon: DollarSign },
  { to: "/socialmidia/contas", label: "Suas contas", icon: Users },
  { to: "/socialmidia/aprovacoes", label: "Acompanhamento de Aprovações", icon: ListChecks },
] as const;

// Títulos do HeroBand por rota (gestão)
const HERO_TITLES: Record<string, string> = {
  "/socialmidia/criapost": "Clientes",
  "/socialmidia/criacrm": "Cria Gestão",
  "/socialmidia/criacaixa": "Cria Caixa",
  "/socialmidia/parceria": "Parceria",
  "/socialmidia/comissoes": "Comissões",
  "/socialmidia/contas": "Suas contas",
  "/socialmidia/aprovacoes": "Acompanhamento de Aprovações",
};

export type ManagerOutletContext = { openModule: (m: ModuleWithStatus) => void; openSettings: () => void };
export function useManagerOutlet() { return useOutletContext<ManagerOutletContext>(); }

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile, isLoading } = useProfile();
  const { hasManagedAccounts } = useActiveAccount();
  const { isPartner } = usePartner();
  const { modules } = useModules();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleWithStatus | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Tema: managers agora escolhem o próprio accent (igual usuário normal). Sem trava de roxo.
  useEffect(() => {
    if (profile?.theme_preset) {
      applyTheme(profile.theme_preset, profile.theme_accent || "#8B5CF6");
    }
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  const isActive = (to: string) =>
    to === "/socialmidia/dashboard"
      ? location.pathname === to || location.pathname === "/socialmidia"
      : location.pathname.startsWith(to);

  const openModule = (m: ModuleWithStatus) => {
    const active = m.status === "active" || m.status === "past_due";
    const route = MODULE_ROUTE[m.code];
    if (active && route) navigate(route);
    else setSelectedModule(m);
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };
  const onNavComissoes = () => navigate(isPartner ? "/socialmidia/comissoes" : "/socialmidia/parceria");

  // Item do rail flutuante (icon-only, com tooltip e cantinho de status opcional)
  const railNode = (
    Icon: LucideIcon,
    label: string,
    opts: { active?: boolean; onClick: () => void; corner?: ReactNode; tipBadge?: ReactNode },
  ) => (
    <div key={label} className="group relative flex w-full justify-center">
      <button
        type="button"
        onClick={opts.onClick}
        aria-label={label}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-2xl transition-colors",
          opts.active
            ? "bg-primary/15 text-primary"
            : "text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {opts.active && <span className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-primary" />}
        {opts.corner}
      </button>
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
        {label}{opts.tipBadge}
      </span>
    </div>
  );

  // Guards
  if (isLoading) return <LoadingScreen />;
  if (profile?.must_change_password === true) return <Navigate to="/app/trocar-senha" replace />;
  // criadores (não-manager) não entram no hub
  if (profile && profile.account_type !== "manager" && !hasManagedAccounts) return <Navigate to="/app" replace />;

  const ctx: ManagerOutletContext = { openModule, openSettings: () => setSettingsOpen(true) };

  // HeroBand (desktop)
  const isDash = location.pathname === "/socialmidia" || location.pathname === "/socialmidia/dashboard";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = (profile?.name ?? "").trim().split(" ")[0] || "você";
  const heroTitle = isDash
    ? `${firstName} 👋`
    : (Object.entries(HERO_TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] ?? "Gestão");
  const avatarNode = isDash ? (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 font-display font-bold text-white shadow-sm">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : firstName.charAt(0).toUpperCase()}
    </div>
  ) : null;

  return (
    <div className="min-h-screen app-canvas" style={{ ["--active-font-display" as string]: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}>
      {/* Rail flutuante (desktop) — substitui a sidebar w-64 */}
      <nav className="fixed left-5 top-[calc(50%+0.75rem)] z-40 hidden w-[64px] -translate-y-1/2 flex-col items-center rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl md:flex">
        <div className="mb-2 grid h-[38px] w-[38px] place-items-center rounded-[12px] bg-primary font-display text-[17px] font-extrabold text-primary-foreground">c</div>
        <div className="flex w-full flex-col items-center gap-1">
          {railNode(Home, "Início", { active: isActive("/socialmidia/dashboard"), onClick: () => navigate("/socialmidia/dashboard") })}
          {modules.map((m) => {
            const Icon = (MODICONS[m.code] ?? Boxes) as LucideIcon;
            const active = m.status === "active" || m.status === "past_due";
            const route = MODULE_ROUTE[m.code];
            const corner = active
              ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-[hsl(var(--sidebar-background))]" />
              : <Lock className="absolute right-0.5 top-0.5 h-3 w-3 text-muted-foreground" />;
            const tipBadge = (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                active ? "bg-green-500/20 text-green-300" : m.coming_soon ? "bg-white/15 text-background/80" : "bg-white/15 text-background/90")}>
                {active ? "Ativo" : m.coming_soon ? "Em breve" : brl(m.price_cents)}
              </span>
            );
            return railNode(Icon, m.name, { active: !!route && isActive(route), onClick: () => openModule(m), corner, tipBadge });
          })}
          <div className="my-2 h-px w-8 bg-border" />
          {NAV.map((n) => {
            const onClick = n.to === "/socialmidia/comissoes" ? onNavComissoes : () => navigate(n.to);
            return railNode(n.icon as LucideIcon, n.label, { active: isActive(n.to), onClick });
          })}
        </div>
        <div className="flex-1" />
        <div className="my-2 h-px w-8 bg-border" />
        <div className="flex w-full flex-col items-center gap-1">
          {railNode(SettingsIcon, "Configurações", { onClick: () => setSettingsOpen(true) })}
          {railNode(LogOut, "Sair", { onClick: handleSignOut })}
        </div>
      </nav>

      <div className="flex min-h-screen flex-col md:pl-[104px]">
        {/* HeroBand (desktop) — sangra full-width por trás do rail */}
        <div className="hidden md:block md:-ml-[104px] md:w-[calc(100%+104px)]">
          <HeroBand eyebrow={isDash ? `${greet},` : undefined} title={heroTitle} avatar={avatarNode}>
            <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-2 py-1 backdrop-blur">
              <FeedbackButton />
              <NotificationsBell />
            </div>
          </HeroBand>
        </div>

        <main className="flex-1 px-4 py-7 pb-[96px] sm:px-8 sm:py-10 md:pb-10 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl">
            <BroadcastBanner audience="social" />
            <NotificationNudge />
            <Suspense fallback={<ContentSkeleton />}>
              <Outlet context={ctx} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Dock flutuante mobile — estilo pessoa física */}
      {(() => {
        const dockItem = (active: boolean, Icon: typeof Home, label: string, onClick: () => void) => (
          <button key={label} type="button" onClick={onClick}
            className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-2xl">
            <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} strokeWidth={active ? 2 : 1.6} />
            <span className={cn("text-[10px] font-body", active ? "text-primary font-semibold" : "text-muted-foreground font-medium")}>{label}</span>
          </button>
        );
        const crm = modules.find((m) => m.code === "crm");
        const fin = modules.find((m) => m.code === "financeiro");
        const post = modules.find((m) => m.code === "aprovapost_externo");
        const moreNav = [
          ...(post ? [{ label: "Clientes", icon: Send, onClick: () => openModule(post) }] : []),
          { label: "Parceria", icon: Handshake, onClick: () => navigate("/socialmidia/parceria") },
          { label: "Comissões", icon: DollarSign, onClick: onNavComissoes },
          { label: "Suas contas", icon: Users, onClick: () => navigate("/socialmidia/contas") },
          { label: "Config.", icon: SettingsIcon, onClick: () => setSettingsOpen(true) },
        ];
        return (
          <>
            {moreOpen && (
              <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            )}
            {moreOpen && (
              <div className="fixed left-3 right-3 z-40 md:hidden bg-card/95 backdrop-blur-lg border border-border rounded-3xl shadow-warm-lg p-4"
                   style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}>
                <div className="grid grid-cols-4 gap-2.5">
                  {moreNav.map((n) => (
                    <button key={n.label} type="button" onClick={() => { setMoreOpen(false); n.onClick(); }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                      <n.icon className="h-5 w-5" strokeWidth={1.5} />
                      <span className="text-[10px] font-body font-medium leading-tight text-center">{n.label}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setMoreOpen(false); handleSignOut(); }}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors text-sm font-body font-medium">
                  <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sair
                </button>
              </div>
            )}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
                 style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}>
              <div className="flex items-center justify-center gap-2.5 px-3 pointer-events-auto">
                <div className="dock-pill flex items-center gap-0.5 rounded-[30px] p-1.5">
                  {dockItem(isActive("/socialmidia/dashboard"), Home, "Início", () => navigate("/socialmidia/dashboard"))}
                  {crm && dockItem(isActive("/socialmidia/criacrm"), Users2, "Gestão", () => openModule(crm))}
                  {fin && dockItem(isActive("/socialmidia/criacaixa"), Wallet, "Caixa", () => openModule(fin))}
                  {dockItem(isActive("/socialmidia/aprovacoes"), ListChecks, "Aprov.", () => navigate("/socialmidia/aprovacoes"))}
                </div>
                <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-label="Mais"
                  className="dock-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform">
                  <ChevronUp className={cn("h-6 w-6 transition-transform", moreOpen ? "rotate-180 text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </>
        );
      })()}

      <ModulePopup module={selectedModule} onClose={() => setSelectedModule(null)} />
      <SettingsManagerDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
