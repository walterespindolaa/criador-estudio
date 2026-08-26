import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Mail, MapPin, Menu, Phone, Quote, X } from "lucide-react";
import { BlocoPublico, type VisualBio } from "@/components/bio/BlocoPublico";
import {
  faltaNoBloco, lista, linkWhatsapp, precoVisivel, txt, type DadosBloco,
} from "@/lib/bioBlocks";
import { TextoRico } from "@/lib/textoRico";
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

   E "tela grande" aqui é o ESPAÇO DISPONÍVEL, não a janela: cq-sm, cq-md e
   cq-lg no lugar de sm, md e lg. Com sm/md/lg, a prévia do celular no editor
   (uma moldura de 300px num monitor de 1440px) montava o menu de computador e
   a grade de três colunas dentro da moldura, cortando tudo. Quem montava a
   página via um desenho que nenhum visitante ia ver.
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
    /* Branco sólido, não translúcido: com backdrop-blur o texto da seção
       passava por trás e a barra parecia estar em cima do conteúdo. */
    <header className="sticky top-0 z-30 bg-white border-b border-black/[0.07]">
      <div className="mx-auto max-w-5xl px-4 cq-md:px-5 h-[52px] flex items-center justify-between gap-2">
        <button type="button" onClick={() => ir("topo")} className="flex items-center gap-2 min-w-0 flex-1">
          {marca.logo
            ? <img src={marca.logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            : <span className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold shrink-0"
                style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{marca.nome.slice(0, 1).toUpperCase()}</span>}
          <span className="font-display font-bold text-[14px] tracking-tight truncate">{marca.nome}</span>
        </button>

        <nav className="hidden cq-md:flex items-center gap-6 shrink-0">
          {secoes.map((s) => (
            <button key={s.id} type="button" onClick={() => ir(s.id)}
              className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">{s.nome}</button>
          ))}
        </nav>

        {secoes.length > 0 && (
          <button type="button" aria-label={aberto ? "Fechar menu" : "Abrir menu"} aria-expanded={aberto}
            onClick={() => setAberto((v) => !v)}
            className="cq-md:hidden w-11 h-11 -mr-2.5 shrink-0 grid place-items-center text-gray-800">
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Gaveta do celular: cada item com 48px de altura, dedo cabe. */}
      {aberto && (
        <nav className="cq-md:hidden border-t border-black/[0.07] bg-white">
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

function Rotulo({ children, cor, herda }: { children: React.ReactNode; cor: string; herda?: boolean }) {
  if (!children) return null;
  // Em fundo escuro ou da marca, a cor de destaque some. Aí o rótulo usa a
  // própria cor do texto da seção, só um pouco mais apagada.
  return (
    <p className={cn("text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1.5", herda && "opacity-70")}
      style={herda ? undefined : { color: cor }}>{children}</p>
  );
}

/* ── O FUNDO DE CADA SEÇÃO ──
   Uma página inteira branca cansa e some: tudo vira a mesma coisa e ninguém
   percebe onde um assunto acaba e o outro começa. Aqui cada seção escolhe o
   seu fundo, e a alternância é o que dá ritmo à rolagem.

   Fundo escuro troca a cor do texto junto, senão a seção some. */
export type FundoSecao = "claro" | "creme" | "escuro" | "marca";

function estiloDoFundo(fundo: string, marca: MarcaSite): { classe: string; estilo?: React.CSSProperties; escuro: boolean } {
  switch (fundo) {
    case "creme": return { classe: "bg-[#F7F5EF] text-gray-900", escuro: false };
    case "escuro": return { classe: "bg-[#101014] text-[#F5F3E7]", escuro: true };
    case "marca": return {
      classe: "",
      estilo: { backgroundColor: marca.cor, color: marca.corTexto },
      escuro: marca.corTexto.toLowerCase() !== "#1a1626",
    };
    default: return { classe: "bg-white text-gray-900", escuro: false };
  }
}

function Secao({ id, fundo, marca, className, children }: {
  id?: string; fundo?: string; marca: MarcaSite; className?: string; children: React.ReactNode;
}) {
  const f = estiloDoFundo(fundo ?? "claro", marca);
  return (
    <section id={id} style={f.estilo}
      className={cn("px-5 py-9 cq-md:py-16 scroll-mt-[52px]", f.classe, className)}>
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
    <section id="topo" className="px-5 pt-11 pb-12 cq-md:py-24 scroll-mt-[52px]" style={{ background: `linear-gradient(160deg, ${marca.cor}14, transparent)` }}>
      {/* Uma coluna no celular, duas só a partir de 768px. A imagem vem DEPOIS
          do texto no telefone, pra a pessoa ler a proposta antes de rolar. */}
      <div className="mx-auto max-w-5xl grid cq-md:grid-cols-[1.1fr_.9fr] gap-7 cq-md:gap-12 items-center">
        <div>
          {/* tracking apertado: título grande com espaçamento de corpo parece
              inchado, e é o primeiro sinal de página amadora. */}
          <h1 className="font-display font-extrabold text-[1.55rem] cq-md:text-[2.7rem] leading-[1.08] tracking-[-0.02em] text-gray-900 [text-wrap:balance]">
            {txt(d, "titulo")}
          </h1>
          {txt(d, "frase") && (
            <p className="text-[14.5px] cq-md:text-[17px] text-gray-600 leading-[1.55] mt-3.5 whitespace-pre-line [text-wrap:pretty]">{txt(d, "frase")}</p>
          )}
          {(b1 || b2) && (
            <div className="flex flex-col cq-sm:flex-row gap-2.5 mt-6">
              {b1 && u1 && (
                <a href={u1} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                  className="rounded-full px-6 h-12 inline-flex items-center justify-center font-display font-bold text-[14.5px] shadow-sm transition active:scale-[.98]"
                  style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{b1}</a>
              )}
              {b2 && u2 && (
                <a href={u2} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
                  className="rounded-full px-6 h-12 inline-flex items-center justify-center font-display font-bold text-[14.5px] border border-gray-900/25 text-gray-900 transition active:scale-[.98] hover:border-gray-900/50">{b2}</a>
              )}
            </div>
          )}
        </div>
        {img && (
          <img src={img} alt="" className="w-full rounded-3xl object-cover aspect-[4/3] cq-md:aspect-square shadow-lg" />
        )}
      </div>
    </section>
  );
}

function SecaoSobre({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const img = txt(d, "imagem");
  return (
    <Secao id="sobre" fundo={txt(d, "fundo", "claro")} marca={marca}>
      <Rotulo cor={marca.cor} herda={txt(d, "fundo") === "escuro" || txt(d, "fundo") === "marca"}>{txt(d, "rotulo")}</Rotulo>
      {txt(d, "titulo") && <h2 className="font-display font-extrabold text-[1.28rem] cq-md:text-[1.8rem] leading-[1.15] tracking-[-0.015em] [text-wrap:balance]">{txt(d, "titulo")}</h2>}
      <div className={cn("mt-4 gap-6 cq-md:gap-9", img ? "grid cq-md:grid-cols-[240px_1fr] items-start" : "")}>
        {img && <img src={img} alt="" className="w-full max-w-[240px] rounded-2xl object-cover aspect-square" />}
        {/* max-w de leitura: linha longa demais cansa e ninguém termina. */}
        <TextoRico texto={txt(d, "texto")} className="text-[14.5px] cq-md:text-[15.5px] leading-[1.68] opacity-85 max-w-[62ch]" />
      </div>
    </Secao>
  );
}


/* ── O CARD DE UM ITEM (serviço ou post) ──
   Card sem imagem é o que mais estraga uma página destas: o quadro fica só
   com um título solto e três quartos de vazio, e a página inteira parece
   inacabada. Aqui SEMPRE existe um topo visual: a foto quando tem, e um
   bloco na cor da marca com a inicial quando não tem.

   O "ver mais" era uma pílula preenchida. Num card estreito o texto quebrava
   em duas linhas dentro dela e virava uma bolha colorida no meio do preço.
   Agora é texto na cor da marca com uma seta, numa linha só, que é como
   Linktree, Stan e Beacons resolvem. */
function CapaDoItem({ src, titulo, marca, proporcao }: {
  src: string | null; titulo: string; marca: MarcaSite; proporcao: string;
}) {
  if (src) {
    return <img src={src} alt="" loading="lazy" className={cn("w-full object-cover", proporcao)} />;
  }
  return (
    <span className={cn("w-full grid place-items-center", proporcao)}
      style={{ background: `linear-gradient(140deg, ${marca.cor}26, ${marca.cor}08)` }}>
      <span className="font-display font-black text-[2.4rem] leading-none opacity-30" style={{ color: marca.cor }}>
        {(titulo || "?").slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

function VerMais({ marca, texto = "ver mais" }: { marca: MarcaSite; texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-display font-bold whitespace-nowrap shrink-0"
      style={{ color: marca.cor }}>
      {texto} <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );
}

function CartaoItem({ item, marca, proporcao, rodape, aoAbrir }: {
  item: ItemLite; marca: MarcaSite; proporcao: string;
  rodape: React.ReactNode; aoAbrir: () => void;
}) {
  return (
    <button type="button" onClick={aoAbrir}
      className="text-left rounded-2xl border border-black/[0.07] bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all duration-200 active:scale-[.99]">
      <CapaDoItem src={item.capa} titulo={item.titulo} marca={marca} proporcao={proporcao} />
      <span className="block p-3.5 cq-md:p-4">
        <span className="block font-display font-bold text-[14.5px] leading-[1.25] text-gray-900 [text-wrap:pretty]">{item.titulo}</span>
        {item.resumo && (
          <span className="block text-[12.5px] text-gray-500 leading-[1.45] mt-1.5 line-clamp-2">{item.resumo}</span>
        )}
        <span className="flex items-center justify-between gap-2 mt-3">{rodape}</span>
      </span>
    </button>
  );
}

function SecaoProdutos({ d, marca, itens, aoAbrir, aoClicar }: {
  d: DadosBloco; marca: MarcaSite; itens: ItemLite[]; aoAbrir: (slug: string) => void; aoClicar?: () => void;
}) {
  if (itens.length === 0) return null;
  return (
    <Secao id="servicos" fundo={txt(d, "fundo", "creme")} marca={marca}>
      <Rotulo cor={marca.cor} herda={txt(d, "fundo", "creme") === "escuro" || txt(d, "fundo") === "marca"}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-extrabold text-[1.28rem] cq-md:text-[1.8rem] leading-[1.15] tracking-[-0.015em] [text-wrap:balance]">{txt(d, "titulo") || "Serviços"}</h2>
      {txt(d, "subtitulo") && <p className="text-[13.5px] opacity-70 leading-[1.5] mt-2 max-w-[54ch]">{txt(d, "subtitulo")}</p>}
      {/* Um por linha no celular. Duas colunas em 390px viraria card de 170px
          com foto de 90px, que não vende nada. */}
      <div className="grid gap-3 cq-sm:grid-cols-2 cq-lg:grid-cols-3 mt-5">
        {itens.map((i) => (
          <CartaoItem key={i.id} item={i} marca={marca} proporcao="aspect-[16/10]"
            aoAbrir={() => { aoClicar?.(); aoAbrir(i.slug); }}
            rodape={<>
              <span className="font-display font-extrabold text-[15px] text-gray-900 truncate">
                {precoVisivel(i.preco, i.preco_texto) || "Sob consulta"}
              </span>
              <VerMais marca={marca} />
            </>} />
        ))}
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
    <Secao id="blog" fundo={txt(d, "fundo", "claro")} marca={marca}>
      <Rotulo cor={marca.cor} herda={txt(d, "fundo") === "escuro" || txt(d, "fundo") === "marca"}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-extrabold text-[1.28rem] cq-md:text-[1.8rem] leading-[1.15] tracking-[-0.015em] [text-wrap:balance]">{txt(d, "titulo") || "Blog"}</h2>
      <div className="grid gap-3 cq-sm:grid-cols-2 cq-lg:grid-cols-3 mt-5">
        {itens.slice(0, quantos).map((i) => (
          <CartaoItem key={i.id} item={i} marca={marca} proporcao="aspect-[16/9]"
            aoAbrir={() => { aoClicar?.(); aoAbrir(i.slug); }}
            rodape={<>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-400 truncate">
                {dataBR(i.publicado_em)}
              </span>
              <VerMais marca={marca} texto="ler" />
            </>} />
        ))}
      </div>
    </Secao>
  );
}

function SecaoDepoimentos({ d, marca }: { d: DadosBloco; marca: MarcaSite }) {
  const itens = lista<{ texto?: string; autor?: string }>(d, "itens").filter((i) => (i.texto || "").trim());
  if (itens.length === 0) return null;
  return (
    <Secao id="depoimentos" fundo={txt(d, "fundo", "creme")} marca={marca}>
      <Rotulo cor={marca.cor} herda={txt(d, "fundo", "creme") === "escuro" || txt(d, "fundo") === "marca"}>{txt(d, "rotulo")}</Rotulo>
      <h2 className="font-display font-extrabold text-[1.28rem] cq-md:text-[1.8rem] leading-[1.15] tracking-[-0.015em] [text-wrap:balance]">{txt(d, "titulo") || "Depoimentos"}</h2>
      <div className="grid gap-3 cq-sm:grid-cols-2 cq-lg:grid-cols-3 mt-5">
        {itens.map((i, n) => (
          <figure key={n} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Quote className="h-4 w-4 mb-2 opacity-40" style={{ color: marca.cor }} />
            <blockquote className="text-[13.5px] text-gray-700 leading-[1.6]">{i.texto}</blockquote>
            {i.autor && (
              <figcaption className="font-display font-bold text-[12.5px] text-gray-900 mt-3 pt-3 border-t border-black/[0.06]">
                {i.autor}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </Secao>
  );
}

function Rodape({ d, marca, aoClicar }: { d: DadosBloco; marca: MarcaSite; aoClicar?: () => void }) {
  const tel = txt(d, "telefone"), mail = txt(d, "email"), end = txt(d, "endereco"), ig = txt(d, "instagram");
  return (
    /* Sem mt: a margem abria uma faixa da cor da seção anterior entre ela e o
       rodapé, e o rodapé preto parecia um cartão solto no fim da página. */
    <footer id="contato" className="px-5 py-10 cq-md:py-14 scroll-mt-[52px]" style={{ backgroundColor: "#101014", color: "#F5F3E7" }}>
      <div className="mx-auto max-w-5xl grid gap-7 cq-sm:grid-cols-2 cq-lg:grid-cols-3">
        <div>
          <p className="font-display font-extrabold text-[15px] tracking-tight">{txt(d, "titulo") || marca.nome}</p>
          {txt(d, "assinatura") && <p className="text-[13px] opacity-70 leading-[1.55] mt-1.5 whitespace-pre-line">{txt(d, "assinatura")}</p>}
        </div>
        {(tel || mail) && (
          <div className="space-y-2">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-55">Fale comigo</p>
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
  alturaCheia,
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
  /** Na página pública o site ocupa a altura da tela, pra não sobrar fundo
   *  cinza embaixo numa página curta. Dentro da prévia isso viraria um vazio
   *  branco enorme depois da última seção, então lá vai desligado. */
  alturaCheia?: boolean;
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

  /* [container-type:inline-size] é o que faz cq-sm/cq-md/cq-lg funcionarem:
     a partir daqui, "grande" e "pequeno" passam a ser sobre a largura DESTA
     caixa, não sobre a largura do monitor. É por isso que a prévia de 300px
     no editor mostra a mesma página que o celular de verdade mostra. */
  return (
    <div className={cn("bg-white [container-type:inline-size]", alturaCheia !== false && "min-h-[100dvh]")}>
      <Topo marca={marca} secoes={secoes} aoIr={irPara} />
      {blocos.map((b) => {
        switch (b.kind) {
          case "capa": return <SecaoCapa key={b.id} d={b.data} marca={marca} aoClicar={() => onClique?.(b.id)} />;
          case "sobre": return <SecaoSobre key={b.id} d={b.data} marca={marca} />;
          case "produtos": return <SecaoProdutos key={b.id} d={b.data} marca={marca} itens={produtos} aoAbrir={aoAbrirProduto} aoClicar={() => onClique?.(b.id)} />;
          case "blog": return <SecaoBlog key={b.id} d={b.data} marca={marca} itens={posts} aoAbrir={aoAbrirPost} aoClicar={() => onClique?.(b.id)} />;
          case "depoimentos": return <SecaoDepoimentos key={b.id} d={b.data} marca={marca} />;
          case "contato": return <Rodape key={b.id} d={b.data} marca={marca} aoClicar={() => onClique?.(b.id)} />;
          default: {
            // Bloco pela metade não vira seção. Antes, um bloco de texto ainda
            // sem texto desenhava um <Secao> com o espaçamento inteiro e o
            // conteúdo nulo dentro: uma faixa branca de 80px no meio da página,
            // que na prévia parecia um erro de montagem.
            if (faltaNoBloco({ kind: b.kind, data: b.data })) return null;
            // Os blocos comuns (vídeo, FAQ, mapa, captura) também servem no
            // Site: entram centralizados numa coluna de leitura confortável.
            return (
              <Secao key={b.id} marca={marca} fundo={txt(b.data, "fundo", "claro")}>
                <div className="mx-auto max-w-[620px]">
                  <BlocoPublico kind={b.kind} data={b.data} visual={visual}
                    onClique={() => onClique?.(b.id)} captura={capturaDoBloco?.(b)} />
                </div>
              </Secao>
            );
          }
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
    <div className="min-h-[100dvh] bg-white [container-type:inline-size]">
      <Topo marca={marca} secoes={[]} aoIr={aoVoltar} />
      {item.capa && <img src={item.capa} alt="" className="w-full aspect-[16/9] cq-md:aspect-[21/9] object-cover" />}

      <article className="px-5 py-8 cq-md:py-12">
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
          <h1 className="font-display font-extrabold text-[1.6rem] cq-md:text-[2.1rem] leading-[1.15] text-gray-900 mt-1.5 [text-wrap:balance]">
            {item.titulo}
          </h1>
          {!ehPost && preco && (
            <p className="font-display font-bold text-[1.4rem] mt-1.5" style={{ color: marca.cor }}>{preco}</p>
          )}
          {item.resumo && <p className="text-[15px] text-gray-600 leading-relaxed mt-3">{item.resumo}</p>}

          {item.conteudo && (
            // whitespace-pre-line em vez de HTML: o que a pessoa digitou é o
            // que aparece, sem risco de colar markup estranho na página.
            <TextoRico texto={item.conteudo} className="text-[15.5px] leading-[1.75] text-gray-700 mt-5 space-y-4" />
          )}

          {item.galeria.length > 0 && (
            <div className="grid grid-cols-2 cq-sm:grid-cols-3 gap-2 mt-6">
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
