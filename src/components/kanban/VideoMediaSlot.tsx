import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VideoEmbed } from "./VideoEmbed";

export function MediaPreparingPlaceholder({ pct, label }: { pct?: number | null; label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/90 px-6">
      <img src="/logo-icon-white.png" alt="CRIA" className="w-14 h-14 animate-pulse opacity-90" />
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

export function VideoMediaSlot({ viewUrl, videoGuid, className }: {
  viewUrl: string;
  videoGuid?: string | null;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!videoGuid) { setReady(true); return; }
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // ~4 min; depois mostra o player de qualquer forma

    const check = async () => {
      attempts += 1;
      try {
        const { data } = await supabase.functions.invoke("bunny-video-status", {
          body: { videoGuid },
        });
        if (cancelled) return;
        if ((data as { ready?: boolean } | null)?.ready) { setReady(true); return; }
      } catch { /* tenta de novo */ }
      if (!cancelled) {
        if (attempts >= MAX_ATTEMPTS) { setReady(true); return; }
        timer = window.setTimeout(check, 6000);
      }
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [videoGuid]);

  if (ready) return <VideoEmbed viewUrl={viewUrl} className={className} />;
  return <MediaPreparingPlaceholder label="Preparando vídeo…" />;
}
