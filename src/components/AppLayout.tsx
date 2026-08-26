import { Suspense, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BottomBar } from "@/components/BottomBar";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { NotificationNudge } from "@/components/NotificationNudge";
import { FeedbackButton } from "@/components/FeedbackButton";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { Logo } from "@/components/shared/Logo";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Menu fixado aberto (por aparelho). O estado mora aqui, e não no AppRail,
// porque a margem do conteúdo e o recuo da HeroBand dependem dele.
const RAIL_PIN_KEY = "cria_rail_fixado";

// Emoji da saudação, clicável e personalizável (fica salvo por dispositivo).
const GREET_EMOJIS = [
  "👋", "✨", "🚀", "🔥", "💪", "😎", "🎯", "☕", "🌟", "💜", "🙌", "👊",
  "😊", "😄", "🤩", "🥳", "😌", "🤗", "😉", "🙃", "💫", "⚡", "🌈", "🍀",
  "❤️", "🧡", "💛", "💙", "💚", "🩷", "👑", "🏆", "📈", "🎨", "💡", "🎬",
];
function GreetingEmoji() {
  const [emoji, setEmoji] = useState<string>(() => { try { return localStorage.getItem("cria_greet_emoji") || "👋"; } catch { return "👋"; } });
  const [open, setOpen] = useState(false);
  const pick = (e: string) => { setEmoji(e); setOpen(false); try { localStorage.setItem("cria_greet_emoji", e); } catch { /* noop */ } };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Trocar emoji da saudação" className="leading-none transition-transform hover:scale-110">{emoji}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <p className="text-[11px] font-body text-muted-foreground mb-1.5 px-0.5">Escolha seu emoji</p>
        <div className="grid grid-cols-6 gap-1 max-h-[220px] overflow-y-auto">
          {GREET_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => pick(e)}
              className={"h-8 w-8 rounded-lg text-lg grid place-items-center transition-colors hover:bg-muted " + (e === emoji ? "bg-muted" : "")}>{e}</button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const AppLayout = () => {
  const { profile, isLoading } = useProfile();
  const { isManaging, activeAccountId, managedAccounts, teamAccounts } = useActiveAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [railPinned, setRailPinned] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_PIN_KEY) === "1"; } catch { return false; }
  });
  const toggleRailPin = () => {
    setRailPinned((v) => {
      const next = !v;
      try { localStorage.setItem(RAIL_PIN_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  useLastSeen();

  // ── Compra direta pela LP (Payment Link): quem pagou ANTES de criar a conta
  //    tem a assinatura esperando em pending_purchases. No primeiro load logado
  //    da sessão, o claim-purchase entrega: pelo session_id guardado no
  //    navegador ou, sem ele, pelo e-mail da conta. Roda uma vez por sessão. ──
  useEffect(() => {
    if (!profile?.id) return;
    if (profile.subscription_status === "active") return;
    if (sessionStorage.getItem("cria_claim_tentado")) return;
    sessionStorage.setItem("cria_claim_tentado", "1");
    const sid = localStorage.getItem("cria_plink_session");
    void supabase.functions.invoke("claim-purchase", {
      body: { action: "claim", session_id: sid ?? undefined },
    }).then(({ data }) => {
      if ((data as { claimed?: boolean } | null)?.claimed) {
        localStorage.removeItem("cria_plink_session");
        queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
        toast.success("Pagamento confirmado e plano ativado. Bem-vindo(a) ao CRIA!");
      }
    }).catch(() => { /* sem compra pendente, segue o jogo */ });
  }, [profile?.id, profile?.subscription_status, queryClient]);

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
      applyTheme(profile.theme_preset, profile.theme_accent || '#EA4918');
    }
    // Apply sidebar color override AFTER theme (so it wins)
    applySidebarColor(profile?.theme_sidebar || null);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
    // Cacheia o tema pro próximo boot aplicar na hora (sem flash do padrão).
    try {
      if (profile?.theme_preset) localStorage.setItem("theme_preset", profile.theme_preset);
      if (profile?.theme_accent) localStorage.setItem("theme_accent", profile.theme_accent);
      if (profile?.theme_sidebar) localStorage.setItem("theme_sidebar", profile.theme_sidebar);
      else localStorage.removeItem("theme_sidebar");
      if (profile?.theme_font) localStorage.setItem("theme_font", profile.theme_font);
    } catch { /* ignore */ }
  }, [profile]);

  // Ao GERENCIAR a conta de um cliente, o tema/cor tem que ser o DELE, não o seu.
  // (o useProfile fica no SEU id de propósito, por causa do gate de plano/acesso;
  // por isso aqui buscamos o perfil do cliente à parte só pra pintar a interface.)
  // Roda depois do efeito acima, então vence e sobrescreve a cor da social mídia.
  useEffect(() => {
    if (!isManaging || !activeAccountId) return;
    let alive = true;
    // Caminho seguro: RPC SECURITY DEFINER traz so colunas nao sensiveis do
    // perfil da conta gerenciada (sem stripe/pix). Devolve array; pega [0].
    void (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>)("get_managed_profile", { _owner: activeAccountId })
      .then(({ data }) => {
        if (!alive || !Array.isArray(data) || !data[0]) return;
        const t = data[0] as { theme_preset?: string | null; theme_accent?: string | null; theme_sidebar?: string | null; theme_font?: string | null };
        if (t.theme_preset) applyTheme(t.theme_preset, t.theme_accent || "#EA4918");
        applySidebarColor(t.theme_sidebar || null);
        if (t.theme_font) applyThemeFont(t.theme_font);
      });
    return () => { alive = false; };
  }, [isManaging, activeAccountId]);

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
  const heroTitle = isDash
    ? <span className="inline-flex items-center gap-2">{firstName} <GreetingEmoji /></span>
    : (PAGE_TITLES[location.pathname] ?? "CRIA");
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
          <AppRail pinned={railPinned} onTogglePin={toggleRailPin} />

          {/* Fixado, o menu ocupa 248px + folgas: o conteúdo abre espaço (não
              fica coberto). Solto, volta pros 104px do rail de ícones. */}
          <div
            className={cn(
              "flex-1 flex flex-col min-w-0 md:transition-[padding-left] md:duration-200",
              railPinned ? "md:pl-[288px]" : "md:pl-[104px]",
            )}
          >
            {/* TOPO MOBILE: o banner de impersonação e o header ficam GRUDADOS e
                sticky juntos, respeitando a safe-area do topo do celular. No desktop
                o wrapper vira fluxo normal (md:static) e só o banner aparece, já que
                o header é md:hidden. */}
            <div className="sticky top-0 z-40 md:static md:z-auto">
              <ManagingBanner />

              {/* HEADER MOBILE: 3 zonas, logo no centro (2 à esquerda, logo centrado,
                  2 à direita). Quando está gerenciando (banner laranja em cima), o
                  header NÃO repete a safe-area: quem trata o notch é o banner, e as
                  duas barras ficam coladas, sem gap. Sem banner, o próprio header
                  respeita a safe-area do topo. */}
              <header
                className="min-h-14 grid grid-cols-[1fr_auto_1fr] items-center px-3 bg-background border-b border-border md:hidden"
                style={{ paddingTop: isManaging ? undefined : "env(safe-area-inset-top)" }}
              >
                <div className="flex items-center gap-0.5 justify-self-start">
                  <GlobalSearch />
                  <HelpButton />
                  {/* Enviar feedback também no celular (antes só na HeroBand desktop). */}
                  <FeedbackButton origin="usuario" />
                </div>

                {/* A logo central sobe a página atual pro topo (não navega pra home). */}
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="flex items-center justify-self-center px-2"
                  aria-label="Subir ao topo"
                >
                  <Logo className="h-6 w-auto" />
                </button>

                <div className="flex items-center gap-0.5 justify-self-end">
                  <UploadProgressIndicator />
                  <PlanBadge onlyUrgent compact />
                  <AccountSwitcher compact />
                  <NotificationsBell />
                  <NavLink to="/app/configuracoes" aria-label="Configurações" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
                    <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  </NavLink>
                </div>
              </header>
            </div>

            <TrialBanner />
            <StorageWarningBanner />
            <div
              className={cn(
                "hidden md:block",
                railPinned ? "md:-ml-[288px] md:w-[calc(100%+288px)]" : "md:-ml-[104px] md:w-[calc(100%+104px)]",
              )}
            >
              <HeroBand wideInset={railPinned} eyebrow={heroEyebrow} title={heroTitle} avatar={avatarNode} actions={quickActions}>
                <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-2 py-1 backdrop-blur">
                  <GlobalSearch />
                  <PlanBadge light />
                  <UploadProgressIndicator />
                  <HelpButton light />
                  <FeedbackButton origin="usuario" />
                  <NotificationsBell />
                </div>
              </HeroBand>
            </div>

            {/* overflow-x CLIP, não hidden. Com `hidden` o navegador transforma este
                <main> num contêiner de rolagem, e todo `position: sticky` lá dentro
                para de grudar: era por isso que a pré-visualização do Link na bio
                ficava cravada no topo em vez de acompanhar a rolagem. `clip` trava
                o arrasto lateral do mesmo jeito, sem virar contêiner de rolagem. */}
            <main className="flex-1 pb-[96px] md:pb-0 w-full overflow-x-clip">
              <div className="max-w-screen-2xl mx-auto px-4 py-4 md:px-8 md:py-6">
                <BroadcastBanner audience="criadora" />
                <NotificationNudge />
                <Suspense fallback={<LoadingScreen compact />}>
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
