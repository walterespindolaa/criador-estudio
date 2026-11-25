import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   LEGENDA NO FORMATO DO LINKEDIN (mockup aprovado em 25/11/2026)

   Walter, 25/11/2026: "o estilo do post para linkedin a estrutura de criacao
   dele interna é diferente". No feed do LinkedIn só as primeiras linhas
   aparecem; o resto fica atrás do "ver mais". O LinkedIn não publica o número
   exato: usamos cerca de 210 caracteres ou 3 linhas, o que vier antes (é o que
   se vê no feed hoje). A linha azul é aproximada, por isso o rótulo diz "corte".
   ═══════════════════════════════════════════════════════════════════════════ */

export const CORTE_VER_MAIS = 210;

/** Onde o feed corta: 210 caracteres ou o fim da 3ª linha, o que vier antes. */
export function posicaoCorte(texto: string, limite = CORTE_VER_MAIS, linhas = 3): number | null {
  let corte = Math.min(limite, texto.length);
  let quebras = 0;
  for (let i = 0; i < corte; i++) {
    if (texto[i] === "\n" && ++quebras === linhas) { corte = i; break; }
  }
  return corte >= texto.trimEnd().length ? null : corte;
}

/** Linha azul por cima do textarea, na altura do corte. Um "espelho" invisível
    com o mesmo texto e a mesma fonte mede onde o corte cai. */
/* A descrição do YouTube usa a mesma régua com outro corte e outra cor
   (Walter, 25/11/2026, mockup do post de YouTube): por isso limite, linhas e rótulo. */
export function CorteVerMais({ texto, textareaRef, limite, linhas, rotulo = 'corte do "ver mais"', cor = "#0A66C2", fundo = "#E8F1FB" }: {
  texto: string; textareaRef: RefObject<HTMLTextAreaElement>; limite?: number; linhas?: number; rotulo?: string; cor?: string; fundo?: string;
}) {
  const espelho = useRef<HTMLDivElement>(null);
  const marca = useRef<HTMLSpanElement>(null);
  const [topo, setTopo] = useState<number | null>(null);
  const corte = posicaoCorte(texto, limite, linhas);

  useLayoutEffect(() => {
    if (corte === null) { setTopo(null); return; }
    // A régua vem antes do textarea na tela, então o ref dele só existe depois
    // deste efeito: a medida acontece no quadro seguinte.
    let ta: HTMLTextAreaElement | null = null;
    const medir = () => {
      ta = textareaRef.current;
      if (!ta || !marca.current || !espelho.current) return;
      // O espelho copia a caixa do textarea antes de medir.
      const e = espelho.current.style;
      e.left = `${ta.offsetLeft}px`; e.top = `${ta.offsetTop}px`;
      e.width = `${ta.clientWidth}px`; e.height = `${ta.clientHeight}px`;
      const y = marca.current.offsetTop + marca.current.offsetHeight + ta.offsetTop - ta.scrollTop + 2;
      setTopo(y > ta.offsetTop && y < ta.offsetTop + ta.clientHeight ? y : null);
    };
    const quadro = requestAnimationFrame(() => { medir(); ta?.addEventListener("scroll", medir); });
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(quadro);
      ta?.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [texto, corte, textareaRef]);

  if (corte === null) return null;
  return (
    <>
      <div ref={espelho} aria-hidden
        className="pointer-events-none invisible absolute overflow-hidden whitespace-pre-wrap break-words font-body text-base leading-relaxed pr-10">
        {texto.slice(0, corte)}<span ref={marca}>&#8203;</span>{texto.slice(corte)}
      </div>
      {topo !== null && (
        <div aria-hidden className="pointer-events-none absolute left-3 right-3 border-t-2 border-dashed" style={{ top: topo, borderColor: cor }}>
          <span className="absolute right-0 -top-[11px] rounded-full px-2 py-px text-[10.5px] font-body font-bold" style={{ background: fundo, color: cor }}>{rotulo}</span>
        </div>
      )}
    </>
  );
}

/** Conferência rápida: gancho antes do corte, parágrafos curtos, poucas hashtags. */
export function ChecagemLinkedIn({ texto }: { texto: string }) {
  const t = texto.trim();
  if (!t) return null;
  const corte = posicaoCorte(t);
  const primeira = t.split("\n").find((l) => l.trim())?.trim() ?? "";
  const gancho = corte === null || primeira.length <= corte;
  const longos = t.split(/\n\s*\n/).filter((p) => p.length > 400).length;
  const tags = (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const ok = "text-emerald-700 font-bold";
  const av = "text-amber-700 font-bold";
  return (
    <div className="space-y-0.5 text-[12px] font-body leading-snug">
      {corte === null
        ? <p className={ok}>✓ O texto todo aparece sem "ver mais"</p>
        : gancho
          ? <p className={ok}>✓ Gancho cabe antes do corte ({primeira.length} caracteres)</p>
          : <p className={av}>• A primeira frase passa do corte: encurte o gancho pra ele aparecer inteiro</p>}
      {longos ? <p className={av}>• {longos} parágrafo{longos > 1 ? "s" : ""} longo{longos > 1 ? "s" : ""}: no LinkedIn rende mais quebrar em blocos curtos</p> : <p className={ok}>✓ Parágrafos curtos</p>}
      {tags > 5 ? <p className={av}>• {tags} hashtags: no LinkedIn, poucas bastam</p> : tags > 0 ? <p className="text-muted-foreground">• {tags} hashtag{tags > 1 ? "s" : ""}</p> : null}
    </div>
  );
}
