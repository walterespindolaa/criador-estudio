import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useT } from "@/lib/i18n";

type ResetFormData = { password: string; confirmPassword: string };

const ResetPassword = () => {
  const navigate = useNavigate();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  // Enquanto o token do link ainda está sendo processado não mostramos "inválido".
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetSchema = z.object({
    password: z.string().min(8, t("auth.minPassword")).max(128, t("auth.maxPassword")),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("signup.passwordsNoMatch"),
    path: ["confirmPassword"],
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    let active = true;

    // Escuta o evento de recuperação. No fluxo implícito o detectSessionInUrl do
    // client processa o hash (#access_token...&type=recovery) e dispara este evento.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    const processarLink = async () => {
      const query = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // Erro explícito devolvido pelo Supabase (ex.: token expirado/já usado).
      const erro = query.get("error_description") || hashParams.get("error_description")
        || query.get("error") || hashParams.get("error");

      // Fluxo PKCE: o link volta com ?code=... e é preciso trocar pela sessão.
      const code = query.get("code");
      if (code && !erro) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (!error) {
          setIsRecovery(true);
          setChecking(false);
          return;
        }
      }

      // Fluxo implícito com o hash ainda presente (caso o detectSessionInUrl ainda
      // não tenha limpado a URL).
      if (!erro && window.location.hash.includes("type=recovery")) {
        setIsRecovery(true);
        setChecking(false);
        return;
      }

      if (erro) {
        setChecking(false);
        return;
      }

      // O detectSessionInUrl pode já ter consumido o token e limpado a URL (deixando
      // apenas "#" vazio). getSession aguarda essa inicialização terminar: se existe
      // uma sessão, o link de recuperação foi validado com sucesso.
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setIsRecovery(true);
      }
      setChecking(false);
    };

    processarLink();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: ResetFormData) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("reset.error"));
    } else {
      toast.success(t("reset.success"));
      // "/" (RootRedirect) manda cada um pro seu lugar: parceiro → /parceiro,
      // criador/social mídia → /app. Foi o furo que jogou o PeJota no
      // onboarding de criador depois de redefinir a senha.
      navigate("/");
    }
  };

  // Enquanto processa o token do link, não decide nada (evita mostrar "inválido"
  // antes do Supabase terminar de ler a URL).
  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground font-body">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-body">{t("reset.invalidLink")}</p>
          <Button variant="link" onClick={() => navigate("/login")} className="mt-4">
            {t("reset.backToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-2">
          <Logo className="h-10 w-auto" />
        </div>
        <h3 className="text-2xl font-display font-semibold text-foreground mb-2">{t("reset.newPassword")}</h3>
        <p className="text-muted-foreground font-body mb-8">{t("reset.subtitle")}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label className="font-body">{t("reset.newPassword")}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("signup.passwordPlaceholder")}
                {...register("password")}
                className="rounded-xl h-12 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="font-body">{t("signup.confirmPassword")}</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder={t("signup.confirmPlaceholder")}
                {...register("confirmPassword")}
                className="rounded-xl h-12 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? t("reset.saving") : t("reset.save")}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
