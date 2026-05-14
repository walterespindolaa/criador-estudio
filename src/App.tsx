import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthOnlyRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Ideias = lazy(() => import("./pages/app/Ideias"));
const Tarefas = lazy(() => import("./pages/app/Tarefas"));
const Criando = lazy(() => import("./pages/app/Criando"));
const Feed = lazy(() => import("./pages/app/Feed"));
const Relatorios = lazy(() => import("./pages/app/Relatorios"));
const Admin = lazy(() => import("./pages/app/Admin"));
const Plano = lazy(() => import("./pages/app/Plano"));
const Biblioteca = lazy(() => import("./pages/app/Biblioteca"));
const Arquivos = lazy(() => import("./pages/app/Arquivos"));
const Historico = lazy(() => import("./pages/app/Historico"));
const Configuracoes = lazy(() => import("./pages/app/Configuracoes"));
const Aprender = lazy(() => import("./pages/app/Aprender"));
const Brandbook = lazy(() => import("./pages/app/Brandbook"));
const LinkInBio = lazy(() => import("./pages/app/LinkInBio"));
const Assinar = lazy(() => import("./pages/app/Assinar"));
const BioPage = lazy(() => import("./pages/BioPage"));

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
      <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
              <p className="text-muted-foreground font-body animate-pulse">Carregando...</p>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/bio/:slug" element={<BioPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={
                <ProtectedRoute><Onboarding /></ProtectedRoute>
              } />
              <Route path="/app/assinar" element={
                <AuthOnlyRoute><Assinar /></AuthOnlyRoute>
              } />
              <Route path="/app" element={
                <ProtectedRoute><AppLayout /></ProtectedRoute>
              }>
                <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="ideias" element={<ErrorBoundary><Ideias /></ErrorBoundary>} />
                <Route path="criando" element={<ErrorBoundary><Criando /></ErrorBoundary>} />
                <Route path="feed" element={<ErrorBoundary><Feed /></ErrorBoundary>} />
                <Route path="relatorios" element={<ErrorBoundary><Relatorios /></ErrorBoundary>} />
                <Route path="admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
                <Route path="tarefas" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
                <Route path="plano" element={<ErrorBoundary><Plano /></ErrorBoundary>} />
                <Route path="biblioteca" element={<ErrorBoundary><Biblioteca /></ErrorBoundary>} />
                <Route path="arquivos" element={<ErrorBoundary><Arquivos /></ErrorBoundary>} />
                <Route path="historico" element={<ErrorBoundary><Historico /></ErrorBoundary>} />
                <Route path="aprender" element={<ErrorBoundary><Aprender /></ErrorBoundary>} />
                <Route path="brandbook" element={<ErrorBoundary><Brandbook /></ErrorBoundary>} />
                <Route path="linkinbio" element={<ErrorBoundary><LinkInBio /></ErrorBoundary>} />
                <Route path="configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
