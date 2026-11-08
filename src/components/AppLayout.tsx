import { Suspense, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BottomBar } from "@/components/BottomBar";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { NotificationNudge } from "@/components/NotificationNudge";
import { FeedbackButton } from "@/components/FeedbackButton";
import { PWAInstallBanner } from "@/components/shared/PWAInstallBanner";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { AppFooter } from "@/components/shared/AppFooter";
import {
  Lightbulb, Plus, X, ArrowLeft, Home, ChevronRight, CheckCircle2, LayoutGrid, ListChecks, Kanban, Target,
  FolderOpen, BookOpen, BookMarked, Link2, Handshake, BarChart3, FileBarChart, History, GraduationCap,
  PlayCircle, Settings, Gem, IdCard, Trash2, CalendarRange, Mic, Clapperboard, TrendingUp, Users, Shield, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useSouParceiro } from "@/hooks/useParceiro";
import { deriveTier } from "@/hooks/useTier";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { applyTheme, applyHero } from "@/lib/applyTheme";
import { BgShapes } from "@/components/BgShapes";
import { TourProvider } from "@/components/tour/TourProvider";
import { HelpButton } from "@/components/tour/HelpButton";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";
import ContaPausada from "@/pages/ContaPausada";
import { AppSidebar } from "@/components/AppSidebar";
import { AppRail } from "@/components/AppRail";
import { BarraSuperior, CartaoInicioMobile } from "@/components/BarraSuperior";
import { CapturaRapidaDialog } from "@/components/dashboard/CapturaRapidaDialog";
import { TituloCriakut } from "@/components/criakut/TituloCriakut";
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

/* PÁGINAS DO CRIADOR NA BARRA SUPERIOR (Walter, 08/11/2026, mockup aprovado):
   título, ícone e uma frase curta do que a página faz. Sai o emoji da
   saudação (Walter não quer emoji nem ícone padrão do sistema). */
type InfoPagina = { titulo: string; frase?: string; icone: LucideIcon };
const PAGINAS: Record<string, InfoPagina> = {
  ideias: { titulo: "Ideias", frase: "anota agora, organiza depois", icone: Lightbulb },
  aprovacao: { titulo: "Aprovações", frase: "o que está esperando o seu ok", icone: CheckCircle2 },
  feed: { titulo: "Meu Feed", frase: "como o seu perfil vai ficar", icone: LayoutGrid },
  tarefas: { titulo: "Tarefas", frase: "o que precisa sair hoje, sem esquecer nada", icone: ListChecks },
  criando: { titulo: "Criando", frase: "da ideia ao post publicado", icone: Kanban },
  metas: { titulo: "Metas", frase: "onde você quer chegar", icone: Target },
  arquivos: { titulo: "Arquivos", frase: "tudo que você subiu, num lugar só", icone: FolderOpen },
  biblioteca: { titulo: "Biblioteca", frase: "o que você guardou pra usar depois", icone: BookOpen },
  brandbook: { titulo: "Brandbook", frase: "quem você é, do jeito que a Cria IA precisa saber", icone: BookMarked },
  linkinbio: { titulo: "Link in Bio", frase: "a porta de entrada do seu perfil", icone: Link2 },
  collabs: { titulo: "Collabs", frase: "parcerias, propostas e cachê", icone: Handshake },
  insights: { titulo: "Insights", frase: "o que o seu Instagram anda dizendo", icone: BarChart3 },
  relatorios: { titulo: "Relatórios", frase: "o mês em números", icone: FileBarChart },
  historico: { titulo: "Histórico", frase: "tudo o que já saiu", icone: History },
  aprender: { titulo: "Aprender", frase: "cursos pra crescer criando", icone: GraduationCap },
  tutoriais: { titulo: "Tutoriais", frase: "o Cria explicado em vídeos curtos", icone: PlayCircle },
  configuracoes: { titulo: "Configurações", frase: "conta, marca e preferências", icone: Settings },
  assinar: { titulo: "Planos", frase: "escolha até onde o Cria vai com você", icone: Gem },
  "media-kit": { titulo: "Media Kit", frase: "seu portfólio pra fechar publi", icone: IdCard },
  lixeira: { titulo: "Lixeira", frase: "o que foi apagado nos últimos dias", icone: Trash2 },
  plano: { titulo: "Cria Plano", frase: "o mês inteiro montado, post a post", icone: CalendarRange },
  prompter: { titulo: "Cria Prompter", frase: "grave com o roteiro rolando na tela", icone: Mic },
  stories: { titulo: "Cria Stories", frase: "a semana de stories com roteiro", icone: Clapperboard },
  tendencias: { titulo: "Tendências", frase: "o que está em alta no seu nicho", icone: TrendingUp },
  criakut: { titulo: "Criakut", icone: Users },
  "cf-admin-panel": { titulo: "Admin", icone: Shield },
};
const paginaDaRota = (path: string): InfoPagina | null => {
  const seg = path.replace(/^\/app\/?/, "").split("/")[0];
  return seg ? PAGINAS[seg] ?? null : null;
};
// Frase curta do Início por período do dia (sem consulta nova).
const fraseDoDia = (h: number) =>
  h < 12 ? "um post de cada vez, bora começar" : h < 18 ? "segue o ritmo, o dia ainda rende" : "o amanhã agradece o que você planejar hoje";

const AppLayout = () => {
  const { profile, isLoading } = useProfile();
  const { data: souParceiro, isLoading: carregandoPapelParceiro } = useSouParceiro();
  const { isManaging, activeAccountId, managedAccounts, teamAccounts, meuPerfil, ehMeuPerfil } = useActiveAccount();
  // Meu perfil: o onboarding que vale é o do PERFIL aberto, não o da sessão.
  const { profile: perfilAtivo, isLoading: perfilAtivoCarregando } = useActiveProfile();
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
  // Janela de captura do botão "Nova ideia" (topo do dashboard).
  const [capturaAberta, setCapturaAberta] = useState(false);
  const [fabAberto, setFabAberto] = useState(false);

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
    const heroDaSessao = (profile as { theme_hero?: string | null } | null | undefined)?.theme_hero ?? null;
    applyHero(heroDaSessao);
    if (profile?.theme_font) applyThemeFont(profile.theme_font);
    // Cacheia o tema pro próximo boot aplicar na hora (sem flash do padrão).
    try {
      if (profile?.theme_preset) localStorage.setItem("theme_preset", profile.theme_preset);
      if (profile?.theme_accent) localStorage.setItem("theme_accent", profile.theme_accent);
      if (profile?.theme_sidebar) localStorage.setItem("theme_sidebar", profile.theme_sidebar);
      else localStorage.removeItem("theme_sidebar");
      if (profile?.theme_font) localStorage.setItem("theme_font", profile.theme_font);
      if (heroDaSessao) localStorage.setItem("theme_hero", heroDaSessao);
      else localStorage.removeItem("theme_hero");
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
    // Faixa do topo da conta ativa (get_managed_profile não tem essa coluna).
    void (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>)("tema_hero_da_conta", { _owner: activeAccountId })
      .then(({ data }) => {
        if (!alive) return;
        applyHero(typeof data === "string" ? data : null);
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

  /* MEU PERFIL NASCE SEM ONBOARDING (Walter, 18/10/2026). Na primeira vez que
     a dona abre o perfil, ela passa pelo onboarding de criadora, e tudo grava
     no perfil (Onboarding.tsx usa a conta ativa). Conta de cliente nunca cai
     aqui: o desvio é só pro Meu perfil. */
  // Espera o perfil chegar: sem isto o Dashboard montava antes do desvio e
  // guardava no cache as telas VAZIAS do perfil (ideias sumidas no teste de 18/10).
  if (ehMeuPerfil && perfilAtivoCarregando) return <LoadingScreen />;
  if (ehMeuPerfil && perfilAtivo?.onboarding_completed === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isLoading && profile && profile.onboarding_completed === false && profile.account_type !== "manager") {
    /* Parceiro (designer, editor, copy) SEM plano de criador não faz o
       onboarding de criador: a área dele é /parceiro. Sem isto, o PeJota
       redefiniu a senha e caiu no wizard "Sobre o que você cria?". As duas
       exceções: a página de planos (é como o parceiro COMPRA o lado criador)
       e o parceiro que já assinou (aí o onboarding vale, ele virou criador).
       Espera o papel carregar antes de decidir, senão manda pro lugar errado. */
    if (carregandoPapelParceiro) return <LoadingScreen />;
    const parceiroSemPlano = souParceiro && deriveTier(profile) === "none";
    /* Sem exceção nenhuma: parceiro sem plano não entra no /app nem pra ver
       planos (o Walter pegou o PeJota vendo a página de assinatura EMBRULHADA
       no menu de criador). Os módulos do parceiro vivem na área de gestão
       (/socialmidia), dentro da casca dele. */
    if (parceiroSemPlano) {
      return <Navigate to="/socialmidia/demandas" replace />;
    }
    if (location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  const hour = new Date().getHours();
  const greetWord = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  // Gerenciando a conta de um cliente: a saudação e o avatar são do CLIENTE, não do gestor logado.
  const managedAccount = isManaging
    ? [...managedAccounts, ...teamAccounts, ...(meuPerfil ? [meuPerfil] : [])].find((a) => a.owner_id === activeAccountId) ?? null
    : null;
  const displayName = managedAccount?.name ?? profile?.name ?? "";
  const displayAvatarUrl = managedAccount ? managedAccount.avatar_url : profile?.avatar_url;
  const firstName = displayName.trim().split(" ")[0] || "criador";
  const isDash = location.pathname === "/app";
  const pagina = isDash ? null : paginaDaRota(location.pathname);
  const IconePagina = pagina?.icone ?? Sparkles;
  const heroTitle = isDash
    ? firstName
    : location.pathname.startsWith("/app/criakut") ? <TituloCriakut />
    : (pagina?.titulo ?? "Cria");
  const tituloCurto = isDash ? "Início" : (pagina?.titulo ?? "Cria");
  const fraseTopo = isDash ? fraseDoDia(hour) : pagina?.frase;
  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const topoEsquerda = isDash ? (
    <span className="first-letter:uppercase">{dataHoje}</span>
  ) : (
    <nav aria-label="Caminho" className="flex items-center gap-1.5">
      <button type="button" onClick={() => navigate("/app")} className="inline-flex items-center gap-1.5 hover:text-foreground">
        <Home className="h-3.5 w-3.5" /> Início
      </button>
      <ChevronRight className="h-3.5 w-3.5" />
      <b className="font-bold text-[#1D1B18]">{tituloCurto}</b>
    </nav>
  );
  const heroEyebrow = isDash ? `${greetWord},` : undefined;
  // Topo do dashboard (mockup aprovado 19/10/2026): @ e nicho principal embaixo do nome.
  const displayHandle = (managedAccount ? managedAccount.instagram_handle : profile?.instagram_handle)?.replace(/^@/, "").trim();
  const displayNiche = ((managedAccount ? managedAccount.niche : profile?.niche) ?? "").split(",")[0]?.trim();
  const heroMeta = isDash && (displayHandle || displayNiche) ? (
    <>
      {displayHandle && <span>@{displayHandle}</span>}
      {displayNiche && <span className="rounded-full border-[1.5px] border-[#1D1B18] bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[#1D1B18]">{displayNiche}</span>}
    </>
  ) : undefined;
  const avatarNode = isDash ? (
    <Avatar className="h-[62px] w-[62px] shrink-0 border-2 border-[#1D1B18] bg-primary p-[3px] [&>img]:rounded-full [&>img]:border-2 [&>img]:border-white">
      <AvatarImage src={displayAvatarUrl ?? undefined} alt={firstName} />
      <AvatarFallback className="bg-primary font-display text-2xl font-bold text-primary-foreground">
        {firstName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  ) : null;

  const quickActions = isDash ? (
    <>
      <button onClick={() => setCapturaAberta(true)} data-tour="dash-captura"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1D1B18] bg-white px-4 py-2 text-[13.5px] font-extrabold text-[#1D1B18] shadow-[0_2px_0_#1D1B18] transition hover:-translate-y-px">
        <Lightbulb className="h-4 w-4" /> Nova ideia
      </button>
      <button onClick={() => navigate("/app/criando")}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1D1B18] bg-primary px-4 py-2 text-[13.5px] font-extrabold text-primary-foreground shadow-[0_2px_0_#1D1B18] transition hover:-translate-y-px">
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
            <div className="sticky top-[var(--topo-app)] z-40 md:static md:z-auto">
              <ManagingBanner />

              {/* HEADER MOBILE: 3 zonas, logo no centro (2 à esquerda, logo centrado,
                  2 à direita). Quando está gerenciando (banner laranja em cima), o
                  header NÃO repete a safe-area: quem trata o notch é o banner, e as
                  duas barras ficam coladas, sem gap. Sem banner, o próprio header
                  respeita a safe-area do topo. */}
              {/* TOPO DO CELULAR (Walter, 08/11/2026, mockup aprovado): um só,
                  compacto, em papel creme. Avatar no Início ou a seta de voltar,
                  o nome da tela com uma frase à mão, e à direita só o que é
                  urgente, a troca de conta, a busca e os avisos. Ajuda, sugestão
                  e Configurações ficam no "Mais" da barra de baixo. */}
              <header className="flex min-h-14 items-center gap-2.5 border-b-2 border-[#1D1B18] bg-[#FFFCF3] px-3.5 py-2 md:hidden">
                {isDash ? (
                  <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Subir ao topo"
                    className="shrink-0 rounded-full border-2 border-[#1D1B18] bg-primary p-[2px]">
                    <Avatar className="h-[30px] w-[30px] border-2 border-white">
                      <AvatarImage src={displayAvatarUrl ?? undefined} alt={firstName} />
                      <AvatarFallback className="bg-primary font-display text-sm font-bold text-primary-foreground">
                        {firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ) : (
                  <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))} aria-label="Voltar"
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border-2 border-[#1D1B18] bg-white text-[#1D1B18]">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-display text-[19px] font-extrabold leading-none text-[#1D1B18]">{tituloCurto}</span>
                  {fraseTopo && (
                    <span className="mt-0.5 block truncate text-[15px] font-bold leading-none text-primary" style={{ fontFamily: "Caveat, cursive" }}>{fraseTopo}</span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <UploadProgressIndicator />
                  <PlanBadge onlyUrgent compact />
                  <AccountSwitcher compact />
                  <GlobalSearch />
                  <NotificationsBell />
                </div>
              </header>

        {/* ── O NOME DA TELA, NO CELULAR (circuito 10, 15/09/2026) ──────────
            A HeroBand carrega o título de cada tela e é `hidden md:block`. No
            celular, portanto, NENHUMA tela tinha nome: o header mostra só busca,
            logo e atalhos. E as próprias telas deixaram de escrever o título
            ("o título mora na faixa do topo do layout"), contando com uma faixa
            que não existe ali. Resultado: a pessoa abre o app no celular e não
            sabe em que tela está.
            Esta é a versão magra da HeroBand: só o nome, grudada embaixo do
            header, e só no celular. */}
        {/* 26/09/2026 (Walter): as telas já têm título próprio no celular (ícone
            colorido + nome grande), e a faixa repetia o nome logo em cima. A
            faixa agora só aparece no Início, onde ela é a saudação. */}
            </div>
        {/* 19/10/2026 (Walter, mockup aprovado): no Início do celular a saudação
            vira o cartão-faixa (fora do topo grudado, rola junto com a página), com foto, @, nicho, ações e o período. */}
        {isDash && (
          <CartaoInicioMobile
            avatar={
              <span className="shrink-0 rounded-full border-2 border-[#1D1B18] bg-primary p-[3px]">
                <Avatar className="h-14 w-14 border-2 border-white">
                  <AvatarImage src={displayAvatarUrl ?? undefined} alt={firstName} />
                  <AvatarFallback className="bg-primary font-display text-2xl font-bold text-primary-foreground">
                    {firstName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </span>
            }
            eyebrow={`${greetWord},`}
            title={heroTitle}
            meta={heroMeta}
            slotId="cria-hero-slot-mobile"
          />
        )}

            <TrialBanner />
            <StorageWarningBanner />
            {/* BARRA SUPERIOR DO COMPUTADOR (Walter, 08/11/2026, mockup aprovado):
                papel creme dentro da área do conteúdo, com a busca larga e
                ajuda, sugestão e avisos numa pílula só. */}
            <div className="hidden w-full md:block">
              {/* Largura inteira da página, como a faixa antiga (08/11/2026). */}
              <div className="px-4 pt-4">
                <BarraSuperior
                  eyebrow={heroEyebrow}
                  title={heroTitle}
                  avatar={avatarNode}
                  icone={isDash ? undefined : <IconePagina />}
                  frase={fraseTopo}
                  topoEsquerda={topoEsquerda}
                  actions={quickActions}
                  meta={heroMeta}
                  destaque={isDash}
                >
                  <div className="w-[300px] max-w-[30vw] [&>button]:w-full [&>button]:rounded-full [&>button]:border-2 [&>button]:border-[#1D1B18] [&>button]:bg-white [&>button]:shadow-[0_2px_0_#1D1B18]">
                    <GlobalSearch />
                  </div>
                  <UploadProgressIndicator />
                  <div className="flex items-center rounded-full border-2 border-[#1D1B18] bg-white p-[3px] text-[#1D1B18] shadow-[0_2px_0_#1D1B18] [&_button]:rounded-full">
                    <HelpButton />
                    <FeedbackButton origin="usuario" />
                    <NotificationsBell />
                  </div>
                  <PlanBadge />
                </BarraSuperior>
              </div>
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
      {/* + FLUTUANTE DO CELULAR (Walter, 08/11/2026, mockup aprovado): Nova ideia
          e Novo post saem do topo e ficam aqui, na cor do tema, acima da barra de
          baixo. A janela da Nova ideia agora existe em todas as telas. */}
      <Popover open={fabAberto} onOpenChange={setFabAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={fabAberto ? "Fechar" : "Criar"}
            className={cn(
              "fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-[18px] border-2 border-[#1D1B18] shadow-[2px_2px_0_#1D1B18] md:hidden",
              fabAberto ? "bg-[#1D1B18] text-white" : "bg-primary text-primary-foreground",
            )}
            style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            {fabAberto ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={10}
          className="w-auto border-0 bg-transparent p-0 shadow-none md:hidden">
          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={() => { setFabAberto(false); setCapturaAberta(true); }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#1D1B18] bg-white px-3.5 py-2 text-[13px] font-extrabold text-[#1D1B18] shadow-[0_2px_0_#1D1B18]">
              <Lightbulb className="h-4 w-4" /> Nova ideia
            </button>
            <button type="button" onClick={() => { setFabAberto(false); navigate("/app/criando"); }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#1D1B18] bg-white px-3.5 py-2 text-[13px] font-extrabold text-[#1D1B18] shadow-[0_2px_0_#1D1B18]">
              <Plus className="h-4 w-4" /> Novo post
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <CapturaRapidaDialog open={capturaAberta} onOpenChange={setCapturaAberta} />
    </SidebarProvider>
    </UploadProgressProvider>
    </VideoPublicConfirmProvider>
    </CriaAIProvider>
    </TourProvider>
  );
};

export default AppLayout;
