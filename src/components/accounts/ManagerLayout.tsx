import { Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { ContentSkeleton } from "@/components/shared/ContentSkeleton";
import {
  Home, Boxes, Handshake, DollarSign, Users, ListChecks,
  Settings as SettingsIcon, LogOut, Send, Users2, Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "@/contexts/AccountContext";
import { usePartner } from "@/hooks/usePartner";
import { useModules, type ModuleWithStatus } from "@/hooks/useModules";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { ModulePopup } from "@/components/accounts/ModulePopup";
import { SettingsManagerDrawer } from "@/components/accounts/SettingsManagerDrawer";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
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

  // Mesmo tratamento de tema do AppLayout (managers travam no roxo da marca)
  useEffect(() => {
    if (profile?.theme_preset) {
      const accent = profile.account_type === "manager" ? "#8B5CF6" : (profile.theme_accent || "#8B5CF6");
      applyTheme(profile.theme_preset, accent);
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

  const navBtn = (active: boolean) =>
    cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body text-left transition-colors",
      active ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground");

  // Guards
  if (isLoading) return <LoadingScreen />;
  if (profile?.must_change_password === true) return <Navigate to="/app/trocar-senha" replace />;
  // criadores (não-manager) não entram no hub
  if (profile && profile.account_type !== "manager" && !hasManagedAccounts) return <Navigate to="/app" replace />;

  const ctx: ManagerOutletContext = { openModule, openSettings: () => setSettingsOpen(true) };

  return (
    <div className="min-h-screen bg-background flex" style={{ ["--active-font-display" as string]: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}>
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/40 px-3 py-5 sticky top-0 h-screen overflow-y-auto">
        <div className="px-2 mb-5"><Logo className="h-8 w-auto" /></div>
        <button className={navBtn(isActive("/socialmidia/dashboard"))} onClick={() => navigate("/socialmidia/dashboard")}><Home className="h-4 w-4" /> Início</button>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1.5">Módulos</p>
        {modules.map((m) => {
          const Icon = MODICONS[m.code] ?? Boxes;
          const active = m.status === "active" || m.status === "past_due";
          const route = MODULE_ROUTE[m.code];
          return (
            <button key={m.code} className={navBtn(!!route && isActive(route))} onClick={() => openModule(m)}>
              <Icon className="h-4 w-4" /> <span className="flex-1">{m.name}</span>
              <span className={cn("text-[9.5px] font-bold px-2 py-0.5 rounded-full",
                active ? "bg-green-100 text-green-700" : m.coming_soon ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                {active ? "Ativo" : m.coming_soon ? "Em breve" : brl(m.price_cents)}
              </span>
            </button>
          );
        })}
        <div className="h-px bg-border mx-2 my-3" />
        {NAV.map((n) => {
          const Icon = n.icon;
          const onClick = n.to === "/socialmidia/comissoes" ? onNavComissoes : () => navigate(n.to);
          return <button key={n.to} className={navBtn(isActive(n.to))} onClick={onClick}><Icon className="h-4 w-4 shrink-0" /> <span className="text-left leading-tight">{n.label}</span></button>;
        })}
        <div className="flex-1" />
        <button className={navBtn(false)} onClick={() => setSettingsOpen(true)}><SettingsIcon className="h-4 w-4" /> Configurações</button>
        <button className={navBtn(false)} onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sair</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-1 border-b border-border px-3 py-2 overflow-x-auto">
          <button className={cn("px-3 py-1.5 rounded-lg text-sm font-body whitespace-nowrap", isActive("/socialmidia/dashboard") ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground")} onClick={() => navigate("/socialmidia/dashboard")}>Início</button>
          {NAV.map((n) => (
            <button key={n.to} className={cn("px-3 py-1.5 rounded-lg text-sm font-body whitespace-nowrap", isActive(n.to) ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground")} onClick={n.to === "/socialmidia/comissoes" ? onNavComissoes : () => navigate(n.to)}>{n.to === "/socialmidia/aprovacoes" ? "Aprovações" : n.label}</button>
          ))}
          <div className="flex-1" />
          <button aria-label="Configurações" className="px-2 py-1.5 rounded-lg text-muted-foreground shrink-0" onClick={() => setSettingsOpen(true)}><SettingsIcon className="h-4 w-4" /></button>
          <button aria-label="Sair" className="px-2 py-1.5 rounded-lg text-muted-foreground shrink-0" onClick={handleSignOut}><LogOut className="h-4 w-4" /></button>
        </div>

        <main className="flex-1 px-4 sm:px-8 py-7 sm:py-10">
          <div className="w-full max-w-6xl mx-auto">
            <Suspense fallback={<ContentSkeleton />}>
              <Outlet context={ctx} />
            </Suspense>
          </div>
        </main>
      </div>

      <ModulePopup module={selectedModule} onClose={() => setSelectedModule(null)} />
      <SettingsManagerDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
