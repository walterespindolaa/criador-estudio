// ═══════════════════════════════════════════════════════════════════════════
// POSTER-LETTERBOX — mede TARJA PRETA QUEIMADA NO PIXEL da miniatura de vídeo.
//
// POR QUE EXISTE: a miniatura de vídeo nem sempre é só o frame. Conferido em
// arquivos reais do Google Drive: alguns devolvem o frame dentro de uma moldura
// fixa (ex.: canvas 480x360 com 44px pretos em cima e embaixo pra um vídeo 16:9;
// o mesmo arquivo pedido em w200 devolve 200x150 com 18px pretos, ou seja, a
// moldura é proporcional e faz parte da imagem). Vídeo exportado pelo editor com
// barra na própria mídia cai no mesmo caso.
//
// NENHUM PARÂMETRO DO DRIVE RESOLVE. Foi testado no arquivo com tarja:
//   drive.google.com/thumbnail?sz=w200 · sz=w1600 · sz=w2000 · sz=h1600
//   lh3.googleusercontent.com/d/ID · =w2000 · =s2000 · =w800-h1422-c
// e a tarja continua em TODAS, porque o preto é pixel da imagem, não moldura do
// player. object-cover também não resolve sozinho pelo mesmo motivo: ele recorta
// a imagem inteira, tarja incluída.
//
// A SAÍDA é medir a tarja e reposicionar a imagem na exibição. Dá pra ler o pixel
// porque o lh3.googleusercontent.com responde `Access-Control-Allow-Origin: *`
// (verificado), então a amostra entra num canvas sem contaminar.
//
// Quando NÃO há tarja (o caso normal dos arquivos atuais do Drive, que devolvem
// 1080x1920 limpo pra Reels) nada disso liga e a prévia segue no object-cover.
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties } from "react";

export type LetterboxBox = {
  /** Fração da largura/altura ocupada pela tarja em cada lado (0 a 1). */
  fl: number; ft: number; fr: number; fb: number;
  /** Tamanho natural da amostra, pra calcular a proporção do conteúdo. */
  nw: number; nh: number;
};

export type LetterboxProbe = {
  /** Tarja medida, ou null quando a miniatura veio limpa (sem moldura). */
  box: LetterboxBox | null;
  /**
   * Proporção largura/altura do CONTEÚDO de verdade: com tarja, é o miolo já
   * sem a moldura; sem tarja, é a proporção natural da própria miniatura (que
   * nesse caso é a proporção do frame do vídeo). Serve pro estado tocando
   * dimensionar o iframe do player (ver coverIframeStyle).
   */
  ratio: number;
};

// Canal máximo pra considerar o pixel preto. Baixo de propósito: cena escura de
// verdade quase nunca zera os três canais em TODA uma linha.
const NEAR_BLACK = 24;
// Tarja menor que isso não vale recorte (é ruído de compressão da borda).
const MIN_BAR = 0.015;
// Se sobrar menos que isso de imagem, não é moldura: é frame que abre no escuro.
const MIN_KEEP = 0.45;
// Largura da amostra. Medir tarja não precisa de resolução, e assim o download
// extra é de alguns KB em vez da miniatura cheia.
const PROBE_W = 320;

function loadCors(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Proporção largura/altura do miolo (o frame sem a tarja medida). */
function contentRatio(box: LetterboxBox): number {
  return (box.nw * (1 - box.fl - box.fr)) / (box.nh * (1 - box.ft - box.fb));
}

/**
 * Mede a miniatura e devolve tarja + proporção real do conteúdo, ou null quando
 * a imagem não carregou / não deu pra ler (CORS, canvas indisponível). NUNCA
 * lança: qualquer problema vira null e a prévia segue no comportamento de sempre.
 * IMPORTANTE: null é só "não sei medir"; miniatura limpa volta { box: null, ratio }.
 */
async function probeLetterboxNow(url: string): Promise<LetterboxProbe | null> {
  if (typeof document === "undefined") return null;
  const img = await loadCors(url);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const box = measureBox(img);
  return { box, ratio: box ? contentRatio(box) : img.naturalWidth / img.naturalHeight };
}

// A mesma miniatura é medida pelo poster E pelo estado tocando (iframe), então a
// promessa fica em cache por URL: um download e uma leitura de canvas por sessão.
// Falha também fica em cache, igual ao comportamento antigo (o efeito só re-media
// quando a URL da amostra muda).
const probeCache = new Map<string, Promise<LetterboxProbe | null>>();
export function probeLetterbox(url: string): Promise<LetterboxProbe | null> {
  let p = probeCache.get(url);
  if (!p) { p = probeLetterboxNow(url); probeCache.set(url, p); }
  return p;
}

/** Devolve a tarja medida, ou null quando não há tarja / não deu pra medir. */
function measureBox(img: HTMLImageElement): LetterboxBox | null {

  const w = Math.max(1, Math.min(PROBE_W, img.naturalWidth));
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  let data: Uint8ClampedArray;
  try {
    ctx.drawImage(img, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // canvas contaminado (servidor sem CORS): não recorta nada
  }

  const dark = (i: number) => data[i] <= NEAR_BLACK && data[i + 1] <= NEAR_BLACK && data[i + 2] <= NEAR_BLACK;
  const rowDark = (y: number) => { for (let x = 0; x < w; x++) if (!dark((y * w + x) * 4)) return false; return true; };
  const colDark = (x: number) => { for (let y = 0; y < h; y++) if (!dark((y * w + x) * 4)) return false; return true; };

  let t = 0; while (t < h && rowDark(t)) t++;
  let b = 0; while (b < h - t && rowDark(h - 1 - b)) b++;
  let l = 0; while (l < w && colDark(l)) l++;
  let r = 0; while (r < w - l && colDark(w - 1 - r)) r++;

  let ft = t / h, fb = b / h, fl = l / w, fr = r / w;
  // Moldura de verdade aparece nos DOIS lados do mesmo eixo. Preto só de um lado
  // é conteúdo do vídeo (céu à noite, fundo escuro), então não se mexe.
  if (ft < MIN_BAR || fb < MIN_BAR) { ft = 0; fb = 0; }
  if (fl < MIN_BAR || fr < MIN_BAR) { fl = 0; fr = 0; }
  if (!ft && !fb && !fl && !fr) return null;
  // Sobrou pouca imagem: é abertura no escuro, não moldura. Melhor não recortar
  // do que dar zoom absurdo num frame preto.
  if (1 - ft - fb < MIN_KEEP || 1 - fl - fr < MIN_KEEP) return null;

  return { fl, ft, fr, fb, nw: img.naturalWidth, nh: img.naturalHeight };
}

/**
 * Estilo que faz o CONTEÚDO (o frame sem a tarja) cobrir o slot, do mesmo jeito
 * que o object-cover cobriria se a tarja não existisse.
 *
 * Como funciona: a imagem inteira é ampliada até que só o miolo caiba no slot, e
 * o centro do miolo é alinhado ao centro do slot. Tudo em %, então continua certo
 * quando a tela muda de tamanho. `slotRatio` é largura/altura do slot.
 */
export function letterboxStyle(box: LetterboxBox, slotRatio: number): CSSProperties {
  const kw = 1 - box.fl - box.fr;
  const kh = 1 - box.ft - box.fb;
  const contentRatio = (box.nw * kw) / (box.nh * kh);
  const base: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    maxWidth: "none",
    // Translate em % é relativo ao próprio tamanho da imagem: leva o centro do
    // miolo (e não o centro da imagem com tarja) pro centro do slot.
    transform: `translate(${-((box.fl + kw / 2) * 100)}%, ${-((box.ft + kh / 2) * 100)}%)`,
  };
  // Slot mais largo que o miolo: quem manda é a largura. Senão, a altura.
  return slotRatio >= contentRatio
    ? { ...base, width: `${100 / kw}%`, height: "auto" }
    : { ...base, width: "auto", height: `${100 / kh}%` };
}

// ─── "Cover no iframe" (estado TOCANDO) ─────────────────────────────────────
// O player do Drive (/preview) faz "contain" do vídeo dentro do iframe com fundo
// preto: iframe do tamanho do slot + vídeo com proporção diferente = barra preta
// dentro do player, que nenhum CSS de fora alcança. A saída é o mesmo truque do
// object-cover, só que aplicado no IFRAME: o slot vira uma janela (overflow
// hidden) e o iframe fica MAIOR que ela, centralizado, com a PROPORÇÃO DO VÍDEO.
// Com iframe na proporção do vídeo, o contain do player preenche o iframe todo,
// e o excesso (onde morava a barra) fica cortado fora da área visível.
//
// Corte tem preço: os controles do player (play/pause, barra de progresso) vivem
// na borda de baixo do iframe. Acima desse teto de escala o corte começaria a
// engolir os controles de vez, e vídeo muito fora da proporção do slot não tem
// solução honesta por corte. Aí devolvemos null e o chamador fica com as barras
// de sempre. Até o teto, o corte por borda é (escala-1)/2 <= 12,5% do slot, e as
// prévias já desenham overlay de Instagram (rodapé de story, dots do carrossel)
// por cima dessa faixa, então na prática pouco se perde.
const MAX_COVER_SCALE = 1.25;

/**
 * Estilo pro iframe do player cobrir o slot. `videoRatio` é a proporção real do
 * conteúdo (largura/altura, medida da miniatura via probeLetterbox) e `slotRatio`
 * a do slot. Devolve null quando cobrir exigiria corte demais (ver teto acima)
 * ou quando falta medida; o chamador então mantém o iframe do tamanho do slot.
 *
 * A conta: o iframe mantém a proporção V do vídeo e cresce só o bastante pra
 * MENOR dimensão dele cobrir o slot (S = W/H):
 *   V >= S (vídeo mais largo): altura do iframe = altura do slot (H) e largura =
 *     H*V = W*(V/S). Sobra largura, cortada metade de cada lado.
 *   V <  S (vídeo mais estreito): largura = W e altura = W/V = H*(S/V). Sobra
 *     altura, cortada metade em cima e metade embaixo.
 * Ou seja, a escala de corte é max(V/S, S/V) >= 1, aplicada numa dimensão só;
 * a outra casa exata com o slot. Centralizar com left/top 50% + translate -50%
 * deixa o corte simétrico, igual ao object-cover faria.
 */
export function coverIframeStyle(videoRatio: number, slotRatio: number): CSSProperties | null {
  if (!Number.isFinite(videoRatio) || videoRatio <= 0) return null;
  if (!Number.isFinite(slotRatio) || slotRatio <= 0) return null;
  const scale = videoRatio >= slotRatio ? videoRatio / slotRatio : slotRatio / videoRatio;
  if (scale > MAX_COVER_SCALE) return null;
  const base: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  };
  return videoRatio >= slotRatio
    ? { ...base, height: "100%", width: `${scale * 100}%` }
    : { ...base, width: "100%", height: `${scale * 100}%` };
}
