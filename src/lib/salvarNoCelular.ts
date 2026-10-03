/* ═══════════════════════════════════════════════════════════════════════════
   SALVAR NO CELULAR (Walter, 03/10/2026)

   Problema: no celular a social mídia baixava as mídias do post UMA POR UMA
   (o .zip no iPhone vai pro app Arquivos, não pra Galeria). Solução: baixar
   todas pelo proxy (criapost-download-file, que já checa permissão e devolve
   os bytes com CORS) e entregar ao menu de compartilhar do próprio celular
   (navigator.share com files). No iPhone aparece "Salvar N itens", no Android
   "Salvar na galeria" / Fotos: tudo de uma vez.

   Por que o menu abre num SEGUNDO toque: o navegador só deixa abrir o menu de
   compartilhar logo depois de um toque. Baixar 7 fotos leva alguns segundos e
   esse "crédito" do toque expira no meio. Então: 1º toque prepara, 2º toque
   salva. Mesmo padrão do Prompter (PrompterPlayer, "Salvar vídeo").

   Vídeo do Bunny Stream fica de fora: o proxy recusa (não existe arquivo MP4
   pra puxar dessa library). Ele aparece na lista com "abrir à parte".
   ═══════════════════════════════════════════════════════════════════════════ */
import { supabase } from "@/integrations/supabase/client";
import { mediaDownloadName, type MediaLike } from "@/lib/driveMedia";

/** Celular/tablet que sabe compartilhar arquivos (iPhone, Android). No computador fica o .zip. */
export function podeSalvarNoCelular(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof window === "undefined") return false;
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    const toque = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!toque) return false;
    const teste = new File([new Uint8Array([0xff, 0xd8, 0xff])], "teste.jpg", { type: "image/jpeg" });
    return navigator.canShare({ files: [teste] });
  } catch {
    return false;
  }
}

/** Vídeo hospedado no Bunny Stream: não tem arquivo pra baixar por aqui. */
export const ehVideoDoBunny = (m: MediaLike) =>
  !!m.bunny_video_id || (m.provider ?? "").toLowerCase() === "bunny_stream";

/* O proxy devolve application/octet-stream. O celular só oferece "Salvar imagem"
   quando o arquivo diz o que é, então a gente lê o começo dos bytes e descobre o
   tipo de verdade. Se não for imagem nem vídeo (ex.: a página de aviso do Drive
   pra arquivo grande ou privado), é erro, não arquivo. */
// Blob.arrayBuffer não existe em Safari antigo (nem no jsdom dos testes): FileReader cobre.
function lerBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as ArrayBuffer);
    r.onerror = () => falha(r.error);
    r.readAsArrayBuffer(blob);
  });
}

export async function tipoReal(blob: Blob): Promise<{ mime: string; ext: string } | null> {
  const b = new Uint8Array(await lerBytes(blob.slice(0, 16)));
  if (b.length < 12) return null;
  const txt = (i: number, n: number) => String.fromCharCode(...Array.from(b.slice(i, i + n)));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && txt(1, 3) === "PNG") return { mime: "image/png", ext: "png" };
  if (txt(0, 4) === "GIF8") return { mime: "image/gif", ext: "gif" };
  if (txt(0, 4) === "RIFF" && txt(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (txt(4, 4) === "ftyp") {
    const marca = txt(8, 4);
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(marca)) return { mime: "image/heic", ext: "heic" };
    if (marca === "avif" || marca === "avis") return { mime: "image/avif", ext: "avif" };
    if (marca === "qt  ") return { mime: "video/quicktime", ext: "mov" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  if (txt(0, 4) === "\x1aE\xdf\xa3") return { mime: "video/webm", ext: "webm" };
  return null;
}

/** Baixa uma mídia do post e devolve um File com nome e tipo certos. */
export async function prepararMidia(m: MediaLike & { id: string }, titulo: string | undefined, indice: number): Promise<File> {
  const { data, error } = await supabase.functions.invoke("criapost-download-file", { body: { media_id: m.id } });
  if (error || !(data instanceof Blob) || data.size === 0) throw new Error("Não consegui baixar.");
  const tipo = await tipoReal(data);
  if (!tipo) throw new Error("O arquivo não veio como foto ou vídeo.");
  const base = mediaDownloadName(titulo, indice, m).replace(/\.[a-z0-9]+$/i, "");
  return new File([data], `${base}.${tipo.ext}`, { type: tipo.mime });
}

/** Roda as tarefas com no máximo `limite` ao mesmo tempo (o celular agradece). */
export async function emLotes<T>(itens: T[], limite: number, fazer: (item: T) => Promise<void>) {
  let i = 0;
  const trabalhador = async () => {
    while (i < itens.length) {
      const atual = itens[i++];
      await fazer(atual);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
}
