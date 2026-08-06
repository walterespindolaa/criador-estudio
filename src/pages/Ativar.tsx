import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type OtpType = "invite" | "magiclink" | "recovery" | "email";

/**
 * Página de 1º acesso "branded". Recebe um token_hash (th) gerado pelo admin,
 * autentica via verifyOtp e leva o usuário pra área certa, sem expor o supabase.co.
 *
 * O token é de uso único e expira em poucas horas. Convite aberto tarde (ou
 * aberto duas vezes pelo navegador do WhatsApp) cai no erro, então a própria
 * tela de erro oferece a saída: a pessoa digita o e-mail e recebe um link novo
 * na hora, sem depender de quem convidou reenviar.
 */
export default function Ativar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Token de uso único: garante que o verifyOtp roda UMA vez só (re-render,
  // StrictMode ou identidade de params mudando não podem consumir o token 2x).
  const ran = useRef(false);

  const to = params.get("to") || "/app";

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const th = params.get("th");
    const type = (params.get("type") || "invite") as OtpType;

    if (!th) {
      setError("Link inválido ou incompleto.");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: th, type });
      if (error) {
        console.error("[ativar] verifyOtp failed:", error);
        setError("Este link expirou ou já foi usado.");
        return;
      }
      // logado, segue pro destino (o app cuida da troca de senha se necessário)
      navigate(to.startsWith("/") ? to : "/app", { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, navigate]);

  // Link novo por magic link, direto pro mesmo destino do convite original.
  // shouldCreateUser: false evita criar conta pra e-mail digitado errado.
  const reenviar = async () => {
    const alvo = email.trim().toLowerCase();
    if (!alvo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
      setSendError("Digite o e-mail que recebeu o convite.");
      return;
    }
    setSending(true);
    setSendError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: alvo,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${to.startsWith("/") ? to : "/app"}`,
      },
    });
    setSending(false);
    if (error) {
      console.error("[ativar] reenvio falhou:", error);
      // "Signups not allowed for otp" = e-mail sem conta (shouldCreateUser false).
      const semConta = /signup|not allowed|not found/i.test(error.message ?? "");
      setSendError(semConta
        ? "Não achei uma conta com esse e-mail. Confira se é o mesmo que recebeu o convite."
        : "Não consegui enviar agora. Tente de novo em instantes.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-display font-extrabold text-foreground">Não consegui te conectar</h1>
            <p className="text-sm font-body text-muted-foreground mt-2">
              {error} Sem problema: digite o e-mail que recebeu o convite e eu te mando um link novo agora.
            </p>

            {sent ? (
              <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-body text-emerald-800">
                Link novo enviado! Abra o e-mail mais recente (os anteriores param de valer) e clique em até 1 hora.
              </div>
            ) : (
              <div className="mt-5 space-y-2 text-left">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void reenviar(); }}
                  className="rounded-xl h-11"
                />
                {sendError && <p className="text-xs font-body text-destructive">{sendError}</p>}
                <Button onClick={() => void reenviar()} disabled={sending} className="w-full h-11 rounded-xl">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-2" /> Me manda um link novo</>}
                </Button>
              </div>
            )}

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
