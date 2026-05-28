import { useEffect } from "react";
import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { BottomBar } from "@/components/BottomBar";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { AppFooter } from "@/components/shared/AppFooter";
import { Settings } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { applyTheme } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CriaAIProvider } from "@/contexts/CriaAIContext";
import { CriaAIPanel } from "@/components/ai/CriaAIPanel";
import { TrialBanner } from "@/components/TrialBanner";
import { StorageWarningBanner } from "@/components/StorageWarningBanner";
import { useLastSeen } from "@/hooks/useLastSeen";

const AppLayout = () => {
  const { profile, isLoading } = useProfile();
  const location = useLocation();

  useLastSeen();

  useEffect(() => {
    if (profile?.theme_preset) {
      applyTheme(profile.theme_preset, profile.theme_accent || '#C4622D');
    }
    // Apply sidebar color override AFTER theme (so it wins)
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  if (!isLoading && profile && profile.onboarding_completed === false) {
    if (location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return (
    <CriaAIProvider>
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        <TrialBanner />
        <StorageWarningBanner />
        <div className="flex flex-1 w-full min-h-0">
          <PWAInstallBanner />
          <CriaAIPanel />

          <div className="hidden md:block">
            <AppSidebar />
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 hidden md:flex items-center justify-between px-4 border-b border-border bg-background sticky top-0 z-40">
              <SidebarTrigger className="mr-3" />
              <div className="flex items-center gap-2">
                <PlanBadge />
                <NotificationsBell />
              </div>
            </header>

            <header className="h-14 fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-background border-b border-border md:hidden">
              <NavLink to="/app" className="flex items-center">
                <h1
                  className="text-xl font-display font-semibold text-foreground tracking-tight"
                  style={{ fontVariationSettings: "'opsz' 9" }}
                >
                  cria
                </h1>
              </NavLink>
              <div className="flex items-center gap-1.5">
                <PlanBadge />
                <NotificationsBell />
                <NavLink to="/app/configuracoes" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
                  <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </NavLink>
              </div>
            </header>

            <main className="flex-1 pt-14 pb-24 md:pb-0 md:pt-0 w-full">
              <div className="max-w-screen-2xl mx-auto px-4 py-4 md:px-8 md:py-6">
                <Outlet />
              </div>
              <AppFooter />
            </main>

            <BottomBar />
          </div>
        </div>
      </div>
    </SidebarProvider>
    </CriaAIProvider>
  );
};

export default AppLayout;
