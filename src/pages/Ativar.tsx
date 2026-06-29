import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type OtpType = "invite" | "magiclink" | "recovery" | "email";

/**
 * Página de 1º acesso "branded". Recebe um token_hash (th) gerado pelo admin,
 * autentica via verifyOtp e leva o usuário pra área certa — sem expor o supabase.co.
 */
export default function Ativar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const th = params.get("th");
    const type = (params.get("type") || "invite") as OtpType;
    const to = params.get("to") || "/app";

    if (!th) {
      setError("Link inválido ou incompleto. Peça um novo acesso a quem te convidou.");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: th, type });
      if (error) {
        console.error("[ativar] verifyOtp failed:", error);
        setError("Este link expirou ou já foi usado. Peça um novo acesso a quem te convidou.");
        return;
      }
      // logado — segue pro destino (o app cuida da troca de senha se necessário)
      navigate(to.startsWith("/") ? to : "/app", { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-display font-extrabold text-foreground">Não consegui te conectar</h1>
            <p className="text-sm font-body text-muted-foreground mt-2">{error}</p>
            <Link to="/login" className="inline-block mt-5 text-sm font-medium text-primary">Ir para o login</Link>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-display font-extrabold text-foreground">Preparando seu acesso…</h1>
            <p className="text-sm font-body text-muted-foreground mt-2 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Só um instante
            </p>
          </>
        )}
      </div>
    </div>
  );
}
