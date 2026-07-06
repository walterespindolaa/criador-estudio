import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useT } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type LoginFormData = { email: string; password: string };
type ForgotFormData = { email: string };

const Login = () => {
  const navigate = useNavigate();
  const t = useT();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.minPassword")).max(128, t("auth.maxPassword")),
  });
  const forgotSchema = z.object({ email: z.string().email(t("auth.invalidEmail")) });

  const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const { register: registerForgot, handleSubmit: handleSubmitForgot, formState: { errors: forgotErrors } } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const emailValue = watch("email");

  const onSubmitLogin = async (data: LoginFormData) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    setLoading(false);
    if (error) {
      toast.error(t("auth.wrongCredentials"));
    } else {
      navigate("/app");
    }
  };

  const onSubmitForgot = async (data: ForgotFormData) => {
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(t("auth.sendError"));
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-card items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="max-w-md">
          <Logo className="h-14 w-auto mb-8" />
          <h2 className="text-4xl font-display font-extrabold text-foreground tracking-tight mb-4">{t("auth.welcomeBack")}</h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">{t("auth.welcomeBackDesc")}</p>
        </motion.div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex justify-center lg:justify-start">
            <Logo className="h-16 lg:h-10 w-auto" />
          </Link>
          <h3 className="text-2xl font-display font-extrabold text-foreground mb-2">{t("auth.signIn")}</h3>
          <p className="text-muted-foreground font-body mb-8">{t("auth.signInDesc")}</p>

          <form onSubmit={handleSubmit(onSubmitLogin)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body">{t("auth.email")}</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-xl h-12" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-body">{t("auth.password")}</Label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotSent(false); }}
                  className="text-xs text-primary font-body hover:underline"
                >
                  {t("auth.forgot")}
                </button>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" {...register("password")} className="rounded-xl h-12 pr-10" />
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
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground font-body mt-6 text-center">
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">{t("auth.createAccount")}</Link>
          </p>
        </motion.div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("auth.forgotTitle")}</DialogTitle>
            <DialogDescription className="font-body">
              {forgotSent
                ? t("auth.forgotSent")
                : t("auth.forgotPrompt")
              }
            </DialogDescription>
          </DialogHeader>
          {!forgotSent ? (
            <form onSubmit={handleSubmitForgot(onSubmitForgot)} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  defaultValue={emailValue}
                  {...registerForgot("email")}
                  className="rounded-xl"
                />
                {forgotErrors.email && <p className="text-xs text-destructive mt-1">{forgotErrors.email.message}</p>}
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={forgotLoading}>
                <Mail className="h-4 w-4 mr-2" />
                {forgotLoading ? t("auth.sending") : t("auth.sendLink")}
              </Button>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setForgotOpen(false)} className="w-full">
              {t("common.close")}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
