import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

export default function TrocarSenha() {
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await updateProfile.mutateAsync({ must_change_password: false } as never);
      toast.success("Senha atualizada!");
      navigate("/app", { replace: true });
    } catch (e) {
      toast.error("Erro ao atualizar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-display font-extrabold text-foreground mb-1">Defina sua senha</h1>
        <p className="text-sm text-muted-foreground font-body mb-5">
          Você entrou com uma senha provisória. Crie uma senha definitiva para continuar.
        </p>
        <div className="space-y-3">
          <Input type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" />
          <Input type="password" placeholder="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-xl" />
          <Button onClick={handleSubmit} disabled={loading} className="w-full rounded-xl">
            {loading ? "Salvando..." : "Salvar senha"}
          </Button>
        </div>
      </div>
    </div>
  );
}
