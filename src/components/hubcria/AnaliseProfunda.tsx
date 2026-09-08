import { useState } from "react";
import { Clapperboard, Clock, Copy, Film, Loader2, RotateCcw, Scissors, Sparkles, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { useAnaliseVideo, usePodeAnalisarVideo, useRodarAnaliseVideo, type BlocoAnalise, type ResultadoAnalise } from "@/hooks/useVideoAnalysis";

/* ═══════════════════════════════════════════════════════════════════════════
   ANÁLISE PROFUNDA (dentro do card do reel no Radar)

   A v1 despejava tudo em texto e a social mídia tinha que LER a análise
   inteira pra tirar alguma coisa dali. Nesta versão a tela é montada na ordem
   em que ela trabalha:

   1. A FÓRMULA em uma linha, pra decidir em dois segundos se vale a pena.
   2. A LINHA DO TEMPO colorida por função, que mostra a arquitetura do vídeo
      sem obrigar a ler nove linhas de texto.
   3. A FICHA TÉCNICA com números calculados (cortes por minuto, quando a
      venda entra, quanto do vídeo é venda), que é o que dá pra comparar entre
      um reel e outro.
   4. O ROTEIRO PRONTO pro cliente dela, cronometrado, com fala e letreiro.
      É aqui que a leitura vira trabalho entregue: copia, ou vira pauta.

   O resto (letreiros, visual, o que gravar) fica recolhido, porque é consulta,
   não decisão. Só admin vê, fase de teste.
   ═══════════════════════════════════════════════════════════════════════════ */

const seg = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;

/** Vocabulário fechado que vem da edge, traduzido pra tela. */
const FUNCAO = {
  prender: { label: "Prende", cor: CRIA_HEX.laranja },
  provar: { label: "Prova", cor: CRIA_HEX.azul },
  ensinar: { label: "Ensina", cor: CRIA_HEX.lilas },
  tensionar: { label: "Tensiona", cor: CRIA_HEX.rosa },
  virar: { label: "Vira a chave", cor: CRIA_HEX.amarelo },
  vender: { label: "Vende", cor: CRIA_HEX.verde },
  fechar: { label: "Fecha", cor: "#2A2440" },
} as const;

const daFuncao = (f: string) => FUNCAO[f as keyof typeof FUNCAO] ?? { label: f, cor: "#B9B3A7" };

const TECNICA: Record<string, string> = {
  numero_choque: "número chocante", pergunta: "pergunta", contraste: "contraste",
  promessa: "promessa", dor: "dor", autoridade: "autoridade", curiosidade: "curiosidade",
  antes_depois: "antes e depois", humor: "humor", historia: "história", lista: "lista",
};
const CTA_TIPO: Record<string, string> = {
  link_bio: "link na bio", comenta: "comentário", salva: "salvar",
  compartilha: "compartilhar", segue: "seguir", dm: "direct", nenhum: "sem CTA",
};
const ENQUADRA: Record<string, string> = {
  selfie: "selfie", tripe: "tripé", terceiro: "alguém filmando", tela: "gravação de tela",
};
const LEGENDAS: Record<string, string> = {
  dinamicas: "legendas dinâmicas", fixas: "legendas fixas", nenhuma: "sem legendas",
};
const DIFICULDADE: Record<string, { label: string; cls: string }> = {
  facil: { label: "fácil de refazer", cls: "bg-green-100 text-green-800" },
  media: { label: "dá algum trabalho", cls: "bg-amber-100 text-amber-800" },
  dificil: { label: "difícil de refazer", cls: "bg-red-100 text-red-700" },
};
const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", story: "Story", shorts: "YouTube Shorts",
};

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

/** Chip da ficha técnica. Número calculado, não chute do modelo. */
function Ficha({ icone, children }: { icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-body text-foreground/80 rounded-md bg-card border border-border/60 px-1.5 py-0.5">
      {icone}{children}
    </span>
  );
}

/**
 * A arquitetura do vídeo em uma barra. Cada bloco ocupa o tempo que ocupa no
 * vídeo, então dá pra ver de longe se o cara passou o reel inteiro provando ou
 * se ele vendeu no segundo cinco.
 */
function LinhaDoTempo({ blocos, duracao }: { blocos: BlocoAnalise[]; duracao: number }) {
  if (!blocos.length || duracao <= 0) return null;
  const presentes = [...new Set(blocos.map((b) => b.funcao))];
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {blocos.map((b, i) => {
          const larg = Math.max(0.5, ((b.fim - b.inicio) / duracao) * 100);
          const f = daFuncao(b.funcao);
          return (
            <span
              key={i}
              title={`${seg(b.inicio)} a ${seg(b.fim)} · ${f.label}`}
              style={{ width: `${larg}%`, background: f.cor }}
              className="block h-full border-r border-white/70 last:border-r-0"
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
        {presentes.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 text-[10px] font-body text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: daFuncao(f).cor }} />
            {daFuncao(f).label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Monta o texto que vai pra área de transferência quando ela clica em copiar. */
function roteiroEmTexto(r: ResultadoAnalise): string {
  const linhas: string[] = [];
  if (r.roteiro_adaptado?.titulo) linhas.push(r.roteiro_adaptado.titulo, "");
  if (r.formula) linhas.push(`Fórmula: ${r.formula}`, "");
  for (const b of r.roteiro_adaptado?.blocos ?? []) {
    linhas.push(`${seg(b.inicio)} a ${seg(b.fim)} · ${daFuncao(b.funcao).label}`);
    if (b.fala) linhas.push(`Fala: ${b.fala}`);
    if (b.na_tela) linhas.push(`Na tela: ${b.na_tela}`);
    linhas.push("");
  }
  if (r.o_que_gravar?.length) {
    linhas.push("O que gravar:");
    r.o_que_gravar.forEach((t, i) => linhas.push(`${i + 1}. ${t}`));
    linhas.push("");
  }
  if (r.roteiro_adaptado?.legenda_sugerida) {
    linhas.push("Legenda sugerida:", r.roteiro_adaptado.legenda_sugerida);
  }
  return linhas.join("\n").trim();
}

type VirarPauta = (r: { title: string; rationale?: string | null; ref_url?: string | null; format?: string | null }) => void;

function Resultado({ r, postUrl, aoVirarPauta }: { r: ResultadoAnalise; postUrl: string; aoVirarPauta?: VirarPauta }) {
  const [tudo, setTudo] = useState(false);
  const m = r.metricas ?? { duracao: null, cortes_por_minuto: null, segundos_ate_cta: null, pct_vendendo: null, blocos: 0 };
  const duracao = m.duracao ?? 0;
  const dif = DIFICULDADE[r.dificuldade?.nivel] ?? DIFICULDADE.media;
  const roteiro = r.roteiro_adaptado?.blocos ?? [];

  const copiar = () => {
    void navigator.clipboard.writeText(roteiroEmTexto(r));
    toast.success("Roteiro copiado.");
  };

  const virarPauta = () => {
    if (!aoVirarPauta) return;
    aoVirarPauta({
      title: (r.roteiro_adaptado?.titulo || r.formula || "Roteiro da engenharia reversa").slice(0, 160),
      rationale: roteiroEmTexto(r).slice(0, 4000),
      ref_url: postUrl,
      format: r.formato_sugerido === "carrossel" ? "carrossel" : r.formato_sugerido === "story" ? "story" : "reels",
    });
  };

  return (
    <div className="space-y-3">
      {/* 1. A FÓRMULA. Se a pessoa só ler esta linha, ela já levou algo. */}
      {r.formula && (
        <p className="text-[13px] font-display font-bold text-foreground leading-snug">{r.formula}</p>
      )}
      {r.resumo && <p className="text-[12.5px] font-body text-foreground/90 leading-relaxed">{r.resumo}</p>}

      {/* 2. A ARQUITETURA */}
      <LinhaDoTempo blocos={r.estrutura ?? []} duracao={duracao} />

      {/* 3. A FICHA TÉCNICA: só número calculado, nada de opinião do modelo. */}
      <div className="flex flex-wrap gap-1.5">
        {duracao > 0 && <Ficha icone={<Clock className="h-3 w-3" />}>{seg(duracao)}</Ficha>}
        {m.cortes_por_minuto != null && (
          <Ficha icone={<Scissors className="h-3 w-3" />}>{r.ritmo?.cortes_estimados} cortes · {m.cortes_por_minuto}/min</Ficha>
        )}
        {m.segundos_ate_cta != null && m.segundos_ate_cta > 0 && (
          <Ficha>venda entra em {seg(m.segundos_ate_cta)}</Ficha>
        )}
        {m.pct_vendendo != null && <Ficha>{m.pct_vendendo}% do vídeo é venda</Ficha>}
        {r.visual?.enquadramento && <Ficha icone={<Film className="h-3 w-3" />}>{ENQUADRA[r.visual.enquadramento] ?? r.visual.enquadramento}</Ficha>}
        {r.legendas && r.legendas !== "nenhuma" && <Ficha>{LEGENDAS[r.legendas] ?? r.legendas}</Ficha>}
        {r.cta?.tipo && r.cta.tipo !== "nenhum" && <Ficha>CTA de {CTA_TIPO[r.cta.tipo] ?? r.cta.tipo}</Ficha>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Nota label="Gancho" v={r.notas?.gancho ?? 0} />
        <Nota label="Ritmo" v={r.notas?.ritmo ?? 0} />
        <Nota label="Clareza" v={r.notas?.clareza ?? 0} />
        <Nota label="CTA" v={r.notas?.cta ?? 0} />
        {r.formato_sugerido && (
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background">
            refazer como {FORMATO[r.formato_sugerido] ?? r.formato_sugerido}
          </span>
        )}
        <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full", dif.cls)}>{dif.label}</span>
      </div>

      <Bloco titulo={`Gancho · ${Math.round(r.gancho?.segundos ?? 3)}s · ${TECNICA[r.gancho?.tecnica] ?? r.gancho?.tecnica ?? ""}`}>
        <p className="text-[12.5px] font-body text-foreground leading-relaxed">{r.gancho?.texto}</p>
        {r.gancho?.por_que_prende && (
          <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed mt-0.5">{r.gancho.por_que_prende}</p>
        )}
      </Bloco>

      <Bloco titulo="Bloco a bloco">
        <ol className="space-y-1">
          {(r.estrutura ?? []).map((b, i) => {
            const f = daFuncao(b.funcao);
            return (
              <li key={i} className="text-[12px] font-body text-foreground/90 leading-relaxed flex gap-2">
                <span className="font-mono text-[10.5px] text-muted-foreground shrink-0 pt-0.5">{seg(b.inicio)}</span>
                <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: f.cor }} />
                <span>
                  <b className="font-display">{f.label}:</b> {b.o_que_acontece}
                  {b.o_que_aparece && <span className="text-muted-foreground"> ({b.o_que_aparece})</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </Bloco>

      {/* 4. A ENTREGA. O que a social mídia leva pro cliente dela. */}
      {roteiro.length > 0 && (
        <div className="rounded-xl border border-primary/40 bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-primary">O roteiro pro seu cliente</p>
              {r.roteiro_adaptado?.titulo && (
                <p className="text-[13px] font-display font-bold text-foreground leading-snug mt-0.5">{r.roteiro_adaptado.titulo}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={copiar} className="inline-flex items-center gap-1 text-[10.5px] font-body font-bold text-primary hover:underline">
                <Copy className="h-3 w-3" /> copiar
              </button>
              {aoVirarPauta && (
                <button type="button" onClick={virarPauta} className="inline-flex items-center gap-1 text-[10.5px] font-body font-bold text-primary hover:underline">
                  <Lightbulb className="h-3 w-3" /> virar pauta
                </button>
              )}
            </div>
          </div>

          <ol className="space-y-2">
            {roteiro.map((b, i) => {
              const f = daFuncao(b.funcao);
              return (
                <li key={i} className="border-l-2 pl-2.5" style={{ borderColor: f.cor }}>
                  <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                    {seg(b.inicio)} a {seg(b.fim)} · {f.label}
                  </p>
                  {b.fala && <p className="text-[12.5px] font-body text-foreground leading-relaxed">{b.fala}</p>}
                  {b.na_tela && (
                    <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed mt-0.5">
                      Na tela: {b.na_tela}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {r.roteiro_adaptado?.legenda_sugerida && (
            <div className="pt-2 border-t border-border/60">
              <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Legenda sugerida</p>
              <p className="text-[12px] font-body text-foreground/90 leading-relaxed whitespace-pre-wrap">{r.roteiro_adaptado.legenda_sugerida}</p>
            </div>
          )}
        </div>
      )}

      {(r.o_que_gravar ?? []).length > 0 && (
        <Bloco titulo="O que precisa ser gravado">
          <ol className="space-y-0.5">
            {r.o_que_gravar.map((t, i) => (
              <li key={i} className="text-[12px] font-body text-foreground leading-relaxed flex gap-1.5">
                <span className="font-display font-bold text-primary shrink-0">{i + 1}.</span>{t}
              </li>
            ))}
          </ol>
          {r.dificuldade?.o_que_precisa && (
            <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed mt-1">Precisa ter: {r.dificuldade.o_que_precisa}</p>
          )}
        </Bloco>
      )}

      {/* Consulta, não decisão: fica recolhido. */}
      {!tudo ? (
        <button type="button" onClick={() => setTudo(true)} className="text-[11px] font-body font-bold text-primary hover:underline">
          ver letreiros, visual e por que funciona
        </button>
      ) : (
        <>
          {(r.letreiros ?? []).length > 0 && (
            <Bloco titulo="Letreiros na tela">
              <div className="flex flex-wrap gap-1">
                {r.letreiros.map((t, i) => (
                  <span key={i} className="text-[11px] font-body px-2 py-0.5 rounded-md bg-muted border border-border/60">{t}</span>
                ))}
              </div>
            </Bloco>
          )}
          <Bloco titulo="Visual">
            <ul className="text-[12px] font-body text-foreground/90 leading-relaxed space-y-0.5">
              <li><b className="font-display">Cenário:</b> {r.visual?.cenario}</li>
              <li><b className="font-display">Luz e cores:</b> {r.visual?.luz_e_cores}</li>
              <li><b className="font-display">Edição:</b> {r.visual?.edicao}</li>
              <li><b className="font-display">Áudio:</b> {r.audio?.tipo}{r.audio?.musica ? ` · ${r.audio.musica}` : ""}</li>
            </ul>
          </Bloco>
          {r.ritmo?.onde_a_atencao_cai && (
            <Bloco titulo="Onde a atenção cai">
              <p className="text-[12px] font-body text-foreground/90 leading-relaxed">{r.ritmo.onde_a_atencao_cai}</p>
            </Bloco>
          )}
          <Bloco titulo="Por que funciona">
            <ul className="space-y-0.5">
              {(r.por_que_funciona ?? []).map((t, i) => (
                <li key={i} className="text-[12px] font-body text-foreground/90 leading-relaxed flex gap-1.5"><span className="text-primary">•</span>{t}</li>
              ))}
            </ul>
          </Bloco>
        </>
      )}
    </div>
  );
}

export function AnaliseProfunda({ postUrl, videoUrl, thumbnail, scrapeId, crmClientId, aoVirarPauta }: {
  postUrl: string | null | undefined;
  videoUrl?: string | null;
  thumbnail?: string | null;
  scrapeId?: string | null;
  crmClientId?: string | null;
  aoVirarPauta?: VirarPauta;
}) {
  const pode = usePodeAnalisarVideo();
  const { data: analise } = useAnaliseVideo(pode ? postUrl : null);
  const rodar = useRodarAnaliseVideo();
  if (!pode || !postUrl) return null;

  const processando = analise?.status === "queued" || analise?.status === "running" || rodar.isPending;
  const iniciar = () => rodar.mutate({ post_url: postUrl, video_url: videoUrl ?? null, thumbnail: thumbnail ?? null, scrape_id: scrapeId ?? null, crm_client_id: crmClientId ?? null });

  // Análise gravada antes da v2: o formato mudou, não vale renderizar meia tela.
  const velha = analise?.status === "done" && !!analise.result && (analise.result.versao ?? 1) < 2;

  return (
    <div className="border-t border-border/60 px-3 py-2.5 space-y-2" style={{ background: `${CRIA_HEX.azul}10` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clapperboard className="h-3 w-3" /> Análise profunda do vídeo
          <span className="normal-case tracking-normal font-semibold text-[9.5px] px-1.5 py-0.5 rounded-full bg-foreground/10">teste · admin</span>
        </p>
        {analise?.status === "done" && !velha && (
          <button type="button" onClick={iniciar} disabled={processando}
            className="text-[10.5px] font-body font-bold text-primary hover:underline inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> rodar de novo
          </button>
        )}
      </div>

      {((!analise && !processando) || velha) && (
        <div className="space-y-1.5">
          {velha && (
            <p className="text-[11.5px] font-body text-muted-foreground">
              Esta análise é do formato antigo. Rode de novo pra ver a linha do tempo e o roteiro adaptado.
            </p>
          )}
          <button type="button" onClick={iniciar} disabled={processando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-bold px-3 py-1.5 hover:opacity-90">
            <Sparkles className="h-3.5 w-3.5" /> {velha ? "Analisar de novo" : "Assistir e analisar este vídeo"}
          </button>
        </div>
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

      {analise?.status === "done" && analise.result && !velha && (
        <>
          <Resultado r={analise.result} postUrl={postUrl} aoVirarPauta={aoVirarPauta} />
          {/* Contagem de token saiu: era debug meu na tela dela. Só continua
              aparecendo o que ela pode resolver: resposta cortada pede rodar
              de novo. */}
          {analise.usage?.truncado && (
            <p className="text-[10.5px] font-body text-amber-700">A resposta veio cortada. Rode de novo pra completar.</p>
          )}
        </>
      )}
    </div>
  );
}
