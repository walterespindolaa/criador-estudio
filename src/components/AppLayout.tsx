import { Suspense, useEffect } from "react";
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ContentSkeleton } from "@/components/shared/ContentSkeleton";
import { BottomBar } from "@/components/BottomBar";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { NotificationNudge } from "@/components/NotificationNudge";
import { FeedbackButton } from "@/components/FeedbackButton";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { AppFooter } from "@/components/shared/AppFooter";
import { Settings, Lightbulb, Plus } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { applyTheme } from "@/lib/applyTheme";
import { BgShapes } from "@/components/BgShapes";
import { TourProvider } from "@/components/tour/TourProvider";
import { HelpButton } from "@/components/tour/HelpButton";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";
import ContaPausada from "@/pages/ContaPausada";
import { AppSidebar } from "@/components/AppSidebar";
import { AppRail } from "@/components/AppRail";
import { HeroBand } from "@/components/HeroBand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarProvider } from "@/components/ui/sidebar";
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
  const { isManaging, activeAccountId, managedAccounts, teamAccounts } = useActiveAccount();
  const location = useLocation();
  const navigate = useNavigate();

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
      // Accent personalizado vale pra todos (inclusive managers); fallback no laranja da marca.
      applyTheme(profile.theme_preset, profile.theme_accent || '#CE4A1D');
    }
    // Apply sidebar color override AFTER theme (so it wins)
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
  }, [profile]);

  if (!isLoading && profile?.must_change_password === true && location.pathname !== "/app/trocar-senha") {
    return <Navigate to="/app/trocar-senha" replace />;
  }

  // Conta de criadora pausada pela agência (inventário): bloqueia o uso.
  if (!isLoading && !isManaging && profile?.subscription_status === "parked") {
    return <ContaPausada />;
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

  const hour = new Date().getHours();
  const greetWord = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  // Gerenciando a conta de um cliente: a saudação e o avatar são do CLIENTE, não do gestor logado.
  const managedAccount = isManaging
    ? [...managedAccounts, ...teamAccounts].find((a) => a.owner_id === activeAccountId) ?? null
    : null;
  const displayName = managedAccount?.name ?? profile?.name ?? "";
  const displayAvatarUrl = managedAccount ? managedAccount.avatar_url : profile?.avatar_url;
  const firstName = displayName.trim().split(" ")[0] || "criador";
  const PAGE_TITLES: Record<string, string> = {
    "/app/ideias": "Ideias", "/app/aprovacao": "Aprovações", "/app/feed": "Meu Feed", "/app/tarefas": "Tarefas",
    "/app/criando": "Criando", "/app/metas": "Metas", "/app/arquivos": "Arquivos",
    "/app/biblioteca": "Biblioteca", "/app/brandbook": "Brandbook", "/app/linkinbio": "Link in Bio",
    "/app/collabs": "Collabs", "/app/insights": "Insights", "/app/relatorios": "Relatórios", "/app/historico": "Histórico",
    "/app/aprender": "Aprender", "/app/configuracoes": "Configurações",
  };
  const isDash = location.pathname === "/app";
  const heroTitle = isDash ? `${firstName} 👋` : (PAGE_TITLES[location.pathname] ?? "CRIA");
  const heroEyebrow = isDash ? `${greetWord},` : undefined;
  const avatarNode = isDash ? (
    <Avatar className="h-11 w-11 shrink-0 border-2 border-white/40 shadow-sm">
      <AvatarImage src={displayAvatarUrl ?? undefined} alt={firstName} />
      <AvatarFallback className="bg-white/20 font-display font-bold text-white">
        {firstName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  ) : null;

  const quickActions = isDash ? (
    <>
      <button onClick={() => navigate("/app/ideias")}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-foreground shadow-sm transition hover:opacity-90">
        <Lightbulb className="h-4 w-4" /> Nova ideia
      </button>
      <button onClick={() => navigate("/app/criando")}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25">
        <Plus className="h-4 w-4" /> Novo post
      </button>
    </>
  ) : null;

  return (
    <TourProvider>
    <CriaAIProvider>
    <VideoPublicConfirmProvider>
    <UploadProgressProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full app-canvas relative">
        <BgShapes styleKey={(profile as { theme_bg?: string | null } | null | undefined)?.theme_bg} />
        <div className="flex flex-1 w-full min-h-0 relative z-[1]">
          <PWAInstallBanner />
          <CriaAIPanel />

          <div className="hidden">
            <AppSidebar />
          </div>
          <AppRail />

          <div className="flex-1 flex flex-col min-w-0 md:pl-[104px]">
            <ManagingBanner />
            <TrialBanner />
            <StorageWarningBanner />
            <div className="hidden md:block md:-ml-[104px] md:w-[calc(100%+104px)]">
              <HeroBand eyebrow={heroEyebrow} title={heroTitle} avatar={avatarNode} actions={quickActions}>
                <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-2 py-1 backdrop-blur">
                  <GlobalSearch />
                  <PlanBadge light />
                  <UploadProgressIndicator />
                  <HelpButton light />
                  <FeedbackButton />
                  <NotificationsBell />
                </div>
              </HeroBand>
            </div>

            {/* HEADER MOBILE — 3 zonas, logo no centro.
                Antes eram SETE controles empilhados à direita (busca, conta, plano,
                upload, ajuda, feedback, sino, engrenagem) com o logo espremido na
                esquerda. Num celular de 380px isso vira uma barra ilegível.
                Agora: 2 à esquerda · logo centrado · 2 à direita. A pílula do plano
                só aparece quando ela EXIGE atenção (teste acabando, sem plano) —
                nos outros casos ela mora no menu, em "Planos". O feedback virou o
                botão flutuante que já existe. */}
            <header className="h-14 sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center px-3 bg-background border-b border-border md:hidden">
              <div className="flex items-center gap-1 justify-self-start">
                <GlobalSearch />
                <HelpButton />
              </div>

              <NavLink to="/app" className="flex items-center justify-self-center px-2">
                <h1
                  className="text-xl font-display font-semibold text-foreground tracking-tight"
                  style={{ fontVariationSettings: "'opsz' 9" }}
                >
                  cria
                </h1>
              </NavLink>

              <div className="flex items-center gap-1 justify-self-end">
                <UploadProgressIndicator />
                <PlanBadge onlyUrgent />
                <AccountSwitcher compact />
                <NotificationsBell />
                <NavLink to="/app/configuracoes" aria-label="Configurações" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
                  <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </NavLink>
              </div>
            </header>

            <main className="flex-1 pb-[96px] md:pb-0 w-full overflow-x-hidden">
              <div className="max-w-screen-2xl mx-auto px-4 py-4 md:px-8 md:py-6">
                <BroadcastBanner audience="criadora" />
                <NotificationNudge />
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
    </TourProvider>
  );
};

export default AppLayout;
