import { useContext, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Download, Play } from "lucide-react";
import { txt, type DadosBloco } from "@/lib/bioBlocks";
import { iconeLucide } from "@/lib/bioIcones";
import {
  CORES_BOTAO, lerBotoes, lerCupons, lerFormatos, lerMarcas, mesAno, numerosDoKit, pdfDoKit, perfilDosVideos,
  publicoDoKit, redesDaCapa, videosDaPagina, type SocialPublico,
} from "@/lib/bioCriadora";
import { BarraQueEnche, Contador } from "@/components/bio/Movimento";
import { EmPreviaContext } from "@/components/bio/SiteLoja";
import type { MarcaSite } from "@/components/bio/SecaoSite";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SEÇÕES DO MODELO CRIADORA (22/10/2026)
   Desenho aprovado no mockup "Criadora de conteúdo (bio + mídia kit)".
   ═══════════════════════════════════════════════════════════════════════════ */

const PAPEL = "#FFF4EF";
const TINTA = "#1A1A1A";
const CINZA = "#6B625E";

const externo = { target: "_blank", rel: "noopener noreferrer" } as const;

/* ── CAPA DA CRIADORA ── */
export function CapaCriadora({ d, marca, social, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; social: SocialPublico | null; aoClicar?: () => void;
}) {
  const foto = txt(d, "foto");
  const nome = txt(d, "nome").trim() || marca.nome;
  const redes = redesDaCapa(d, social);
  return (
    <section id="topo" className="px-3.5 pt-3.5 pb-1 cq-md:pt-8" style={{ backgroundColor: PAPEL, color: TINTA }}>
      <div className="mx-auto max-w-3xl">
        <div className="relative h-[470px] cq-md:h-[560px] rounded-[28px] overflow-hidden" style={{ backgroundColor: "#2A2320" }}>
          {foto && <img src={foto} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover" />}
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,.75) 100%)" }} />
          {(txt(d, "cidade").trim() || txt(d, "selo").trim()) && (
            <div className="absolute top-3.5 left-3.5 right-3.5 flex justify-between gap-2">
              {txt(d, "cidade").trim() ? <span className="bg-white rounded-full px-3 py-1.5 text-[12px] font-bold">{txt(d, "cidade")}</span> : <span />}
              {txt(d, "selo").trim() && <span className="bg-[#D9CCFF] rounded-full px-3 py-1.5 text-[12px] font-bold">{txt(d, "selo")}</span>}
            </div>
          )}
          <div className="absolute left-[18px] right-[18px] bottom-[18px] text-white">
            <h1 className="font-display font-extrabold text-[2.9rem] cq-md:text-[3.6rem] leading-[.95] tracking-[-0.02em] [text-wrap:balance]">{nome}</h1>
            {txt(d, "frase").trim() && <p className="mt-1.5 text-[15px] opacity-90 max-w-[46ch]">{txt(d, "frase")}</p>}
          </div>
        </div>
        {redes.length > 0 && (
          <div className="grid gap-2 mt-2.5" style={{ gridTemplateColumns: `repeat(${redes.length}, minmax(0, 1fr))` }}>
            {redes.map((r, i) => {
              const conteudo = (
                <>
                  <Contador texto={r.numero} className="font-display font-extrabold text-[1.35rem] leading-tight" />
                  <span className="text-[11.5px]" style={{ color: CINZA }}>{r.rotulo}</span>
                </>
              );
              const classe = "bg-white rounded-[18px] px-2.5 py-3 flex flex-col gap-0.5 min-w-0";
              return r.href
                ? <a key={i} href={r.href} {...externo} onClick={aoClicar} className={classe}>{conteudo}</a>
                : <div key={i} className={classe}>{conteudo}</div>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── BOTÕES EM DESTAQUE ── */
export function SecaoBotoes({ d, marca, aoClicar }: { d: DadosBloco; marca: MarcaSite; aoClicar?: () => void }) {
  const itens = lerBotoes(d);
  if (!itens.length) return null;
  return (
    <section className="px-3.5 pt-6 pb-1" style={{ backgroundColor: PAPEL, color: TINTA }}>
      <div className="mx-auto max-w-3xl flex flex-col gap-2.5">
        {itens.map((b, i) => {
          const c = CORES_BOTAO[b.cor];
          const fundo = "fundo" in c ? c.fundo : marca.cor;
          const texto = "texto" in c ? c.texto : marca.corTexto;
          const Icone = iconeLucide(b.icone);
          return (
            <a key={i} href={b.href} {...externo} onClick={aoClicar}
              className="grid grid-cols-[44px_minmax(0,1fr)_20px] gap-3 items-center px-3.5 py-3 rounded-[20px] min-h-[68px] transition active:scale-[.99]"
              style={{ backgroundColor: fundo, color: texto, border: b.cor === "branco" ? "1px solid #F1E2DA" : undefined }}>
              <span className="w-11 h-11 rounded-[14px] grid place-items-center font-display font-extrabold text-[18px]"
                style={{ backgroundColor: "rgba(255,255,255,.22)" }} aria-hidden>
                {Icone ? <Icone className="h-5 w-5" /> : b.titulo.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex flex-col min-w-0">
                <b className="text-[16px] leading-tight">{b.titulo}</b>
                {b.sub && <span className="text-[12.5px] opacity-80 truncate">{b.sub}</span>}
              </span>
              <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden />
            </a>
          );
        })}
      </div>
    </section>
  );
}

/* ── ÚLTIMOS VÍDEOS ── */
export function SecaoVideos({ d, social, aoClicar }: { d: DadosBloco; social: SocialPublico | null; aoClicar?: () => void }) {
  const itens = videosDaPagina(d, social);
  if (!itens.length) return null;
  const perfil = perfilDosVideos(d, social);
  return (
    <section id="conteudo" className="px-3.5 pt-9 pb-1 scroll-mt-[52px]" style={{ backgroundColor: PAPEL, color: TINTA }}>
      <div className="mx-auto max-w-3xl flex flex-col gap-3">
        <div className="flex justify-between items-baseline gap-3">
          <h2 className="font-display font-extrabold text-[1.75rem]">{txt(d, "titulo") || "Últimos vídeos"}</h2>
          {perfil && (
            <a href={perfil.href} {...externo} onClick={aoClicar} className="text-[13px] font-bold inline-flex items-center gap-0.5 min-h-[44px]">
              {perfil.rotulo} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {itens.map((v, i) => (
            <a key={i} href={v.href} {...externo} onClick={aoClicar} aria-label={`Abrir conteúdo ${i + 1}`}
              className="relative block aspect-[9/16] rounded-xl overflow-hidden bg-black/10">
              <img src={v.foto} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,.6))" }} />
              {(v.views || v.video) && (
                <span className="absolute left-1.5 bottom-1.5 flex items-center gap-1 text-white text-[11.5px] font-bold">
                  {v.video && <Play className="h-3 w-3 fill-white" aria-hidden />}{v.views}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CUPONS ──
   Copiar de verdade. Sem clipboard (navegador antigo, iframe), o código fica
   selecionado pra pessoa copiar na mão. */
export function SecaoCupons({ d, aoClicar }: { d: DadosBloco; aoClicar?: () => void }) {
  const itens = lerCupons(d);
  const [copiado, setCopiado] = useState<string | null>(null);
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emPrevia = useContext(EmPreviaContext);
  useEffect(() => () => { if (tempo.current) clearTimeout(tempo.current); }, []);
  if (!itens.length) return null;

  const copiar = async (codigo: string, el: HTMLElement | null) => {
    if (emPrevia) return;
    aoClicar?.();
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      if (el) {
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
      }
    }
    setCopiado(codigo);
    if (tempo.current) clearTimeout(tempo.current);
    tempo.current = setTimeout(() => setCopiado(null), 2200);
  };

  return (
    <section className="px-3.5 pt-9 pb-1" style={{ backgroundColor: PAPEL, color: TINTA }}>
      <div className="mx-auto max-w-3xl flex flex-col gap-2.5">
        <h2 className="font-display font-extrabold text-[1.75rem]">{txt(d, "titulo") || "Meus cupons"}</h2>
        {itens.map((c, i) => {
          const ok = copiado === c.codigo;
          return (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-center bg-white rounded-[20px] py-3.5 pr-3.5 pl-4 border-2 border-dashed border-[#F4C9BA]">
              <div className="flex flex-col gap-0.5 min-w-0">
                {(c.marca || c.desconto) && (
                  <span className="text-[12px] truncate" style={{ color: CINZA }}>{[c.marca, c.desconto].filter(Boolean).join(" · ")}</span>
                )}
                <span id={`cupom-${i}`} className="font-display font-extrabold text-[1.35rem] tracking-[0.04em] break-all">{c.codigo}</span>
                {c.href && (
                  <a href={c.href} {...externo} onClick={aoClicar} className="text-[12.5px] font-semibold underline underline-offset-2 self-start">Ir pra loja</a>
                )}
              </div>
              <button type="button" onClick={(e) => void copiar(c.codigo, e.currentTarget.parentElement?.querySelector(`#cupom-${i}`) as HTMLElement | null)}
                className="min-h-[44px] px-4 rounded-[14px] text-white font-bold text-[14px] transition-colors"
                style={{ backgroundColor: ok ? "#1F8A4C" : TINTA }} aria-live="polite">
                {ok ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" aria-hidden />Copiado</span> : "Copiar"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── MÍDIA KIT ── */
export function SecaoMidiaKit({ d, marca, social, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; social: SocialPublico | null; aoClicar?: () => void;
}) {
  const { barras, doInstagram } = publicoDoKit(d, social);
  const numeros = numerosDoKit(d, social);
  const formatos = lerFormatos(d);
  const marcas = lerMarcas(d);
  const pdf = pdfDoKit(txt(d, "pdf"));
  const [ativo, setAtivo] = useState(0);
  const atual = formatos[Math.min(ativo, formatos.length - 1)];
  const atualizado = doInstagram || (d.auto === true && social?.conectado) ? mesAno(social?.atualizado_em ?? null) : "";
  if (!barras.length && !numeros.length && !formatos.length && !marcas.length && !pdf) return null;

  return (
    <section id="midiakit" className="mt-10 px-[18px] pt-8 pb-9 cq-md:py-14 scroll-mt-[52px]" style={{ backgroundColor: TINTA, color: "#fff" }}>
      <div className="mx-auto max-w-3xl flex flex-col gap-[18px]">
        {txt(d, "rotulo").trim() && (
          <span className="self-start bg-[#D9CCFF] text-[#1A1A1A] text-[11px] font-extrabold tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full">{txt(d, "rotulo")}</span>
        )}
        {(barras.length > 0 || numeros.length > 0) && (
          <>
            <h2 className="font-display font-extrabold text-[2rem] leading-none">{txt(d, "titulo") || "Quem me assiste"}</h2>
            {barras.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {barras.map((b, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]"><span>{b.rotulo}</span><Contador texto={`${b.pct}%`} className="font-bold" /></div>
                    <BarraQueEnche pct={b.pct} cor={marca.cor} trilho="#333" atraso={i * 120} />
                  </div>
                ))}
              </div>
            )}
            {numeros.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {numeros.map((n, i) => (
                  <div key={i} className="bg-[#262626] rounded-2xl p-3.5">
                    <Contador texto={n.valor} className="block font-display font-extrabold text-[1.5rem]" />
                    <div className="text-[12px] text-[#B5ADA9]">{n.rotulo}</div>
                  </div>
                ))}
              </div>
            )}
            {atualizado && <span className="text-[11.5px] text-[#B5ADA9]">Números do Instagram, atualizados em {atualizado}.</span>}
          </>
        )}

        {formatos.length > 0 && atual && (
          <>
            <h3 className="font-display font-extrabold text-[1.5rem] mt-2.5">Formatos</h3>
            {formatos.length > 1 && (
              <div className="flex gap-1.5" role="tablist" aria-label="Formatos">
                {formatos.map((f, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === ativo} onClick={() => setAtivo(i)}
                    className={cn("flex-1 min-h-[42px] rounded-full border-[1.5px] border-white font-bold text-[14px] px-2 truncate",
                      i === ativo ? "bg-white text-[#1A1A1A]" : "bg-transparent text-white")}>
                    {f.nome}
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white text-[#1A1A1A] rounded-[20px] p-[18px] flex flex-col gap-2.5" role="tabpanel">
              {formatos.length === 1 && <b className="text-[15px]">{atual.nome}</b>}
              {atual.inclui.map((i, n) => (
                <div key={n} className="flex gap-2 text-[14.5px]">
                  <Check className="h-4 w-4 shrink-0 mt-[3px]" style={{ color: marca.cor }} strokeWidth={3} aria-hidden /><span>{i}</span>
                </div>
              ))}
              {atual.preco && (
                <div className="border-t border-[#EEE] pt-3 flex justify-between items-baseline">
                  <span className="text-[13px]" style={{ color: CINZA }}>a partir de</span>
                  <span className="font-display font-extrabold text-[1.5rem]">R$ {atual.preco}</span>
                </div>
              )}
            </div>
          </>
        )}

        {marcas.length > 0 && (
          <>
            <h3 className="font-display font-extrabold text-[1.5rem] mt-2.5">Já trabalhei com</h3>
            <div className="grid grid-cols-3 gap-2">
              {marcas.map((m, i) => (
                <span key={i} className="border border-[#3A3A3A] rounded-[14px] min-h-[56px] px-1.5 py-2 grid place-items-center text-center font-bold text-[13px] text-[#B5ADA9]">
                  {m.logo ? <img src={m.logo} alt={m.nome || "Marca"} loading="lazy" className="max-h-9 max-w-full object-contain" /> : m.nome}
                </span>
              ))}
            </div>
          </>
        )}

        {pdf && (
          <a href={pdf} {...externo} download onClick={aoClicar}
            className="mt-1.5 flex justify-center items-center gap-2 min-h-[52px] rounded-2xl font-bold text-[15px]"
            style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
            <Download className="h-4 w-4" aria-hidden /> {txt(d, "botaoPdf") || "Baixar mídia kit em PDF"}
          </a>
        )}
      </div>
    </section>
  );
}
