import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { lerConsentimento, guardarConsentimento } from "@/lib/consent";

/* BANNER DE CONSENTIMENTO (pente fino 23/09/2026, LGPD)
   Compacto, no rodapé, duas escolhas de verdade: aceitar ou só o essencial.
   Não bloqueia a tela e não some sozinho, porque "ignorou" não é consentimento.
   Não aparece nas páginas que o cliente final abre por link (aprovação,
   cronograma, roteiros, materiais, bio): lá o Pixel nem dispara, e o cliente
   da agência não é usuário nosso pra tomar essa decisão. */
// Onboarding tem rodapé fixo com "Próximo" no celular: o banner cobria o botão.
const ROTAS_SEM_BANNER = ["/onboarding", "/comecar-agencia", "/aprovar", "/cronograma", "/roteiros", "/materiais", "/cadastro", "/proposta", "/bio", "/b/", "/site/"];

export function ConsentBanner() {
  const { pathname } = useLocation();
  const [decidido, setDecidido] = useState<boolean>(() => lerConsentimento() !== null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Um respiro antes de aparecer: quem chegou agora precisa ver a tela primeiro.
    const t = setTimeout(() => setVisivel(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (decidido || !visivel) return null;
  if (ROTAS_SEM_BANNER.some((r) => pathname.startsWith(r))) return null;

  const decidir = (v: "aceito" | "recusado") => { guardarConsentimento(v); setDecidido(true); };

  return (
    <div role="dialog" aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md rounded-2xl border border-border bg-card shadow-lg p-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <p className="text-sm font-body text-foreground leading-relaxed">
        Usamos cookies essenciais pra você entrar e usar o Cria. Se você permitir, também usamos o pixel da Meta pra medir
        nossos anúncios. Nada de venda de dados.{" "}
        <Link to="/privacidade" className="text-primary underline underline-offset-2">Como cuidamos dos seus dados</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => decidir("aceito")}
          className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-body font-bold">
          Aceitar
        </button>
        <button type="button" onClick={() => decidir("recusado")}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-body font-semibold text-foreground">
          Só o essencial
        </button>
      </div>
    </div>
  );
}
