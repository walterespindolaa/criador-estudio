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

const resetSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ResetFormData = z.infer<typeof resetSchema>;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: ResetFormData) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Erro ao redefinir senha.");
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/app");
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-body">Link inválido ou expirado.</p>
          <Button variant="link" onClick={() => navigate("/login")} className="mt-4">
            Voltar para o login
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
        <h3 className="text-2xl font-display font-semibold text-foreground mb-2">Nova senha</h3>
        <p className="text-muted-foreground font-body mb-8">Escolha uma nova senha para sua conta.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label className="font-body">Nova senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                {...register("password")}
                className="rounded-xl h-12 pr-10"
              />
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
            <Label className="font-body">Confirmar senha</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Repita a senha"
                {...register("confirmPassword")}
                className="rounded-xl h-12 pr-10"
              />
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
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
