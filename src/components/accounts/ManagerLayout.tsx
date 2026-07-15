import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { BroadcastBanner } from "@/components/BroadcastBanner";
import { NotificationNudge } from "@/components/NotificationNudge";
import { FeedbackButton } from "@/components/FeedbackButton";
import {
  Home, Boxes, Handshake, DollarSign, Users, ListChecks, Menu, ChevronRight, Gift,
  Settings as SettingsIcon, LogOut, Send, Users2, Wallet, Lock, Contact, Sparkles, CalendarDays, Trash2, UserPlus, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "@/contexts/AccountContext";
import { usePartner } from "@/hooks/usePartner";
import { useModules, type ModuleWithStatus } from "@/hooks/useModules";
import { useHasHubCria } from "@/hooks/useHubCria";
import { useMyTeamPermissions } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { definirBadge } from "@/lib/pwa";
import { ModulePopup } from "@/components/accounts/ModulePopup";
import { ClientSwitcher } from "@/components/accounts/ClientSwitcher";
import { SettingsManagerDrawer } from "@/components/accounts/SettingsManagerDrawer";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { HeroBand } from "@/components/HeroBand";
import { useManagerApprovalOverview } from "@/hooks/useApprovals";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { applyTheme } from "@/lib/applyTheme";
import { BgShapes } from "@/components/BgShapes";
import { TourProvider } from "@/components/tour/TourProvider";
import { HelpButton } from "@/components/tour/HelpButton";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { applyThemeFont } from "@/components/settings/SettingsVisual";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const MODICONS: Record<string, typeof Send> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet };
const MODULE_ROUTE: Record<string, string> = {
  aprovapost_externo: "/socialmidia/criapost",
  crm: "/socialmidia/criacrm",
  financeiro: "/socialmidia/criacaixa",
  // ISTO NÃO EXISTIA. Sem rota, o clique caía no `else` e abria o popup dizendo
  // "assinatura ativa", sem lugar nenhum pra ir. A pessoa pagava e não entrava.
  hub_cria: "/socialmidia/hubcria",
};
// Mapeia o código do módulo (catálogo) → código de permissão de time.
const MODULE_TEAM_CODE: Record<string, string> = {
  aprovapost_externo: "cria_post",
  crm: "cria_gestao",
};

// Seção "Negócio" do rail (Equipe e Comissões têm tratamento próprio no render).
const BUSINESS_NAV = [
  { to: "/socialmidia/parceria", label: "Parceria", icon: Handshake },
  { to: "/socialmidia/comissoes", label: "Comissões", icon: DollarSign },
  { to: "/socialmidia/contas", label: "Suas contas", icon: Users },
] as const;

// Títulos do HeroBand por rota (gestão)
const HERO_TITLES: Record<string, string> = {
  "/socialmidia/clientes": "Clientes",
  "/socialmidia/agenda": "Agenda",
  "/socialmidia/hubcria": "Cria Radar",
  "/socialmidia/criapost": "Cria Post",
  "/socialmidia/criacrm": "Cria Gestão",
  "/socialmidia/criacaixa": "Cria Caixa",
  "/socialmidia/parceria": "Parceria",
  "/socialmidia/comissoes": "Comissões",
  "/socialmidia/contas": "Suas contas",
  "/socialmidia/aprovacoes": "Aprovações",
  "/socialmidia/equipe": "Equipe",
  "/socialmidia/lixeira": "Lixeira",
};

export type ManagerOutletContext = { openModule: (m: ModuleWithStatus) => void; openSettings: () => void };
export function useManagerOutlet() { return useOutletContext<ManagerOutletContext>(); }

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile, isLoading } = useProfile();
  const { hasManagedAccounts, actingAsTeam, agencyOwnerId } = useActiveAccount();
  const { isPartner } = usePartner();
  const { modules: allModules } = useModules();
  const { allowed: hasHubCriaRaw } = useHasHubCria();
  const { data: teamPerms } = useMyTeamPermissions(actingAsTeam ? agencyOwnerId : null);

  // Gate de módulo pro colaborador: só vê o que o gestor liberou. Gestor vê tudo.
  const canTeam = (code: string) => !actingAsTeam || (teamPerms?.has(code) ?? false);
  const modules = actingAsTeam
    ? allModules.filter((m) => MODULE_TEAM_CODE[m.code] && canTeam(MODULE_TEAM_CODE[m.code]))
    : allModules;
  const hasHubCria = hasHubCriaRaw && canTeam("hub_cria");
  const canAgenda = canTeam("agenda");
  const canClients = !actingAsTeam || canTeam("cria_gestao") || canTeam("cria_post");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [railHovered, setRailHovered] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleWithStatus | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Tema: managers agora escolhem o próprio accent (igual usuário normal). Sem trava de roxo.
  useEffect(() => {
    if (profile?.theme_preset) {
      applyTheme(profile.theme_preset, profile.theme_accent || "#CE4A1D");
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

  // Item do rail flutuante. Expande com o nome quando o rail está em hover.
  const railNode = (
    Icon: LucideIcon,
    label: string,
    opts: { active?: boolean; onClick: () => void; corner?: ReactNode; tipBadge?: ReactNode },
  ) => (
    <button
      key={label}
      type="button"
      onClick={opts.onClick}
      aria-label={label}
      className={cn(
        "relative flex h-10 w-full items-center rounded-2xl transition-colors",
        railHovered ? "gap-3 px-2.5 justify-start" : "justify-center",
        opts.active
          ? "bg-primary/15 text-primary"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary",
      )}
    >
      <span className="relative grid h-6 w-6 shrink-0 place-items-center">
        <Icon className="h-[18px] w-[18px]" />
        {opts.corner}
      </span>
      {railHovered && (
        <span className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-sm font-body font-medium">
          <span className="truncate">{label}</span>{opts.tipBadge}
        </span>
      )}
      {opts.active && !railHovered && <span className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-primary" />}
    </button>
  );

  // Guards
  if (isLoading) return <LoadingScreen />;
  if (profile?.must_change_password === true) return <Navigate to="/app/trocar-senha" replace />;
  // criadores (não-manager) não entram no hub, exceto colaboradores atuando no time.
  if (profile && profile.account_type !== "manager" && !hasManagedAccounts && !actingAsTeam) return <Navigate to="/app" replace />;

  const ctx: ManagerOutletContext = { openModule, openSettings: () => setSettingsOpen(true) };

  // ═══ FAIXA DO TOPO ═══
  // Antes ela repetia "Bom dia, Gabriela" — a MESMA saudação que já está no card
  // logo abaixo. Era um espaço órfão: nas outras telas a faixa mostra o nome do
  // módulo, e no dashboard não havia nada pra mostrar, então enfiaram a saudação.
  //
  // Agora a faixa é sempre CONTEXTO: onde você está (nome do módulo) ou, no
  // dashboard, o dia de hoje e a única coisa que está te travando. A saudação
  // fica só no card, que é onde ela tem companhia (foto, números, atalhos).
  const isDash = location.pathname === "/socialmidia" || location.pathname === "/socialmidia/dashboard";

  const { overview } = useManagerApprovalOverview();
  const travados = overview.reduce((s, r) => s + (r.pendentes ?? 0), 0);

  // Bolinha com número no ícone do app (PWA instalado). A pessoa bate o olho na
  // tela do celular e vê "3 posts esperando o cliente", sem abrir nada.
  useEffect(() => { definirBadge(travados); }, [travados]);

  const firstName = (profile?.name ?? "").trim().split(" ")[0] || "você";

  const hoje = new Date();
  const dataHoje = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dataCap = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);

  const heroTitle = isDash
    ? dataCap
    : (Object.entries(HERO_TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] ?? "Gestão");

  // A linha de cima (eyebrow): o alarme. Se não tem nada travado, fica quieta.
  const heroEyebrow = isDash
    ? (travados > 0
        ? `${travados} ${travados === 1 ? "post aguardando" : "posts aguardando"} o cliente`
        : "Nada travado por aqui")
    : undefined;
  const avatarNode = isDash ? (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 font-display font-bold text-white shadow-sm">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : firstName.charAt(0).toUpperCase()}
    </div>
  ) : null;

  return (
    <TourProvider>
    <div className="min-h-screen app-canvas relative" style={{ ["--active-font-display" as string]: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}>
      <BgShapes styleKey={(profile as { theme_bg?: string | null } | null | undefined)?.theme_bg} />
      {/* Rail flutuante (desktop), expande no hover mostrando os nomes */}
      <nav
        onMouseEnter={() => setRailHovered(true)}
        onMouseLeave={() => setRailHovered(false)}
        className={cn(
          "fixed left-5 top-[calc(50%+0.75rem)] z-40 hidden -translate-y-1/2 flex-col rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] px-2 py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex",
          railHovered ? "w-[240px] items-stretch" : "w-[64px] items-stretch",
        )}
      >
        <div className={cn("mb-2 flex items-center gap-2", railHovered ? "px-1" : "justify-center")}>
          {railHovered ? <Logo className="h-7 w-auto" /> : <Logo icon className="h-[38px] w-[38px] rounded-[12px]" />}
        </div>
        <div className="flex w-full flex-col items-stretch gap-1">
          {railHovered && <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dia a dia</p>}
          {railNode(Home, "Início", { active: isActive("/socialmidia/dashboard"), onClick: () => navigate("/socialmidia/dashboard") })}
          {canClients && railNode(Contact, "Clientes", { active: isActive("/socialmidia/clientes"), onClick: () => navigate("/socialmidia/clientes") })}
          {canAgenda && railNode(CalendarDays, "Agenda", { active: isActive("/socialmidia/agenda"), onClick: () => navigate("/socialmidia/agenda") })}
          {railNode(ListChecks, "Aprovações", { active: isActive("/socialmidia/aprovacoes"), onClick: () => navigate("/socialmidia/aprovacoes") })}
          {railHovered && (modules.length > 0 || hasHubCria) && <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Módulos</p>}
          {modules
            // hub_extra é PACOTE DE CRÉDITO, não é módulo nem destino: ele não
            // pode virar item de menu (a pessoa clica esperando abrir algo).
            .filter((m) => m.code !== "hub_extra")
            .map((m) => {
            const Icon = (MODICONS[m.code] ?? Boxes) as LucideIcon;
            const active = m.status === "active" || m.status === "past_due";
            const route = MODULE_ROUTE[m.code];
            const corner = active
              ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--sidebar-background))]" />
              : <Lock className="absolute right-0.5 top-0.5 h-3 w-3 text-muted-foreground" />;
            const tipBadge = (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                active ? "bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/25" : m.coming_soon ? "bg-foreground/[0.07] text-muted-foreground" : "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20")}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {active ? "Ativo" : m.coming_soon ? "Em breve" : brl(m.price_cents)}
              </span>
            );
            return railNode(Icon, m.name, { active: !!route && isActive(route), onClick: () => openModule(m), corner, tipBadge });
          })}
          <div className="my-2 h-px w-full bg-border" />
          {railHovered && <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Negócio</p>}
          {!actingAsTeam && railNode(UserPlus, "Equipe", { active: isActive("/socialmidia/equipe"), onClick: () => navigate("/socialmidia/equipe") })}
          {BUSINESS_NAV.map((n) => {
            const onClick = n.to === "/socialmidia/comissoes" ? onNavComissoes : () => navigate(n.to);
            return railNode(n.icon as LucideIcon, n.label, { active: isActive(n.to), onClick });
          })}
        </div>
        <div className="flex-1" />
        <div className="my-2 h-px w-full bg-border" />
        <div className="flex w-full flex-col items-stretch gap-1">
          {railNode(Trash2, "Lixeira", { active: isActive("/socialmidia/lixeira"), onClick: () => navigate("/socialmidia/lixeira") })}
          {railNode(SettingsIcon, "Configurações", { onClick: () => setSettingsOpen(true) })}
          {railNode(LogOut, "Sair", { onClick: handleSignOut })}
        </div>
      </nav>

      <div className="flex min-h-screen flex-col md:pl-[104px]">
        {/* HeroBand (desktop), sangra full-width por trás do rail */}
        <div className="hidden md:block md:-ml-[104px] md:w-[calc(100%+104px)]">
          <HeroBand eyebrow={heroEyebrow} title={heroTitle} avatar={avatarNode}>
            {/* Indique e ganhe: sempre visível. Parceira vai direto pras comissões. */}
            <button type="button" onClick={onNavComissoes}
              title={isPartner ? "Ver suas comissões" : "Indique o CRIA e ganhe comissão recorrente"}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-body font-semibold text-white backdrop-blur transition-colors hover:bg-white/25">
              <Gift className="h-3.5 w-3.5" /> Indique e ganhe
            </button>
            <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-2 py-1 backdrop-blur">
              <GlobalSearch />
              {canClients && <ClientSwitcher />}
              <HelpButton light />
              <FeedbackButton />
              <NotificationsBell />
            </div>
          </HeroBand>
        </div>

        {/* HEADER MOBILE DA SOCIAL MÍDIA — não existia.
            O sino de notificações morava SÓ dentro da HeroBand, que é `hidden md:block`.
            Ou seja: no celular, o gestor não tinha como ver notificação nenhuma —
            nem aprovação de cliente, nem lead. Todo o sistema de push apontava pra
            uma tela que ele não conseguia abrir.
            Mesma estrutura do lado do criador: 2 à esquerda, logo no centro, 2 à direita. */}
        <header
          className="min-h-14 sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center px-3 bg-background border-b border-border md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-1 justify-self-start">
            <GlobalSearch />
            <HelpButton />
          </div>

          <button
            type="button"
            onClick={() => navigate("/socialmidia/dashboard")}
            className="justify-self-center px-2"
            aria-label="Início"
          >
            <Logo className="h-6 w-auto" />
          </button>

          <div className="flex items-center gap-1 justify-self-end">
            {canClients && <ClientSwitcher />}
            <NotificationsBell />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configurações"
              className="p-2 rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* max-w-6xl (1152px) deixava metade da tela vazia num monitor grande e o
            conteúdo espremido numa coluna no meio. 1600px usa a tela de trabalho
            de verdade; acima disso o texto ficaria longo demais pra ler. */}
        <main className="relative z-[1] flex-1 px-4 py-7 pb-[96px] sm:px-8 sm:py-10 md:pb-10 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px]">
            <BroadcastBanner audience="social" />
            <NotificationNudge />
            <Suspense fallback={<LoadingScreen compact />}>
              <Outlet context={ctx} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Dock flutuante mobile, estilo pessoa física */}
      {(() => {
        const dockItem = (active: boolean, Icon: typeof Home, label: string, onClick: () => void) => (
          <button key={label} type="button" onClick={onClick}
            className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-2xl">
            <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} strokeWidth={active ? 2 : 1.6} />
            <span className={cn("text-[10px] font-body", active ? "text-primary font-semibold" : "text-muted-foreground font-medium")}>{label}</span>
          </button>
        );
        // MENU "MAIS" no mesmo padrão do cliente final (BottomBar.tsx):
        // gaveta que sobe do rodapé, com SEÇÕES, uma linha por item, ícone em
        // quadradinho, descrição do que aquilo faz e chevron. A grade de ícones
        // secos que existia aqui não dizia o que cada coisa era.
        const moreSections: { title: string; items: { label: string; desc?: string; icon: LucideIcon; onClick: () => void; ativo?: boolean }[] }[] = [
          {
            title: "Módulos",
            items: [
              // O CRIA RADAR APARECIA TRÊS VEZES no menu do celular:
              //   1. o módulo hub_cria, vindo do banco;
              //   2. o "Pacote Extra" (hub_extra), que também é uma linha em `modules`
              //      — mas ele NÃO é um lugar pra abrir, é um pacote de créditos;
              //   3. um item fixo, escrito na mão logo abaixo.
              // Some com os dois primeiros: o Radar entra uma vez só, no item de baixo,
              // que é o que realmente leva pra tela dele.
              ...modules
                .filter((m) => m.code !== "hub_extra" && !(hasHubCria && m.code === "hub_cria"))
                .map((m) => ({
                  label: m.name,
                  desc: (m.status === "active" || m.status === "past_due") ? "Toque para abrir" : m.coming_soon ? "Em breve" : "Conhecer o módulo",
                  icon: (MODICONS[m.code] ?? Boxes) as LucideIcon,
                  ativo: m.status === "active" || m.status === "past_due",
                  onClick: () => openModule(m),
                })),
              ...(hasHubCria ? [{ label: "Cria Radar", desc: "Espiar os concorrentes dos seus clientes", icon: Sparkles as LucideIcon, ativo: true, onClick: () => navigate("/socialmidia/hubcria") }] : []),
            ],
          },
          {
            title: "Negócio",
            items: [
              ...(!actingAsTeam ? [{ label: "Equipe", desc: "Convidar colaboradores", icon: UserPlus as LucideIcon, onClick: () => navigate("/socialmidia/equipe") }] : []),
              { label: "Parceria", desc: "Indique o CRIA e ganhe comissão", icon: Handshake as LucideIcon, onClick: () => navigate("/socialmidia/parceria") },
              { label: "Comissões", desc: "O que você já ganhou", icon: DollarSign as LucideIcon, onClick: onNavComissoes },
              { label: "Suas contas", desc: "Assentos e clientes do plano", icon: Users as LucideIcon, onClick: () => navigate("/socialmidia/contas") },
            ],
          },
          {
            title: "Sistema",
            items: [
              { label: "Lixeira", desc: "Recuperar o que você excluiu", icon: Trash2 as LucideIcon, onClick: () => navigate("/socialmidia/lixeira") },
              { label: "Configurações", desc: "Perfil, visual e integrações", icon: SettingsIcon as LucideIcon, onClick: () => setSettingsOpen(true) },
            ],
          },
        ];
        return (
          <>
            {moreOpen && (
              <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            )}
            {moreOpen && (
              <div
                className="fixed left-0 right-0 z-40 md:hidden bg-card border-t border-border rounded-t-[28px] shadow-warm-lg overflow-hidden flex flex-col"
                style={{ bottom: 0, maxHeight: "82vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="px-5 pt-3 pb-2 shrink-0">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
                  <h2 className="text-xl font-display font-extrabold text-foreground">Menu</h2>
                </div>

                <div className="overflow-y-auto px-3 pb-2">
                  {moreSections.filter((s) => s.items.length > 0).map((sec) => (
                    <div key={sec.title} className="mb-2">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/70 px-3 pt-2.5 pb-1">{sec.title}</p>
                      <div className="space-y-0.5">
                        {sec.items.map((item) => (
                          <button key={sec.title + item.label} type="button"
                            onClick={() => { setMoreOpen(false); item.onClick(); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:bg-muted/60 transition-colors text-left">
                            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                              item.ativo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[15px] font-body font-semibold text-foreground truncate">{item.label}</span>
                              {item.desc && <span className="block text-[11.5px] font-body text-muted-foreground truncate mt-0.5">{item.desc}</span>}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={() => { setMoreOpen(false); handleSignOut(); }}
                    className="mt-2 mb-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:bg-destructive/10 transition-colors">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                      <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-body font-semibold text-destructive">Sair</span>
                  </button>
                </div>
              </div>
            )}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
                 style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}>
              <div className="flex items-center justify-center gap-2.5 px-3 pointer-events-auto">
                <div className="dock-pill flex items-center gap-0.5 rounded-[30px] p-1.5">
                  {dockItem(isActive("/socialmidia/dashboard"), Home, "Início", () => navigate("/socialmidia/dashboard"))}
                  {canClients && dockItem(isActive("/socialmidia/clientes"), Contact, "Clientes", () => navigate("/socialmidia/clientes"))}
                  {canAgenda && dockItem(isActive("/socialmidia/agenda"), CalendarDays, "Agenda", () => navigate("/socialmidia/agenda"))}
                  {dockItem(isActive("/socialmidia/aprovacoes"), ListChecks, "Aprov.", () => navigate("/socialmidia/aprovacoes"))}
                </div>
                {/* Hambúrguer, igual ao do cliente final. A seta pra cima sugeria
                    "expandir a tela", não "abrir o menu". */}
                <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-label="Menu"
                  className="dock-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform">
                  <Menu className={cn("h-6 w-6 transition-colors", moreOpen ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </>
        );
      })()}

      <ModulePopup module={selectedModule} onClose={() => setSelectedModule(null)} />
      <SettingsManagerDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
    </TourProvider>
  );
}
