import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { BottomBar } from "@/components/BottomBar";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { Settings } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { applyTheme } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const AppLayout = () => {
  const { profile } = useProfile();

  useEffect(() => {
    if (profile?.theme_preset) {
      applyTheme(profile.theme_preset, profile.theme_accent || '#C4622D');
    }
    // Apply sidebar color override AFTER theme (so it wins)
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PWAInstallBanner />

        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 hidden md:flex items-center justify-between px-4 border-b border-border bg-background sticky top-0 z-40">
            <SidebarTrigger className="mr-3" />
            <div className="flex items-center gap-1">
              <NotificationsBell />
            </div>
          </header>

          <header className="h-14 fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-background border-b border-border md:hidden">
            <NavLink to="/app" className="flex items-center">
              <h1
                className="text-xl font-display font-semibold text-foreground tracking-tight"
                style={{ fontVariationSettings: "'opsz' 9" }}
              >
                CreatorsFlow
              </h1>
            </NavLink>
            <div className="flex items-center gap-1">
              <NotificationsBell />
              <NavLink to="/app/configuracoes" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
                <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </NavLink>
            </div>
          </header>

          <main className="flex-1 pt-14 pb-16 md:pb-0 md:pt-0 w-full">
            <div className="max-w-screen-2xl mx-auto p-4 md:px-8 md:py-6">
              <Outlet />
            </div>
          </main>

          <BottomBar />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
