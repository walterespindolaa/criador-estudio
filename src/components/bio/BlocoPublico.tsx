import { useEffect, useState } from "react";
import { Check, Copy, MapPin, MessageCircle, Navigation } from "lucide-react";
import {
  bool, embedDeSpotify, embedDeVideo, faltaAte, linkAppleMaps, linkGoogleMaps,
  linkSeguro, linkWaze, linkWhatsapp, lista, txt, type DadosBloco,
} from "@/lib/bioBlocks";
import { iconeLucide } from "@/lib/bioIcones";
import { TextoRico } from "@/lib/textoRico";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   COMO CADA BLOCO APARECE NA PÁGINA

   Um componente só, usado pela página pública E pela prévia do editor. Se
   fossem dois desenhos, a prévia mentiria na primeira alteração, que é o
   problema que a gente acabou de corrigir no "Sobre mim".

   MOBILE PRIMEIRO, de verdade: quase todo mundo abre este link pelo Instagram,
   no celular, com uma mão. Então nada aqui depende de largura grande, os alvos
   de toque têm no mínimo 44px, e o que cresce em tela grande é o espaço em
   volta, nunca a quantidade de coisa por linha.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VisualBio = {
  buttonColor: string;
  buttonTextColor: string;
  cardColor?: string;
  cardTextColor?: string;
  /** classe de arredondamento já resolvida pelo estilo do botão */
  radius: string;
  isOutline: boolean;
};

type Props = {
  kind: string;
  data: DadosBloco;
  visual: VisualBio;
  /** Chamado quando o visitante toca em algo que leva pra fora. */
  onClique?: () => void;
  /** O formulário de captura é o único bloco com estado próprio; a página
   *  pública passa o dela, e a prévia do editor passa nada (fica só desenho). */
  captura?: React.ReactNode;
};

function CartaoBase({ visual, className, children }: { visual: VisualBio; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("w-full rounded-2xl shadow-md overflow-hidden", visual.cardColor ? "" : "bg-white/90 backdrop-blur-sm", className)}
      style={visual.cardColor ? { backgroundColor: visual.cardColor, color: visual.cardTextColor || undefined } : undefined}
    >
      {children}
    </div>
  );
}

function TituloCartao({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="font-display font-bold text-[15px] mb-2.5">{children}</p>;
}

/** Botão grande, mesma casca pro link, pro WhatsApp e pra rota. */
function BotaoGrande({
  visual, href, onClique, capa, children,
}: {
  visual: VisualBio; href: string; onClique?: () => void; capa?: string; children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClique}
      className={cn(
        "block w-full font-body font-semibold text-[15px] shadow-md overflow-hidden transition active:scale-[.985]",
        visual.radius, visual.isOutline && "border-2 bg-transparent",
      )}
      style={{
        backgroundColor: visual.isOutline ? "transparent" : visual.buttonColor,
        color: visual.buttonTextColor,
        borderColor: visual.isOutline ? visual.buttonTextColor : undefined,
      }}
    >
      {capa && (
        <span className="block w-full aspect-video overflow-hidden">
          <img src={capa} alt="" loading="lazy" className="w-full h-full object-cover" />
        </span>
      )}
      {/* min-h-[52px]: alvo de toque confortável mesmo com rótulo de uma linha.
          text-balance: quebra a frase em pedaços parecidos em vez de deixar
          uma palavra órfã na segunda linha. */}
      <span className="flex items-center justify-center gap-2 px-5 py-3.5 min-h-[52px] text-center whitespace-pre-line [text-wrap:balance]">
        {children}
      </span>
    </a>
  );
}

/* ── Contagem regressiva ── */
function Contagem({ data, visual }: { data: DadosBloco; visual: VisualBio }) {
  const ate = txt(data, "ate");
  const [agora, setAgora] = useState(() => Date.now());
  const f = faltaAte(ate, agora);
  /* O relógio só bate enquanto tem o que contar. Sem essa guarda ele acordava
     o componente uma vez por segundo PARA SEMPRE mesmo com a contagem já
     vencida ou sem data nenhuma, o que não aparece na tela mas aparece na
     bateria de quem deixou a aba aberta. */
  const parado = !ate || f.acabou;
  useEffect(() => {
    if (parado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [parado]);
  if (!ate) return null;
  // Acabou: some da página em vez de mostrar zero, que passa a impressão de
  // página abandonada.
  if (f.acabou) return null;

  const caixa = (v: number, r: string) => (
    <div className="rounded-xl px-3 py-2 text-center min-w-[58px]" style={{ backgroundColor: visual.buttonColor, color: visual.buttonTextColor }}>
      <b className="block font-display text-lg leading-none tabular-nums">{String(v).padStart(2, "0")}</b>
      <span className="text-[9px] uppercase tracking-wider opacity-85">{r}</span>
    </div>
  );
  return (
    <CartaoBase visual={visual} className="p-4 text-center">
      <TituloCartao>{txt(data, "titulo")}</TituloCartao>
      <div className="flex gap-2 justify-center">
        {f.d > 0 && caixa(f.d, "dias")}
        {caixa(f.h, "horas")}
        {caixa(f.m, "min")}
        {f.d === 0 && caixa(f.s, "seg")}
      </div>
    </CartaoBase>
  );
}

/* ── Perguntas frequentes ── */
function Faq({ data, visual }: { data: DadosBloco; visual: VisualBio }) {
  const itens = lista<{ p?: string; r?: string }>(data, "itens").filter((i) => (i.p || "").trim());
  const [aberto, setAberto] = useState<number | null>(null);
  if (itens.length === 0) return null;
  return (
    <CartaoBase visual={visual} className="p-4">
      <TituloCartao>{txt(data, "titulo")}</TituloCartao>
      <div>
        {itens.map((i, n) => (
          <div key={n} className={cn("border-t first:border-t-0", visual.cardColor ? "border-current/15" : "border-gray-200")}>
            <button
              type="button"
              onClick={() => setAberto(aberto === n ? null : n)}
              aria-expanded={aberto === n}
              className="w-full flex items-start justify-between gap-3 text-left py-3 min-h-[44px]"
            >
              <span className="text-[14px] font-medium leading-snug">{i.p}</span>
              <span className="text-lg leading-none shrink-0 opacity-60" aria-hidden>{aberto === n ? "−" : "+"}</span>
            </button>
            {aberto === n && (i.r || "").trim() && (
              <p className={cn("text-[13.5px] leading-relaxed pb-3 whitespace-pre-line", visual.cardColor ? "opacity-85" : "text-gray-600")}>
                {i.r}
              </p>
            )}
          </div>
        ))}
      </div>
    </CartaoBase>
  );
}

/* ── Endereço e rota ── */
function Mapa({ data, visual, onClique }: { data: DadosBloco; visual: VisualBio; onClique?: () => void }) {
  const endereco = txt(data, "endereco").trim();
  const [copiado, setCopiado] = useState(false);
  if (!endereco) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sem permissão de área de transferência: ignora */ }
  };

  // Três apps porque o celular de cada pessoa tem o seu. Abrir tudo em aba
  // nova deixa o app decidir: no celular o link do Waze e do Maps é capturado
  // pelo aplicativo instalado; no computador cai no site, que também serve.
  const chip = "flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12.5px] font-body font-semibold border transition active:scale-[.98]";
  const chipNeutro = visual.cardColor ? "border-current/25" : "border-gray-200 text-gray-800";

  /* REDESENHO (pedido do Walter, 01/09: "feio e esticado"). O que era uma torre
     de botões cheios de altura virou UM cartão enxuto: endereço em cima, uma
     linha de atalhos embaixo. A "faixa do mapa" (o embed sem chave que o Google
     fechou) virou um mapinha DESENHADO: linhas de rua em SVG na cor do texto e
     o alfinete na cor do botão. Nunca quebra, e parece feito de propósito. */
  return (
    <CartaoBase visual={visual} className="overflow-hidden">
      {bool(data, "mostrarMapa", true) && (
        <a href={linkGoogleMaps(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
          aria-label="Ver no mapa" className="block relative h-[88px] overflow-hidden bg-black/[.05]">
          {/* Ruas estilizadas: decoração, não dado. aria-hidden pra leitor de tela. */}
          <svg aria-hidden viewBox="0 0 400 88" preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full opacity-[.16]">
            <g stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M-10 24 H410" />
              <path d="M-10 62 H410" />
              <path d="M70 -10 V98" />
              <path d="M210 -10 V98" />
              <path d="M330 -10 V98" />
              <path d="M-10 44 Q 120 30 210 44 T 410 40" strokeWidth="5" />
            </g>
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <span className="w-9 h-9 rounded-full grid place-items-center shadow-md"
              style={{ backgroundColor: visual.buttonColor, color: visual.buttonTextColor }}>
              <MapPin className="h-[18px] w-[18px]" />
            </span>
          </span>
        </a>
      )}
      <div className="p-4">
        <TituloCartao>{txt(data, "titulo")}</TituloCartao>
        <p className="flex items-start gap-2 text-[13.5px] leading-snug">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
          <span className="whitespace-pre-line">{endereco}</span>
        </p>
        {txt(data, "horario").trim() && (
          <p className={cn("text-[12.5px] mt-1.5 whitespace-pre-line", visual.cardColor ? "opacity-80" : "text-gray-600")}>
            {txt(data, "horario")}
          </p>
        )}

        <a href={linkGoogleMaps(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
          className={cn(chip, "w-full mt-3.5 h-11 text-[13.5px] border-transparent shadow-sm")}
          style={{ backgroundColor: visual.buttonColor, color: visual.buttonTextColor }}>
          <Navigation className="h-4 w-4" /> Como chegar
        </a>

        {/* Uma linha só de atalhos secundários: era isso que esticava o card. */}
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          <a href={linkWaze(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
            className={cn(chip, chipNeutro)}>
            Waze
          </a>
          <a href={linkAppleMaps(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
            className={cn(chip, chipNeutro)}>
            Apple Maps
          </a>
          <button type="button" onClick={copiar} className={cn(chip, chipNeutro)}>
            {copiado ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
          </button>
        </div>
      </div>
    </CartaoBase>
  );
}

export function BlocoPublico({ kind, data, visual, onClique, captura }: Props) {
  switch (kind) {
    case "titulo": {
      const t = txt(data, "titulo");
      if (!t.trim()) return null;
      return <p className="w-full text-center font-display font-bold text-[17px] pt-4 pb-1 drop-shadow-sm">{t}</p>;
    }

    case "link": {
      // Endereço que não passa na checagem não vira botão: melhor o bloco
      // sumir do que existir um botão que abre um "javascript:".
      const url = linkSeguro(txt(data, "url"));
      if (!url) return null;
      const icone = txt(data, "icone");
      const capa = txt(data, "capa");
      // Ícone do catálogo (lucide:id) desenha o componente; emoji antigo
      // continua saindo como texto. Sem ícone, o botão fica só com o rótulo.
      const IconeL = iconeLucide(icone);
      return (
        <BotaoGrande visual={visual} href={url} onClique={onClique} capa={capa || undefined}>
          {!capa && IconeL && <IconeL className="h-[18px] w-[18px] shrink-0" aria-hidden />}
          {!capa && !IconeL && icone && <span aria-hidden>{icone}</span>}
          {txt(data, "titulo") || "Abrir"}
        </BotaoGrande>
      );
    }

    case "whatsapp": {
      const tel = txt(data, "telefone");
      if (tel.replace(/\D/g, "").length < 10) return null;
      return (
        <BotaoGrande visual={visual} href={linkWhatsapp(tel, txt(data, "mensagem"))} onClique={onClique}>
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />{txt(data, "titulo") || "Falar no WhatsApp"}
        </BotaoGrande>
      );
    }

    case "texto": {
      const t = txt(data, "texto");
      const foto = txt(data, "imagem");
      if (!t.trim() && !foto) return null;
      /* A foto entra colada no topo, sem respiro em volta: é o desenho que o
         "Sobre mim" antigo tinha, e é de lá que a maioria destes blocos veio. */
      return (
        <CartaoBase visual={visual} className={foto ? "overflow-hidden" : "p-4"}>
          {/* Proporção fixa em vez de max-h: sem ela, o espaço só aparecia
              quando a foto chegava, e todo o resto da página pulava pra baixo
              na frente do visitante. */}
          {foto && <img src={foto} alt="" loading="lazy" decoding="async"
            className="w-full aspect-[16/9] object-cover" />}
          <div className={foto ? "p-4" : ""}>
            <TituloCartao>{txt(data, "titulo")}</TituloCartao>
            {/* font-normal + leading-normal (pedidos da Gabi, 31/08): o corpo
               saía pesado e com entrelinha larga demais, cansando a leitura. */}
            <TextoRico texto={t} className={cn("text-[14px] font-normal leading-normal", visual.cardColor ? "opacity-90" : "text-gray-700")} />
          </div>
        </CartaoBase>
      );
    }

    case "spotify": {
      const e = embedDeSpotify(txt(data, "url"));
      if (!e) return null;
      return (
        <CartaoBase visual={visual} className="p-3">
          <TituloCartao>{txt(data, "titulo")}</TituloCartao>
          <iframe
            title={txt(data, "titulo") || "Spotify"}
            src={e.src}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className={cn("w-full border-0 rounded-xl", e.compacto ? "h-[152px]" : "h-[352px]")}
          />
        </CartaoBase>
      );
    }

    case "video": {
      const e = embedDeVideo(txt(data, "url"));
      if (!e) return null;
      return (
        <CartaoBase visual={visual} className="p-3">
          <TituloCartao>{txt(data, "titulo")}</TituloCartao>
          {/* Proporção fixa em vez de altura fixa: no celular estreito o vídeo
              acompanha a largura e não sobra faixa preta. */}
          <div className={cn("w-full overflow-hidden rounded-xl bg-black", e.alto ? "aspect-[9/16]" : "aspect-video")}>
            <iframe
              title={txt(data, "titulo") || "Vídeo"}
              src={e.src}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </CartaoBase>
      );
    }

    case "galeria": {
      const fotos = lista<string>(data, "imagens").filter((x) => typeof x === "string" && x.trim());
      if (fotos.length === 0) return null;
      return (
        <CartaoBase visual={visual} className="p-3">
          <TituloCartao>{txt(data, "titulo")}</TituloCartao>
          {/* Duas colunas no celular e três a partir do tablet: três quadradinhos
              numa tela de 390px viram miniaturas ilegíveis. */}
          <div className="grid grid-cols-2 cq-sm:grid-cols-3 gap-1.5">
            {fotos.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        </CartaoBase>
      );
    }

    case "faq": return <Faq data={data} visual={visual} />;
    case "contagem": return <Contagem data={data} visual={visual} />;
    case "mapa": return <Mapa data={data} visual={visual} onClique={onClique} />;
    case "captura": return <>{captura}</>;
    default: return null;
  }
}
