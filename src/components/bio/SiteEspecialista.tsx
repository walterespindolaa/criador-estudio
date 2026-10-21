import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { linkSeguro, linkWhatsapp, lista, txt, type DadosBloco } from "@/lib/bioBlocks";
import {
  QUADRO_H, QUADRO_W, fonteAssinatura, lerAssinatura, podeTocarVideoDeFundo, urlFonteGoogle, videoDaCapa,
  type Assinatura,
} from "@/lib/bioEspecialista";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   OS TRÊS BLOCOS DA PÁGINA DE ESPECIALISTA (21/10/2026)
   Regras em lib/bioEspecialista. Aqui é só o desenho, usado pela página
   pública e pela prévia do editor (a prévia não pode mentir).
   ═══════════════════════════════════════════════════════════════════════════ */

const TEMAS = {
  escuro: { fundo: "#111312", texto: "#EDEAE3", forte: "#F6F2EA", suave: "#A7A39B", linha: "rgba(237,234,227,0.14)" },
  claro: { fundo: "#F7F3EE", texto: "#2A221D", forte: "#1F1915", suave: "#6B5F56", linha: "rgba(42,34,29,0.14)" },
} as const;
export const temaDe = (v: unknown) => (v === "claro" ? TEMAS.claro : TEMAS.escuro);

/** Carrega a fonte do Google só quando alguma assinatura usa. Um <link> por
 *  família, nunca repetido. */
export function carregarFonteAssinatura(familia: string) {
  if (typeof document === "undefined") return;
  const id = `fonte-ass-${familia.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id;
  l.rel = "stylesheet";
  l.href = urlFonteGoogle(familia);
  document.head.appendChild(l);
}

export function useFonteAssinatura(familia: string | null) {
  useEffect(() => { if (familia) carregarFonteAssinatura(familia); }, [familia]);
}

/** O nome ou o traço, sem posição. Quem chama decide onde fica. */
export function DesenhoAssinatura({ a, nome, cor }: { a: Assinatura; nome: string; cor: string }) {
  const f = fonteAssinatura(a.fonte);
  useFonteAssinatura(a.modo === "fonte" ? f.familia : null);
  if (a.modo === "desenho" && a.d) {
    return (
      <svg role="img" aria-label={nome ? `Assinatura de ${nome}` : "Assinatura"} viewBox={`0 0 ${QUADRO_W} ${QUADRO_H}`}
        className="block w-full h-auto overflow-visible">
        <path d={a.d} fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (a.modo === "fonte" && nome.trim()) {
    /* font-size em cqw da caixa da capa: a largura da assinatura acompanha a
       capa, igual ao traço desenhado. 0,28 deixa "Nome Sobrenome" com a
       largura pedida em `escala` na fonte padrão. */
    return (
      <span className="block whitespace-nowrap leading-[1.05] select-none"
        style={{ fontFamily: `'${f.familia}', cursive`, fontSize: `${a.escala * 0.28 * f.ajuste}cqw`, color: cor }}>
        {nome}
      </span>
    );
  }
  return null;
}

/* ── A CAPA ── */
export function SecaoApresentacao({ d, nomePadrao, editavel }: {
  d: DadosBloco;
  nomePadrao: string;
  /** No editor de assinatura a capa é desenhada por fora, com arraste. */
  editavel?: boolean;
}) {
  const tema = temaDe(txt(d, "tema"));
  const a = lerAssinatura(d.assinatura);
  const nome = txt(d, "nome").trim() || nomePadrao;
  const midia = txt(d, "midia", "video");
  const video = midia === "video" ? videoDaCapa(txt(d, "video_guid")) : null;
  const imagem = txt(d, "imagem");
  const poster = imagem || video?.poster || "";
  const [tocar, setTocar] = useState(false);
  const [videoFalhou, setVideoFalhou] = useState(false);
  // Decidido depois de montar: o servidor (e o teste) não sabe da conexão.
  useEffect(() => { setTocar(podeTocarVideoDeFundo()); }, []);

  return (
    <section id="topo" className="relative overflow-hidden aspect-[3/4] cq-md:aspect-[16/8] max-h-[760px] w-full"
      style={{ backgroundColor: tema.fundo }}>
      {video && tocar && !videoFalhou ? (
        <video key={video.fontes[0]} className="absolute inset-0 w-full h-full object-cover"
          autoPlay muted loop playsInline preload="auto" poster={poster || undefined}
          aria-hidden="true" onError={() => setVideoFalhou(true)}>
          {video.fontes.map((s) => <source key={s} src={s} type="video/mp4" />)}
        </video>
      ) : poster ? (
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" decoding="async" />
      ) : null}
      <div aria-hidden className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 50%, ${tema.fundo} 100%)` }} />

      {/* A caixa onde a assinatura mora. No celular é a capa inteira; em tela
          grande é uma coluna de 560px, senão 70% da largura de um monitor
          viraria uma assinatura de 900px. */}
      <div className="absolute inset-0 mx-auto w-full max-w-[560px] [container-type:inline-size]">
        {!editavel && a.modo !== "nenhuma" && (
          <div className="absolute" style={{ left: `${a.x}%`, top: `${a.y}%`, width: a.modo === "desenho" ? `${a.escala}%` : undefined }}>
            <DesenhoAssinatura a={a} nome={nome} cor={tema.forte} />
          </div>
        )}
        {txt(d, "profissao") && (
          <p className="absolute left-[6%] right-[6%] bottom-[4%] text-[12px] cq-sm:text-[13px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: tema.suave }}>{txt(d, "profissao")}</p>
        )}
      </div>
      <h1 className="sr-only">{nome}</h1>
    </section>
  );
}

/* ── OS NÚMEROS ── */
export function SecaoNumeros({ d }: { d: DadosBloco }) {
  const tema = temaDe(txt(d, "tema"));
  const itens = lista<{ valor?: string; rotulo?: string }>(d, "itens").filter((i) => (i.valor ?? "").trim()).slice(0, 4);
  if (!itens.length) return null;
  const local = txt(d, "local").trim(), registro = txt(d, "registro").trim();
  return (
    <section className="px-6 pt-6 pb-8 cq-md:py-12" style={{ backgroundColor: tema.fundo, color: tema.texto }}>
      <div className="mx-auto max-w-[560px]">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
          {itens.map((i, n) => (
            <div key={n} className="min-w-0">
              <p className="font-display font-bold text-[1.45rem] cq-md:text-[1.9rem] leading-tight break-words" style={{ color: tema.forte }}>{i.valor}</p>
              {i.rotulo && <p className="text-[12px] leading-snug mt-0.5" style={{ color: tema.suave }}>{i.rotulo}</p>}
            </div>
          ))}
        </div>
        {(local || registro) && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-5 pt-4 text-[12px]"
            style={{ borderTop: `1px solid ${tema.linha}`, color: tema.suave }}>
            {local && <span>{local}</span>}
            {registro && <span>{registro}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Endereço do botão fixo, ou vazio se não presta. */
export function destinoDaAcao(d: DadosBloco): string {
  if (txt(d, "destino", "whatsapp") === "whatsapp") {
    return txt(d, "telefone").replace(/\D/g, "").length >= 10 ? linkWhatsapp(txt(d, "telefone"), txt(d, "mensagem")) : "";
  }
  return linkSeguro(txt(d, "url"));
}

/* ── O BOTÃO FIXO ──
   `sticky bottom-0` como ÚLTIMO elemento da página, e não `fixed`: assim ele
   fica preso no pé tanto no celular quanto dentro da moldura da prévia, que
   tem rolagem própria. `fixed` escaparia da moldura e cobriria o editor. */
export function BarraAcaoFixa({ d, cor, corTexto, aoClicar }: { d: DadosBloco; cor: string; corTexto: string; aoClicar?: () => void }) {
  const href = destinoDaAcao(d);
  const texto = txt(d, "texto").trim();
  if (!href || !texto) return null;
  return (
    <div className="sticky bottom-0 z-30 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] pointer-events-none"
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 100%)" }}>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
        className={cn("pointer-events-auto mx-auto max-w-[520px] h-14 rounded-2xl flex items-center justify-center gap-2",
          "font-display font-bold text-[15.5px] shadow-lg transition active:scale-[.99]")}
        style={{ backgroundColor: cor, color: corTexto }}>
        {texto} <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}
