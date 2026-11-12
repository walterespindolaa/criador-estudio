import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Home, Lightbulb, Kanban, CalendarDays,
  BookOpen, Archive, GraduationCap, FolderOpen, ListTodo, BookMarked, Settings, Menu, Search, LogOut, Grid3X3, Link2, ClipboardCheck, Handshake, Maximize2, Minimize2, Instagram, BarChart3, ShieldCheck, PlayCircle, Clapperboard, Wand2, TrendingUp, IdCard, Trash2, Gem, Video, Globe, MessageSquarePlus, UsersRound, Briefcase
} from "lucide-react";
import { useAcessoCriakut } from "@/hooks/useCriakut";
import { useSouParceiro } from "@/hooks/useParceiro";
import { useActiveAccount } from "@/contexts/AccountContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { PlanTag } from "@/components/shared/PlanTag";
import { FeedbackDialog } from "@/components/FeedbackButton";
import { useTemSocialMidia } from "@/hooks/useTemSocialMidia";

const leftItems = [
  { title: "Início", url: "/app", icon: Home, exact: true },
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
];

const rightItems = [
  { title: "Criando", url: "/app/criando", icon: Kanban },
];

type MoreItem = { title: string; url: string; icon: typeof Home; hot?: boolean; desc?: string; soComSocialMidia?: boolean };
const MORE_SECTIONS: { title: string; items: MoreItem[] }[] = [
  { title: "Criar", items: [
    // Ordem pedida pelo Walter (31/08): Produção, Ideias, Tarefas.
    { title: "Em produção", url: "/app/criando", icon: Kanban, desc: "Seu kanban de posts" },
    { title: "Ideias", url: "/app/ideias", icon: Lightbulb, desc: "Banco de ideias e ganchos" },
    { title: "Tarefas", url: "/app/tarefas", icon: ListTodo, desc: "O que falta pra cada post sair" },
  ]},
  // Mundo CRIA acima de Planejar (Walter, 04/09), igual ao menu do desktop.
  { title: "Mundo CRIA", items: [
    { title: "Cria Plano", url: "/app/autopilot", icon: Wand2, hot: true, desc: "Cronograma do mês com a Cria IA" },
    { title: "Cria Stories", url: "/app/stories", icon: Clapperboard, desc: "Plano de stories da semana" },
    { title: "Tendências", url: "/app/tendencias", icon: TrendingUp, hot: true, desc: "O que tá bombando no nicho" },
    { title: "Cria Prompter", url: "/app/prompter", icon: Video, hot: true, desc: "Teleprompter com comando de voz" },
  ]},
  { title: "Planejar", items: [
    { title: "Meu Feed", url: "/app/feed", icon: Grid3X3, desc: "Prévia do seu feed" },
    // Filtrado na renderização: só aparece quando a conta tem social mídia
    // vinculada (é ela quem aprova por ali). Ver soComSocialMidia abaixo.
    { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck, desc: "O que espera seu ok", soComSocialMidia: true },
    { title: "Calendário & Metas", url: "/app/metas", icon: CalendarDays, desc: "Calendário e objetivos" },
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
  { title: "Aprender", items: [
    { title: "Cursos", url: "/app/aprender", icon: GraduationCap },
    { title: "Tutoriais", url: "/app/tutoriais", icon: PlayCircle },
  ]},
  { title: "Mais", items: [
    { title: "Parcerias", url: "/app/collabs", icon: Handshake },
    // PLANOS. Eu tinha colocado o item só no menu lateral do DESKTOP e a maior
    // parte dessa gente vive no celular. Ou seja: quem quisesse fazer upgrade,
    // pelo celular, não tinha por onde. Você não pode esconder a porta de quem
    // está tentando te pagar.
    { title: "Planos", url: "/app/assinar", icon: Gem, desc: "Ver planos e fazer upgrade" },
    { title: "Lixeira", url: "/app/lixeira", icon: Trash2 },
    { title: "Configurações", url: "/app/configuracoes", icon: Settings },
  ]},
];

/* Cor cheia da marca por grupo do menu. `borda` é a cor usada no contorno e no
   ícone da linha "Você mais usa" (o amarelo e o rosa ganham um tom mais firme
   pra não sumir no branco). */
type CorGrupo = { fundo: string; texto: string; borda: string };
const CORES_GRUPO: Record<string, CorGrupo> = {
  "Criar": { fundo: "#EB4918", texto: "#FFFFFF", borda: "#EB4918" },
  "Mundo CRIA": { fundo: "#FF77B9", texto: "#0A0A0A", borda: "#F0469A" },
  "Planejar": { fundo: "#0061EE", texto: "#FFFFFF", borda: "#0061EE" },
  "Resultados": { fundo: "#00A652", texto: "#FFFFFF", borda: "#00A652" },
  "Minha marca": { fundo: "#FFCF03", texto: "#0A0A0A", borda: "#E0B400" },
};
const COR_PADRAO: CorGrupo = { fundo: "#0061EE", texto: "#FFFFFF", borda: "#0061EE" };
const corDoGrupo = (titulo: string): CorGrupo => CORES_GRUPO[titulo] ?? COR_PADRAO;
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  useTravarRolagem(moreOpen);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { openCria } = useCriaAI();
  const { profile } = useProfile();
  const { temSocialMidia } = useTemSocialMidia();
  const { temAcesso: temCriakut } = useAcessoCriakut();
  // Parceiro na própria conta de criadora: porta de volta pra bancada (igual ao AppRail).
  const { data: souParceiro } = useSouParceiro();
  const { isManaging } = useActiveAccount();
  const portaDaBancada = souParceiro && !isManaging
    ? [{ title: "Parceiro", items: [{ title: "Clientes e demandas", url: "/socialmidia/dashboard", icon: Briefcase, desc: "Sua carteira e a fila das agências" }] as MoreItem[] }]
    : [];
  const base = [...portaDaBancada, ...MORE_SECTIONS].map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.soComSocialMidia || temSocialMidia),
  })).map((s) => s.title === "Mais" && temCriakut
    ? { ...s, items: [{ title: "Criakut", url: "/app/criakut", icon: UsersRound, desc: "Ache social mídia, designer, editor e filmmaker" }, ...s.items] }
    : s);
  const sections = profile?.role === "admin"
    ? base.map((s) => s.title === "Mais"
        ? { ...s, items: [...s.items, { title: "Admin", url: "/app/cf-admin-panel", icon: ShieldCheck }] }
        : s)
    : base;
  const allMoreItems = sections.flatMap((s) => s.items);

  /* ── Menu em grade (12/11/2026) ── */
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca.trim());
  const casa = (i: MoreItem) => !termo || semAcento(i.title).includes(termo) || semAcento(i.desc ?? "").includes(termo);
  const EM_PILULA = ["Aprender", "Mais"];
  const gruposGrade = sections.filter((s) => !EM_PILULA.includes(s.title))
    .map((s) => ({ ...s, items: s.items.filter(casa) })).filter((s) => s.items.length > 0);
  const pilulas = sections.filter((s) => EM_PILULA.includes(s.title)).flatMap((s) => s.items).filter(casa);
  /* "Você mais usa": os módulos que a pessoa mais abriu em 30 dias (RPC
     meus_modulos_mais_usados, lê o contador do RastroDeTelas). Só busca quando
     o menu abre. O que já mora na barra de baixo fica de fora. Sem a RPC ou
     com pouco uso, a linha simplesmente não aparece. */
  const { data: modulosUsados } = useQuery<string[]>({
    queryKey: ["menu-mais-usados", profile?.id],
    enabled: moreOpen && !!profile?.id,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as unknown as (fn: string) => PromiseLike<{ data: unknown; error: unknown }>)("meus_modulos_mais_usados");
        return error || !Array.isArray(data) ? [] : (data as unknown[]).map(String);
      } catch { return []; }
    },
  });
  const NA_BARRA = ["/app", "/app/ideias", "/app/criando"];
  const maisUsados = (modulosUsados ?? [])
    .map((m) => {
      const sec = sections.find((s) => s.items.some((i) => i.url === `/app/${m}`));
      const item = sec?.items.find((i) => i.url === `/app/${m}`);
      return item && sec && !NA_BARRA.includes(item.url) ? { item, cor: corDoGrupo(sec.title) } : null;
    })
    .filter((x): x is { item: MoreItem; cor: CorGrupo } => !!x)
    .slice(0, 4);
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
        className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 px-2"
      >
        <item.icon
          className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")}
          strokeWidth={active ? 2 : 1.5}
        />
        <span
          className={cn(
            "text-[11.5px] font-body transition-colors",
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
        <>
          {/* Véu escuro. A faixa de baixo, que ele não alcança no iPhone instalado, ganha um remendo em useTravarRolagem. */}
          <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm touch-none" onClick={() => setMoreOpen(false)} />
        </>
      )}
      {moreOpen && (
        <div
          /* MENU FLUTUANTE (Walter, 09/11/2026: "a borda inferior fica toda
             branca"). Antes a folha descia até o fim da tela e reservava 96px
             vazios embaixo pra barra de baixo não cobrir os itens. Agora ela
             para logo acima da barra, com os quatro cantos redondos, e a barra
             fica sobre o fundo escurecido. */
          className="fixed left-3 right-3 z-40 md:hidden bg-card border border-border rounded-[28px] shadow-warm-lg overflow-hidden flex flex-col"
          style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100dvh - 88px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 24px)' }}
        >
          {/* Cabeçalho */}
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
            <h2 className="text-xl font-display font-extrabold text-foreground">Menu</h2>
          </div>
          {/* min-h-0: sem ele o filho de um flex-col cresce até o tamanho do conteúdo, é
              cortado pelo pai (overflow-hidden) e nunca rola; o dedo então rolava a
              página de trás. overscroll-contain: ao chegar no fim, não passa pra trás. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] pb-4">
            {/* MENU EM GRADE (Walter, 12/11/2026, mockup em tela real aprovado).
                Antes: 25 itens em lista, 7 por tela. Agora: grade de 4, cor cheia
                da marca por grupo, sem borda preta nem tom claro. No topo, busca
                (filtra os blocos) e "Você mais usa" (os módulos que ESTA pessoa
                mais abriu nos últimos 30 dias, em branco com a borda na cor do
                grupo). Aprender, Mais, feedback e sair viram pílulas no fim. */}
            <label className="mb-[18px] flex items-center gap-2.5 rounded-full bg-[#F1EEE4] px-4 py-3 text-[#5B574E]">
              <Search className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no Cria" aria-label="Buscar no menu"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] font-body text-[#0A0A0A] placeholder:text-[#5B574E] outline-none" />
            </label>

            {!termo && maisUsados.length >= 2 && (
              <div className="mb-5">
                <p className="mb-2.5 text-[15px] font-display font-extrabold text-foreground">Você mais usa</p>
                <div className="grid grid-cols-4 gap-[9px]">
                  {maisUsados.map(({ item, cor }) => (
                    <NavLink key={"mu" + item.url} to={item.url} onClick={() => setMoreOpen(false)}
                      className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[20px] border-[2.5px] bg-white px-1.5 pb-[9px] pt-3 active:scale-[0.97] transition-transform"
                      style={{ borderColor: cor.borda }}>
                      <item.icon className="h-[22px] w-[22px]" strokeWidth={1.9} style={{ color: cor.borda }} />
                      <span className="text-center text-[11.5px] font-body font-bold leading-[1.15] text-[#0A0A0A]">{item.title}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

            {gruposGrade.map((sec) => {
              const cor = corDoGrupo(sec.title);
              return (
                <div key={sec.title} className="mb-[18px]">
                  <p className="mb-2.5 text-[15px] font-display font-extrabold text-foreground">{sec.title === "Mundo CRIA" ? "Mundo Cria" : sec.title}</p>
                  <div className="grid grid-cols-4 gap-[9px]">
                    {sec.items.map((item) => (
                      <NavLink key={item.url + item.title} to={item.url} onClick={() => setMoreOpen(false)}
                        className={cn("relative flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[20px] px-1.5 pb-[11px] pt-3.5 active:scale-[0.97] transition-transform",
                          isActive(item.url) && "ring-[3px] ring-[#0A0A0A] ring-offset-2 ring-offset-card")}
                        style={{ background: cor.fundo, color: cor.texto }}>
                        <span className="absolute right-1 top-1"><PlanTag to={item.url} /></span>
                        <item.icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
                        <span className="text-center text-[11.5px] font-body font-semibold leading-[1.15]">{item.title}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}

            {termo && gruposGrade.length === 0 && pilulas.length === 0 && (
              <p className="py-6 text-center text-[14px] font-body text-muted-foreground">Nada com esse nome no menu.</p>
            )}

            <div className="mt-1 flex flex-wrap gap-2">
              {pilulas.map((item) => (
                <NavLink key={item.url + item.title} to={item.url} onClick={() => setMoreOpen(false)}
                  className={cn("inline-flex h-10 items-center gap-1.5 rounded-full bg-[#F1EEE4] px-3.5 text-[13px] font-body font-semibold text-[#0A0A0A] active:scale-[0.97] transition-transform",
                    isActive(item.url) && "bg-[#0A0A0A] text-[#F5F3E7]")}>
                  <item.icon className="h-4 w-4" strokeWidth={1.9} />{item.title}
                </NavLink>
              ))}
              {!termo && (
                <>
                  {/* Feedback: abre o mesmo diálogo do desktop, mas acessível no celular. */}
                  <button type="button" onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#F1EEE4] px-3.5 text-[13px] font-body font-semibold text-[#0A0A0A] active:scale-[0.97] transition-transform">
                    <MessageSquarePlus className="h-4 w-4" strokeWidth={1.9} />Enviar feedback
                  </button>
                  <button type="button" onClick={handleSignOut}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-destructive/10 px-3.5 text-[13px] font-body font-semibold text-destructive active:scale-[0.97] transition-transform">
                    <LogOut className="h-4 w-4" strokeWidth={1.9} />Sair
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
           style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
        {/* BARRA DE BAIXO INTEIRA (Walter, 12/11/2026, mockup em tela real
            aprovado). Antes era uma pílula de 200px com botões de 41x39 e o
            Menu numa bolinha solta, sem nome. Agora é uma peça só, de ponta a
            ponta, com cinco espaços iguais (toque de 48px no mínimo) e o Menu
            com nome. Continua flutuando, com os cantos redondos. */}
        <div className="relative flex items-center justify-center px-3 pointer-events-auto">
          {onCriando && (
            <button type="button" onClick={toggleOverview} aria-label={overview ? "Sair da visão geral" : "Visão geral"}
              className={cn("absolute -top-[62px] right-3 h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform",
                overview ? "bg-gradient-to-br from-primary to-pink-400 shadow-lg shadow-primary/30" : "dock-pill")}>
              {overview ? <Minimize2 className="h-5 w-5 text-white" strokeWidth={2} />
                        : <Maximize2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.9} />}
            </button>
          )}
          <div className="dock-pill grid h-16 w-full max-w-[440px] grid-cols-5 items-center justify-items-center rounded-[30px] px-1.5">
            {leftItems.map(renderNavItem)}
            <button type="button" onClick={() => openCria()} aria-label="cria"
              className="h-12 w-12 rounded-full bg-[#FFCF03] flex items-center justify-center shadow-lg shadow-black/15 active:scale-95 transition-transform">
              {/* Selo das Criaturas, o mesmo do topo do chat da Cria IA (Walter, 09/11/2026). */}
              <img src="/logo-icon-sm.png" alt="" draggable={false} className="h-[32px] w-[32px] object-contain" />
            </button>
            {rightItems.map(renderNavItem)}
            <button type="button" onClick={() => { setBusca(""); setMoreOpen(!moreOpen); }} aria-label="Menu" aria-expanded={moreOpen}
              className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 px-2">
              <Menu className={cn("h-5 w-5 transition-colors", moreOpen || isMoreActive ? "text-primary" : "text-muted-foreground")} strokeWidth={moreOpen || isMoreActive ? 2 : 1.5} />
              <span className={cn("text-[11.5px] font-body transition-colors", moreOpen || isMoreActive ? "text-primary font-semibold" : "text-muted-foreground font-medium")}>Menu</span>
            </button>
          </div>
        </div>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} origin="usuario" />
    </>
  );
}
