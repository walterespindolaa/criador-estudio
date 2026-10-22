import { useEffect, useId, useRef, useState } from "react";
import { SiteBio, type ItemLite } from "@/components/bio/SiteBio";
import { EmPreviaContext } from "@/components/bio/SiteLoja";
import { corDeDestaque } from "@/lib/bioBlocks";
import type { AparenciaModelo, BlocoDoModelo, PreviaDoModelo } from "@/lib/bioTemplates";
import type { DadosBloco } from "@/lib/bioBlocks";

/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DE UM MODELO (21/10/2026)

   Antes cada modelo era um desenho de três barrinhas coloridas, e os quatro
   pareciam iguais: a pessoa escolhia no escuro e só via o resultado depois de
   aplicar. Aqui o modelo é montado com o MESMO SiteBio da página pública, com
   o texto de exemplo dele, antes de aplicar nada.

   O site se monta pela largura da moldura (container queries), então ele é
   desenhado sempre em 300px, a largura de um celular, e só a escala muda: na
   miniatura do card fica pequeno, na janela de prévia fica do tamanho real.
   ═══════════════════════════════════════════════════════════════════════════ */

const LARGURA = 300;

/** Serviço e post de exemplo: sem eles o modelo de loja e o de autoridade
 *  apareciam sem a seção principal, porque ela puxa o que a pessoa cadastrou. */
const EXEMPLO_ITENS = (tipo: string, nomes: string[], preco: boolean): ItemLite[] =>
  nomes.map((titulo, i) => ({
    id: `${tipo}-${i}`, tipo, slug: `${tipo}-${i}`, titulo,
    resumo: "Texto de exemplo. Aqui entra o que você cadastrar.",
    capa: null, preco: preco ? [180, 250, 90][i] ?? null : null, preco_texto: null,
    publicado_em: "2026-10-01T12:00:00Z",
  }));
const PRODUTOS = EXEMPLO_ITENS("produto", ["Seu primeiro serviço", "Pacote completo", "Avulso"], true);
const POSTS = EXEMPLO_ITENS("post", ["Como escolher o melhor pra você", "3 erros que todo mundo comete"], false);

/** Foto de exemplo na capa: sem ela a capa sai como um bloco liso e a prévia
 *  não mostra o que o modelo é. Só existe na prévia; o modelo aplicado entra
 *  sem foto, porque a foto tem que ser da pessoa. */
export const FOTO_EXEMPLO = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=70";
export const FOTO_EXEMPLO_SAUDE = "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=700&h=1000&fit=crop&crop=faces&q=70";

/* Foto de exemplo da capa de especialista, uma por ramo (22/10/2026). A
   primeira impressão do modelo é esta foto: genérica ou fora do ramo, o modelo
   inteiro parece errado. Retrato em pé, rosto no terço de cima, pra a
   assinatura caber embaixo. Só prévia: nunca vai pra página de ninguém. */
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=700&h=1000&fit=crop&crop=faces&q=70`;
const FOTOS_DO_RAMO: Record<string, string> = {
  saude: U("1594824476967-48c8b964273f"),
  estetica: U("1580489944761-15a19d654956"),
  advocacia: U("1573497019940-1c28c88b4f3e"),
  fitness: U("1571019614242-c5c5dee9f50b"),
  beleza: U("1524504388940-b1c1722653e1"),
  comida: U("1607631568010-a87245c0daf8"),
  imoveis: U("1573496359142-b8d87734a5a2"),
  educacao: U("1508214751196-bcfd4ca60f91"),
};
export const fotoDoRamo = (id: string | undefined) => (id && FOTOS_DO_RAMO[id]) || FOTO_EXEMPLO_SAUDE;

/** Nome de exemplo por ramo, combinando com a foto do ramo. */
const NOMES_DO_RAMO: Record<string, string> = {
  saude: "Lívia Moraes", estetica: "Carol Nunes", advocacia: "Helena Prado", fitness: "Duda Ribeiro",
  beleza: "Júlia Reis", comida: "Rafael Duarte", imoveis: "Paula Andrade", educacao: "Renata Campos",
};
export const nomeDoRamo = (id: string | undefined) => (id && NOMES_DO_RAMO[id]) || "Lívia Moraes";

/* Os ramos do especialista vêm com marcadores ("[anos]", "CRN [número]") pra
   pessoa saber o que trocar depois de aplicar. Na prévia isso parecia site
   quebrado. Aqui cada marcador vira um exemplo plausível, SÓ no desenho. */
const EXEMPLO_DO_MARCADOR: Record<string, string> = {
  "anos": "12", "pacientes": "+1.800", "procedimentos": "+3.000", "alunos": "+400", "famílias": "+150",
  "quantidade": "+2.500", "prazo": "2 dias", "cidade": "Itajaí", "cidades": "Itajaí e BC", "bairro": "Centro",
  "bairros ou cidades": "Itajaí e BC", "estado": "SC", "UF": "SC", "número": "12345", "especialidade": "Loiros",
  "formato": "Ao vivo", "Nome do local": "Clínica Centro", "dias e horário": "Seg a sex, 8h às 18h",
  "até quando aceita encomenda": "Encomendas até quinta", "empresa ou certificação": "Certificação internacional",
};
const trocarMarcadores = (t: string) =>
  t.replace(/\[([^\]]*)\]/g, (_, k: string) => EXEMPLO_DO_MARCADOR[k.trim()] ?? k.trim());
function semMarcadores(v: unknown): unknown {
  if (typeof v === "string") return trocarMarcadores(v);
  if (Array.isArray(v)) return v.map(semMarcadores);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, semMarcadores(x)]));
  return v;
}
/** Prévia dos blocos de um ramo com os marcadores trocados por exemplo. */
export function previaDoNicho(blocos: BlocoDoModelo[]): PreviaDoModelo {
  const out: Record<number, DadosBloco> = {};
  blocos.forEach((b, i) => {
    const d = (b.data ?? {}) as DadosBloco;
    if (JSON.stringify(d).includes("[")) out[i] = semMarcadores(d) as DadosBloco;
  });
  return { blocos: out };
}

const RAIO: Record<AparenciaModelo["buttonStyle"], string> = {
  pill: "rounded-full", square: "rounded-none", rounded: "rounded-xl", outline: "rounded-xl",
};

const pilha = (fonte: string) =>
  /serif|display/i.test(fonte) && !/sans/i.test(fonte) ? `'${fonte}', Georgia, serif` : `'${fonte}', system-ui, sans-serif`;

export function PreviaModelo({ blocos, aparencia, escala: escalaFixa = 1, altura, foto = FOTO_EXEMPLO, previa, nome = "Seu nome", encaixar = false }: {
  /** Ocupa a largura toda de quem está em volta (a moldura do celular na
   *  janela do modelo). Desenha em no mínimo 360px, a largura de um celular
   *  comum, e reduz só se a moldura for mais estreita: nada de faixa branca
   *  do lado nem site espremido. */
  encaixar?: boolean;
  /** Nome de exemplo no menu e na assinatura ("Lívia Moraes" fica melhor que "Seu nome"). */
  nome?: string;
  blocos: BlocoDoModelo[];
  /** Dados de exemplo SÓ desta prévia (números, preços, Instagram de mentira).
   *  Nunca entram na página de ninguém: o modelo aplicado leva só `blocos`. */
  previa?: PreviaDoModelo;
  foto?: string;
  aparencia: AparenciaModelo;
  /** 1 = tamanho de celular. A miniatura usa uns 0.32. */
  escala?: number;
  /** Altura visível já na escala final. Sem ela, mostra a página inteira. */
  altura?: number;
}) {
  // Classe própria por prévia: a fonte de um modelo não pode vazar pro outro
  // card nem pro editor em volta.
  const escopo = `pm-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  /* Reduzida e sem altura fixa: o transform não encolhe o espaço que a página
     ocupa, e sobrava um vazio do tamanho da diferença no fim da rolagem. Mede
     a altura de verdade e reserva só a encolhida. */
  const miolo = useRef<HTMLDivElement>(null);
  const fora = useRef<HTMLDivElement>(null);
  const [larguraFora, setLarguraFora] = useState(0);
  useEffect(() => {
    if (!encaixar || !fora.current || typeof ResizeObserver === "undefined") return;
    const el = fora.current;
    const ro = new ResizeObserver(() => setLarguraFora(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [encaixar]);
  const largura = encaixar && larguraFora ? Math.max(larguraFora, 360) : LARGURA;
  const escala = encaixar ? (larguraFora ? larguraFora / largura : 1) : escalaFixa;
  const [alturaMedida, setAlturaMedida] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (escala === 1 || altura !== undefined || !miolo.current || typeof ResizeObserver === "undefined") return;
    const el = miolo.current;
    const medir = () => setAlturaMedida(el.offsetHeight * escala);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [escala, altura]);
  const lite = blocos.map((b, i) => {
    const data = { ...(b.data ?? {}), ...(previa?.blocos?.[i] ?? {}) };
    if ((b.kind === "capa" || b.kind === "apresentacao") && !data.imagem) {
      data.imagem = foto;
      if (b.kind === "apresentacao") data.midia = "imagem";
    }
    return { id: `${escopo}-${i}`, kind: b.kind, data, position: i };
  });

  return (
    <div aria-hidden className="overflow-hidden relative" ref={fora}
      style={{ width: encaixar ? "100%" : LARGURA * escala, height: altura ?? (escala === 1 ? undefined : alturaMedida),
        visibility: encaixar && !larguraFora ? "hidden" : undefined }}>
      <style>{`.${escopo},.${escopo} *:not(.bio-fonte-livre){font-family:${pilha(aparencia.fontFamily)} !important}`
        + (aparencia.fontTitulos ? `.${escopo} :is(.font-display,h1,h2,h3):not(.bio-fonte-livre),.${escopo} :is(.font-display,h1,h2,h3) *:not(.bio-fonte-livre){font-family:${pilha(aparencia.fontTitulos)} !important}` : "")}</style>
      <div className={escopo} ref={miolo}
        // inert: é desenho. Nada dentro dele recebe clique ou foco.
        {...{ inert: "" }}
        style={{ width: largura, transform: escala === 1 ? undefined : `scale(${escala})`, transformOrigin: "top left" }}>
        <EmPreviaContext.Provider value={true}>
        <SiteBio
          blocos={lite}
          marca={{ nome, logo: null, cor: corDeDestaque(aparencia.buttonColor), corTexto: aparencia.buttonTextColor }}
          produtos={PRODUTOS} posts={POSTS} social={previa?.social ?? null}
          visual={{
            buttonColor: aparencia.buttonColor, buttonTextColor: aparencia.buttonTextColor,
            cardColor: aparencia.cardColor, cardTextColor: aparencia.cardTextColor,
            radius: RAIO[aparencia.buttonStyle] ?? "rounded-xl", isOutline: aparencia.buttonStyle === "outline",
          }}
          aoAbrirProduto={() => {}} aoAbrirPost={() => {}} alturaCheia={false} />
        </EmPreviaContext.Provider>
      </div>
    </div>
  );
}

/* ── A PRÉVIA QUE ROLA SOZINHA ──
   Na janela do modelo, a pessoa via só a primeira dobra (no celular, o título)
   e achava que o modelo era aquilo. Agora a página desce devagar sozinha, de
   cima a baixo, pra mostrar o site inteiro. Qualquer toque ou rolagem para na
   hora e devolve o controle. Quem pediu menos movimento no celular não vê
   rolagem nenhuma, só o aviso de que dá pra rolar. */
export function PreviaRolando({ children, className, chave }: { children: React.ReactNode; className?: string; chave: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [mexeu, setMexeu] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.scrollTop = 0;
    setMexeu(false);
    const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (parado) return;
    let quadro = 0;
    let parou = false;
    let antes = 0;
    let pos = 0; // rolagem em fração de pixel: em tela de 120Hz o passo é menor que 1px e o navegador arredondava pra zero

    const parar = () => { parou = true; cancelAnimationFrame(quadro); setMexeu(true); };
    const passo = (agora: number) => {
      if (parou) return;
      const dt = antes ? Math.min(64, agora - antes) : 16;
      antes = agora;
      pos += dt * 0.07; // ~70px por segundo: dá pra ler enquanto passa
      el.scrollTop = pos;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { setMexeu(true); return; }
      quadro = requestAnimationFrame(passo);
    };
    const comecar = setTimeout(() => { quadro = requestAnimationFrame(passo); }, 1400);
    const opcoes = { passive: true } as const;
    el.addEventListener("pointerdown", parar, opcoes);
    el.addEventListener("wheel", parar, opcoes);
    el.addEventListener("touchstart", parar, opcoes);
    return () => {
      clearTimeout(comecar); cancelAnimationFrame(quadro);
      el.removeEventListener("pointerdown", parar);
      el.removeEventListener("wheel", parar);
      el.removeEventListener("touchstart", parar);
    };
  }, [chave]);
  return (
    <div className="relative h-full">
      <div ref={caixa} className={className}>{children}</div>
      {!mexeu && (
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white text-[11px] font-body font-semibold px-3 py-1.5 whitespace-nowrap">
          Rolando a página inteira · toque pra parar
        </span>
      )}
    </div>
  );
}
