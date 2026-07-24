import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Home, Lightbulb, Kanban, CalendarDays,
  BookOpen, Archive, GraduationCap, FolderOpen, ListTodo, BookMarked, Settings, Menu, ChevronRight, LogOut, Sparkles, Grid3X3, Link2, ClipboardCheck, Handshake, Maximize2, Minimize2, Instagram, BarChart3, ShieldCheck, PlayCircle, Clapperboard, Wand2, TrendingUp, IdCard, Trash2, Gem, Video, Globe, MessageSquarePlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useTier } from "@/hooks/useTier";
import { PlanTag } from "@/components/shared/PlanTag";
import { seloDaRota } from "@/lib/plans";
import { FeedbackDialog } from "@/components/FeedbackButton";

const leftItems = [
  { title: "Início", url: "/app", icon: Home, exact: true },
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
];

const rightItems = [
  { title: "Criando", url: "/app/criando", icon: Kanban },
];

type MoreItem = { title: string; url: string; icon: typeof Home; hot?: boolean; desc?: string };
const MORE_SECTIONS: { title: string; items: MoreItem[] }[] = [
  { title: "Criar", items: [
    { title: "Ideias", url: "/app/ideias", icon: Lightbulb, desc: "Banco de ideias e ganchos" },
    { title: "Em produção", url: "/app/criando", icon: Kanban, desc: "Seu kanban de posts" },
    { title: "Cria Plano", url: "/app/autopilot", icon: Wand2, hot: true, desc: "Cronograma do mês com IA" },
    { title: "Cria Stories", url: "/app/stories", icon: Clapperboard, desc: "Plano de stories da semana" },
  ]},
  { title: "Planejar", items: [
    { title: "Meu Feed", url: "/app/feed", icon: Grid3X3, desc: "Prévia do seu feed" },
    { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck, desc: "O que espera seu ok" },
    { title: "Calendário & Metas", url: "/app/metas", icon: CalendarDays, desc: "Calendário e objetivos" },
    { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
    { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
  ]},
  { title: "Resultados", items: [
    { title: "Insights", url: "/app/insights", icon: Instagram },
    { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
    { title: "Histórico", url: "/app/historico", icon: Archive },
  ]},
  { title: "Minha marca", items: [
    { title: "Brandbook", url: "/app/brandbook", icon: BookMarked, desc: "Identidade, tom e persona" },
    { title: "Link na bio", url: "/app/linkinbio", icon: Link2 },
    { title: "Media Kit", url: "/app/media-kit", icon: IdCard, hot: true, desc: "Seu portfólio pra marcas" },
    { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  ]},
  { title: "Mundo CRIA", items: [
    { title: "Tendências", url: "/app/tendencias", icon: TrendingUp, hot: true, desc: "O que tá bombando no nicho" },
    { title: "Cria Prompter", url: "/app/prompter", icon: Video, hot: true, desc: "Teleprompter com comando de voz" },
  ]},
  { title: "Aprender", items: [
    { title: "Cursos", url: "/app/aprender", icon: GraduationCap },
    { title: "Tutoriais", url: "/app/aprender", icon: PlayCircle },
  ]},
  { title: "Mais", items: [
    { title: "Parcerias", url: "/app/collabs", icon: Handshake },
    // PLANOS. Eu tinha colocado o item só no menu lateral do DESKTOP — e a maior
    // parte dessa gente vive no celular. Ou seja: quem quisesse fazer upgrade,
    // pelo celular, não tinha por onde. Você não pode esconder a porta de quem
    // está tentando te pagar.
    { title: "Planos", url: "/app/assinar", icon: Gem, desc: "Ver planos e fazer upgrade" },
    { title: "Lixeira", url: "/app/lixeira", icon: Trash2 },
    { title: "Configurações", url: "/app/configuracoes", icon: Settings },
  ]},
];

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { openCria } = useCriaAI();
  const { profile } = useProfile();
  const { tier } = useTier();
  const sections = profile?.role === "admin"
    ? MORE_SECTIONS.map((s) => s.title === "Mais"
        ? { ...s, items: [...s.items, { title: "Admin", url: "/app/cf-admin-panel", icon: ShieldCheck }] }
        : s)
    : MORE_SECTIONS;
  const allMoreItems = sections.flatMap((s) => s.items);
  const [searchParams, setSearchParams] = useSearchParams();
  const onCriando = location.pathname === "/app/criando";
  const overview = searchParams.get("view") === "overview";
  const toggleOverview = () => {
    const next = new URLSearchParams(searchParams);
    overview ? next.delete("view") : next.set("view", "overview");
    setSearchParams(next, { replace: true });
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/");
  };

  const isActive = (url: string, exact?: boolean) => {
    if (exact) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const isMoreActive = allMoreItems.some(item => location.pathname.startsWith(item.url));

  const renderNavItem = (item: { title: string; url: string; icon: typeof Home; exact?: boolean }) => {
    const active = isActive(item.url, item.exact);
    return (
      <NavLink
        key={item.url}
        to={item.url}
        className="flex flex-col items-center justify-center gap-1 px-2 flex-1"
      >
        <item.icon
          className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")}
          strokeWidth={active ? 2 : 1.5}
        />
        <span
          className={cn(
            "text-[10px] font-body transition-colors",
            active ? "text-primary font-semibold" : "text-muted-foreground font-medium"
          )}
        >
          {item.title}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
      )}
      {moreOpen && (
        <div
          className="fixed left-0 right-0 z-40 md:hidden bg-card border-t border-border rounded-t-[28px] shadow-warm-lg overflow-hidden flex flex-col"
          style={{ bottom: 0, maxHeight: '82vh', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Cabeçalho */}
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
            <h2 className="text-xl font-display font-extrabold text-foreground">Menu</h2>
          </div>
          <div className="overflow-y-auto px-3 pb-2">
            {sections.map((sec) => (
              <div key={sec.title} className="mb-2">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/70 px-3 pt-2.5 pb-1">{sec.title}</p>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <NavLink key={item.url + item.title} to={item.url} onClick={() => setMoreOpen(false)}
                        className={cn("flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors", active ? "bg-primary/10" : "active:bg-muted/60")}>
                        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", active ? "bg-primary/15 text-primary" : item.hot ? "bg-secondary/12 text-secondary" : "bg-muted text-muted-foreground")}>
                          <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[15px] font-body font-semibold truncate", active ? "text-primary" : "text-foreground")}>{item.title}</span>
                            {/* Selo de plano vindo do mapa (lib/plans.ts), não mais
                                de um "pro: true" escrito à mão que só existia em 2 itens. */}
                            <PlanTag to={item.url} />
                            {item.hot && !seloDaRota(item.url, tier) && <span className="shrink-0 rounded-full bg-secondary/15 text-secondary text-[9px] font-bold px-1.5 py-0.5 leading-none">EM ALTA</span>}
                          </div>
                          {item.desc && <p className="text-[11.5px] font-body text-muted-foreground truncate mt-0.5">{item.desc}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={2} />
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Feedback: abre o mesmo diálogo do desktop, mas acessível no celular. */}
            <button type="button" onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
              className="mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:bg-muted/60 transition-colors text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><MessageSquarePlus className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
              <div className="min-w-0 flex-1">
                <span className="block text-[15px] font-body font-semibold text-foreground">Enviar feedback</span>
                <span className="block text-[11.5px] font-body text-muted-foreground truncate mt-0.5">Uma ideia ou um problema no app</span>
              </div>
            </button>
            <button type="button" onClick={handleSignOut}
              className="mt-1 mb-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:bg-destructive/10 transition-colors">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
              <span className="text-[15px] font-body font-semibold text-destructive">Sair</span>
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
           style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
        <div className="flex items-center justify-center gap-2.5 px-3 pointer-events-auto">
          <div className="dock-pill flex items-center gap-0.5 rounded-[30px] p-1.5">
            {leftItems.map(renderNavItem)}
            <button type="button" onClick={() => openCria()} aria-label="cria"
              className="mx-0.5 h-11 w-11 rounded-full bg-gradient-to-br from-primary to-pink-400 text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform">
              <Sparkles className="h-5 w-5" strokeWidth={2} />
            </button>
            {rightItems.map(renderNavItem)}
          </div>
          {onCriando && (
            <button type="button" onClick={toggleOverview} aria-label={overview ? "Sair da visão geral" : "Visão geral"}
              className={cn("h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform",
                overview ? "bg-gradient-to-br from-primary to-pink-400 shadow-lg shadow-primary/30" : "dock-pill")}>
              {overview ? <Minimize2 className="h-5 w-5 text-white" strokeWidth={2} />
                        : <Maximize2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.9} />}
            </button>
          )}
          <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-label="Menu"
            className="dock-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <Menu className={cn("h-6 w-6 transition-colors", moreOpen || isMoreActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8}/>
          </button>
        </div>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} origin="usuario" />
    </>
  );
}
