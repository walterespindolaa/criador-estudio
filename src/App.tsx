import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Ideias from "./pages/app/Ideias";
import Criando from "./pages/app/Criando";
import Plano from "./pages/app/Plano";
import Biblioteca from "./pages/app/Biblioteca";
import Historico from "./pages/app/Historico";
import Configuracoes from "./pages/app/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="ideias" element={<Ideias />} />
            <Route path="criando" element={<Criando />} />
            <Route path="plano" element={<Plano />} />
            <Route path="biblioteca" element={<Biblioteca />} />
            <Route path="historico" element={<Historico />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
