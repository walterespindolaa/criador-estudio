import { Suspense, useEffect } from "react";
import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { ContentSkeleton } from "@/components/shared/ContentSkeleton";
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
import { VideoPublicConfirmProvider } from "@/contexts/VideoPublicConfirmContext";
import { CriaAIPanel } from "@/components/ai/CriaAIPanel";
import { TrialBanner } from "@/components/TrialBanner";
import { StorageWarningBanner } from "@/components/StorageWarningBanner";
import { ManagingBanner } from "@/components/accounts/ManagingBanner";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useLastSeen } from "@/hooks/useLastSeen";
import { installOverflowDetector } from "@/lib/overflow-detector";
import { UploadProgressProvider } from "@/contexts/UploadProgressContext";
import { UploadProgressIndicator } from "@/components/UploadProgressIndicator";

const AppLayout = () => {
  const { profile, isLoading } = useProfile();
  const { isManaging } = useActiveAccount();
  const location = useLocation();

  useLastSeen();

  useEffect(() => {
    installOverflowDetector();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void import("@/pages/app/Ideias");
      void import("@/pages/app/Criando");
      void import("@/pages/app/Plano");
      void import("@/pages/app/Tarefas");
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (profile?.theme_preset) {
      // Managers nunca usam accent personalizado — fica travado no roxo da marca.
      const accent = profile.account_type === "manager" ? '#8B5CF6' : (profile.theme_accent || '#8B5CF6');
      applyTheme(profile.theme_preset, accent);
    }
    // Apply sidebar color override AFTER theme (so it wins)
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  if (!isLoading && profile?.must_change_password === true && location.pathname !== "/app/trocar-senha") {
    return <Navigate to="/app/trocar-senha" replace />;
  }

  // Social media (manager) sem cliente ativo: vai pra área dedicada /socialmidia
  if (!isLoading && profile?.account_type === "manager" && !isManaging) {
    return <Navigate to="/socialmidia/dashboard" replace />;
  }

  if (!isLoading && profile && profile.onboarding_completed === false && profile.account_type !== "manager") {
    if (location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return (
    <CriaAIProvider>
    <VideoPublicConfirmProvider>
    <UploadProgressProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <div className="flex flex-1 w-full min-h-0">
          <PWAInstallBanner />
          <CriaAIPanel />

          <div className="hidden md:block">
            <AppSidebar />
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <ManagingBanner />
            <TrialBanner />
            <StorageWarningBanner />
            <header className="h-12 hidden md:flex items-center justify-between px-4 border-b border-border bg-background sticky top-0 z-40">
              <SidebarTrigger className="mr-3" />
              <div className="flex items-center gap-2">
                <PlanBadge />
                <UploadProgressIndicator />
                <NotificationsBell />
              </div>
            </header>

            <header className="h-14 sticky top-0 z-40 flex items-center justify-between px-4 bg-background border-b border-border md:hidden">
              <NavLink to="/app" className="flex items-center">
                <h1
                  className="text-xl font-display font-semibold text-foreground tracking-tight"
                  style={{ fontVariationSettings: "'opsz' 9" }}
                >
                  cria
                </h1>
              </NavLink>
              <div className="flex items-center gap-1.5">
                <AccountSwitcher compact />
                <PlanBadge />
                <UploadProgressIndicator />
                <NotificationsBell />
                <NavLink to="/app/configuracoes" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
                  <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </NavLink>
              </div>
            </header>

            <main className="flex-1 pb-24 md:pb-0 w-full">
              <div className="max-w-screen-2xl mx-auto px-4 py-4 md:px-8 md:py-6">
                <Suspense fallback={<ContentSkeleton />}>
                  <Outlet />
                </Suspense>
              </div>
              <AppFooter />
            </main>

            <BottomBar />
          </div>
        </div>
      </div>
    </SidebarProvider>
    </UploadProgressProvider>
    </VideoPublicConfirmProvider>
    </CriaAIProvider>
  );
};

export default AppLayout;
