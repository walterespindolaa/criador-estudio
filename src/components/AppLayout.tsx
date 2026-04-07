import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomBar } from "@/components/BottomBar";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { Settings } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { applyThemeColor, applyThemeFont } from "@/components/settings/SettingsVisual";

const AppLayout = () => {
  const { profile } = useProfile();

  useEffect(() => {
    if (profile?.theme_color) applyThemeColor(profile.theme_color);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Desktop TopBar */}
      <TopBar />

      {/* Mobile Header */}
      <header className="h-14 fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-[#FAF8F4] border-b border-[rgba(28,28,26,0.08)] md:hidden">
        <NavLink to="/app" className="flex items-center">
          <h1 
            className="text-xl font-display font-semibold text-foreground tracking-tight"
            style={{ fontVariationSettings: "'opsz' 9" }}
          >
            Criadores
          </h1>
        </NavLink>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <NavLink to="/app/configuracoes" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
            <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </NavLink>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 pt-14 pb-16 md:pb-0 md:pt-14 w-full">
        <div className="max-w-screen-2xl mx-auto p-4 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile BottomBar */}
      <BottomBar />
    </div>
  );
};

export default AppLayout;
