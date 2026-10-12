import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useT } from "@/lib/i18n";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN NOVO (Walter, 12/10/2026: "mais criativa, bonita, de fácil acesso",
   "puxar pra criador de conteúdo, criatividade e organização", "fazer toda a
   tela integrada, não 2 imagens coladas", "no mobile tudo na mesma página")

   Computador: uma cena só. A mesa de criação (ideia, roteiro, gravação,
   calendário) fica embaixo à esquerda, ligada por uma linha tracejada que
   termina no cartão de login. As manchas passam por baixo do cartão.
   Celular: topo amarelo com a mesa em miniatura e o login numa folha que sobe
   de baixo. Cabe numa tela, sem rolar de lado.

   Usabilidade: campos e botões grandes, erro embaixo do campo (não some
   sozinho), "esqueci a senha" dentro do próprio cartão aproveitando o e-mail
   digitado, e "Criar conta" sempre à vista.
   Página desenhada clara: o tema escuro do aparelho não vale aqui.
   ═══════════════════════════════════════════════════════════════════════════ */

type LoginFormData = { email: string; password: string };
type ForgotFormData = { email: string };
type Tela = "entrar" | "esqueci" | "enviado";

const BLOB_A = "rounded-[38%_62%_55%_45%/48%_42%_58%_52%]";
const BLOB_B = "rounded-[55%_45%_40%_60%/50%_60%_40%_50%]";
const DISPLAY = "[font-family:'Baloo_2',sans-serif]";
const SCRIPT = "[font-family:'Grand_Hotel',cursive]";
const campo = "w-full h-[54px] rounded-2xl border-2 bg-white text-[16px] text-[#0A0A0A] placeholder:text-[#8A8478] outline-none transition-[border-color,box-shadow] focus:border-[#0061EE] focus:shadow-[0_0_0_4px_rgba(0,97,238,.15)]";

/** A mesa de criação. `mini` é a versão do topo do celular. */
function Check2() {
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-md bg-[#01A652]">
      <Check className="h-3 w-3 text-white" strokeWidth={3.4} />
    </span>
  );
}

function MesaDesktop() {
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 bottom-6 h-[430px] w-[860px] origin-bottom-left [@media(max-height:840px)]:scale-[.82] [@media(max-height:740px)]:scale-[.7]">
      <svg width="860" height="430" viewBox="0 0 860 430" fill="none" className="absolute inset-0">
        <path d="M232 170 C 262 130, 270 118, 296 122" stroke="#0A0A0A" strokeWidth="2.4" strokeDasharray="7 8" strokeLinecap="round" />
        <path d="M430 238 C 420 270, 400 282, 372 294" stroke="#0A0A0A" strokeWidth="2.4" strokeDasharray="7 8" strokeLinecap="round" />
        <path d="M452 360 C 490 370, 512 360, 530 342" stroke="#F5F3E7" strokeWidth="2.4" strokeDasharray="7 8" strokeLinecap="round" />
        <path d="M676 298 C 740 270, 760 190, 836 154" stroke="#0A0A0A" strokeWidth="2.6" strokeDasharray="7 8" strokeLinecap="round" />
        <path d="M820 144 l18 9 l-14 14" stroke="#0A0A0A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className={cn(SCRIPT, "absolute left-[676px] top-[180px] text-[30px] text-[#0A0A0A] -rotate-[14deg]")}>e agora é com você</p>
      <img src="/stickers/selo-da-ideia-ao-post-rosa.png" alt="" className="absolute left-[560px] top-[10px] w-[180px] -rotate-12" />

      <div className="absolute left-[60px] top-[130px] h-[152px] w-[172px] -rotate-6 rounded-[4px_4px_22px_4px] bg-[#FFCF03] p-[14px_16px] shadow-[0_8px_18px_rgba(10,10,10,.18)]">
        <p className="text-[11px] font-bold uppercase tracking-[.8px] text-[#6B4E00]">Ideia</p>
        <p className={cn(SCRIPT, "mt-1.5 text-[25px] leading-[1.05] text-[#0A0A0A]")}>bastidores da cozinha às 6h da manhã</p>
      </div>

      <div className="absolute left-[300px] top-[90px] w-[230px] rotate-3 rounded-[20px] border-2 border-[#0A0A0A] bg-[#FDFBF5] p-[14px_16px] shadow-[0_6px_0_#0A0A0A]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className={cn(DISPLAY, "text-[16px] font-extrabold")}>Roteiro</span>
          <span className="rounded-full bg-[#0061EE] px-2.5 py-0.5 text-[10.5px] font-bold text-white">Reels</span>
        </div>
        <div className="flex flex-col gap-[7px] text-[13px] text-[#0A0A0A]">
          <span className="flex items-center gap-2"><Check2 />Gancho</span>
          <span className="flex items-center gap-2"><Check2 />Desenvolvimento</span>
          <span className="flex items-center gap-2 text-[#5B574E]"><span className="h-[18px] w-[18px] rounded-md border-2 border-[#CFC8B6]" />Chamada pra ação</span>
        </div>
      </div>

      <div className="absolute left-[200px] top-[298px] w-[252px] -rotate-3 rounded-[20px] bg-[#0A0A0A] p-[13px_16px] text-[#F5F3E7]">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF4D2E]" />
          <span className="text-[12px] font-bold tracking-[.6px]">REC 00:42</span>
          <span className="ml-auto text-[11px] text-[#BDB6A6]">tomada 2</span>
        </div>
        <p className={cn(DISPLAY, "text-[15px] font-semibold leading-[1.3] text-white")}>Quem acorda primeiro aqui<br /><span className="text-[#8F887A]">não é o chef...</span></p>
      </div>

      <div className="absolute left-[530px] top-[270px] w-[150px] rotate-[5deg] rounded-[18px] border-2 border-[#0A0A0A] bg-[#FDFBF5] p-[10px_12px]">
        <p className="mb-1.5 text-[11px] font-bold text-[#3D3A33]">Postar sexta</p>
        <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-bold">
          {["S", "T", "Q", "Q"].map((d, i) => <span key={i} className="rounded-lg bg-[#EFEBDD] py-[3px]">{d}</span>)}
          <span className="rounded-lg bg-[#EA4918] py-[3px] text-white">S</span>
        </div>
      </div>
    </div>
  );
}

function MesaMini() {
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto mt-1 h-[200px] w-full max-w-[360px] [@media(max-height:700px)]:hidden">
      <div className="absolute left-[6px] top-[18px] h-[118px] w-[130px] -rotate-[7deg] rounded-[4px_4px_18px_4px] bg-[#FF77B9] p-[11px_12px] shadow-[0_6px_14px_rgba(10,10,10,.18)]">
        <p className="text-[10px] font-bold uppercase tracking-[.7px] text-[#5C1236]">Ideia</p>
        <p className={cn(SCRIPT, "mt-1 text-[21px] leading-[1.05] text-[#0A0A0A]")}>bastidores da cozinha às 6h</p>
      </div>
      <div className="absolute left-[150px] top-[6px] w-[172px] rotate-[4deg] rounded-2xl border-2 border-[#0A0A0A] bg-[#FDFBF5] p-[10px_12px] shadow-[0_4px_0_#0A0A0A]">
        <p className={cn(DISPLAY, "mb-1.5 text-[14px] font-extrabold")}>Roteiro</p>
        <div className="flex flex-col gap-[5px] text-[12px] text-[#0A0A0A]">
          <span className="flex items-center gap-1.5"><Check2 />Gancho</span>
          <span className="flex items-center gap-1.5 text-[#5B574E]"><span className="h-[14px] w-[14px] rounded-[5px] border-2 border-[#CFC8B6]" />Chamada pra ação</span>
        </div>
      </div>
      <div className="absolute left-[120px] top-[124px] w-[196px] -rotate-3 rounded-2xl bg-[#0A0A0A] p-[10px_12px] text-[#F5F3E7]">
        <p className="flex items-center gap-1.5 text-[11px] font-bold"><span className="h-2 w-2 rounded-full bg-[#FF4D2E]" /> REC 00:42</p>
        <p className={cn(DISPLAY, "mt-1 text-[13px] font-semibold leading-tight text-white")}>Quem acorda primeiro aqui...</p>
      </div>
    </div>
  );
}

const Login = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const t = useT();
  const { signIn } = useAuth();
  const [tela, setTela] = useState<Tela>("entrar");
  const [loading, setLoading] = useState(false);
  const [erroLogin, setErroLogin] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.minPassword")).max(128, t("auth.maxPassword")),
  });
  const forgotSchema = z.object({ email: z.string().email(t("auth.invalidEmail")) });

  const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const { register: registerForgot, handleSubmit: handleSubmitForgot, formState: { errors: forgotErrors }, reset: resetForgot } =
    useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  const emailValue = watch("email");

  const onSubmitLogin = async (data: LoginFormData) => {
    setLoading(true);
    setErroLogin(false);
    const { error } = await signIn(data.email, data.password);
    setLoading(false);
    if (error) {
      setErroLogin(true);
    } else {
      // "/" (RootRedirect) decide o destino: parceiro cai em /parceiro, o resto
      // em /app. Ir direto pro /app jogava o designer no app de criador.
      navigate("/");
    }
  };

  const onSubmitForgot = async (data: ForgotFormData) => {
    setForgotLoading(true);
    setErroEnvio(false);
    /* Pela edge, não pelo mailer interno do Supabase Auth: o Cria manda TODO
       e-mail pela fila própria. A edge sempre responde ok (não vaza se o
       e-mail existe), então aqui é só mostrar a confirmação. */
    const { error } = await supabase.functions.invoke("password-reset", { body: { email: data.email } });
    setForgotLoading(false);
    if (error) setErroEnvio(true);
    else setTela("enviado");
  };

  const irEsqueci = () => {
    // Aproveita o e-mail já digitado: ninguém digita duas vezes.
    resetForgot({ email: emailValue ?? "" });
    setErroEnvio(false);
    setTela("esqueci");
  };

  const bordaCampo = erroLogin ? "border-[#D9480F]" : "border-[#CFC8B6]";
  const botaoGrande = cn(DISPLAY, "h-14 w-full rounded-full border-2 border-[#0A0A0A] text-[18px] font-extrabold text-white shadow-[0_5px_0_#0A0A0A] lg:shadow-[0_6px_0_#0A0A0A] transition-all hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_#0A0A0A] disabled:opacity-70 disabled:hover:translate-y-0");
  const rotulo = cn(DISPLAY, "text-[15px] font-bold text-[#0A0A0A]");

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[#FFCF03] lg:bg-[#F5F3E7] font-body text-[#0A0A0A] flex flex-col lg:block">

      {/* ── Cena do computador (só lg+) ── */}
      {/* As manchas grandes passam da borda da tela de propósito. Ficam numa
          camada própria, do tamanho da tela e com corte: com overflow-x-hidden
          no contêiner, o navegador ligava a rolagem vertical nele e aparecia
          uma barra lateral (Walter, 12/10/2026, no PWA). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
        <div className={cn("absolute -left-[140px] -bottom-[260px] h-[520px] w-[1120px] bg-[#0061EE]", BLOB_A)} />
        <div className={cn("absolute -right-[120px] -top-[130px] h-[420px] w-[470px] bg-[#FF77B9]", BLOB_B)} />
      </div>
      <div className="relative mx-auto hidden lg:block h-[100dvh] min-h-[680px] max-w-[1440px]">
        <div aria-hidden className={cn("absolute left-[700px] top-[96px] h-[78px] w-[84px] bg-[#FFCF03]", BLOB_B)} />
        <a href="https://criasocialclub.com.br" aria-label="Cria, voltar pro site" className="absolute left-14 top-11">
          <Logo variant="light" className="h-[50px] w-auto" />
        </a>
        <div className="absolute left-14 top-[132px] w-[640px] [@media(max-height:780px)]:top-[110px]">
          <p className={cn(SCRIPT, "mb-1 origin-left -rotate-3 text-[42px] text-[#D9480F]")}>bora criar?</p>
          <h1 className={cn(DISPLAY, "text-[64px] font-extrabold leading-[0.98] tracking-[-1px] [@media(max-height:780px)]:text-[54px]")}>
            Da ideia ao post,<br />sem perder nada{" "}
            <span className="inline-block -rotate-2 rounded-[14px] bg-[#FFCF03] px-3">no caminho.</span>
          </h1>
          <p className="mt-[18px] max-w-[470px] text-[18px] leading-[1.5] text-[#3D3A33]">
            Suas ideias, roteiros, gravações e calendário num lugar só. Organizado do jeito que a criatividade precisa.
          </p>
        </div>
        <MesaDesktop />
      </div>

      {/* ── Topo do celular (abaixo de lg) ── */}
      <div className="relative lg:hidden shrink-0 overflow-hidden px-[22px]" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 22px)" }}>
        <div aria-hidden className={cn("pointer-events-none absolute -right-[90px] -top-[70px] h-[230px] w-[250px] bg-[#FF77B9]", BLOB_B)} />
        <div aria-hidden className={cn("pointer-events-none absolute -bottom-[60px] -left-[50px] h-[150px] w-[170px] bg-[#0061EE]", BLOB_A)} />
        <a href="https://criasocialclub.com.br" aria-label="Cria, voltar pro site" className="relative inline-block">
          <Logo variant="light" className="h-9 w-auto" />
        </a>
        {tela === "entrar" ? <MesaMini /> : <div className="h-6" />}
      </div>

      {/* ── O cartão de login: folha no celular, cartão na cena do computador ── */}
      <motion.main
        /* Só opacidade: um `y` aqui sobrescreveria o -translate-y-1/2 que
           centraliza o cartão na tela do computador. */
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className={cn(
          "relative flex-1 bg-[#FDFBF5] border-t-2 border-[#0A0A0A] rounded-t-[32px] px-[22px] pt-[22px]",
          "lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-[max(48px,calc(50%-576px))] lg:w-[440px] lg:flex-none",
          "lg:rounded-[32px] lg:border-2 lg:shadow-[0_10px_0_#0A0A0A] lg:px-9 lg:pt-10 lg:pb-[30px]",
        )}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}
      >
        <img src="/stickers/selo-da-ideia-ao-post-rosa.png" alt="" aria-hidden className="pointer-events-none absolute -top-[30px] right-[14px] w-[120px] -rotate-[10deg] lg:hidden" />
        <img src="/stickers/selo-sem-formula.png" alt="" aria-hidden className="pointer-events-none absolute -left-[62px] -top-[54px] hidden w-[120px] -rotate-12 lg:block" />

        <div className="mx-auto w-full max-w-[440px]">
          {tela === "entrar" && (
            <form onSubmit={handleSubmit(onSubmitLogin)} noValidate className="flex flex-col gap-[14px] lg:gap-5">
              {/* Entrar / Criar conta lado a lado: quem não tem conta acha na hora. */}
              <div className="hidden lg:grid grid-cols-2 gap-1 rounded-full bg-[#EFEBDD] p-1">
                <span className={cn(DISPLAY, "grid h-11 place-items-center rounded-full bg-[#0A0A0A] text-[16px] font-bold text-[#F5F3E7]")}>{t("auth.signIn")}</span>
                <Link to="/signup" className={cn(DISPLAY, "grid h-11 place-items-center rounded-full text-[16px] font-bold text-[#3D3A33] hover:text-[#0A0A0A]")}>{t("auth.createAccount")}</Link>
              </div>

              <div>
                <p className={cn(SCRIPT, "origin-left -rotate-2 text-[26px] leading-none text-[#D9480F] lg:hidden")}>bora criar?</p>
                <h2 className={cn(DISPLAY, "mt-0.5 text-[28px] font-extrabold leading-[1.05] lg:mt-0 lg:text-[32px]")}>Bom te ver de novo</h2>
                <p className="mt-1.5 hidden text-[15px] text-[#5B574E] lg:block">Suas ideias estão te esperando.</p>
              </div>

              <div className="flex flex-col gap-1.5 lg:gap-2">
                <label htmlFor="email" className={rotulo}>{t("auth.email")}</label>
                <div className="relative">
                  <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 hidden h-[18px] w-[18px] -translate-y-1/2 text-[#5B574E] lg:block" />
                  <input id="email" type="email" autoComplete="email" inputMode="email" placeholder="seu@email.com"
                    {...register("email", { onChange: () => setErroLogin(false) })}
                    aria-invalid={!!errors.email || erroLogin}
                    className={cn(campo, bordaCampo, "px-4 lg:pl-[46px]")} />
                </div>
                {errors.email && <p className="text-[13.5px] text-[#B3330C]">{errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5 lg:gap-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className={rotulo}>{t("auth.password")}</label>
                  <button type="button" onClick={irEsqueci} className="py-1 text-[14px] font-semibold text-[#0050C8] underline underline-offset-[3px] hover:text-[#003A92]">
                    {t("auth.forgot")}
                  </button>
                </div>
                <div className="relative">
                  <Lock aria-hidden className="pointer-events-none absolute left-4 top-1/2 hidden h-[18px] w-[18px] -translate-y-1/2 text-[#5B574E] lg:block" />
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="sua senha"
                    {...register("password", { onChange: () => setErroLogin(false) })}
                    aria-invalid={!!errors.password || erroLogin}
                    className={cn(campo, bordaCampo, "pl-4 pr-14 lg:pl-[46px]")} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                    className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[#3D3A33] hover:text-[#0A0A0A]">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[13.5px] text-[#B3330C]">{errors.password.message}</p>}
                {erroLogin && (
                  <p role="alert" className="flex items-center gap-1.5 text-[13.5px] text-[#B3330C]">
                    <AlertCircle className="h-4 w-4 shrink-0" /> E-mail ou senha não batem. Confere e tenta de novo.
                  </p>
                )}
              </div>

              <button type="submit" disabled={loading} className={cn(botaoGrande, "mt-1 bg-[#EA4918] hover:bg-[#FF5A24] flex items-center justify-center gap-2.5")}>
                {loading ? t("auth.signingIn") : t("auth.signIn")}
                {!loading && <ArrowRight className="h-5 w-5" strokeWidth={2.4} />}
              </button>

              <p className="text-center text-[15px] text-[#3D3A33] lg:hidden">
                {t("auth.noAccount")}{" "}
                <Link to="/signup" className="font-bold text-[#0050C8] underline underline-offset-[3px]">{t("auth.createAccount")}</Link>
              </p>
              <p className="hidden items-center justify-center gap-1.5 text-[13px] text-[#5B574E] lg:flex">
                <ShieldCheck className="h-3.5 w-3.5" /> Você continua conectado neste aparelho.
              </p>
            </form>
          )}

          {tela === "esqueci" && (
            <form onSubmit={handleSubmitForgot(onSubmitForgot)} noValidate className="flex flex-col gap-4 lg:gap-5">
              <button type="button" onClick={() => setTela("entrar")} className="flex items-center gap-1.5 self-start py-2 text-[14px] font-semibold text-[#3D3A33] hover:text-[#0A0A0A]">
                <ArrowLeft className="h-4 w-4" /> Voltar pro login
              </button>
              <div>
                <h2 className={cn(DISPLAY, "text-[28px] font-extrabold leading-[1.05] lg:text-[32px]")}>Esqueceu a senha?</h2>
                <p className="mt-2 text-[15px] leading-[1.5] text-[#5B574E]">Acontece. Manda o seu e-mail que a gente envia um link pra criar uma senha nova.</p>
              </div>
              <div className="flex flex-col gap-1.5 lg:gap-2">
                <label htmlFor="forgot-email" className={rotulo}>{t("auth.email")}</label>
                <input id="forgot-email" type="email" autoComplete="email" inputMode="email" placeholder="seu@email.com"
                  {...registerForgot("email")} className={cn(campo, "border-[#CFC8B6] px-4")} />
                {forgotErrors.email && <p className="text-[13.5px] text-[#B3330C]">{forgotErrors.email.message}</p>}
                {erroEnvio && <p role="alert" className="text-[13.5px] text-[#B3330C]">{t("auth.sendError")} Tenta de novo daqui a pouco.</p>}
              </div>
              <button type="submit" disabled={forgotLoading} className={cn(botaoGrande, "bg-[#0061EE] hover:bg-[#1A72F5]")}>
                {forgotLoading ? t("auth.sending") : t("auth.sendLink")}
              </button>
            </form>
          )}

          {tela === "enviado" && (
            <div className="flex flex-col items-center gap-4 pt-4 text-center lg:pt-2">
              <span className={cn("grid h-[76px] w-[76px] place-items-center bg-[#01A652] text-white", BLOB_A)}>
                <Mail className="h-8 w-8" strokeWidth={2.4} />
              </span>
              <h2 className={cn(DISPLAY, "text-[28px] font-extrabold leading-[1.05] lg:text-[30px]")}>Confere seu e-mail</h2>
              <p className="text-[15px] leading-[1.5] text-[#5B574E]">Se tiver uma conta com esse e-mail, o link chega em alguns minutos. Olha também o spam.</p>
              <button type="button" onClick={() => setTela("entrar")}
                className={cn(DISPLAY, "h-[52px] w-full rounded-full border-2 border-[#0A0A0A] bg-[#FDFBF5] text-[17px] font-bold text-[#0A0A0A] hover:bg-white")}>
                Voltar pro login
              </button>
            </div>
          )}
        </div>

        <a href="https://criasocialclub.com.br"
          className="absolute -bottom-12 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[14px] font-semibold text-[#3D3A33] underline underline-offset-[3px] hover:text-[#0A0A0A] lg:block">
          Voltar pro site
        </a>
      </motion.main>
    </div>
  );
};

export default Login;
