import { useId, useState } from "react";
import { ArrowRight, Check, Minus, Plus, Quote } from "lucide-react";
import { alvoDoLink, linkDoBotao, lista, txt, type DadosBloco } from "@/lib/bioBlocks";
import {
  destinoDoBotao, destinoDoServico, lerEtapas, lerPraQuem, lerServicos, numerosDaCapa, tituloComDestaque,
} from "@/lib/bioConsultoria";
import { Contador } from "@/components/bio/Movimento";
import { Rotulo, Secao, estiloDoFundo, type MarcaSite } from "@/components/bio/SecaoSite";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SEÇÕES DO MODELO CONSULTORIA (22/10/2026)
   Desenho aprovado no mockup "Consultoria e serviços (editorial)".
   ═══════════════════════════════════════════════════════════════════════════ */

const TINTA = "#1E2A24";
const APOIO = "#45524B";

/* ── CAPA EDITORIAL ──
   Texto grande primeiro, foto recortada ao lado com dois números de prova. */
export function CapaEditorial({ d, marca, aoClicar }: { d: DadosBloco; marca: MarcaSite; aoClicar?: () => void }) {
  const titulo = txt(d, "titulo").trim();
  if (!titulo) return null;
  const img = txt(d, "imagem");
  const numeros = numerosDaCapa(d);
  const selo = txt(d, "selo").trim();
  const b1 = txt(d, "botao1").trim(), u1 = linkDoBotao(txt(d, "url1"));
  const b2 = txt(d, "botao2").trim(), u2 = linkDoBotao(txt(d, "url2"));
  const f = estiloDoFundo(txt(d, "fundo", "creme"), marca);

  const ladoDaFoto = (numeros.length > 0 || selo) && (
    <div className="flex flex-col justify-end gap-3.5 pb-1.5">
      {numeros.map((n, i) => (
        <div key={i} className="pt-2.5" style={{ borderTop: `1px solid ${f.escuro ? "rgba(255,255,255,.4)" : TINTA}` }}>
          <Contador texto={n.valor} className="block font-display text-[1.9rem] cq-md:text-[2.3rem] leading-none" />
          {n.rotulo && <span className="block text-[12px] mt-1 opacity-70">{n.rotulo}</span>}
        </div>
      ))}
      {selo && (
        <span className="self-start text-[11px] font-semibold px-2.5 py-1.5 rounded-full"
          style={{ backgroundColor: `${marca.cor}1F`, color: f.escuro ? undefined : marca.cor }}>{selo}</span>
      )}
    </div>
  );

  return (
    <section id="topo" className={cn("px-5 pt-9 pb-8 cq-md:py-20 scroll-mt-[52px]", f.classe)} style={f.estilo}>
      <div className="mx-auto max-w-5xl grid cq-md:grid-cols-[1.1fr_.9fr] gap-6 cq-md:gap-12 items-end">
        <div className="flex flex-col gap-4">
          {txt(d, "etiqueta").trim() && (
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: f.escuro ? undefined : marca.cor }}>
              {txt(d, "etiqueta")}
            </span>
          )}
          <h1 className="font-display text-[2.35rem] cq-md:text-[3.4rem] leading-[1.04] tracking-[-0.01em] [text-wrap:balance]">
            {tituloComDestaque(titulo, txt(d, "destaque")).map((p, i) => p.marcado
              ? <em key={i} className="italic" style={{ color: f.escuro ? undefined : marca.cor }}>{p.texto}</em>
              : <span key={i}>{p.texto}</span>)}
          </h1>
          {txt(d, "frase").trim() && <p className="text-[16px] cq-md:text-[18px] leading-[1.55] opacity-80 max-w-[52ch]">{txt(d, "frase")}</p>}
          {((b1 && u1) || (b2 && u2)) && (
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-center mt-1">
              {b1 && u1 && (
                <a href={u1} {...alvoDoLink(u1)} onClick={aoClicar}
                  className="inline-flex items-center justify-center min-h-[48px] px-5 rounded-full font-semibold text-[15px] transition active:scale-[.98]"
                  style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{b1}</a>
              )}
              {b2 && u2 && (
                <a href={u2} {...alvoDoLink(u2)} onClick={aoClicar}
                  className="inline-flex items-center min-h-[44px] font-semibold text-[15px] underline underline-offset-4"
                  style={{ color: f.escuro ? undefined : marca.cor }}>{b2}</a>
              )}
            </div>
          )}
        </div>
        {img ? (
          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
            <img src={img} alt="" loading="eager"
              className="w-full h-[250px] cq-md:h-[380px] object-cover rounded-[4px_4px_120px_4px]" />
            {ladoDaFoto || <span />}
          </div>
        ) : ladoDaFoto ? <div className="max-w-[320px]">{ladoDaFoto}</div> : null}
      </div>
    </section>
  );
}

/* ── É PRA VOCÊ SE ── */
export function SecaoPraQuem({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lerPraQuem(d);
  if (!itens.length) return null;
  return (
    <Secao fundo={txt(d, "fundo", "creme")} marca={marca} className="!py-4 cq-md:!py-8">
      <div className="rounded-[18px] bg-white text-[#1E2A24] px-5 py-6 cq-md:px-8 cq-md:py-8 flex flex-col gap-3 max-w-3xl">
        <h2 className="font-display text-[1.5rem] cq-md:text-[1.9rem] mb-1">{txt(d, "titulo") || "É pra você se..."}</h2>
        {itens.map((t, i) => (
          <div key={i} className="flex gap-2.5 items-start text-[15px] leading-[1.45]">
            <Check className="h-5 w-5 shrink-0 mt-[1px]" style={{ color: marca.cor }} strokeWidth={2.4} aria-hidden />
            <span>{t}</span>
          </div>
        ))}
      </div>
    </Secao>
  );
}

/* ── SERVIÇOS ──
   Cartão por serviço, com o que inclui e o preço. O destacado vai escuro. */
export function SecaoServicos({ d, marca, telefonePadrao, temChamada, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; telefonePadrao: string; temChamada: boolean; aoClicar?: () => void;
}) {
  const itens = lerServicos(d);
  if (!itens.length) return null;
  const fundo = txt(d, "fundo", "creme");
  const tel = txt(d, "telefone") || telefonePadrao;
  const botao = txt(d, "botao").trim() || "Quero esse";
  return (
    <Secao id="servicos" fundo={fundo} marca={marca}>
      <Rotulo cor={marca.cor} herda={fundo === "escuro" || fundo === "marca"}>{txt(d, "rotulo")}</Rotulo>
      {txt(d, "titulo").trim() && (
        <h2 className="font-display text-[1.9rem] cq-md:text-[2.5rem] leading-[1.08] [text-wrap:balance]">{txt(d, "titulo")}</h2>
      )}
      <div className="grid gap-3.5 cq-md:grid-cols-2 cq-lg:grid-cols-3 mt-5 items-start">
        {itens.map((s) => {
          const escuro = s.destaque;
          const href = destinoDoServico(s.nome, tel, temChamada);
          return (
            <article key={s.id} className="rounded-[18px] px-5 py-6 flex flex-col gap-3 border"
              style={{ backgroundColor: escuro ? TINTA : "#FFFFFF", color: escuro ? "#F6F3EE" : TINTA, borderColor: escuro ? TINTA : "#E4DED3" }}>
              {s.destaque && (
                <span className="self-start text-[11px] font-bold tracking-[0.08em] px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: marca.cor, color: marca.corTexto }}>MAIS PROCURADO</span>
              )}
              <div className="flex justify-between items-baseline gap-3">
                <h3 className="font-display text-[1.5rem] leading-tight">{s.nome}</h3>
                {s.duracao && <span className="text-[12px] opacity-75 whitespace-nowrap">{s.duracao}</span>}
              </div>
              {s.resumo && <p className="text-[14px] leading-[1.5] opacity-85">{s.resumo}</p>}
              {s.inclui.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  {s.inclui.map((i, n) => (
                    <li key={n} className="flex gap-2"><span aria-hidden>·</span><span>{i}</span></li>
                  ))}
                </ul>
              )}
              <div className="flex justify-between items-center gap-3 pt-3.5 mt-0.5"
                style={{ borderTop: `1px solid ${escuro ? "#3A4842" : "#E4DED3"}` }}>
                {s.preco
                  ? <span className="text-[13px]">a partir de <b className="font-display font-normal text-[1.35rem]">R$ {s.preco}</b></span>
                  : <span />}
                <a href={href} {...alvoDoLink(href)} onClick={aoClicar}
                  className="inline-flex items-center gap-1 min-h-[44px] font-semibold text-[14px] underline underline-offset-4">
                  {botao}
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </Secao>
  );
}

/* ── COMO FUNCIONA ── */
export function SecaoEtapas({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lerEtapas(d);
  if (!itens.length) return null;
  const fundo = txt(d, "fundo", "creme");
  const escuro = fundo === "escuro" || fundo === "marca";
  return (
    <Secao fundo={fundo} marca={marca}>
      <Rotulo cor={marca.cor} herda={escuro}>{txt(d, "rotulo")}</Rotulo>
      {txt(d, "titulo").trim() && <h2 className="font-display text-[1.7rem] cq-md:text-[2.3rem] leading-[1.1] mb-2">{txt(d, "titulo")}</h2>}
      <ol className="grid gap-5 cq-md:grid-cols-3 mt-4">
        {itens.map((e, i) => (
          <li key={i} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
            <span className="font-display text-[2.75rem] leading-[0.9]" style={{ color: escuro ? undefined : marca.cor }} aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="pt-2.5" style={{ borderTop: `1px solid ${escuro ? "rgba(255,255,255,.3)" : "#CFC7B9"}` }}>
              <h3 className="font-bold text-[17px] mb-1">{e.titulo}</h3>
              {e.texto && <p className="text-[14px] leading-[1.5] opacity-80">{e.texto}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

/* ── DEPOIMENTO EM DESTAQUE ──
   Um depoimento grande na cor da marca. Os outros, se houver, vêm menores. */
export function DepoimentoGrande({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lista<{ texto?: string; autor?: string }>(d, "itens").filter((i) => (i?.texto ?? "").trim());
  if (!itens.length) return null;
  const [primeiro, ...resto] = itens;
  const inicial = (primeiro.autor ?? "").trim().slice(0, 1).toUpperCase();
  return (
    <section id="depoimentos" className="px-6 py-10 cq-md:py-16 scroll-mt-[52px]" style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
      <div className="mx-auto max-w-3xl flex flex-col gap-5">
        <Quote className="h-8 w-8 opacity-70" aria-hidden />
        <blockquote className="font-display text-[1.55rem] cq-md:text-[2.1rem] leading-[1.22]">{primeiro.texto}</blockquote>
        {primeiro.autor && (
          <div className="flex items-center gap-3">
            {inicial && <span className="w-10 h-10 rounded-full grid place-items-center font-bold bg-white/15" aria-hidden>{inicial}</span>}
            <span className="text-[14px] font-semibold">{primeiro.autor}</span>
          </div>
        )}
        {resto.length > 0 && (
          <div className="grid gap-3 cq-md:grid-cols-2 mt-3">
            {resto.map((i, n) => (
              <figure key={n} className="rounded-2xl bg-white/10 p-4">
                <blockquote className="text-[14px] leading-[1.55]">{i.texto}</blockquote>
                {i.autor && <figcaption className="text-[12.5px] font-semibold mt-2 opacity-80">{i.autor}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── PERGUNTAS QUE ABREM E FECHAM ──
   A primeira vem aberta: mostra que dá pra abrir sem precisar explicar. */
export function SecaoPerguntas({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lista<{ p?: string; r?: string }>(d, "itens")
    .map((i) => ({ p: String(i?.p ?? "").trim(), r: String(i?.r ?? "").trim() }))
    // Pergunta sem resposta não vai pro ar: abrir e achar vazio é pior que não ter.
    .filter((i) => i.p && i.r);
  const [aberta, setAberta] = useState(0);
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!itens.length) return null;
  const fundo = txt(d, "fundo", "claro");
  const escuro = fundo === "escuro" || fundo === "marca";
  return (
    <Secao id="perguntas" fundo={fundo} marca={marca}>
      <div className="max-w-3xl">
        <Rotulo cor={marca.cor} herda={escuro}>{txt(d, "titulo") || "Perguntas frequentes"}</Rotulo>
        <div className="mt-2">
          {itens.map((i, n) => {
            const aqui = aberta === n;
            return (
              <div key={n} className="border-b" style={{ borderColor: escuro ? "rgba(255,255,255,.2)" : "#DDD5C8" }}>
                <h3>
                  <button type="button" onClick={() => setAberta(aqui ? -1 : n)} aria-expanded={aqui} aria-controls={`${base}-${n}`}
                    className="w-full min-h-[56px] flex justify-between items-center gap-3 py-3.5 text-left text-[16px] font-semibold">
                    <span>{i.p}</span>
                    {aqui ? <Minus className="h-5 w-5 shrink-0" style={{ color: escuro ? undefined : marca.cor }} aria-hidden />
                      : <Plus className="h-5 w-5 shrink-0" style={{ color: escuro ? undefined : marca.cor }} aria-hidden />}
                  </button>
                </h3>
                <div id={`${base}-${n}`} hidden={!aqui}>
                  {i.r && <p className="pb-4 text-[14.5px] leading-[1.55] opacity-80 whitespace-pre-line">{i.r}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Secao>
  );
}

/* ── CHAMADA FINAL ── */
export function SecaoChamada({ d, marca, telefonePadrao, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; telefonePadrao: string; aoClicar?: () => void;
}) {
  const titulo = txt(d, "titulo").trim();
  const botao = txt(d, "botao").trim();
  const href = destinoDoBotao(d, telefonePadrao);
  if (!titulo) return null;
  return (
    <Secao id="agendar" fundo={txt(d, "fundo", "creme")} marca={marca}>
      <div className="mx-auto max-w-2xl rounded-[22px] bg-white text-[#1E2A24] border border-[#E4DED3] px-5 py-7 cq-md:px-10 cq-md:py-10 flex flex-col gap-3.5">
        <h2 className="font-display text-[1.85rem] cq-md:text-[2.4rem] leading-[1.08] [text-wrap:balance]">{titulo}</h2>
        {txt(d, "texto").trim() && <p className="text-[15px] leading-[1.5]" style={{ color: APOIO }}>{txt(d, "texto")}</p>}
        {botao && href && (
          <a href={href} {...alvoDoLink(href)} onClick={aoClicar}
            className="flex items-center justify-center gap-2 min-h-[52px] rounded-full font-semibold text-[15px] mt-1 transition active:scale-[.99]"
            style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
            {botao} <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        )}
        {txt(d, "nota").trim() && <span className="text-[12.5px] text-center" style={{ color: APOIO }}>{txt(d, "nota")}</span>}
      </div>
    </Secao>
  );
}
