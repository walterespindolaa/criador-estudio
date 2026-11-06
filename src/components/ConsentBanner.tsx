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
const ROTAS_SEM_BANNER = ["/onboarding", "/comecar-agencia", "/aprovar", "/cronograma", "/roteiros", "/agendar", "/materiais", "/cadastro", "/proposta", "/bio", "/b/", "/site/", "/conectar"];

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

  /* DISCRETO (Walter, 06/11/2026: "esse cookies é muito grande"). Era um card de
     4 linhas cobrindo o rodapé do link na bio. Agora é uma faixa fina: texto
     curto, os dois botões pequenos e o link da política. Mesmas duas escolhas. */
  return (
    <div role="dialog" aria-label="Aviso de cookies"
      className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100vw-1.5rem)] max-w-[440px] sm:left-auto sm:right-4 sm:translate-x-0 rounded-full border border-border bg-card/95 backdrop-blur shadow-md pl-3.5 pr-1.5 py-1.5 flex items-center gap-2"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <p className="flex-1 min-w-0 text-[11.5px] font-body text-muted-foreground leading-snug">
        Pixel da Meta só se você deixar.{" "}
        <Link to="/privacidade" className="underline underline-offset-2 text-foreground/80">Saiba mais</Link>
      </p>
      <button type="button" onClick={() => decidir("recusado")}
        className="shrink-0 h-8 px-2.5 rounded-full text-[11.5px] font-body font-semibold text-foreground/80 hover:bg-muted">
        Só essencial
      </button>
      <button type="button" onClick={() => decidir("aceito")}
        className="shrink-0 h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[11.5px] font-body font-bold">
        Aceitar
      </button>
    </div>
  );
}
