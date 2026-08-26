import { useEffect, useState } from "react";
import { Check, Copy, MapPin, Navigation } from "lucide-react";
import {
  bool, embedDeVideo, embedGoogleMaps, faltaAte, linkAppleMaps, linkGoogleMaps,
  linkWaze, linkWhatsapp, lista, txt, type DadosBloco,
} from "@/lib/bioBlocks";
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
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const f = faltaAte(ate, agora);
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
  const rota = "flex items-center justify-center gap-1.5 py-3 min-h-[44px] rounded-xl text-[13px] font-body font-semibold border transition active:scale-[.98]";

  return (
    <CartaoBase visual={visual} className="overflow-hidden">
      {bool(data, "mostrarMapa", true) && (
        <iframe
          title="Mapa"
          src={embedGoogleMaps(endereco)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-[170px] border-0 block"
        />
      )}
      <div className="p-4">
        <TituloCartao>{txt(data, "titulo")}</TituloCartao>
        <p className="flex items-start gap-2 text-[13.5px] leading-snug">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
          <span className="whitespace-pre-line">{endereco}</span>
        </p>
        {txt(data, "horario").trim() && (
          <p className={cn("text-[12.5px] mt-2 whitespace-pre-line", visual.cardColor ? "opacity-80" : "text-gray-600")}>
            {txt(data, "horario")}
          </p>
        )}

        <a href={linkGoogleMaps(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
          className={cn(rota, "w-full mt-3 border-transparent")}
          style={{ backgroundColor: visual.buttonColor, color: visual.buttonTextColor }}>
          <Navigation className="h-4 w-4" /> Como chegar
        </a>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <a href={linkWaze(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
            className={cn(rota, visual.cardColor ? "border-current/25" : "border-gray-200 text-gray-800")}>
            Waze
          </a>
          <a href={linkAppleMaps(endereco)} target="_blank" rel="noopener noreferrer" onClick={onClique}
            className={cn(rota, visual.cardColor ? "border-current/25" : "border-gray-200 text-gray-800")}>
            Apple Maps
          </a>
        </div>

        <button type="button" onClick={copiar}
          className={cn(rota, "w-full mt-2", visual.cardColor ? "border-current/25" : "border-gray-200 text-gray-800")}>
          {copiado ? <><Check className="h-4 w-4" /> Endereço copiado</> : <><Copy className="h-4 w-4" /> Copiar endereço</>}
        </button>
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
      const url = txt(data, "url").trim();
      if (!url) return null;
      const icone = txt(data, "icone");
      const capa = txt(data, "capa");
      return (
        <BotaoGrande visual={visual} href={url} onClique={onClique} capa={capa || undefined}>
          {!capa && icone && <span aria-hidden>{icone}</span>}
          {txt(data, "titulo") || "Abrir"}
        </BotaoGrande>
      );
    }

    case "whatsapp": {
      const tel = txt(data, "telefone");
      if (tel.replace(/\D/g, "").length < 10) return null;
      return (
        <BotaoGrande visual={visual} href={linkWhatsapp(tel, txt(data, "mensagem"))} onClique={onClique}>
          <span aria-hidden>💬</span>{txt(data, "titulo") || "Falar no WhatsApp"}
        </BotaoGrande>
      );
    }

    case "texto": {
      const t = txt(data, "texto");
      if (!t.trim()) return null;
      return (
        <CartaoBase visual={visual} className="p-4">
          <TituloCartao>{txt(data, "titulo")}</TituloCartao>
          <TextoRico texto={t} className={cn("text-[14px] leading-relaxed", visual.cardColor ? "opacity-90" : "text-gray-700")} />
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
      const fotos = lista<string>(data, "imagens").filter(Boolean);
      if (fotos.length === 0) return null;
      return (
        <CartaoBase visual={visual} className="p-3">
          <TituloCartao>{txt(data, "titulo")}</TituloCartao>
          {/* Duas colunas no celular e três a partir do tablet: três quadradinhos
              numa tela de 390px viram miniaturas ilegíveis. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
