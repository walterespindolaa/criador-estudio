import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VideoEmbed } from "./VideoEmbed";

export function MediaPreparingPlaceholder({ pct, label }: { pct?: number | null; label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-neutral-950 px-6">
      <img src="/logo-cria-white.png" alt="CRIA" className="w-28 h-auto animate-pulse opacity-90" />
      <div className="w-40 h-1.5 rounded-full bg-white/20 overflow-hidden">
        {typeof pct === "number" ? (
          <div className="h-full bg-white/80 transition-all duration-300" style={{ width: `${Math.max(3, pct)}%` }} />
        ) : (
          <div className="h-full w-1/3 bg-white/70 animate-pulse" />
        )}
      </div>
      <p className="text-white/70 text-[11px] font-body text-center">
        {label ?? "Preparando pré-visualização…"}
      </p>
    </div>
  );
}

/* Vídeos que já ficaram prontos nesta aba: trocar de rede na prévia (que
   remonta o componente) não volta pro carregando nem consulta de novo. */
const prontos = new Set<string>();

/** Pega library e guid da URL do player do Bunny (/embed/{library}/{guid}). */
export function dadosDoPlayerBunny(viewUrl: string): { libraryId: string; videoGuid: string } | null {
  const m = viewUrl.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
  return m ? { libraryId: m[1], videoGuid: m[2] } : null;
}

/* PRÉVIA SÓ COM VÍDEO PRONTO (Walter, 05/11/2026: "muito feio essa tela
   quando sobe um vídeo no Cria, melhor aparecer um loading com a logo do Cria
   e ficar atualizando por trás até aparecer a prévia"). Enquanto o Bunny não
   termina de converter, o player dele mostra "Processing video" em letra
   gigante. Aqui o player só nasce quando o status diz pronto; até lá fica a
   logo com o progresso, consultando a cada 4 s. */
export function VideoMediaSlot({ viewUrl, videoGuid, className, autoplay = false, envioPct }: {
  viewUrl: string;
  videoGuid?: string | null;
  className?: string;
  autoplay?: boolean;
  /** Progresso do envio do arquivo (antes da conversão começar). */
  envioPct?: number | null;
}) {
  const doPlayer = dadosDoPlayerBunny(viewUrl);
  const guid = videoGuid || doPlayer?.videoGuid || null;
  const libraryId = doPlayer?.libraryId ?? null;
  const [ready, setReady] = useState(() => !guid || prontos.has(guid));
  const [progress, setProgress] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!guid || prontos.has(guid)) { setReady(true); return; }
    setReady(false); setProgress(null); setFalhou(false);
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    let erros = 0;
    const MAX_ATTEMPTS = 150; // ~10 min: vídeo grande demora pra subir e converter

    const check = async () => {
      attempts += 1;
      try {
        const { data, error } = await supabase.functions.invoke("bunny-video-status", {
          body: { videoGuid: guid, libraryId },
        });
        if (cancelled) return;
        /* Status não consultável (vídeo antigo, sem login, função fora): depois
           de 3 erros seguidos mostra o player, que é como era antes. */
        if (error || !data) {
          erros += 1;
          if (erros >= 3) { setReady(true); return; }
        } else erros = 0;
        const d = data as { ready?: boolean; failed?: boolean; encodeProgress?: number | null } | null;
        if (d?.failed) { setFalhou(true); return; }
        if (typeof d?.encodeProgress === "number") setProgress(d.encodeProgress);
        if (d?.ready) { prontos.add(guid); setReady(true); return; }
      } catch { /* tenta de novo */ }
      if (!cancelled) {
        if (attempts >= MAX_ATTEMPTS) { setReady(true); return; }
        timer = window.setTimeout(check, 4000);
      }
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [guid, libraryId]);

  if (ready) return <VideoEmbed viewUrl={viewUrl} autoplay={autoplay} className={className} />;
  if (falhou) {
    return (
      <MediaPreparingPlaceholder pct={0} label="O vídeo não converteu. Remova e suba de novo." />
    );
  }
  const enviando = typeof envioPct === "number" && envioPct < 100;
  return (
    <MediaPreparingPlaceholder
      pct={enviando ? envioPct : progress}
      label={enviando
        ? `Enviando vídeo… ${envioPct}%`
        : progress != null && progress > 0 ? `Preparando a prévia… ${progress}%` : "Preparando a prévia…"}
    />
  );
}
