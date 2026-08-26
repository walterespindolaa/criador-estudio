import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { BlocoPublico, type VisualBio } from "@/components/bio/BlocoPublico";
import {
  lista, linkWhatsapp, precoVisivel, txt, type DadosBloco,
} from "@/lib/bioBlocks";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O MODO SITE

   Aqui os blocos deixam de ser botões numa coluna e viram SEÇÕES de largura
   cheia, com menu no topo e rodapé embaixo.

   O CELULAR MANDA, e não o contrário. A regra que segui em cada seção: no
   telefone tudo vira uma coluna, sempre. Nada de duas colunas espremidas, nada
   de texto ao lado de imagem em 390px, nada de grade de três. O que muda em
   tela grande é a quantidade de coisa por linha; o que nunca muda é a ORDEM em
   que a pessoa lê. Menu vira gaveta, grade de produtos vira lista de um por
   linha, e o rodapé empilha.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ItemLite = {
  id: string; tipo: string; slug: string; titulo: string;
  resumo: string | null; capa: string | null;
  preco: number | null; preco_texto: string | null; publicado_em: string;
};

export type BlocoLite = { id: string; kind: string; data: DadosBloco; position: number };

export type MarcaSite = {
  nome: string;
  logo?: string | null;
  /** Cor de destaque da marca. Vem do brandbook do cliente. */
  cor: string;
  corTexto: string;
};

const dataBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/* ── Menu do topo ── */
function Topo({ marca, secoes, aoIr }: { marca: MarcaSite; secoes: { id: string; nome: string }[]; aoIr: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  // Fecha a gaveta ao trocar de seção, senão ela cobre o que a pessoa acabou de
  // pedir pra ver.
  const ir = (id: string) => { setAberto(false); aoIr(id); };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/[0.07]">
      <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between gap-3">
        <button type="button" onClick={() => ir("topo")} className="flex items-center gap-2 min-w-0">
          {marca.logo
            ? <img src={marca.logo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            : <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0"
                style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{marca.nome.slice(0, 1).toUpperCase()}</span>}
          <span className="font-display font-bold text-[15px] truncate">{marca.nome}</span>
        </button>

        <nav className="hidden md:flex items-center gap-6">
          {secoes.map((s) => (
            <button key={s.id} type="button" onClick={() => ir(s.id)}
              className="text-[13.5px] text-gray-600 hover:text-gray-900 transition-colors">{s.nome}</button>
          ))}
        </nav>

        {secoes.length > 0 && (
          <button type="button" aria-label={aberto ? "Fechar menu" : "Abrir menu"} aria-expanded={aberto}
            onClick={() => setAberto((v) => !v)}
            className="md:hidden w-11 h-11 -mr-2 grid place-items-center text-gray-800">
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Gaveta do celular: cada item com 48px de altura, dedo cabe. */}
      {aberto && (
        <nav className="md:hidden border-t border-black/[0.07] bg-white">
          {secoes.map((s) => (
            <button key={s.id} type="button" onClick={() => ir(s.id)}
              className="w-full text-left px-5 h-12 flex items-center text-[15px] text-gray-800 border-b border-black/[0.05] last:border-0">
              {s.nome}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

function Rotulo({ children, cor }: { children: React.ReactNode; cor: string }) {
  if (!children) return null;
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.13em] mb-1" style={{ color: cor }}>{children}</p>
  );
}

function Secao({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("px-5 py-10 md:py-14 border-t border-black/[0.06]", className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

/* ── As seções ── */
function SecaoCapa({ d, marca, aoClicar }: { d: DadosBloco; marca: MarcaSite; aoClicar?: () => void }) {
  const img = txt(d, "imagem");
  const b1 = txt(d, "botao1"), u1 = txt(d, "url1");
  const b2 = txt(d, "botao2"), u2 = txt(d, "url2");
  return (
    <section id="topo" className="px-5 py-10 md:py-16" style={{ background: `linear-gradient(160deg, ${marca.cor}14, transparent)` }}>
      {/* Uma coluna no celular, duas só a partir de 768px. A imagem vem DEPOIS
          do texto no telefone, pra a pessoa ler a proposta antes de rolar. */}
      <div className="mx-auto max-w-5xl grid md:grid-cols-[1.1fr_.9fr] gap-7 md:gap-10 items-center">
        <div>
          <h1 className="font-display font-extrabold text-[1.75rem] md:text-[2.6rem] leading-[1.12] text-gray-900 [text-wrap:balance]">
            {txt(d, "titulo")}
          </h1>
          {txt(d, "frase") && (
            <p className="text-[15px] md:text-base text-gray-600 leading-relaxed mt-3 whitespace-pre-line">{txt(d, "frase")}</p>
          )}
          {(b1 || b2) && (
            <div className="flex flex-col sm:flex-row gap-2.5 mt-6">
              {b1 && u1 && (
                <a href={u1} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                  className="rounded-full px-6 h-12 inline-flex items-center justify-center font-display font-bold text-[15px] transition active:scale-[.98]"
                  style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{b1}</a>
              )}
              {b2 && u2 && (
                <a href={u2} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                  className="rounded-full px-6 h-12 inline-flex items-center justify-center font-display font-bold text-[15px] border-2 border-gray-900 text-gray-900 transition active:scale-[.98]">{b2}</a>
              )}
            </div>
          )}
        </div>
        {img && (
          <img src={img} alt="" className="w-full rounded-3xl object-cover aspect-[4/3] md:aspect-square shadow-lg" />
        )}
      </div>
    </section>
  );
}

function SecaoSobre({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const img = txt(d, "imagem");
  return (
    <Secao id="sobre">
      <Rotulo cor={marca.cor}>{txt(d, "rotulo")}</Rotulo>
      {txt(d, "titulo") && <h2 className="font-display font-bold text-[1.4rem] md:text-2xl text-gray-900">{txt(d, "titulo")}</h2>}
      <div className={cn("mt-5 gap-6", img ? "grid md:grid-cols-[220px_1fr] items-start" : "")}>
        {img && <img src={img} alt="" className="w-full max-w-[220px] rounded-2xl object-cover aspect-square" />}
        <p className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-line">{txt(d, "texto")}</p>
      </div>
    </Secao>
  );
}

function SecaoProdutos({ d, marca, itens, aoAbrir, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; itens: ItemLite[]; aoAbrir: (slug: string) => void; aoClicar?: () => void;
}) {
  if (itens.length === 0) return null;
  return (
    <Secao id="servicos">
      <Rotulo cor={marca.cor}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-bold text-[1.4rem] md:text-2xl text-gray-900">{txt(d, "titulo") || "Serviços"}</h2>
      {txt(d, "subtitulo") && <p className="text-[14px] text-gray-600 mt-1.5">{txt(d, "subtitulo")}</p>}
      {/* Um por linha no celular. Duas colunas em 390px viraria card de 170px
          com foto de 90px, que não vende nada. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {itens.map((i) => {
          const preco = precoVisivel(i.preco, i.preco_texto);
          return (
            <button key={i.id} type="button" onClick={() => { aoClicar?.(); aoAbrir(i.slug); }}
              className="text-left rounded-2xl border border-black/[0.08] bg-white overflow-hidden shadow-sm hover:shadow-md transition active:scale-[.99]">
              {i.capa && <img src={i.capa} alt="" loading="lazy" className="w-full aspect-[16/10] object-cover" />}
              <span className="block p-4">
                <span className="block font-display font-bold text-[15px] text-gray-900">{i.titulo}</span>
                {i.resumo && <span className="block text-[13px] text-gray-600 leading-snug mt-1">{i.resumo}</span>}
                <span className="flex items-center justify-between gap-2 mt-3">
                  <span className="font-display font-bold text-[17px] text-gray-900">{preco || "Sob consulta"}</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
                    ver mais
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Secao>
  );
}

function SecaoBlog({ d, marca, itens, aoAbrir, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; itens: ItemLite[]; aoAbrir: (slug: string) => void; aoClicar?: () => void;
}) {
  if (itens.length === 0) return null;
  const quantos = typeof d.quantos === "number" ? d.quantos : 6;
  return (
    <Secao id="blog">
      <Rotulo cor={marca.cor}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-bold text-[1.4rem] md:text-2xl text-gray-900">{txt(d, "titulo") || "Blog"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {itens.slice(0, quantos).map((i) => (
          <button key={i.id} type="button" onClick={() => { aoClicar?.(); aoAbrir(i.slug); }}
            className="text-left rounded-2xl border border-black/[0.08] bg-white overflow-hidden shadow-sm hover:shadow-md transition active:scale-[.99]">
            {i.capa && <img src={i.capa} alt="" loading="lazy" className="w-full aspect-[16/9] object-cover" />}
            <span className="block p-4">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-gray-400">{dataBR(i.publicado_em)}</span>
              <span className="block font-display font-bold text-[15px] text-gray-900 leading-snug mt-1">{i.titulo}</span>
              {i.resumo && <span className="block text-[13px] text-gray-600 leading-snug mt-1.5">{i.resumo}</span>}
            </span>
          </button>
        ))}
      </div>
    </Secao>
  );
}

function SecaoDepoimentos({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lista<{ texto?: string; autor?: string }>(d, "itens").filter((i) => (i.texto || "").trim());
  if (itens.length === 0) return null;
  return (
    <Secao id="depoimentos" className="bg-black/[0.02]">
      <Rotulo cor={marca.cor}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-bold text-[1.4rem] md:text-2xl text-gray-900">{txt(d, "titulo") || "Depoimentos"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {itens.map((i, n) => (
          <figure key={n} className="rounded-2xl border border-black/[0.08] bg-white p-4">
            <blockquote className="text-[14px] text-gray-700 leading-relaxed">“{i.texto}”</blockquote>
            {i.autor && <figcaption className="font-display font-bold text-[13px] text-gray-900 mt-2.5">{i.autor}</figcaption>}
          </figure>
        ))}
      </div>
    </Secao>
  );
}

function Rodape({ d, marca, aoClicar }: { d: DadosBloco; marca: MarcaSite; aoClicar?: () => void }) {
  const tel = txt(d, "telefone"), mail = txt(d, "email"), end = txt(d, "endereco"), ig = txt(d, "instagram");
  return (
    <footer id="contato" className="px-5 py-9 mt-2" style={{ backgroundColor: "#101014", color: "#F5F3E7" }}>
      <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="font-display font-bold text-[15px]">{txt(d, "titulo") || marca.nome}</p>
          {txt(d, "assinatura") && <p className="text-[13px] opacity-75 mt-1 whitespace-pre-line">{txt(d, "assinatura")}</p>}
        </div>
        {(tel || mail) && (
          <div className="space-y-2">
            <p className="font-display font-bold text-[13px] opacity-90">Fale comigo</p>
            {tel && (
              <a href={linkWhatsapp(tel)} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                className="flex items-center gap-2 text-[13.5px] opacity-85 min-h-[44px]">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {tel}
              </a>
            )}
            {mail && (
              <a href={`mailto:${mail}`} onClick={aoClicar}
                className="flex items-center gap-2 text-[13.5px] opacity-85 min-h-[44px] break-all">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {mail}
              </a>
            )}
          </div>
        )}
        {(end || ig) && (
          <div className="space-y-2">
            {end && (
              <p className="flex items-start gap-2 text-[13.5px] opacity-85">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span className="whitespace-pre-line">{end}</span>
              </p>
            )}
            {ig && (
              <a href={`https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                className="text-[13.5px] opacity-85 inline-flex min-h-[44px] items-center">@{ig.replace(/^@/, "")}</a>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}

/* ── A HOME DO SITE ── */
export function SiteBio({
  blocos, marca, produtos, posts, visual, aoAbrirProduto, aoAbrirPost, onClique, capturaDoBloco,
}: {
  blocos: BlocoLite[];
  marca: MarcaSite;
  produtos: ItemLite[];
  posts: ItemLite[];
  visual: VisualBio;
  aoAbrirProduto: (slug: string) => void;
  aoAbrirPost: (slug: string) => void;
  onClique?: (blocoId: string) => void;
  capturaDoBloco?: (b: BlocoLite) => React.ReactNode;
}) {
  // O menu lista só as seções que existem de verdade na página montada.
  const secoes = useMemo(() => {
    const m: { id: string; nome: string }[] = [];
    for (const b of blocos) {
      if (b.kind === "sobre") m.push({ id: "sobre", nome: "Sobre" });
      if (b.kind === "produtos" && produtos.length > 0) m.push({ id: "servicos", nome: txt(b.data, "titulo") || "Serviços" });
      if (b.kind === "blog" && posts.length > 0) m.push({ id: "blog", nome: "Blog" });
      if (b.kind === "depoimentos") m.push({ id: "depoimentos", nome: "Depoimentos" });
      if (b.kind === "contato") m.push({ id: "contato", nome: "Contato" });
    }
    return m;
  }, [blocos, produtos.length, posts.length]);

  const irPara = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      <Topo marca={marca} secoes={secoes} aoIr={irPara} />
      {blocos.map((b) => {
        switch (b.kind) {
          case "capa": return <SecaoCapa key={b.id} d={b.data} marca={marca} aoClicar={() => onClique?.(b.id)} />;
          case "sobre": return <SecaoSobre key={b.id} d={b.data} marca={marca} />;
          case "produtos": return <SecaoProdutos key={b.id} d={b.data} marca={marca} itens={produtos} aoAbrir={aoAbrirProduto} aoClicar={() => onClique?.(b.id)} />;
          case "blog": return <SecaoBlog key={b.id} d={b.data} marca={marca} itens={posts} aoAbrir={aoAbrirPost} aoClicar={() => onClique?.(b.id)} />;
          case "depoimentos": return <SecaoDepoimentos key={b.id} d={b.data} marca={marca} />;
          case "contato": return <Rodape key={b.id} d={b.data} marca={marca} aoClicar={() => onClique?.(b.id)} />;
          default:
            // Os blocos comuns (vídeo, FAQ, mapa, captura) também servem no
            // Site: entram centralizados numa coluna de leitura confortável.
            return (
              <Secao key={b.id}>
                <div className="mx-auto max-w-[620px]">
                  <BlocoPublico kind={b.kind} data={b.data} visual={visual}
                    onClique={() => onClique?.(b.id)} captura={capturaDoBloco?.(b)} />
                </div>
              </Secao>
            );
        }
      })}
    </div>
  );
}

/* ── A PÁGINA DE UM ITEM ── */
export function PaginaItem({
  item, marca, voltarRotulo, aoVoltar, whatsapp,
}: {
  item: {
    tipo: string; slug: string; titulo: string; resumo: string | null; capa: string | null;
    preco: number | null; preco_texto: string | null; conteudo: string | null;
    galeria: string[]; cta_texto: string | null; cta_url: string | null; publicado_em: string;
  };
  marca: MarcaSite;
  voltarRotulo: string;
  aoVoltar: () => void;
  whatsapp?: string;
}) {
  // Abrir uma página interna e cair no meio dela é desorientador.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [item.slug]);

  const preco = precoVisivel(item.preco, item.preco_texto);
  const ehPost = item.tipo === "post";
  const cta = item.cta_url || (whatsapp ? linkWhatsapp(whatsapp, `Oi! Vi "${item.titulo}" no site e quero saber mais.`) : "");

  return (
    <div className="min-h-[100dvh] bg-white">
      <Topo marca={marca} secoes={[]} aoIr={aoVoltar} />
      {item.capa && <img src={item.capa} alt="" className="w-full aspect-[16/9] md:aspect-[21/9] object-cover" />}

      <article className="px-5 py-8 md:py-12">
        <div className="mx-auto max-w-[680px]">
          <button type="button" onClick={aoVoltar}
            className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 min-h-[44px]">
            <ArrowLeft className="h-3.5 w-3.5" /> {voltarRotulo}
          </button>

          {ehPost && (
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] mt-2" style={{ color: marca.cor }}>
              {dataBR(item.publicado_em)}
            </p>
          )}
          <h1 className="font-display font-extrabold text-[1.6rem] md:text-[2.1rem] leading-[1.15] text-gray-900 mt-1.5 [text-wrap:balance]">
            {item.titulo}
          </h1>
          {!ehPost && preco && (
            <p className="font-display font-bold text-[1.4rem] mt-1.5" style={{ color: marca.cor }}>{preco}</p>
          )}
          {item.resumo && <p className="text-[15px] text-gray-600 leading-relaxed mt-3">{item.resumo}</p>}

          {item.conteudo && (
            // whitespace-pre-line em vez de HTML: o que a pessoa digitou é o
            // que aparece, sem risco de colar markup estranho na página.
            <div className="text-[15.5px] leading-[1.75] text-gray-700 mt-5 whitespace-pre-line">{item.conteudo}</div>
          )}

          {item.galeria.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
              {item.galeria.map((g, i) => (
                <img key={i} src={g} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          )}

          {cta && (
            <a href={cta} target="_blank" rel="noopener noreferrer"
              className="mt-8 w-full rounded-2xl h-14 flex items-center justify-center font-display font-bold text-[15px] transition active:scale-[.99]"
              style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
              {item.cta_texto || (ehPost ? "Quero conversar sobre isso" : "Quero saber mais")}
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
