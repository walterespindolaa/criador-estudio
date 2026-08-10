import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrompterScript } from "@/hooks/usePrompterScripts";
import { PrompterPlayer } from "@/components/prompter/PrompterPlayer";

/* Tela de gravação: carrega o roteiro e entrega pro player fullscreen.
   O player cobre o app inteiro (position:fixed, z-60), então o layout
   (rail/bottombar) continua montado por baixo sair é instantâneo. */

export default function PrompterGravar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: script, isLoading } = usePrompterScript(id);

  const exit = useCallback(() => {
    /* Volta pra onde a pessoa estava (Criando, Stories, biblioteca).
       Deep link sem histórico dentro do app cai na biblioteca. */
    const idx = (window.history.state && (window.history.state as { idx?: number }).idx) || 0;
    if (idx > 0) navigate(-1);
    else navigate("/app/prompter", { replace: true });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }

  if (!script) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black text-center px-6">
        <div>
          <p className="text-white font-body font-medium">Roteiro não encontrado</p>
          <p className="text-white/60 text-sm font-body mt-1">Ele pode ter sido excluído em outro aparelho.</p>
          <Button className="mt-4" onClick={() => navigate("/app/prompter", { replace: true })}>Ir pra biblioteca</Button>
        </div>
      </div>
    );
  }

  return <PrompterPlayer title={script.title} text={script.script} onExit={exit} />;
}
