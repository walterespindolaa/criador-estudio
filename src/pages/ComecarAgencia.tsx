import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Check, Users, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

/**
 * BOAS-VINDAS DA SOCIAL MÍDIA (antes era um paywall, e estava errado).
 *
 * O que esta tela era: um checkout OBRIGATÓRIO. Quem se cadastrava como social
 * mídia tinha que escolher quantos assentos queria e PAGAR antes de conseguir
 * abrir o painel. Isso contradiz o modelo do produto e a própria landing, que
 * promete "área do gestor gratuita, você ativa só os módulos que usar".
 *
 * O que ela é agora: uma tela de boas-vindas que abre a conta de graça. O que se
 * paga vem depois e por dentro do app: os MÓDULOS (Cria Post, Cria Gestão, Cria
 * Caixa, Cria Radar) e os ASSENTOS de cliente, em "Suas contas".
 *
 * Na prática, com o gatilho do banco corrigido (ver a migration
 * 20260802000001_conta_social_midia_gratis.sql), a conta já nasce como gestora e
 * ninguém mais cai aqui. Esta tela fica como rede de segurança pra quem se
 * cadastrou ANTES da correção e ainda não foi migrado.
 */
const INCLUSO = [
  "Painel com todos os seus clientes num lugar só",
  "Ficha completa de cada cliente, com brandbook e links",
  "Agenda juntando criações, tarefas, captações e posts",
  "Fila única de aprovações de todos os clientes",
];

export default function ComecarAgencia() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, isLoading } = useProfile();
  const [loading, setLoading] = useState(false);

  // Já é conta de gestora? vai direto pro painel.
  useEffect(() => {
    if (!isLoading && (profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0)) {
      navigate("/socialmidia/dashboard", { replace: true });
    }
  }, [isLoading, profile, navigate]);

  // Abre a conta de gestora. Sem cobrança: quem cobra são os módulos e os
  // assentos, cada um com o seu próprio checkout. A coluna account_type é
  // travada pela RLS (é campo de privilégio), então a gravação vai pela RPC
  // security definer tornar_conta_manager(), que valida auth.uid() no servidor
  // e só marca a própria conta como gestora.
  const abrirConta = async () => {
    setLoading(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao?.user?.id;
      if (!uid) { toast.error("Sua sessão expirou. Entre de novo."); return; }
      // Cast: a RPC é nova e ainda não está nos tipos gerados do banco.
      const { error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ error: unknown }>)("tornar_conta_manager");
      if (error) {
        console.error("[comecar-agencia] falha ao abrir a conta:", error);
        toast.error("Não consegui abrir sua conta agora. Tente de novo.");
        return;
      }
      toast.success("Pronto! Sua área de social mídia está aberta.");
      // replace evita voltar pra esta tela com o botão de voltar.
      window.location.replace("/socialmidia/dashboard");
    } catch (e) {
      console.error("[comecar-agencia] erro inesperado:", e);
      toast.error("Algo deu errado. Tente de novo.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-lg">
        <div className="flex justify-center mb-8"><Logo className="h-10 w-auto" /></div>

        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-warm-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
            <h1 className="text-xl font-display font-extrabold text-foreground">Sua área de social mídia</h1>
          </div>
          <p className="text-sm font-body text-muted-foreground mb-5">
            A conta é gratuita. Você entra, cadastra seus clientes e só paga pelos módulos que resolver usar.
          </p>

          <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Já vem incluso, sem pagar nada</p>
          <ul className="space-y-2 mb-6">
            {INCLUSO.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm font-body text-foreground/85">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 mb-6">
            <p className="text-[13px] font-body text-foreground leading-snug">
              <b>E o que é pago?</b> Só os módulos, contratados um a um lá dentro: Cria Post pra aprovação por link,
              Cria Gestão pro CRM, Cria Caixa pro financeiro e Cria Radar pra análise de concorrentes. Assento de
              cliente também é à parte, em "Suas contas".
            </p>
          </div>

          <Button variant="hero" size="lg" className="w-full" onClick={abrirConta} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Entrar na minha área
          </Button>
          <p className="text-[11px] font-body text-muted-foreground text-center mt-3">Sem cartão, sem cobrança agora.</p>
        </div>

        <button onClick={() => { void signOut().then(() => navigate("/login")); }}
          className="mx-auto mt-5 flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </motion.div>
    </div>
  );
}
