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
import { Logo } from "@/components/shared/Logo";

const signupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Signup = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setEmailValue(data.email);
    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.name);
    setLoading(false);
    if (error) {
      console.warn("[signup] error:", error.message);
      toast.error("Não foi possível criar a conta. Verifique seus dados e tente novamente.");
    } else {
      setEmailSent(true);
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
    if (error) toast.error("Erro ao conectar com Google.");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-card items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="max-w-md">
          <Logo className="h-14 w-auto mb-8" />
          <h2 className="text-4xl font-display font-extrabold text-foreground tracking-tight mb-4">Sua jornada criativa começa aqui. 🚀</h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">Chega de improvisar. Organize suas ideias, crie com consistência e apareça pro mundo.</p>
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
                Confirme seu email
              </h2>
              <p className="text-muted-foreground font-body text-sm leading-relaxed">
                Enviamos um link de confirmação para{" "}
                <strong className="text-foreground">{emailValue}</strong>.
                Abra o email e clique no link para ativar sua conta.
              </p>
              <p className="text-xs text-muted-foreground font-body">
                Não recebeu? Verifique a pasta de spam ou{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setEmailSent(false)}
                >
                  tente novamente
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-2xl font-display font-extrabold text-foreground mb-2">Criar conta</h3>
              <p className="text-muted-foreground font-body mb-8">Comece a organizar seu conteúdo hoje</p>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full mb-4 flex items-center gap-3"
                onClick={handleGoogleSignup}
              >
                <GoogleIcon />
                <span className="font-body">Criar conta com Google</span>
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-body">ou</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-body">Seu nome</Label>
                  <Input id="name" type="text" placeholder="Como quer ser chamada?" {...register("name")} className="rounded-xl h-12" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body">E-mail</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-xl h-12" />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-body">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Mínimo 8 caracteres" {...register("password")} className="rounded-xl h-12 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-body">Confirmar senha</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Repita a senha" {...register("confirmPassword")} className="rounded-xl h-12 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar minha conta"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground font-body mt-6 text-center">
                Já tem conta?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
