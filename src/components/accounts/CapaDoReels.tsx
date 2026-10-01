import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, ImagePlus, Loader2, Play, Trash2 } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/shared/Confirm";

/* ═══════════════════════════════════════════════════════════════════════════
   CAPA DO REELS (Walter, 28/09/2026)

   "Quando for um Reels, eu ter opção de inserir capa, e se a capa for
   inserida, na visualização do Cria Post já vai aparecer a pré-visualização
   com a capa."

   A capa é o que aparece no grid do perfil e no feed antes do play. Sem ela,
   a prévia (e o cliente no portal) via o primeiro frame do vídeo e aprovava
   sem ver a capa de verdade.

   A imagem sobe pro bucket `media` na pasta de quem subiu e a URL fica em
   posts.cover_url (migration 20260928000015). Formatos que usam capa: Reels,
   vídeo e Shorts.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export const FORMATOS_COM_CAPA = ["reels", "reel", "video", "shorts"];
export const temCapa = (format: string | null | undefined) =>
  FORMATOS_COM_CAPA.includes((format ?? "").toLowerCase());

const MAX_BYTES = 8 * 1024 * 1024;

/* A capa vira JPEG de até 1080 de largura antes de subir. O Instagram só aceita
   JPEG como capa de Reels, e PNG de 6 MB é peso à toa no portal do cliente.
   Se o navegador não conseguir converter, PARA com erro: subir PNG com nome de
   .jpg quebraria a publicação do Reels inteiro (revisão 28/09). */
async function paraJpeg(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1080 / bmp.width);
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.fillStyle = "#ffffff"; // PNG transparente não vira fundo preto
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) throw new Error("sem blob");
    return blob;
  } catch {
    throw new Error("Não consegui preparar essa imagem. Exporte em JPG e tente de novo.");
  }
}

export function useCapaDoPost(postId: string | null) {
  const qc = useQueryClient();
  const chave = ["capa-do-post", postId];
  const q = useQuery<string | null>({
    queryKey: chave,
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select("cover_url").eq("id", postId).maybeSingle();
      // Coluna ainda não existe (migration não rodou): sem capa, sem tela quebrada.
      if (error) return null;
      return ((data as { cover_url?: string | null } | null)?.cover_url ?? null) || null;
    },
  });

  const salvar = useMutation({
    mutationFn: async (url: string | null) => {
      const { error } = await sbFrom("posts").update({ cover_url: url }).eq("id", postId);
      if (error) throw new Error(/cover_url/.test(error.message)
        ? "A capa ainda não está ligada no banco (falta rodar a migration da capa)."
        : error.message);
      return url;
    },
    onSuccess: (url) => {
      qc.setQueryData(chave, url);
      toast.success(url ? "Capa salva. A prévia já mostra ela." : "Capa removida.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar a capa."),
  });

  const subir = useMutation({
    mutationFn: async (arquivo: File) => {
      if (!postId) throw new Error("Salve o post antes de escolher a capa.");
      if (!/^image\//.test(arquivo.type) && !/\.(jpe?g|png|webp)$/i.test(arquivo.name)) {
        throw new Error("A capa precisa ser uma imagem (JPG, PNG ou WebP).");
      }
      if (arquivo.size > MAX_BYTES) throw new Error("Imagem acima de 8 MB. Exporte menor (1080x1920 basta).");
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Faça login de novo.");
      // Sempre JPEG: é o que o Instagram aceita como capa na publicação.
      const jpeg = await paraJpeg(arquivo);
      const caminho = `${uid}/capas/${postId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("media")
        .upload(caminho, jpeg, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("media").getPublicUrl(caminho);
      return pub.publicUrl;
    },
    onSuccess: (url) => salvar.mutate(url),
    onError: (e: Error) => toast.error(e.message || "Não consegui subir a capa."),
  });

  return { capa: q.data ?? null, carregando: q.isLoading, subir, salvar };
}

/** O bloco do editor: miniatura 9:16 + escolher, trocar, remover. */
export function EditorDeCapa({ postId }: { postId: string }) {
  const { capa, subir, salvar } = useCapaDoPost(postId);
  const input = useRef<HTMLInputElement | null>(null);
  /* DO DRIVE TAMBÉM (Gabriela, 30/09/2026: "preciso que dê pra eu selecionar
     do drive a capa do reels"). As artes do cliente moram no Drive; baixar
     pro computador só pra subir de novo era passo à toa. O arquivo escolhido
     passa pelo MESMO caminho do upload (vira JPEG e sobe no bucket), então a
     capa continua valendo na publicação do Reels. */
  const { pickOneImage, picking } = useGoogleDrive();
  const doDrive = async () => { const f = await pickOneImage(); if (f) subir.mutate(f); };
  const ocupado = subir.isPending || salvar.isPending || picking;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir.mutate(f); e.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} disabled={ocupado}
        aria-label={capa ? "Trocar a capa" : "Escolher a capa"}
        className="relative w-12 shrink-0 aspect-[9/16] rounded-lg overflow-hidden border border-border bg-muted grid place-items-center hover:border-primary/50 transition-colors">
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          : capa ? <img src={capa} alt="Capa do Reels" className="absolute inset-0 w-full h-full object-cover" />
          : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-body font-bold text-foreground">Capa do Reels</p>
        <p className="text-[11px] font-body text-muted-foreground leading-snug">
          {capa ? "Aparece na prévia, no link do cliente e no grid do perfil." : "Opcional. 1080x1920, do computador ou do Drive. Sem capa, vale o primeiro frame do vídeo."}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button type="button" size="sm" variant="outline" className="h-8" disabled={ocupado} onClick={() => input.current?.click()}>
          {capa ? "Trocar" : "Escolher"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2.5" disabled={ocupado} onClick={doDrive}
          title="Escolher a capa no Google Drive">
          {picking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline ml-1">Drive</span>
        </Button>
        {capa && (
          <button type="button" aria-label="Remover capa" disabled={ocupado}
            onClick={async () => { if (await confirmar({ titulo: "Remover a capa?", descricao: "A prévia volta a mostrar o primeiro frame do vídeo.", acao: "Remover" })) salvar.mutate(null); }}
            className="h-8 w-8 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A capa por cima do vídeo, como no Instagram antes do play. Tocar tira a capa
 * e mostra o vídeo (que continua ali embaixo, com o player de sempre).
 * Sem capa, não desenha nada: o filho aparece como antes.
 */
export function CapaSobreVideo({ capa, children }: { capa: string | null | undefined; children: ReactNode }) {
  // Chave pela URL: trocou a capa, ela volta pra frente mesmo depois de um play.
  return <CapaSobreVideoInterna key={capa ?? "sem-capa"} capa={capa}>{children}</CapaSobreVideoInterna>;
}

function CapaSobreVideoInterna({ capa, children }: { capa: string | null | undefined; children: ReactNode }) {
  const [vendoVideo, setVendoVideo] = useState(false);
  /* CAPA SÓ APARECE INTEIRA (Walter, 01/10/2026: "tive que carregar 3x a
     página porque tava cortando a imagem"). A capa é um JPEG de 200 a 300 KB
     e o navegador pinta a imagem conforme os bytes chegam, de cima pra baixo.
     No 4G do cliente, por alguns segundos, a metade de cima era a capa e a de
     baixo o frame do vídeo que estava embaixo: parecia imagem cortada. Ao
     recarregar ela já vinha do cache e o problema sumia, por isso o "3x".
     Agora a capa fica invisível até terminar de carregar e entra inteira, de
     uma vez (sem fade: durante o fade o frame do vídeo aparecia por baixo). Enquanto isso, um fundo escuro neutro cobre o slot (sem o
     selo "capa", que antes aparecia em cima do frame errado). Se a capa
     falhar, o overlay sai e o vídeo fica à mostra, em vez de imagem quebrada. */
  const [carregada, setCarregada] = useState(false);
  const [falhou, setFalhou] = useState(false);
  // Imagem que já estava no cache pode terminar antes do React ligar o onLoad.
  const jaPronta = (el: HTMLImageElement | null) => { if (el?.complete && el.naturalWidth > 0) setCarregada(true); };
  return (
    <div className="relative">
      {children}
      {capa && !vendoVideo && !falhou && (
        <button type="button" onClick={() => setVendoVideo(true)} aria-label="Ver o vídeo"
          className="absolute inset-0 z-[5] block w-full h-full overflow-hidden group">
          {/* Fundo SÓLIDO: o pulse anima opacidade, e se fosse nele o frame do vídeo
              aparecia por baixo a cada pulso. Só o brilho de cima pulsa. */}
          {!carregada && <span className="absolute inset-0 bg-neutral-900" aria-hidden><span className="absolute inset-0 bg-white/[0.06] animate-pulse" /></span>}
          <img ref={jaPronta} src={capa} alt="Capa do Reels" decoding="async"
            onLoad={() => setCarregada(true)} onError={() => setFalhou(true)}
            className={`absolute inset-0 w-full h-full object-cover ${carregada ? "opacity-100" : "opacity-0"}`} />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform group-hover:scale-105">
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
            </span>
          </span>
          {carregada && <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-body font-bold text-white">capa</span>}
        </button>
      )}
    </div>
  );
}
