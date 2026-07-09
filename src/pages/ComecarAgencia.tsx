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

const SEAT_OPTIONS = [3, 5, 10, 20];

const BENEFITS = [
  "Gerencie vários clientes num só painel",
  "Cria Post com aprovação do cliente por link",
  "CRM, contratos, tarefas e financeiro da agência",
  "Convide sua equipe (1º colaborador grátis)",
];

export default function ComecarAgencia() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, isLoading } = useProfile();
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);

  // Já é agência? vai direto pro hub.
  useEffect(() => {
    if (!isLoading && (profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0)) {
      navigate("/socialmidia/dashboard", { replace: true });
    }
  }, [isLoading, profile, navigate]);

  const subscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plan: "agency", seats } });
      const url = (data as { url?: string })?.url;
      if (error || !url) { toast.error("Não consegui abrir o checkout. Tente de novo."); return; }
      window.location.href = url;
    } catch (e) {
      console.error("[comecar-agencia] checkout failed:", e);
      toast.error("Falha ao iniciar o checkout.");
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
            <h1 className="text-xl font-display font-extrabold text-foreground">Comece sua agência no Cria</h1>
          </div>
          <p className="text-sm font-body text-muted-foreground mb-5">Você criou uma conta de social mídia. Ative o plano de agência pra abrir o painel de gestão de clientes.</p>

          <ul className="space-y-2 mb-6">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm font-body text-foreground/85">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>

          <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quantos clientes você atende?</p>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {SEAT_OPTIONS.map((n) => (
              <button key={n} type="button" onClick={() => setSeats(n)}
                className={`rounded-xl border py-3 text-center transition-colors ${seats === n ? "border-primary bg-primary/[0.06] text-primary" : "border-border text-foreground hover:border-primary/40"}`}>
                <span className="block text-lg font-display font-extrabold">{n}</span>
                <span className="block text-[10px] font-body text-muted-foreground">assentos</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-body text-muted-foreground mb-5">Cada assento = 1 cliente. Você aumenta ou reduz quando quiser lá em "Suas contas".</p>

          <Button variant="hero" size="lg" className="w-full" onClick={subscribe} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Ativar agência e continuar
          </Button>
          <p className="text-[11px] font-body text-muted-foreground text-center mt-3">Você é levado pro pagamento seguro. Assim que confirmar, o painel abre automaticamente.</p>
        </div>

        <button onClick={() => { void signOut().then(() => navigate("/login")); }}
          className="mx-auto mt-5 flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </motion.div>
    </div>
  );
}
