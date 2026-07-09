import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { track } from "@/lib/metaPixel";
import { Logo } from "@/components/shared/Logo";
import { useT } from "@/lib/i18n";

type SignupFormData = { name: string; email: string; password: string; confirmPassword: string };

const Signup = ({ defaultManager = false }: { defaultManager?: boolean }) => {
  const navigate = useNavigate();
  const t = useT();
  const { signUp } = useAuth();
  const [accountType, setAccountType] = useState<"creator" | "manager">(defaultManager ? "manager" : "creator");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const signupSchema = z.object({
    name: z.string().min(1, t("signup.nameRequired")).max(100, t("signup.maxName")),
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.minPassword")).max(128, t("auth.maxPassword")),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("signup.passwordsNoMatch"),
    path: ["confirmPassword"],
  });

  const { register, handleSubmit, setError, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mapSignupError = (msg: string): { field?: "email" | "password"; text: string } => {
    const m = (msg || "").toLowerCase();
    if (m.includes("already") || m.includes("registered") || m.includes("exists")) return { field: "email", text: t("signup.errEmailInUse") };
    if (m.includes("email") && (m.includes("invalid") || m.includes("validate"))) return { field: "email", text: t("signup.errInvalidEmail") };
    if (m.includes("password")) return { field: "password", text: t("signup.errWeakPassword") };
    if (m.includes("rate") || m.includes("limit") || m.includes("too many")) return { text: t("signup.errRateLimit") };
    if (m.includes("signups") || m.includes("not allowed") || m.includes("disabled")) return { text: t("signup.errSignupsOff") };
    if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) return { text: t("signup.errNetwork") };
    return { text: t("signup.createError") };
  };

  const onSubmit = async (data: SignupFormData) => {
    setEmailValue(data.email);
    setFormError(null);
    setLoading(true);
    const meta = accountType === "manager" ? { account_intent: "manager" } : undefined;
    const { error } = await signUp(data.email, data.password, data.name, meta);
    setLoading(false);
    if (error) {
      console.warn("[signup] error:", error.message);
      const mapped = mapSignupError(error.message);
      if (mapped.field) setError(mapped.field, { message: mapped.text });
      setFormError(mapped.text);
      toast.error(mapped.text);
    } else {
      track("CompleteRegistration", { content_name: accountType === "manager" ? "signup_agency" : "signup_email" });
      setEmailSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-card items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="max-w-md">
          <Logo className="h-14 w-auto mb-8" />
          <h2 className="text-4xl font-display font-extrabold text-foreground tracking-tight mb-4">{t("signup.heroTitle")}</h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">{t("signup.heroDesc")}</p>
        </motion.div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex justify-center lg:justify-start">
            <Logo className="h-16 lg:h-10 w-auto" />
          </Link>

          {emailSent ? (
            <div className="flex flex-col items-center text-center max-w-sm mx-auto mt-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">
                {t("signup.confirmTitle")}
              </h2>
              <p className="text-muted-foreground font-body text-sm leading-relaxed">
                {t("signup.confirmLead")}{" "}
                <strong className="text-foreground">{emailValue}</strong>{t("signup.confirmTail")}
              </p>
              <p className="text-xs text-muted-foreground font-body">
                {t("signup.notReceived")}{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setEmailSent(false)}
                >
                  {t("signup.tryAgain")}
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-2xl font-display font-extrabold text-foreground mb-2">{t("signup.title")}</h3>
              <p className="text-muted-foreground font-body mb-5">{t("signup.subtitle")}</p>

              {/* Tipo de conta */}
              <div className="mb-6">
                <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Você é</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAccountType("creator")}
                    className={`rounded-xl border p-3 text-left transition-colors ${accountType === "creator" ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/40"}`}>
                    <span className="block text-sm font-body font-bold text-foreground">Criador de conteúdo</span>
                    <span className="block text-[11px] font-body text-muted-foreground leading-snug mt-0.5">Crio pro meu próprio perfil</span>
                  </button>
                  <button type="button" onClick={() => setAccountType("manager")}
                    className={`rounded-xl border p-3 text-left transition-colors ${accountType === "manager" ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/40"}`}>
                    <span className="block text-sm font-body font-bold text-foreground">Social mídia / agência</span>
                    <span className="block text-[11px] font-body text-muted-foreground leading-snug mt-0.5">Gerencio clientes e equipe</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-body">{t("signup.name")}</Label>
                  <Input id="name" type="text" placeholder={t("signup.namePlaceholder")} {...register("name")} className="rounded-xl h-12" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body">{t("auth.email")}</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-xl h-12" />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-body">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder={t("signup.passwordPlaceholder")} {...register("password")} className="rounded-xl h-12 pr-10" />
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
                  <Label htmlFor="confirmPassword" className="font-body">{t("signup.confirmPassword")}</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder={t("signup.confirmPlaceholder")} {...register("confirmPassword")} className="rounded-xl h-12 pr-10" />
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
                {formError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive font-body">
                    {formError}
                  </div>
                )}
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? t("signup.creating") : t("signup.createMyAccount")}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground font-body mt-6 text-center">
                {t("signup.haveAccount")}{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">{t("auth.signIn")}</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
