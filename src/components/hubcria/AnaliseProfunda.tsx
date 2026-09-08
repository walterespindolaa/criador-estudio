import { useState } from "react";
import { Clapperboard, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { useAnaliseVideo, usePodeAnalisarVideo, useRodarAnaliseVideo, type ResultadoAnalise } from "@/hooks/useVideoAnalysis";

/* ═══════════════════════════════════════════════════════════════════════════
   ANÁLISE PROFUNDA (dentro do card do reel no Radar)

   Layout de TESTE: mostra tudo que o TwelveLabs devolve, organizado, pra
   gente julgar a qualidade antes de desenhar a entrega final. Só admin vê.
   ═══════════════════════════════════════════════════════════════════════════ */

const seg = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;

function Nota({ label, v }: { label: string; v: number }) {
  const cor = v >= 8 ? "text-green-700 bg-green-100" : v >= 5 ? "text-amber-800 bg-amber-100" : "text-red-700 bg-red-100";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full", cor)}>
      {label} {v}/10
    </span>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1">{titulo}</p>
      {children}
    </div>
  );
}

function Resultado({ r }: { r: ResultadoAnalise }) {
  const [tudo, setTudo] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] font-body text-foreground leading-relaxed">{r.resumo}</p>

      <div className="flex flex-wrap gap-1.5">
        <Nota label="Gancho" v={r.notas?.gancho ?? 0} />
        <Nota label="Ritmo" v={r.notas?.ritmo ?? 0} />
        <Nota label="Clareza" v={r.notas?.clareza ?? 0} />
        <Nota label="CTA" v={r.notas?.cta ?? 0} />
        {r.formato_sugerido && (
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background">refazer como {r.formato_sugerido}</span>
        )}
      </div>

      <Bloco titulo={`Gancho (${r.gancho?.segundos ?? 0}s) · ${r.gancho?.tecnica ?? ""}`}>
        <p className="text-[12.5px] font-body text-foreground leading-relaxed">{r.gancho?.texto}</p>
      </Bloco>

      <Bloco titulo="Estrutura, bloco a bloco">
        <ol className="space-y-1">
          {(r.estrutura ?? []).map((b, i) => (
            <li key={i} className="text-[12px] font-body text-foreground/90 leading-relaxed flex gap-2">
              <span className="font-mono text-[10.5px] text-primary shrink-0 pt-0.5">{seg(b.inicio)}-{seg(b.fim)}</span>
              <span><b className="font-display">{b.funcao}:</b> {b.o_que_acontece}</span>
            </li>
          ))}
        </ol>
      </Bloco>

      {!tudo ? (
        <button type="button" onClick={() => setTudo(true)} className="text-[11px] font-body font-bold text-primary hover:underline">
          ver ritmo, texto na tela, áudio, visual, por que funciona e como adaptar
        </button>
      ) : (
        <>
          <Bloco titulo={`Ritmo · ~${r.ritmo?.cortes_estimados ?? 0} cortes · ${r.ritmo?.cadencia ?? ""}`}>
            <p className="text-[12px] font-body text-foreground/90 leading-relaxed">Onde a atenção cai: {r.ritmo?.onde_a_atencao_cai}</p>
          </Bloco>
          {(r.texto_na_tela ?? []).length > 0 && (
            <Bloco titulo="Texto na tela, na ordem">
              <div className="flex flex-wrap gap-1">
                {r.texto_na_tela.map((t, i) => (
                  <span key={i} className="text-[11px] font-body px-2 py-0.5 rounded-md bg-muted border border-border/60">{t}</span>
                ))}
              </div>
            </Bloco>
          )}
          <Bloco titulo={`Áudio · ${r.audio?.tipo ?? ""}`}>
            <p className="text-[12px] font-body text-foreground/90 leading-relaxed">{r.audio?.fala_resumida}</p>
            {r.audio?.musica && <p className="text-[11px] font-body text-muted-foreground mt-0.5">Música: {r.audio.musica}</p>}
          </Bloco>
          <Bloco titulo="Visual">
            <ul className="text-[12px] font-body text-foreground/90 leading-relaxed space-y-0.5">
              <li><b className="font-display">Enquadramento:</b> {r.visual?.enquadramento}</li>
              <li><b className="font-display">Cenário:</b> {r.visual?.cenario}</li>
              <li><b className="font-display">Luz e cores:</b> {r.visual?.iluminacao_e_cores}</li>
              <li><b className="font-display">Edição:</b> {r.visual?.edicao}</li>
            </ul>
          </Bloco>
          {r.cta && (
            <Bloco titulo="CTA">
              <p className="text-[12px] font-body text-foreground/90 leading-relaxed">{r.cta}</p>
            </Bloco>
          )}
          <Bloco titulo="Por que funciona">
            <ul className="space-y-0.5">
              {(r.por_que_funciona ?? []).map((t, i) => (
                <li key={i} className="text-[12px] font-body text-foreground/90 leading-relaxed flex gap-1.5"><span className="text-primary">•</span>{t}</li>
              ))}
            </ul>
          </Bloco>
          <Bloco titulo="Como adaptar pro seu cliente">
            <ol className="space-y-0.5">
              {(r.como_adaptar ?? []).map((t, i) => (
                <li key={i} className="text-[12px] font-body text-foreground leading-relaxed flex gap-1.5">
                  <span className="font-display font-bold text-primary shrink-0">{i + 1}.</span>{t}
                </li>
              ))}
            </ol>
          </Bloco>
        </>
      )}
    </div>
  );
}

export function AnaliseProfunda({ postUrl, videoUrl, thumbnail, scrapeId, crmClientId }: {
  postUrl: string | null | undefined;
  videoUrl?: string | null;
  thumbnail?: string | null;
  scrapeId?: string | null;
  crmClientId?: string | null;
}) {
  const pode = usePodeAnalisarVideo();
  const { data: analise } = useAnaliseVideo(pode ? postUrl : null);
  const rodar = useRodarAnaliseVideo();
  if (!pode || !postUrl) return null;

  const processando = analise?.status === "queued" || analise?.status === "running" || rodar.isPending;
  const iniciar = () => rodar.mutate({ post_url: postUrl, video_url: videoUrl ?? null, thumbnail: thumbnail ?? null, scrape_id: scrapeId ?? null, crm_client_id: crmClientId ?? null });

  return (
    <div className="border-t border-border/60 px-3 py-2.5 space-y-2" style={{ background: `${CRIA_HEX.azul}10` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clapperboard className="h-3 w-3" /> Análise profunda do vídeo
          <span className="normal-case tracking-normal font-semibold text-[9.5px] px-1.5 py-0.5 rounded-full bg-foreground/10">teste · admin</span>
        </p>
        {analise?.status === "done" && (
          <button type="button" onClick={iniciar} disabled={processando}
            className="text-[10.5px] font-body font-bold text-primary hover:underline inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> rodar de novo
          </button>
        )}
      </div>

      {!analise && !processando && (
        <button type="button" onClick={iniciar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-bold px-3 py-1.5 hover:opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Assistir e analisar este vídeo
        </button>
      )}

      {processando && (
        <p className="text-[12px] font-body text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {analise?.status === "running" ? "Assistindo ao vídeo... leva de 30s a 2 min." : "Buscando o arquivo do vídeo..."}
        </p>
      )}

      {analise?.status === "error" && !processando && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-body text-red-700">{analise.error || "Falhou."}</p>
          <button type="button" onClick={iniciar} className="text-[11px] font-body font-bold text-primary hover:underline">tentar de novo</button>
        </div>
      )}

      {analise?.status === "done" && analise.result && (
        <>
          <Resultado r={analise.result} />
          {analise.usage && (
            <p className="text-[10px] font-body text-muted-foreground/70">
              {analise.usage.input_tokens ?? "?"} tokens de entrada · {analise.usage.output_tokens ?? "?"} de saída
              {analise.usage.truncado ? " · resposta cortada (aumentar max_tokens)" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
