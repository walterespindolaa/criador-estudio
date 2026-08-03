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

/**
 * Devolve a tarja medida, ou null quando não há tarja / não deu pra medir.
 * NUNCA lança: qualquer problema (CORS, canvas indisponível, imagem quebrada)
 * vira null e a prévia segue no comportamento de sempre.
 */
export async function measureLetterbox(url: string): Promise<LetterboxBox | null> {
  if (typeof document === "undefined") return null;
  const img = await loadCors(url);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

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
