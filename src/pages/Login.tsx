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
import { Mail } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
});

const forgotSchema = z.object({
  email: z.string().email("Email inválido"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

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
      toast.error("E-mail ou senha incorretos.");
    } else {
      navigate("/app");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/app" },
    });
    if (error) toast.error("Erro ao conectar com Google.");
  };

  const onSubmitForgot = async (data: ForgotFormData) => {
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error("Erro ao enviar email.");
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-card items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="max-w-md">
          <Logo className="h-14 w-auto mb-8" />
          <h2 className="text-4xl font-display font-extrabold text-foreground tracking-tight mb-4">Bem-vindo de volta, criador. ✨</h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">Suas ideias estão te esperando. Continue de onde parou.</p>
        </motion.div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-block">
            <Logo className="h-10 w-auto" />
          </Link>
          <h3 className="text-2xl font-display font-extrabold text-foreground mb-2">Entrar</h3>
          <p className="text-muted-foreground font-body mb-8">Acesse seu estúdio criativo</p>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full mb-4 flex items-center gap-3"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon />
            <span className="font-body">Entrar com Google</span>
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-body">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmitLogin)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="rounded-xl h-12" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-body">Senha</Label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotSent(false); }}
                  className="text-xs text-primary font-body hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input id="password" type="password" placeholder="••••••••" {...register("password")} className="rounded-xl h-12" />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground font-body mt-6 text-center">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
          </p>
        </motion.div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Esqueci minha senha</DialogTitle>
            <DialogDescription className="font-body">
              {forgotSent
                ? "Enviamos um link para redefinir sua senha. Verifique seu e-mail."
                : "Digite seu e-mail e enviaremos um link para redefinir sua senha."
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
                {forgotLoading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setForgotOpen(false)} className="w-full">
              Fechar
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
