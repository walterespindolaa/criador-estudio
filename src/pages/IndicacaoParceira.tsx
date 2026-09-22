import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { guardarIndicacao } from "@/lib/indicacao";

/* O LINK DA PARCEIRA · /p/:codigo  (Walter, 22/09/2026)
   Guarda o cupom e segue. A regra de guarda e validade vive em
   src/lib/indicacao.ts, junto do comentário que explica o porquê. */
export default function IndicacaoParceira() {
  const { codigo } = useParams<{ codigo: string }>();
  const navegar = useNavigate();

  useEffect(() => {
    if (codigo) guardarIndicacao(codigo);
    /* Vai pra HOME, não direto pro checkout. Quem chega por indicação quase
       nunca está pronto pra pagar: veio de um story, quer ver o que é. Empurrar
       pro cartão neste segundo queima a indicação e a confiança da parceira
       junto. O código fica guardado e aparece sozinho na hora de assinar. */
    navegar(`/?ref=${encodeURIComponent(codigo ?? "")}`, { replace: true });
  }, [codigo, navegar]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 text-center">
      <div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm font-body text-muted-foreground mt-3">Um instante, estamos te levando…</p>
      </div>
    </div>
  );
}
