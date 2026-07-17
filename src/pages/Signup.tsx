import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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

  const { register, handleSubmit, setError, setValue, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Veio do checkout da LP (Payment Link)? Guarda o session_id, pré-preenche
  //    o e-mail do pagador e avisa que o plano está esperando a conta. ──
  const [searchParams] = useSearchParams();
  const [compraPaga, setCompraPaga] = useState<{ email: string; plan: string } | null>(null);
  useEffect(() => {
    const sid = searchParams.get("session_id");
    if (searchParams.get("checkout") !== "success" || !sid) return;
    try { localStorage.setItem("cria_plink_session", sid); } catch { /* modo privado */ }
    void supabase.functions.invoke("claim-purchase", { body: { action: "peek", session_id: sid } })
      .then(({ data }) => {
        const d = data as { found?: boolean; email?: string; plan?: string } | null;
        if (d?.found && d.email) {
          setCompraPaga({ email: d.email, plan: d.plan ?? "" });
          setValue("email", d.email);
          setAccountType("creator");
        }
      })
      .catch(() => { /* o resgate no primeiro login cobre */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nomePlano = compraPaga?.plan === "studio" ? "Studio" : compraPaga?.plan === "pro" ? "Pro" : "Essencial";

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
    <div className="min-h-screen bg-[#F5F3E7] flex">
      {/* ===== Painel esquerdo: energia de "tô mudando de vida" ===== */}
      <div className="hidden lg:flex lg:w-[44%] bg-[#EA4918] items-center justify-center p-12 relative overflow-hidden">
        <div aria-hidden className="cria-blob pointer-events-none absolute -top-32 -right-24 w-96 h-96 bg-[#FFCF03] opacity-90 rounded-[38%_62%_55%_45%/48%_42%_58%_52%]" />
        <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-28 -left-20 w-72 h-72 bg-[#FF77B9] opacity-85 rounded-[55%_45%_40%_60%/50%_60%_40%_50%]" />
        <div aria-hidden className="cria-blob cria-blob-fast pointer-events-none absolute top-[30%] right-[14%] w-16 h-16 bg-[#FDFBF5] opacity-90 rounded-full" />
        <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute bottom-[24%] right-[38%] w-24 h-24 bg-[#0061EE] opacity-60 rounded-[45%_55%_60%_40%/55%_45%_55%_45%]" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-md relative z-10">
          {/* A logo de verdade (versão clara), em vez de "CRIA." digitado. */}
          <Logo variant="dark" className="h-9 w-auto" />
          <h2 className="[font-family:'Baloo_2',sans-serif] font-extrabold text-white text-[2.6rem] leading-[1.08] tracking-tight mt-6 mb-2">
            Hoje é o dia em que o caos acaba.
          </h2>
          <p className="[font-family:'Grand_Hotel',cursive] text-[#FFCF03] text-3xl -rotate-2 inline-block mb-6">bem-vindo(a) ao clube ✦</p>
          <ul className="space-y-3 text-white/95 font-body text-[15px]">
            <li className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFCF03] text-[#0A0A0A] text-[10px] font-black shrink-0">✓</span>Sua semana inteira planejada num lugar só</li>
            <li className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFCF03] text-[#0A0A0A] text-[10px] font-black shrink-0">✓</span>IA que escreve no SEU tom de voz</li>
            <li className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFCF03] text-[#0A0A0A] text-[10px] font-black shrink-0">✓</span>Insights reais do Instagram, sem achismo</li>
          </ul>
          <p className="mt-8 text-white/60 text-xs font-body">7 dias grátis · Cancela quando quiser</p>
        </motion.div>
      </div>

      {/* ===== Lado do formulário ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative overflow-hidden">
        <div aria-hidden className="cria-blob pointer-events-none absolute -top-24 -right-20 w-64 h-64 bg-[#FF77B9] opacity-70 rounded-[38%_62%_55%_45%/48%_42%_58%_52%] lg:opacity-40" />
        <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-20 -left-16 w-52 h-52 bg-[#FFCF03] opacity-70 rounded-[55%_45%_40%_60%/50%_60%_40%_50%] lg:opacity-40" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md bg-[#FDFBF5] border-2 border-[#0A0A0A] rounded-[28px] shadow-[0_10px_0_rgba(21,20,18,0.9)] p-7 sm:p-9"
        >
          <Link to="/" className="mb-5 flex justify-center">
            <Logo className="h-12 w-auto" />
          </Link>

          {emailSent ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-[#E5F2E9] border-2 border-[#01A652] flex items-center justify-center mb-1">
                <Mail className="h-7 w-7 text-[#01A652]" />
              </div>
              <h2 className="text-2xl [font-family:'Baloo_2',sans-serif] font-extrabold text-[#0A0A0A]">
                {t("signup.confirmTitle")}
              </h2>
              <p className="[font-family:'Grand_Hotel',cursive] text-2xl text-[#EA4918] -rotate-2 -mt-2">falta só um clique!</p>
              <p className="text-[#0A0A0A]/60 font-body text-sm leading-relaxed">
                {t("signup.confirmLead")}{" "}
                <strong className="text-[#0A0A0A]">{emailValue}</strong>{t("signup.confirmTail")}
              </p>
              <p className="text-xs text-[#0A0A0A]/50 font-body">
                {t("signup.notReceived")}{" "}
                <button
                  className="text-[#0061EE] underline underline-offset-2"
                  onClick={() => setEmailSent(false)}
                >
                  {t("signup.tryAgain")}
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-3xl text-center [font-family:'Baloo_2',sans-serif] font-extrabold text-[#0A0A0A] mb-1">{t("signup.title")}</h3>
              <p className="text-center [font-family:'Grand_Hotel',cursive] text-2xl text-[#EA4918] -rotate-2 mb-5">sua nova fase começa agora!</p>

              {compraPaga && (
                <div className="mb-5 rounded-2xl border-2 border-[#01A652] bg-[#E5F2E9] px-4 py-3">
                  <p className="text-sm [font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">Pagamento confirmado! 🎉</p>
                  <p className="text-[13px] font-body text-[#0A0A0A]/75 leading-snug mt-0.5">
                    Seu plano <strong>CRIA {nomePlano}</strong> está reservado pra <strong>{compraPaga.email}</strong>. Crie a conta com esse e-mail e o acesso é liberado na hora.
                  </p>
                </div>
              )}

              {/* Tipo de conta */}
              <div className="mb-6">
                <p className="text-xs [font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]/60 uppercase tracking-wider mb-2">Você é</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAccountType("creator")}
                    className={`rounded-2xl border-2 p-3 text-left transition-all duration-200 ${accountType === "creator" ? "border-[#EA4918] bg-[#FBE9E1] -translate-y-0.5 shadow-[0_4px_0_rgba(21,20,18,0.85)]" : "border-[#0A0A0A]/20 hover:border-[#0A0A0A]/50"}`}>
                    <span className="block text-sm [font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">Criador de conteúdo</span>
                    <span className="block text-[11px] font-body text-[#0A0A0A]/60 leading-snug mt-0.5">Crio pro meu próprio perfil</span>
                  </button>
                  <button type="button" onClick={() => setAccountType("manager")}
                    className={`rounded-2xl border-2 p-3 text-left transition-all duration-200 ${accountType === "manager" ? "border-[#EA4918] bg-[#FBE9E1] -translate-y-0.5 shadow-[0_4px_0_rgba(21,20,18,0.85)]" : "border-[#0A0A0A]/20 hover:border-[#0A0A0A]/50"}`}>
                    <span className="block text-sm [font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">Social mídia / agência</span>
                    <span className="block text-[11px] font-body text-[#0A0A0A]/60 leading-snug mt-0.5">Gerencio clientes e equipe</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("signup.name")}</Label>
                  <Input id="name" type="text" placeholder={t("signup.namePlaceholder")} {...register("name")} className="rounded-2xl h-12 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
                  {errors.name && <p className="text-xs text-[#EA4918] mt-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("auth.email")}</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-2xl h-12 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
                  {errors.email && <p className="text-xs text-[#EA4918] mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder={t("signup.passwordPlaceholder")} {...register("password")} className="rounded-2xl h-12 pr-10 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
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
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="[font-family:'Baloo_2',sans-serif] font-bold text-[#0A0A0A]">{t("signup.confirmPassword")}</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder={t("signup.confirmPlaceholder")} {...register("confirmPassword")} className="rounded-2xl h-12 pr-10 bg-[#FDFBF5] border-2 border-[#0A0A0A]/25 focus-visible:border-[#0061EE] focus-visible:ring-0 text-[#0A0A0A]" />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-colors"
                      aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-[#EA4918] mt-1">{errors.confirmPassword.message}</p>}
                </div>
                {formError && (
                  <div className="rounded-2xl border-2 border-[#EA4918]/40 bg-[#FBE9E1] px-3 py-2.5 text-sm text-[#EA4918] font-body font-semibold">
                    {formError}
                  </div>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full h-[52px] rounded-full bg-[#EA4918] hover:bg-[#FF5A24] text-white text-base [font-family:'Baloo_2',sans-serif] font-bold shadow-[0_6px_0_rgba(21,20,18,0.9)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(21,20,18,0.9)] active:translate-y-0.5 active:shadow-[0_3px_0_rgba(21,20,18,0.9)] transition-all"
                >
                  {loading ? t("signup.creating") : t("signup.createMyAccount")}
                </Button>
                <p className="text-center text-[11px] text-[#0A0A0A]/50 font-body -mt-1">7 dias grátis · Sem compromisso · Cancela em 2 cliques</p>
              </form>
              <p className="text-sm text-[#0A0A0A]/60 font-body mt-5 text-center">
                {t("signup.haveAccount")}{" "}
                <Link to="/login" className="text-[#0061EE] font-medium underline underline-offset-2 hover:opacity-80">{t("auth.signIn")}</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
