import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { AuthOnlyRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import MetaPixelTracker from "@/components/MetaPixelTracker";
import AppLayout from "./components/AppLayout";
// Telas públicas/auth agora são lazy: não puxam framer-motion no boot de quem já
// está logado (nem no primeiro paint de quem só quer entrar). Todas caem no mesmo
// <Suspense> do topo. Login/Signup são o caminho crítico do primeiro acesso.
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ComecarAgencia = lazy(() => import("./pages/ComecarAgencia"));
const Obrigado = lazy(() => import("./pages/Obrigado"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const ExcluirDados = lazy(() => import("./pages/ExcluirDados"));
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { ConfirmHost } from "@/components/shared/Confirm";
import { CachePersistence } from "@/components/pwa/CachePersistence";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { RoutePrefetch } from "@/components/pwa/RoutePrefetch";
import { ScrollRestore } from "@/components/pwa/ScrollRestore";
import { UpgradeGate } from "@/components/shared/UpgradeGate";
import { useProfile } from "@/hooks/useProfile";
import { deriveTier } from "@/hooks/useTier";
import { useActiveAccount } from "@/contexts/AccountContext";

const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Ideias = lazy(() => import("./pages/app/Ideias"));
const Tarefas = lazy(() => import("./pages/app/Tarefas"));
const Criando = lazy(() => import("./pages/app/Criando"));
const Aprovacao = lazy(() => import("./pages/app/Aprovacao"));
const Modulos = lazy(() => import("./pages/app/Modulos"));
const Feed = lazy(() => import("./pages/app/Feed"));
const Relatorios = lazy(() => import("./pages/app/Relatorios"));
const Admin = lazy(() => import("./pages/app/Admin"));
const Metas = lazy(() => import("./pages/app/Metas"));
const Biblioteca = lazy(() => import("./pages/app/Biblioteca"));
const Arquivos = lazy(() => import("./pages/app/Arquivos"));
const Historico = lazy(() => import("./pages/app/Historico"));
const Configuracoes = lazy(() => import("./pages/app/Configuracoes"));
const Aprender = lazy(() => import("./pages/app/Aprender"));
const Brandbook = lazy(() => import("./pages/app/Brandbook"));
const LinkInBio = lazy(() => import("./pages/app/LinkInBio"));
const Collabs = lazy(() => import("./pages/app/Collabs"));
const Insights = lazy(() => import("./pages/app/Insights"));
const Autopilot = lazy(() => import("./pages/app/Autopilot"));
const MediaKit = lazy(() => import("./pages/app/MediaKit"));
const Tendencias = lazy(() => import("./pages/app/Tendencias"));
const CriaStories = lazy(() => import("./pages/app/CriaStories"));
const CriaPrompter = lazy(() => import("./pages/app/CriaPrompter"));
const PrompterGravar = lazy(() => import("./pages/app/PrompterGravar"));
const TrocarSenha = lazy(() => import("./pages/app/TrocarSenha"));
const Assinar = lazy(() => import("./pages/app/Assinar"));
const BioPage = lazy(() => import("./pages/BioPage"));
const Ativar = lazy(() => import("./pages/Ativar"));
const AprovarPortal = lazy(() => import("./pages/AprovarPortal"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const CronogramaPublica = lazy(() => import("./pages/CronogramaPublica"));
const ManagerLayout = lazy(() => import("./components/accounts/ManagerLayout"));
const ManagerHome = lazy(() => import("./pages/socialmidia/ManagerHome"));
const CriaPost = lazy(() => import("./pages/socialmidia/CriaPost"));
const CriaCrm = lazy(() => import("./pages/socialmidia/CriaCrm"));
const CriaCrmClient = lazy(() => import("./pages/socialmidia/CriaCrmClient"));
const CriaCaixa = lazy(() => import("./pages/socialmidia/CriaCaixa"));
const Parceria = lazy(() => import("./pages/socialmidia/Parceria"));
const Comissoes = lazy(() => import("./pages/socialmidia/Comissoes"));
const Contas = lazy(() => import("./pages/socialmidia/Contas"));
const Clientes = lazy(() => import("./pages/socialmidia/Clientes"));
const ClienteHub = lazy(() => import("./pages/socialmidia/ClienteHub"));
const HubCria = lazy(() => import("./pages/socialmidia/HubCria"));

// Landing do /app: social mídia (gestor) cai direto no dashboard principal DELE
// (/socialmidia/dashboard), não no /app do criador. Cobre os dois sinais de gestor:
// account_type "manager" OU gerenciar ao menos uma conta.
function AppHome() {
  const { profile, isLoading } = useProfile();
  const { user } = useAuth();
  const { hasManagedAccounts, isManaging, accountsLoading, isCollaborator, actingAsTeam } = useActiveAccount();
  if (isLoading || accountsLoading) return null;
  // Colaborador atuando na conta do gestor → cai na agência.
  if (actingAsTeam) return <Navigate to="/socialmidia/dashboard" replace />;
  // Quem tem plano de CRIADOR vigente é dono do próprio /app, mesmo que também
  // gerencie clientes. Antes, um Studio que pegou UM cliente pontual perdia o
  // acesso ao próprio dashboard: gerenciar alguém não pode rebaixar assinante.
  const temPlanoCriador = deriveTier(profile) !== "none";
  const isManagerAccount =
    profile?.account_type === "manager" ||
    (!temPlanoCriador && ((profile?.seat_limit ?? 0) > 0 || hasManagedAccounts || isCollaborator));
  // Só manda pro dashboard da agência quando o gestor está na PRÓPRIA conta.
  // Se ele entrou num cliente (isManaging), mostra o workspace do cliente.
  if (!isManaging && isManagerAccount) return <Navigate to="/socialmidia/dashboard" replace />;
  // Cadastrou como social mídia mas ainda não ativou a agência → onboarding da agência.
  if (!isManagerAccount && (user?.user_metadata as { account_intent?: string } | undefined)?.account_intent === "manager") {
    return <Navigate to="/comecar-agencia" replace />;
  }
  return <Dashboard />;
}
const Aprovacoes = lazy(() => import("./pages/socialmidia/Aprovacoes"));
const AgendaCriacao = lazy(() => import("./pages/socialmidia/AgendaCriacao"));
const Equipe = lazy(() => import("./pages/socialmidia/Equipe"));
const Lixeira = lazy(() => import("./pages/app/Lixeira"));

// Avisa o usuário quando uma query falha (antes os erros eram engolidos →
// skeleton infinito / tela vazia). Throttle pra não floodar com vários toasts.
let lastQueryErrorToast = 0;
// SALVAR QUE FALHA EM SILÊNCIO É PIOR QUE NÃO SALVAR.
// As queries já avisavam quando falhavam. As MUTAÇÕES não: cada hook tratava do
// seu jeito, e qualquer um que esquecesse o onError deixava a pessoa achando que
// tinha salvado. Com update otimista (que a gente usa em tudo), a tela até MOSTRA
// o dado novo — e ele nunca chegou no banco. Esta é a rede de segurança: se um
// hook não avisou, o MutationCache avisa.
const traduzErro = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sem conexão. Sua alteração não foi salva.";
  if (/quota_exceeded/i.test(m)) return "Você atingiu o limite de IA deste mês.";
  if (/no_access|forbidden|permission|row-level/i.test(m)) return "Você não tem acesso a isso.";
  if (/duplicate|unique/i.test(m)) return "Isso já existe.";
  return m.length > 3 && m.length < 140 ? m : "Não consegui salvar. Tente de novo.";
};

let lastMutationErrorToast = 0;
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: () => {
      const now = Date.now();
      if (now - lastQueryErrorToast < 8000) return;
      lastQueryErrorToast = now;
      toast.error("Não consegui carregar alguns dados. Verifique sua conexão e tente de novo.");
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Se o hook já tem o próprio onError, ele que fale — não damos toast dobrado.
      if (mutation.options.onError) return;
      const now = Date.now();
      if (now - lastMutationErrorToast < 4000) return;
      lastMutationErrorToast = now;
      toast.error(traduzErro(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // gcTime era 10min: ao voltar pra uma tela depois de 10 minutos, o cache
      // já tinha sido jogado fora e a tela piscava esqueleto de novo. No celular,
      // que fica minutos em segundo plano, isso acontecia o TEMPO TODO.
      // 24h: volta instantâneo, e o staleTime cuida de atualizar por baixo.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
      // Voltou a ter internet? Revalida. É o caso do metrô, do elevador.
      refetchOnReconnect: true,
      // Dado em cache aparece na hora; a atualização vem por trás, sem pisca.
      refetchOnMount: false,
    },
    mutations: { retry: 0 },
  },
});

/** Raiz do app: a LP pública agora vive em criasocialclub.com.br.
 *  Logado → /app · Deslogado → /login */
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? "/app" : "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccountProvider>
        <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <UpdatePrompt />
        {/* O confirm() nativo do navegador ("app.criasocialclub.com.br diz") era a
            pior coisa na tela de um produto onde a gente cuidou de cada borda. */}
        <ConfirmHost />
        {/* PWA: cache persistido (abre instantâneo), aviso de offline,
            convite de instalação + notificações, e prefetch das telas. */}
        <CachePersistence />
        <OfflineBanner />
        <InstallPrompt />
        <RoutePrefetch />
        <BrowserRouter>
          <ScrollRestore />
          <MetaPixelTracker />
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/bio/:slug" element={<BioPage />} />
              <Route path="/aprovar/:token" element={<AprovarPortal />} />
              <Route path="/proposta/:token" element={<PropostaPublica />} />
              <Route path="/cronograma/:token" element={<CronogramaPublica />} />
              <Route path="/ativar" element={<Ativar />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/cadastro/agencia" element={<Signup defaultManager />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/excluir-dados" element={<ExcluirDados />} />
              <Route path="/onboarding" element={
                <AuthOnlyRoute><Onboarding /></AuthOnlyRoute>
              } />
              <Route path="/comecar-agencia" element={
                <AuthOnlyRoute><ComecarAgencia /></AuthOnlyRoute>
              } />
              <Route path="/app/obrigado" element={
                <AuthOnlyRoute><Obrigado /></AuthOnlyRoute>
              } />
              <Route path="/app/trocar-senha" element={
                <AuthOnlyRoute><TrocarSenha /></AuthOnlyRoute>
              } />
              <Route path="/app" element={
                <ProtectedRoute><AppLayout /></ProtectedRoute>
              }>
                <Route index element={<ErrorBoundary><AppHome /></ErrorBoundary>} />
                {/* PLANOS dentro do layout: ela era a única tela do sistema que
                    abria "fora do app", sem menu, como se fosse outro site. */}
                <Route path="assinar" element={<ErrorBoundary><Assinar /></ErrorBoundary>} />
                <Route path="ideias" element={<ErrorBoundary><Ideias /></ErrorBoundary>} />
                <Route path="criando" element={<ErrorBoundary><Criando /></ErrorBoundary>} />
                {/* ═══ TRAVAS DE PLANO ═══
                    A trava mora AQUI, na rota — não espalhada dentro das páginas.
                    Antes cada tela inventava a sua (três implementações diferentes
                    da mesma regra), e o Cria Estúdio, que gasta crédito pago de
                    geração de imagem, não tinha trava NENHUMA: bastava digitar a
                    URL. Agora esquecer é impossível: quem não tem o plano vê a
                    vitrine daquele recurso, com o CTA. Não é porta na cara. */}
                <Route path="autopilot" element={<ErrorBoundary><UpgradeGate feature="cria-plano"><Autopilot /></UpgradeGate></ErrorBoundary>} />
                <Route path="media-kit" element={<ErrorBoundary><UpgradeGate feature="media-kit"><MediaKit /></UpgradeGate></ErrorBoundary>} />
                <Route path="tendencias" element={<ErrorBoundary><UpgradeGate feature="tendencias"><Tendencias /></UpgradeGate></ErrorBoundary>} />
                <Route path="stories" element={<ErrorBoundary><UpgradeGate feature="stories"><CriaStories /></UpgradeGate></ErrorBoundary>} />
                <Route path="stories/semanastories" element={<ErrorBoundary><UpgradeGate feature="stories"><CriaStories /></UpgradeGate></ErrorBoundary>} />
                <Route path="prompter" element={<ErrorBoundary><UpgradeGate feature="prompter"><CriaPrompter /></UpgradeGate></ErrorBoundary>} />
                <Route path="prompter/gravar/:id" element={<ErrorBoundary><UpgradeGate feature="prompter"><PrompterGravar /></UpgradeGate></ErrorBoundary>} />
                <Route path="aprovacao" element={<ErrorBoundary><Aprovacao /></ErrorBoundary>} />
                <Route path="modulos" element={<ErrorBoundary><Modulos /></ErrorBoundary>} />
                <Route path="feed" element={<ErrorBoundary><UpgradeGate feature="feed"><Feed /></UpgradeGate></ErrorBoundary>} />
                <Route path="lixeira" element={<ErrorBoundary><Lixeira /></ErrorBoundary>} />
                <Route path="relatorios" element={<ErrorBoundary><UpgradeGate feature="relatorios"><Relatorios /></UpgradeGate></ErrorBoundary>} />
                <Route path="cf-admin-panel" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
                <Route path="tarefas" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
                <Route path="plano" element={<Navigate to="/app/metas" replace />} />
                <Route path="metas" element={<ErrorBoundary><Metas /></ErrorBoundary>} />
                <Route path="biblioteca" element={<ErrorBoundary><UpgradeGate feature="biblioteca"><Biblioteca /></UpgradeGate></ErrorBoundary>} />
                <Route path="arquivos" element={<ErrorBoundary><Arquivos /></ErrorBoundary>} />
                <Route path="historico" element={<ErrorBoundary><UpgradeGate feature="historico"><Historico /></UpgradeGate></ErrorBoundary>} />
                <Route path="aprender" element={<ErrorBoundary><Aprender /></ErrorBoundary>} />
                <Route path="brandbook" element={<ErrorBoundary><Brandbook /></ErrorBoundary>} />
                <Route path="linkinbio" element={<ErrorBoundary><LinkInBio /></ErrorBoundary>} />
                <Route path="collabs" element={<ErrorBoundary><UpgradeGate feature="collabs"><Collabs /></UpgradeGate></ErrorBoundary>} />
                <Route path="insights" element={<ErrorBoundary><UpgradeGate feature="insights"><Insights /></UpgradeGate></ErrorBoundary>} />
                <Route path="configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
              </Route>
              <Route path="/socialmidia" element={
                <ProtectedRoute><ManagerLayout /></ProtectedRoute>
              }>
                <Route index element={<Navigate to="/socialmidia/dashboard" replace />} />
                <Route path="dashboard" element={<ErrorBoundary><ManagerHome /></ErrorBoundary>} />
                <Route path="criapost" element={<ErrorBoundary><CriaPost /></ErrorBoundary>} />
                <Route path="criapost/:tab" element={<ErrorBoundary><CriaPost /></ErrorBoundary>} />
                <Route path="criacrm" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/clientes" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/tarefas" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/calendario" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/pipeline" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/contratos" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/:id" element={<ErrorBoundary><CriaCrmClient /></ErrorBoundary>} />
                {/* Cria Caixa: cada seção é uma rota de verdade
                    (/criacaixa/empresa/calendario, /pessoal/orcamento, …).
                    Catch-all: o próprio componente lê o contexto e a seção do path. */}
                <Route path="criacaixa/*" element={<ErrorBoundary><CriaCaixa /></ErrorBoundary>} />
                <Route path="parceria" element={<ErrorBoundary><Parceria /></ErrorBoundary>} />
                <Route path="comissoes" element={<ErrorBoundary><Comissoes /></ErrorBoundary>} />
                <Route path="contas" element={<ErrorBoundary><Contas /></ErrorBoundary>} />
                <Route path="hubcria" element={<ErrorBoundary><HubCria /></ErrorBoundary>} />
                <Route path="clientes" element={<ErrorBoundary><Clientes /></ErrorBoundary>} />
                <Route path="clientes/:id" element={<ErrorBoundary><ClienteHub /></ErrorBoundary>} />
                <Route path="clientes/:id/:tab" element={<ErrorBoundary><ClienteHub /></ErrorBoundary>} />
                <Route path="aprovacoes" element={<ErrorBoundary><Aprovacoes /></ErrorBoundary>} />
                <Route path="agenda" element={<ErrorBoundary><AgendaCriacao /></ErrorBoundary>} />
                <Route path="equipe" element={<ErrorBoundary><Equipe /></ErrorBoundary>} />
                <Route path="lixeira" element={<ErrorBoundary><Lixeira /></ErrorBoundary>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </TooltipProvider>
      </AccountProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
