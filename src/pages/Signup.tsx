import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Check, Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { track } from "@/lib/metaPixel";
import { Logo } from "@/components/shared/Logo";
import { useT } from "@/lib/i18n";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CADASTRO NA LINGUAGEM DO LOGIN NOVO (Walter, 12/10/2026: "essa página de
   cadastro também tá extensa no PC, com scroll")

   O cartão era estreito e empilhava tudo numa coluna (logo, título, os 3
   tipos de conta, 4 campos, termos, botão): passava da altura de um notebook.
   Agora, no computador, o cartão é mais largo e em duas colunas (nome ao lado
   do e-mail, senha ao lado da confirmação), a logo e a frase saem do cartão
   pra cena, e tudo cabe numa tela. No celular segue uma coluna, numa folha
   que sobe de baixo, igual ao login.
   A lógica (compra paga na LP, aceite dos termos, parceiro com papel, destino
   depois do cadastro) é a mesma de antes.
   ═══════════════════════════════════════════════════════════════════════════ */

type SignupFormData = { name: string; email: string; password: string; confirmPassword: string };
type Tipo = "creator" | "manager" | "parceiro";

const BLOB_A = "rounded-[38%_62%_55%_45%/48%_42%_58%_52%]";
const BLOB_B = "rounded-[55%_45%_40%_60%/50%_60%_40%_50%]";
const DISPLAY = "[font-family:'Baloo_2',sans-serif]";
const SCRIPT = "[font-family:'Grand_Hotel',cursive]";
const campo = "w-full h-[50px] rounded-2xl border-2 border-[#CFC8B6] bg-white px-4 text-[16px] text-[#0A0A0A] placeholder:text-[#8A8478] outline-none transition-[border-color,box-shadow] focus:border-[#0061EE] focus:shadow-[0_0_0_4px_rgba(0,97,238,.15)] aria-[invalid=true]:border-[#D9480F]";
const rotulo = cn(DISPLAY, "text-[15px] font-bold text-[#0A0A0A]");
const erroTxt = "text-[13px] text-[#B3330C]";

const TIPOS: { k: Tipo; titulo: string; desc: string; cor: string }[] = [
  { k: "creator", titulo: "Criador de conteúdo", desc: "Crio pro meu perfil", cor: "#FFCF03" },
  { k: "manager", titulo: "Social mídia / agência", desc: "Cuido de clientes e equipe", cor: "#FF77B9" },
  { k: "parceiro", titulo: "Designer / editor", desc: "Produzo pras agências", cor: "#9FB7FF" },
];

const Signup = ({ defaultManager = false }: { defaultManager?: boolean }) => {
  useForceLightTheme();
  const navigate = useNavigate();
  const t = useT();
  const { signUp } = useAuth();
  /* ?tipo=parceiro ou ?tipo=manager já abre no tipo certo (LP, seção "Produz pra
     social mídia? sua conta é de graça", 15/10/2026). */
  const [accountType, setAccountType] = useState<Tipo>(() => {
    const t = new URLSearchParams(window.location.search).get("tipo");
    return t === "parceiro" || t === "manager" ? t : defaultManager ? "manager" : "creator";
  });
  /* Papel do parceiro. Define o vocabulário do quadro dele já no primeiro
     acesso (Referências/Rascunho/Arte final pro designer, Decupagem/Corte/
     Finalização pro editor) sem depender de agência nenhuma. */
  const [parceiroRole, setParceiroRole] = useState<"designer" | "editor_video" | "copy" | "trafego" | "filmmaker">("designer");
  const [loading, setLoading] = useState(false);
  /* ACEITE DOS TERMOS (pente fino 23/09/2026, LGPD). */
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [erroTermos, setErroTermos] = useState(false);
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

  // ── Veio do checkout da LP (Payment Link)? Guarda o session_id e avisa que
  //    o plano está esperando a conta. ──
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
          /* O peek devolve o e-mail MASCARADO: serve pra pessoa reconhecer a
             compra. Ela digita o e-mail completo, e o resgate só acontece se
             bater com o do pagamento. */
          setCompraPaga({ email: d.email, plan: d.plan ?? "" });
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
    if (!aceitouTermos) { setErroTermos(true); return; }
    setEmailValue(data.email);
    setFormError(null);
    setLoading(true);
    const meta = accountType === "manager" ? { account_intent: "manager" }
      : accountType === "parceiro" ? { account_intent: "parceiro", parceiro_role: parceiroRole }
      : undefined;
    const { error, needsConfirmation } = await signUp(data.email, data.password, data.name, meta);
    setLoading(false);
    if (error) {
      console.warn("[signup] error:", error.message);
      const mapped = mapSignupError(error.message);
      if (mapped.field) setError(mapped.field, { message: mapped.text });
      else setFormError(mapped.text);
    } else {
      track("CompleteRegistration", { content_name: accountType === "manager" ? "signup_agency" : accountType === "parceiro" ? "signup_parceiro" : "signup_email" });
      /* Registra o aceite com IP e user-agent do lado do servidor. Sem sessão
         ainda (falta confirmar o e-mail), a marca fica no localStorage e o
         ProtectedRoute registra no primeiro acesso logado. */
      try { localStorage.setItem("cria.termos_pendentes", "1"); } catch { /* modo privado */ }
      if (!needsConfirmation) {
        void supabase.functions.invoke("accept-terms", { body: {} })
          .then(() => { try { localStorage.removeItem("cria.termos_pendentes"); } catch { /* ok */ } })
          .catch(() => { /* fica pendente, o ProtectedRoute tenta de novo */ });
      }
      if (needsConfirmation) {
        setEmailSent(true);
      } else {
        toast.success("Conta criada! Bem-vinda ao CRIA.");
        navigate(accountType === "manager" ? "/comecar-agencia"
          : accountType === "parceiro" ? "/socialmidia/demandas"
          : "/onboarding", { replace: true });
      }
    }
  };

  const olho = (visivel: boolean, alternar: () => void) => (
    <button type="button" onClick={alternar}
      aria-label={visivel ? t("auth.hidePassword") : t("auth.showPassword")}
      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[#3D3A33] hover:text-[#0A0A0A]">
      {visivel ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[#FFCF03] lg:bg-[#F5F3E7] font-body text-[#0A0A0A] flex flex-col lg:block">

      {/* ── Cena do computador ── */}
      {/* As manchas grandes passam da borda da tela de propósito. Ficam numa
          camada própria, do tamanho da tela e com corte: com overflow-x-hidden
          no contêiner, o navegador ligava a rolagem vertical nele e aparecia
          uma barra lateral (Walter, 12/10/2026, no PWA). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
        <div className={cn("absolute -left-[160px] -bottom-[300px] h-[560px] w-[1000px] bg-[#EA4918]", BLOB_A)} />
        <div className={cn("absolute -right-[120px] -top-[140px] h-[420px] w-[470px] bg-[#FF77B9]", BLOB_B)} />
      </div>
      <div className="relative mx-auto hidden lg:block h-[100dvh] min-h-[700px] max-w-[1440px]">
        <div aria-hidden className={cn("absolute left-[560px] top-[110px] h-[78px] w-[84px] bg-[#0061EE]", BLOB_B)} />
        <a href="https://criasocialclub.com.br" aria-label="Cria, voltar pro site" className="absolute left-14 top-11">
          <Logo variant="light" className="h-[50px] w-auto" />
        </a>
        <div className="absolute left-14 top-[150px] w-[560px] [@media(max-height:780px)]:top-[120px]">
          <p className={cn(SCRIPT, "mb-1 origin-left -rotate-3 text-[40px] text-[#D9480F]")}>bem-vindo(a) ao clube</p>
          <h1 className={cn(DISPLAY, "text-[58px] font-extrabold leading-[0.98] tracking-[-1px] [@media(max-height:780px)]:text-[48px]")}>
            Hoje é o dia em que<br />
            <span className="inline-block -rotate-2 rounded-[14px] bg-[#FFCF03] px-3">o caos acaba.</span>
          </h1>
          <ul className="mt-7 flex flex-col gap-3 text-[17px] text-[#3D3A33]">
            {["Suas ideias, roteiros e calendário num lugar só", "IA que escreve no SEU tom de voz", "Insights reais do Instagram, sem achismo"].map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center bg-[#01A652]", BLOB_A)}><Check className="h-4 w-4 text-white" strokeWidth={3} /></span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        {/* Post-it e selo: a mesma mesa de criação do login, em versão curta. */}
        <div aria-hidden className="pointer-events-none absolute bottom-16 left-16 [@media(max-height:820px)]:hidden">
          <div className="h-[140px] w-[160px] -rotate-6 rounded-[4px_4px_22px_4px] bg-[#FFCF03] p-[13px_15px] shadow-[0_8px_18px_rgba(10,10,10,.22)]">
            <p className="text-[11px] font-bold uppercase tracking-[.8px] text-[#6B4E00]">Ideia</p>
            <p className={cn(SCRIPT, "mt-1 text-[24px] leading-[1.05]")}>primeiro post do meu novo ritmo</p>
          </div>
          <div className="absolute left-[190px] top-[40px] w-[170px] rotate-[5deg] rounded-[18px] bg-[#0A0A0A] p-[12px_14px] text-[#F5F3E7]">
            <p className="text-[11px] font-bold tracking-[.6px] text-[#FFCF03]">7 DIAS GRÁTIS</p>
            <p className={cn(DISPLAY, "mt-0.5 text-[15px] font-semibold leading-tight text-white")}>Cancela quando quiser, em 2 cliques.</p>
          </div>
        </div>
        <img src="/stickers/selo-sem-formula.png" alt="" aria-hidden className="pointer-events-none absolute left-[440px] bottom-10 w-[120px] rotate-[10deg] [@media(max-height:820px)]:hidden" />
      </div>

      {/* ── Topo do celular ── */}
      <div className="relative lg:hidden shrink-0 overflow-hidden px-[22px] pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
        <div aria-hidden className={cn("pointer-events-none absolute -right-[90px] -top-[70px] h-[200px] w-[230px] bg-[#FF77B9]", BLOB_B)} />
        <a href="https://criasocialclub.com.br" aria-label="Cria, voltar pro site" className="relative inline-block">
          <Logo variant="light" className="h-9 w-auto" />
        </a>
        <p className={cn(DISPLAY, "relative mt-3 text-[26px] font-extrabold leading-[1.05]")}>Hoje é o dia em que o caos acaba.</p>
      </div>

      {/* ── O cartão: folha no celular, cartão largo em duas colunas no computador ── */}
      <motion.main
        /* Só opacidade: um `y` sobrescreveria o -translate-y-1/2 que centraliza o cartão. */
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className={cn(
          "relative flex-1 bg-[#FDFBF5] border-t-2 border-[#0A0A0A] rounded-t-[32px] px-[22px] pt-6",
          "lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-[max(40px,calc(50%-640px))] lg:w-[580px] lg:flex-none",
          "lg:max-h-[calc(100dvh-32px)] lg:overflow-y-auto lg:rounded-[32px] lg:border-2 lg:shadow-[0_10px_0_#0A0A0A] lg:px-9 lg:pt-7 lg:pb-6",
        )}
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))" }}
      >
        {emailSent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className={cn("grid h-[76px] w-[76px] place-items-center bg-[#01A652] text-white", BLOB_A)}>
              <Mail className="h-8 w-8" strokeWidth={2.4} />
            </span>
            <h2 className={cn(DISPLAY, "text-[28px] font-extrabold leading-[1.05]")}>{t("signup.confirmTitle")}</h2>
            <p className={cn(SCRIPT, "-mt-2 -rotate-2 text-[26px] text-[#D9480F]")}>falta só um clique!</p>
            <p className="text-[15px] leading-[1.5] text-[#5B574E]">
              {t("signup.confirmLead")} <strong className="text-[#0A0A0A]">{emailValue}</strong>{t("signup.confirmTail")}
            </p>
            <p className="text-[13px] text-[#5B574E]">
              {t("signup.notReceived")}{" "}
              <button type="button" className="font-semibold text-[#0050C8] underline underline-offset-2" onClick={() => setEmailSent(false)}>
                {t("signup.tryAgain")}
              </button>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* Entrar / Criar conta: o mesmo seletor do login. */}
            <div className="hidden lg:grid grid-cols-2 gap-1 rounded-full bg-[#EFEBDD] p-1">
              <Link to="/login" className={cn(DISPLAY, "grid h-11 place-items-center rounded-full text-[16px] font-bold text-[#3D3A33] hover:text-[#0A0A0A]")}>{t("auth.signIn")}</Link>
              <span className={cn(DISPLAY, "grid h-11 place-items-center rounded-full bg-[#0A0A0A] text-[16px] font-bold text-[#F5F3E7]")}>{t("signup.title")}</span>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <h2 className={cn(DISPLAY, "text-[28px] font-extrabold leading-[1.05] lg:text-[30px]")}>{t("signup.title")}</h2>
              <p className={cn(SCRIPT, "shrink-0 -rotate-2 text-[22px] text-[#D9480F]")}>7 dias grátis</p>
            </div>

            {compraPaga && (
              <div className="rounded-2xl border-2 border-[#01A652] bg-[#E5F2E9] px-4 py-3">
                <p className={cn(DISPLAY, "text-[15px] font-bold")}>Pagamento confirmado!</p>
                <p className="mt-0.5 text-[13px] leading-snug text-[#3D3A33]">
                  Seu plano <strong>CRIA {nomePlano}</strong> está reservado pra <strong>{compraPaga.email}</strong>. Crie a conta com esse e-mail e o acesso é liberado na hora.
                </p>
              </div>
            )}

            {/* Tipo de conta: três opções lado a lado, baixinhas. */}
            <fieldset>
              <legend className={cn(rotulo, "mb-2")}>Você é</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {TIPOS.map((tp) => {
                  const ativo = accountType === tp.k;
                  return (
                    <button key={tp.k} type="button" onClick={() => setAccountType(tp.k)} aria-pressed={ativo}
                      className={cn("flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-left transition-all sm:flex-col sm:items-start sm:gap-1.5",
                        ativo ? "border-[#0A0A0A] bg-white shadow-[0_4px_0_#0A0A0A] -translate-y-0.5" : "border-[#CFC8B6] hover:border-[#0A0A0A]")}>
                      <span className={cn("grid h-6 w-6 shrink-0 place-items-center", BLOB_A)} style={{ background: tp.cor }}>
                        {ativo && <Check className="h-3.5 w-3.5 text-[#0A0A0A]" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className={cn(DISPLAY, "block text-[14px] font-bold leading-tight")}>{tp.titulo}</span>
                        <span className="block text-[12px] leading-snug text-[#5B574E]">{tp.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {accountType === "parceiro" && (
                <div className="mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {([["designer", "Design"], ["editor_video", "Edição de vídeo"], ["filmmaker", "Captação"], ["copy", "Copy"], ["trafego", "Tráfego"]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setParceiroRole(k)} aria-pressed={parceiroRole === k}
                        className={cn(DISPLAY, "h-9 rounded-full border-2 px-3.5 text-[13px] font-bold transition-colors",
                          parceiroRole === k ? "border-[#0A0A0A] bg-[#0A0A0A] text-[#F5F3E7]" : "border-[#CFC8B6] text-[#3D3A33] hover:border-[#0A0A0A]")}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-[#5B574E]">O trabalho que vem das agências é sempre grátis pra você.</p>
                </div>
              )}
            </fieldset>

            {/* Duas colunas no computador, uma no celular. */}
            <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 lg:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className={rotulo}>{t("signup.name")}</label>
                <input id="name" type="text" autoComplete="name" placeholder="Nome ou apelido"
                  {...register("name")} aria-invalid={!!errors.name} className={campo} />
                {errors.name && <p className={erroTxt}>{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className={rotulo}>{t("auth.email")}</label>
                <input id="email" type="email" autoComplete="email" inputMode="email" placeholder="seu@email.com"
                  {...register("email")} aria-invalid={!!errors.email} className={campo} />
                {errors.email && <p className={erroTxt}>{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className={rotulo}>{t("auth.password")}</label>
                <div className="relative">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("signup.passwordPlaceholder")}
                    {...register("password")} aria-invalid={!!errors.password} className={cn(campo, "pr-12")} />
                  {olho(showPassword, () => setShowPassword((v) => !v))}
                </div>
                {errors.password && <p className={erroTxt}>{errors.password.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className={rotulo}>{t("signup.confirmPassword")}</label>
                <div className="relative">
                  <input id="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder={t("signup.confirmPlaceholder")}
                    {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} className={cn(campo, "pr-12")} />
                  {olho(showConfirm, () => setShowConfirm((v) => !v))}
                </div>
                {errors.confirmPassword && <p className={erroTxt}>{errors.confirmPassword.message}</p>}
              </div>
            </div>

            {formError && (
              <p role="alert" className="flex items-center gap-1.5 rounded-2xl border-2 border-[#F4B79C] bg-[#FFE3D6] px-3 py-2.5 text-[14px] font-semibold text-[#B3330C]">
                <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
              </p>
            )}

            <div>
              <label className="flex cursor-pointer select-none items-start gap-3">
                <input type="checkbox" checked={aceitouTermos}
                  onChange={(e) => { setAceitouTermos(e.target.checked); if (e.target.checked) setErroTermos(false); }}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-[#0A0A0A]/30 accent-[#EA4918]" />
                <span className="text-[13.5px] leading-snug text-[#3D3A33]">
                  Li e aceito os{" "}
                  <Link to="/termos" target="_blank" className="font-semibold text-[#0050C8] underline underline-offset-2">Termos de Uso</Link>
                  {" "}e a{" "}
                  <Link to="/privacidade" target="_blank" className="font-semibold text-[#0050C8] underline underline-offset-2">Política de Privacidade</Link>.
                </span>
              </label>
              {erroTermos && <p className={cn(erroTxt, "mt-1.5")}>Pra criar a conta, precisa aceitar os termos.</p>}
            </div>

            <button type="submit" disabled={loading}
              className={cn(DISPLAY, "h-14 w-full rounded-full border-2 border-[#0A0A0A] bg-[#EA4918] text-[18px] font-extrabold text-white shadow-[0_5px_0_#0A0A0A] transition-all hover:-translate-y-0.5 hover:bg-[#FF5A24] active:translate-y-0.5 active:shadow-[0_2px_0_#0A0A0A] disabled:opacity-70 disabled:hover:translate-y-0")}>
              {loading ? t("signup.creating") : t("signup.createMyAccount")}
            </button>

            <p className="text-center text-[14px] text-[#3D3A33] lg:hidden">
              {t("signup.haveAccount")}{" "}
              <Link to="/login" className="font-bold text-[#0050C8] underline underline-offset-[3px]">{t("auth.signIn")}</Link>
            </p>
            <p className="-mt-1 hidden text-center text-[12.5px] text-[#5B574E] lg:block">Sem compromisso. Cancela em 2 cliques.</p>
          </form>
        )}
      </motion.main>
    </div>
  );
};

export default Signup;
