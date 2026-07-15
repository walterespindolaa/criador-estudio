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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#F5F3E7]">
      {/* blobs decorativos, identidade da LP */}
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-24 w-80 h-80 bg-[#FF77B9] rounded-[38%_62%_55%_45%/48%_42%_58%_52%]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-24 w-64 h-64 bg-[#FFCF03] rounded-[55%_45%_40%_60%/50%_60%_40%_50%]" />
      <div aria-hidden className="pointer-events-none absolute top-[18%] left-[8%] w-16 h-16 bg-[#0061EE] rounded-full hidden md:block" />
      <div aria-hidden className="pointer-events-none absolute bottom-[20%] right-[9%] w-10 h-10 bg-[#01A652] rounded-full hidden md:block" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md bg-[#FDFBF5] border-2 border-[#0A0A0A] rounded-[28px] shadow-[0_10px_0_rgba(21,20,18,0.9)] p-8 sm:p-10"
      >
        <Link to="/" className="mb-6 flex justify-center">
          <Logo className="h-12 w-auto" />
        </Link>
        <h3 className="text-3xl text-center text-[#0A0A0A] mb-1 [font-family:'Baloo_2',sans-serif] font-extrabold">{t("auth.signIn")}</h3>
        <p className="text-center text-[#0A0A0A]/60 font-body mb-1">{t("auth.signInDesc")}</p>
        <p className="text-center text-2xl text-[#EA4918] mb-7 -rotate-2 [font-family:'Grand_Hotel',cursive]">bom te ver de novo!</p>

        <form onSubmit={handleSubmit(onSubmitLogin)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("auth.email")}</Label>
            <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-2xl h-12 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
            {errors.email && <p className="text-xs text-[#EA4918] mt-1">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("auth.password")}</Label>
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotSent(false); }}
                className="text-xs text-[#0061EE] font-body underline underline-offset-2 hover:opacity-80"
              >
                {t("auth.forgot")}
              </button>
            </div>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" {...register("password")} className="rounded-2xl h-12 pr-10 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-colors"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-[#EA4918] mt-1">{errors.password.message}</p>}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full h-[52px] rounded-full bg-[#EA4918] hover:bg-[#FF5A24] text-white text-base [font-family:'Baloo_2',sans-serif] font-bold shadow-[0_6px_0_rgba(21,20,18,0.9)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(21,20,18,0.9)] active:translate-y-0.5 active:shadow-[0_3px_0_rgba(21,20,18,0.9)] transition-all"
          >
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
        <p className="text-sm text-[#0A0A0A]/60 font-body mt-6 text-center">
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className="text-[#0061EE] font-medium underline underline-offset-2 hover:opacity-80">{t("auth.createAccount")}</Link>
        </p>
        <p className="text-xs text-[#0A0A0A]/40 font-body mt-4 text-center">
          <a href="https://criasocialclub.com.br" className="hover:underline">← voltar pro site</a>
        </p>
      </motion.div>

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
