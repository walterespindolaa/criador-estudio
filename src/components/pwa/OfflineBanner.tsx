import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { onlineManager, useIsMutating, useQueryClient } from "@tanstack/react-query";

/* ═══════════════════════════════════════════════════════════════════════════
   OFFLINE, SEM PERDER O TRABALHO

   O react-query já PAUSA as mutações quando não tem rede e as retoma quando a
   rede volta (networkMode "online", que é o padrão). O problema é que isso
   acontecia de forma invisível: a pessoa arrastava o card no elevador, via o
   card mudar (update otimista), não entendia se tinha salvado, dava refresh
   por insegurança e aí sim perdia a alteração.

   Este componente torna o estado VISÍVEL:
   - offline  → "Sem internet" + quantas alterações estão esperando a rede

   HONESTIDADE SOBRE O QUE ISSO GARANTE: a fila do react-query vive na MEMÓRIA
   da aba. Enquanto ela estiver aberta, a alteração é reenviada sozinha quando a
   rede volta. Se a pessoa FECHAR a aba (ou o iOS descarregar a página) com algo
   pendente, aquilo se perde. Por isso o texto diz "deixe esta aba aberta" em vez
   de "nada se perde": prometer mais do que se entrega faz a pessoa fechar o app
   confiante e perder o trabalho.
   - voltou   → "Sincronizando 3 alterações..." e retoma a fila
   - terminou → "Tudo sincronizado" e some sozinho
   E avisa antes de fechar a aba com coisa pendente.
   ═══════════════════════════════════════════════════════════════════════════ */

export function OfflineBanner() {
  const qc = useQueryClient();
  const pendentes = useIsMutating();
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  const [sincronizou, setSincronizou] = useState(false);

  useEffect(() => {
    return onlineManager.subscribe((estaOnline) => {
      setOnline(estaOnline);
      if (estaOnline) {
        // Retoma o que ficou parado na fila.
        void qc.resumePausedMutations().then(() => {
          setSincronizou(true);
          setTimeout(() => setSincronizou(false), 2500);
        });
      }
    });
  }, [qc]);

  // Fechar a aba com alteração pendente = perder a alteração. Avisa.
  useEffect(() => {
    if (pendentes === 0) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [pendentes]);

  const mostrar = !online || (pendentes > 0 && !online) || sincronizou;
  if (!mostrar) return null;

  const conteudo = !online
    ? {
        Icone: CloudOff,
        titulo: "Sem internet",
        linha:
          pendentes > 0
            ? `${pendentes} ${pendentes === 1 ? "alteração esperando" : "alterações esperando"} a rede voltar. Deixe esta aba aberta.`
            : "Você continua vendo o que já carregou. O que mudar vai junto quando a rede voltar.",
        cor: "bg-amber-500",
      }
    : {
        Icone: sincronizou ? CheckCircle2 : RefreshCw,
        titulo: "Tudo sincronizado",
        linha: "As alterações que ficaram guardadas já foram enviadas.",
        cor: "bg-emerald-600",
      };

  const { Icone, titulo, linha, cor } = conteudo;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[120] -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-lg"
      style={{ top: "calc(8px + env(safe-area-inset-top, 0px))", maxWidth: "92vw" }}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white ${cor}`}>
        <Icone className={`h-4 w-4 ${!online && pendentes > 0 ? "animate-pulse" : ""}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-display font-bold text-foreground leading-tight">{titulo}</p>
        <p className="text-[11px] font-body text-muted-foreground leading-tight">{linha}</p>
      </div>
    </div>
  );
}
