import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, CHAVE_CADASTRO_GOOGLE } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/metaPixel";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

/* VOLTA DO GOOGLE (Walter, 25/11/2026). O Google devolve a pessoa pra cá.
   - Conta que já existia (inclusive a de e-mail com o mesmo endereço, que o
     Supabase junta sozinho): segue pra "/", que decide o destino de sempre.
   - Conta que acabou de nascer pelo Google: aplica as escolhas da tela de
     cadastro (tipo de conta, papel de parceiro, plano da LP, origem do anúncio)
     pela função do banco `aplicar_cadastro_google` e leva pro onboarding certo,
     igual ao cadastro por e-mail. A função só age em conta nova do Google.
   - Cancelou ou deu erro no Google: avisa e oferece voltar. */

type Guardado = { meta: Record<string, string>; em: number };
const VALIDADE_MS = 60 * 60 * 1000;
const NOVA_MS = 30 * 60 * 1000;

function lerGuardado(): Record<string, string> | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CADASTRO_GOOGLE);
    localStorage.removeItem(CHAVE_CADASTRO_GOOGLE);
    if (!bruto) return null;
    const g = JSON.parse(bruto) as Guardado;
    return Date.now() - g.em < VALIDADE_MS ? g.meta : null;
  } catch { return null; }
}

function erroNaUrl(): string | null {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return q.get("error_description") || h.get("error_description") || q.get("error") || h.get("error");
}

export default function EntrarGoogle() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(() => erroNaUrl());
  const feito = useRef(false);

  useEffect(() => {
    if (erro || loading || feito.current) return;
    if (!user) {
      // A sessão às vezes chega um instante depois da tela montar; dá 4s.
      const t = setTimeout(() => { if (!feito.current) setErro("sem_sessao"); }, 4000);
      return () => clearTimeout(t);
    }
    feito.current = true;
    void (async () => {
      const meta = lerGuardado();
      const temGoogle = (user.identities ?? []).some((i) => i.provider === "google");
      const nova = temGoogle && Date.now() - new Date(user.created_at).getTime() < NOVA_MS;
      if (!nova) { navigate("/", { replace: true }); return; }

      const intencao = meta?.account_intent;
      if (meta && Object.keys(meta).length) {
        const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>)(
          "aplicar_cadastro_google", { _meta: meta });
        if (error) console.warn("[entrar-google] aplicar_cadastro_google:", error);
        // Traz os metadados novos (account_intent) pra quem decide a rota.
        await supabase.auth.refreshSession();
      }
      track("CompleteRegistration", { content_name: intencao === "manager" ? "signup_agency_google" : intencao === "parceiro" ? "signup_parceiro_google" : "signup_google" });
      /* Recarrega no destino em vez de navegar: o perfil (account_type) já foi
         lido antes da função rodar, e social mídia cairia no app de criador. */
      window.location.replace(intencao === "manager" ? "/comecar-agencia" : intencao === "parceiro" ? "/comecar-parceiro" : "/onboarding");
    })();
  }, [user, loading, erro, navigate]);

  if (!erro) return <LoadingScreen />;

  const cancelou = /access_denied|denied|cancel/i.test(erro);
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#FDFBF5] px-8 text-center font-body text-[#0A0A0A]">
      <h1 className="font-display text-[26px] font-extrabold leading-tight">
        {cancelou ? "Entrada pelo Google cancelada" : "Não deu pra entrar pelo Google"}
      </h1>
      <p className="mt-2 max-w-[320px] text-[15px] text-[#5B574E]">
        {cancelou ? "Nada foi criado. Dá pra tentar de novo ou entrar com e-mail e senha."
          : "Tenta de novo em instantes. Se continuar, entra com e-mail e senha."}
      </p>
      <Link to="/login" className="mt-6 grid h-12 place-items-center rounded-full bg-[#0A0A0A] px-8 font-display text-[16px] font-bold text-[#F5F3E7]">
        Voltar pro login
      </Link>
    </div>
  );
}
