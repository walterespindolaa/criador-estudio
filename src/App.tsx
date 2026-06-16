import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { AuthOnlyRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";

const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Ideias = lazy(() => import("./pages/app/Ideias"));
const Tarefas = lazy(() => import("./pages/app/Tarefas"));
const Criando = lazy(() => import("./pages/app/Criando"));
const Aprovacao = lazy(() => import("./pages/app/Aprovacao"));
const Modulos = lazy(() => import("./pages/app/Modulos"));
const Feed = lazy(() => import("./pages/app/Feed"));
const Relatorios = lazy(() => import("./pages/app/Relatorios"));
const Admin = lazy(() => import("./pages/app/Admin"));
const Plano = lazy(() => import("./pages/app/Plano"));
const Metas = lazy(() => import("./pages/app/Metas"));
const Biblioteca = lazy(() => import("./pages/app/Biblioteca"));
const Arquivos = lazy(() => import("./pages/app/Arquivos"));
const Historico = lazy(() => import("./pages/app/Historico"));
const Configuracoes = lazy(() => import("./pages/app/Configuracoes"));
const Aprender = lazy(() => import("./pages/app/Aprender"));
const Brandbook = lazy(() => import("./pages/app/Brandbook"));
const LinkInBio = lazy(() => import("./pages/app/LinkInBio"));
const Collabs = lazy(() => import("./pages/app/Collabs"));
const TrocarSenha = lazy(() => import("./pages/app/TrocarSenha"));
const Assinar = lazy(() => import("./pages/app/Assinar"));
const BioPage = lazy(() => import("./pages/BioPage"));
const AprovarPortal = lazy(() => import("./pages/AprovarPortal"));
const ManagerLayout = lazy(() => import("./components/accounts/ManagerLayout"));
const ManagerHome = lazy(() => import("./pages/socialmidia/ManagerHome"));
const CriaPost = lazy(() => import("./pages/socialmidia/CriaPost"));
const CriaCrm = lazy(() => import("./pages/socialmidia/CriaCrm"));
const CriaCrmClient = lazy(() => import("./pages/socialmidia/CriaCrmClient"));
const CriaCaixa = lazy(() => import("./pages/socialmidia/CriaCaixa"));
const Parceria = lazy(() => import("./pages/socialmidia/Parceria"));
const Comissoes = lazy(() => import("./pages/socialmidia/Comissoes"));
const Contas = lazy(() => import("./pages/socialmidia/Contas"));
const Aprovacoes = lazy(() => import("./pages/socialmidia/Aprovacoes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccountProvider>
        <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/bio/:slug" element={<BioPage />} />
              <Route path="/aprovar/:token" element={<AprovarPortal />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/onboarding" element={
                <AuthOnlyRoute><Onboarding /></AuthOnlyRoute>
              } />
              <Route path="/app/assinar" element={
                <AuthOnlyRoute><Assinar /></AuthOnlyRoute>
              } />
              <Route path="/app/trocar-senha" element={
                <AuthOnlyRoute><TrocarSenha /></AuthOnlyRoute>
              } />
              <Route path="/app" element={
                <ProtectedRoute><AppLayout /></ProtectedRoute>
              }>
                <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="ideias" element={<ErrorBoundary><Ideias /></ErrorBoundary>} />
                <Route path="criando" element={<ErrorBoundary><Criando /></ErrorBoundary>} />
                <Route path="aprovacao" element={<ErrorBoundary><Aprovacao /></ErrorBoundary>} />
                <Route path="modulos" element={<ErrorBoundary><Modulos /></ErrorBoundary>} />
                <Route path="feed" element={<ErrorBoundary><Feed /></ErrorBoundary>} />
                <Route path="relatorios" element={<ErrorBoundary><Relatorios /></ErrorBoundary>} />
                <Route path="cf-admin-panel" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
                <Route path="tarefas" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
                <Route path="plano" element={<ErrorBoundary><Plano /></ErrorBoundary>} />
                <Route path="metas" element={<ErrorBoundary><Metas /></ErrorBoundary>} />
                <Route path="biblioteca" element={<ErrorBoundary><Biblioteca /></ErrorBoundary>} />
                <Route path="arquivos" element={<ErrorBoundary><Arquivos /></ErrorBoundary>} />
                <Route path="historico" element={<ErrorBoundary><Historico /></ErrorBoundary>} />
                <Route path="aprender" element={<ErrorBoundary><Aprender /></ErrorBoundary>} />
                <Route path="brandbook" element={<ErrorBoundary><Brandbook /></ErrorBoundary>} />
                <Route path="linkinbio" element={<ErrorBoundary><LinkInBio /></ErrorBoundary>} />
                <Route path="collabs" element={<ErrorBoundary><Collabs /></ErrorBoundary>} />
                <Route path="configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
              </Route>
              <Route path="/socialmidia" element={
                <ProtectedRoute><ManagerLayout /></ProtectedRoute>
              }>
                <Route index element={<Navigate to="/socialmidia/dashboard" replace />} />
                <Route path="dashboard" element={<ErrorBoundary><ManagerHome /></ErrorBoundary>} />
                <Route path="criapost" element={<ErrorBoundary><CriaPost /></ErrorBoundary>} />
                <Route path="criacrm" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/clientes" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/tarefas" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/calendario" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/pipeline" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/contratos" element={<ErrorBoundary><CriaCrm /></ErrorBoundary>} />
                <Route path="criacrm/:id" element={<ErrorBoundary><CriaCrmClient /></ErrorBoundary>} />
                <Route path="criacaixa" element={<ErrorBoundary><CriaCaixa /></ErrorBoundary>} />
                <Route path="criacaixa/empresa" element={<ErrorBoundary><CriaCaixa /></ErrorBoundary>} />
                <Route path="criacaixa/pessoafisica" element={<ErrorBoundary><CriaCaixa /></ErrorBoundary>} />
                <Route path="parceria" element={<ErrorBoundary><Parceria /></ErrorBoundary>} />
                <Route path="comissoes" element={<ErrorBoundary><Comissoes /></ErrorBoundary>} />
                <Route path="contas" element={<ErrorBoundary><Contas /></ErrorBoundary>} />
                <Route path="aprovacoes" element={<ErrorBoundary><Aprovacoes /></ErrorBoundary>} />
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
