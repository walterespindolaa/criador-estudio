import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useCriaPostMedia, type CriaMedia } from "@/hooks/useCriaPostMedia";
import { useGoogleDrive, tokenDriveEmCache } from "@/hooks/useGoogleDrive";
import { levarVideoDoDriveProBunny } from "@/lib/bunny-ingestao";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { StoryPreview } from "@/components/accounts/StoryPreview";
import { CriaPostPublishButton } from "@/components/accounts/CriaPostPublishButton";
import { SalvarNoCelular } from "@/components/accounts/SalvarNoCelular";
import { PublicarNoInstagram } from "@/components/shared/PublicarNoInstagram";
import { CapaSobreVideo, EditorDeCapa, temCapa, useCapaDoPost } from "@/components/accounts/CapaDoReels";
import { postAspect } from "@/lib/post-aspect";
import { getDisplayImageUrl, getDriveFileId, getDriveImageFallbackUrl, getDriveViewPageUrl, isDriveMedia, isUnknownDriveMedia, isVideoMedia, downloadMediaFile, mediaDownloadName } from "@/lib/driveMedia";
import { driveJaRespondeu, useMidiaComTipoDrive } from "@/hooks/useMidiaComTipoDrive";
import { parseRefLinks, refLinkHref } from "@/lib/refLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, Loader2, Heart, MessageCircle, Send, Bookmark, GripVertical, X, Play, Download, ExternalLink, Paperclip, ChevronDown, Trash2, Undo2, History, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

// Lembra se a seção "Anexos e links" fica aberta (colapsada por padrão).
const ATT_OPEN_KEY = "criapost_att_open";

const MAX_MEDIA = 20;
const ACCEPTED_MSG = "Formato não aceito. Use imagens (JPG, PNG, WebP, GIF, HEIC) ou vídeos (MP4, MOV, WebM).";
const isImg = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
const isVid = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name);

function Thumb({ m, privado }: { m: CriaMedia; privado?: boolean }) {
  const video = isVideoMedia(m);
  // Drive: view_url é página, não imagem. O helper monta o thumbnail exibível.
  const src = (isDriveMedia(m) ? getDisplayImageUrl(m, 400) : m.thumbnail_url || m.view_url) || "";
  // Fallback pro Drive: se o thumbnail falhar, tenta o lh3.
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fb = getDriveImageFallbackUrl(m, 1000);
    if (fb && !img.dataset.fb) {
      img.dataset.fb = "1";
      img.src = fb;
      return;
    }
    img.style.display = "none";
  };
  return (
    <div className="relative w-full h-full bg-muted">
      {src ? <img src={src} alt="" draggable={false} loading="lazy" className="w-full h-full object-cover select-none" onError={onImgError} />
        : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileImage className="h-5 w-5" /></div>}
      {video && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play className="h-5 w-5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>}
      {/* SELO "PRIVADO NO DRIVE" (mockup aprovado 29/10/2026): o Drive não
          deixou ninguém de fora ver o arquivo. Some sozinho quando ele vira
          público. Só aparece pra quem edita: o link do cliente não usa isto. */}
      {privado && (
        <span title="Restrito no Drive: o cliente não consegue ver" className="absolute bottom-5 inset-x-0.5 z-10 flex items-center justify-center gap-1 rounded-full bg-white/95 px-1 py-px text-[9px] font-bold text-red-700 shadow">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />Privado
        </span>
      )}
    </div>
  );
}

// Evita o menu de "salvar imagem" do iOS e a seleção de texto enquanto a pessoa
// segura o punho pra reordenar.
const dragThumbStyle: CSSProperties = { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" };

/**
 * PUNHO DEDICADO da tira de mídias (mesmo padrão do kanban da Agenda e do Materiais).
 *
 * A miniatura INTEIRA como alça era a raiz do bug: a alça do @hello-pangea/dnd
 * ganha `data-rfd-drag-handle-draggable-id`, e a regra global do index.css crava
 * `touch-action: none !important` nela. Com a miniatura toda virando alça, e as
 * miniaturas cobrindo a tira inteira, NÃO SOBRAVA UM PIXEL onde o dedo pudesse
 * rolar: no celular a tira simplesmente não andava.
 *
 * Agora a alça é só esta barrinha embaixo da miniatura (64x20px, alvo de toque
 * folgado). Os outros ~44px de altura ficam sem `touch-action`, então o dedo
 * rola nativo por cima da miniatura e o arraste começa pegando o punho.
 */
function MediaGrip({ handleProps }: { handleProps?: DraggableProvidedDragHandleProps }) {
  return (
    <span {...(handleProps ?? {})} aria-label="Arrastar para reordenar"
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-10 h-5 grid place-items-center bg-black/60 text-white/95 cursor-grab active:cursor-grabbing touch-none">
      <GripVertical className="h-3.5 w-3.5 rotate-90" />
    </span>
  );
}

export function CriaPostMedia({ postId, platform, format, caption, handle, approved, title, referenceUrl, paraSair, onParaSairChange }: {
  postId: string; platform: string; format: string; caption?: string; handle?: string; approved?: boolean;
  title?: string; referenceUrl?: string | null;
  /** REMOÇÃO SÓ NO SALVAR (Gabriela, 16/10/2026: "eu exclui uma midia, apertei
   *  em cancelar mas já tinha apagado"). Quando o editor passa isto, o X só
   *  MARCA a mídia; quem apaga de verdade é o Salvar do post (removeMany) e o
   *  Cancelar só limpa a lista. Sem estas props, o X apaga na hora como antes. */
  paraSair?: string[]; onParaSairChange?: (ids: string[]) => void;
}) {
  const { list, antigas, uploadImage, uploadVideo, addDriveLink, remove, removeAll, reorder } = useCriaPostMedia(postId);
  const adiado = !!onParaSairChange;
  const sai = new Set(adiado ? (paraSair ?? []) : []);
  const [velhasOpen, setVelhasOpen] = useState(false);
  const qc = useQueryClient();
  const { pickAndSave, picking, pickerSupported } = useGoogleDrive();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const driveLinkRef = useRef<HTMLInputElement>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [showDrive, setShowDrive] = useState(false);
  // "Anexos e links" colapsável: começa fechada, mas lembra a escolha por device.
  const [attOpen, setAttOpen] = useState<boolean>(() => { try { return localStorage.getItem(ATT_OPEN_KEY) === "1"; } catch { return false; } });
  const toggleAtt = () => setAttOpen((o) => { const n = !o; try { localStorage.setItem(ATT_OPEN_KEY, n ? "1" : "0"); } catch { /* segue */ } return n; });
  const [order, setOrder] = useState<string[]>([]);
  const dirty = useRef(false);
  const busy = uploadImage.isPending || uploadVideo.isPending || addDriveLink.isPending;
  // Capa do Reels (28/09/2026): só formatos de vídeo têm capa no Instagram.
  const comCapa = temCapa(format);
  const { capa } = useCapaDoPost(comCapa ? postId : null);

  const media = list.data ?? [];
  const count = media.length;
  const full = count >= MAX_MEDIA;
  const remaining = () => MAX_MEDIA - (list.data?.length ?? 0);
  // Contador da seção "Anexos e links" (mídias + os links de referência, se houver).
  // O campo Ideia/Referência aceita vários links (um por linha), então conta todos.
  const refLinks = parseRefLinks(referenceUrl);
  const hasRef = refLinks.length > 0;
  const attCount = count + refLinks.length;

  useEffect(() => { if (!dirty.current) setOrder(media.map((m) => m.id)); }, [media]); // eslint-disable-line react-hooks/exhaustive-deps

  /* RESGATE DO VÍDEO PRESO NO DRIVE (01/10/2026). Vídeo anexado antes da
     passagem pelo servidor pode ter ficado no player do Drive (qualidade baixa,
     barra do Google). Abrir o post já pede a passagem pro Bunny: com o token do
     Drive desta sessão se houver, senão pelo download público. Ninguém clica em
     nada, e a edge ignora o que já foi ou está indo. */
  useEffect(() => {
    for (const m of media) {
      const video = (m.file_type ?? "").startsWith("video/");
      if (m.provider === "gdrive" && video) void levarVideoDoDriveProBunny(m.id, tokenDriveEmCache());
    }
  }, [media]);

  useEffect(() => {
    if (!dirty.current) return;
    const ids = order;
    const t = setTimeout(() => { reorder.mutate(ids, { onSettled: () => { dirty.current = false; } }); }, 600);
    return () => clearTimeout(t);
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered: CriaMedia[] = order.length
    ? (order.map((id) => media.find((m) => m.id === id)).filter(Boolean) as CriaMedia[])
    : media;

  // ===== TIRA DE MINIATURAS: rolagem + reordenação =====
  // Três formas de rolar a tira, todas vivas ao mesmo tempo:
  //  1) roda do mouse / trackpad e a barra de rolagem (overflow-x-auto + kanban-scroll);
  //  2) clicar no vazio (ou em cima da miniatura) e arrastar, via useDragScroll;
  //  3) dedo no celular, rolagem nativa, porque só o punho tem touch-action:none.
  // A rolagem AUTOMÁTICA durante o arraste vem de graça do @hello-pangea/dnd:
  // ele acha o container de rolagem mais próximo ACIMA do Droppable, que é
  // exatamente esta div. Por isso o overflow fica aqui e não no Droppable.
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const tiraEl = useRef<HTMLDivElement | null>(null);
  // Sombras nas bordas: numa tira que corta exatamente na miniatura, ninguém
  // percebe que tem mais coisa pro lado. A sombra só aparece do lado que tem.
  const [maisEsq, setMaisEsq] = useState(false);
  const [maisDir, setMaisDir] = useState(false);
  const medirTira = useCallback(() => {
    const el = tiraEl.current;
    if (!el) { setMaisEsq(false); setMaisDir(false); return; }
    const sobra = el.scrollWidth - el.clientWidth;
    setMaisEsq(el.scrollLeft > 4);
    setMaisDir(sobra - el.scrollLeft > 4);
  }, []);
  const tiraRef = useCallback((el: HTMLDivElement | null) => {
    tiraEl.current = el;
    dragScrollRef(el);
    medirTira();
  }, [dragScrollRef, medirTira]);
  useEffect(() => {
    medirTira();
    window.addEventListener("resize", medirTira);
    return () => window.removeEventListener("resize", medirTira);
  }, [medirTira, ordered.length]);

  // Reordena no drop e deixa o debounce de 600ms lá em cima salvar no banco.
  const onMediaDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const de = r.source.index;
    const para = r.destination.index;
    if (de === para) return;
    const ids = ordered.map((m) => m.id);
    const [movido] = ids.splice(de, 1);
    ids.splice(para, 0, movido);
    dirty.current = true;
    setOrder(ids);
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") => {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (!files.length) return;
    const slots = remaining();
    if (slots <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    const take = files.slice(0, slots);
    if (files.length > slots) toast.warning(`Só cabem mais ${slots}. Enviando as primeiras ${slots}.`);
    let okImg = 0;
    for (const f of take) {
      const wantVideo = kind === "video";
      if (wantVideo ? !isVid(f) : !isImg(f)) { toast.error(ACCEPTED_MSG); continue; }
      try {
        if (wantVideo) { await uploadVideo.mutateAsync(f); toast.success("Vídeo enviado, processando…"); }
        else { await uploadImage.mutateAsync(f); okImg++; }
      } catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload"); }
    }
    if (okImg === 1) toast.success("Mídia adicionada");
    else if (okImg > 1) toast.success(`${okImg} mídias adicionadas`);
  };

  const onDrive = async () => {
    if (!driveUrl.trim()) return;
    if (remaining() <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    try {
      const r = await addDriveLink.mutateAsync(driveUrl.trim());
      setDriveUrl(""); setShowDrive(false);
      // Quando não deu pra descobrir se é imagem ou vídeo, avisa o motivo real em vez
      // de deixar a prévia mostrar um play em cima de uma arte estática.
      if (r?.resolved) toast.success("Link adicionado");
      /* Aviso FIXO (29/10/2026): o amarelo que sumia sozinho passou batido e o
         cliente recebeu 5 vídeos sem play. Agora fica até a pessoa fechar. */
      else toast.warning("Esse arquivo está Restrito no Drive: o cliente não vai conseguir ver nem dar play.", {
        description: "No Drive: Compartilhar → Acesso geral → \"Qualquer pessoa com o link\". Depois de liberar, a prévia se corrige sozinha.",
        duration: Infinity, closeButton: true,
      });
    }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao adicionar"); }
  };

  // No editor do post: só marca (ver paraSair). Fora dele: remoção otimista na hora.
  const onRemoveMedia = (id: string) => {
    if (adiado) { if (!sai.has(id)) onParaSairChange!([...sai, id]); return; }
    remove.mutate(id, { onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao remover") });
  };

  // Exclui TODAS as mídias do post de uma vez (com confirmação), também otimista.
  const onRemoveAll = async () => {
    if (!media.length) return;
    if (adiado) {
      const ok = await confirmar({
        titulo: "Tirar todas as mídias?",
        descricao: "Elas ficam marcadas e só são apagadas quando você clicar em Salvar. Se cancelar, voltam todas.",
        acao: "Tirar todas",
      });
      if (ok) onParaSairChange!(media.map((m) => m.id));
      return;
    }
    const ok = await confirmar({
      titulo: "Excluir todas as mídias?",
      descricao: "Isso apaga todas as mídias anexadas a este post. Não dá pra desfazer.",
      acao: "Excluir todas",
    });
    if (!ok) return;
    removeAll.mutate(media.map((m) => m.id), {
      onSuccess: () => toast.success("Mídias removidas"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao remover"),
    });
  };

  // Abre/prevê um anexo: Drive vai pro /view do arquivo; imagem cheia e vídeo
  // (player do Bunny) abrem em nova aba.
  const openMedia = (m: CriaMedia) => {
    if (isDriveMedia(m)) { const u = getDriveViewPageUrl(m); if (u) window.open(u, "_blank", "noopener,noreferrer"); return; }
    const u = m.view_url || m.thumbnail_url;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  // Seleciona do Drive (multi): abre o seletor do Google, entra em pastas e marca
  // várias fotos de uma vez. Ideal pro carrossel. Depois recarrega a mídia.
  const onDrivePicker = async () => {
    if (remaining() <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    // No celular/PWA o seletor do Google não funciona (o popup de OAuth é bloqueado
    // e o dialog do Picker é de desktop). Em vez de um botão que só dá erro, abre e
    // foca o campo "Link Drive", que resolve o mesmo caso: copiar o link no app do
    // Drive e colar aqui (o tipo do arquivo é detectado sozinho).
    if (!pickerSupported) {
      setShowDrive(true);
      toast.info("No celular, abra o app do Drive, toque em Compartilhar > Copiar link e cole no campo aqui embaixo.");
      setTimeout(() => driveLinkRef.current?.focus(), 80);
      return;
    }
    try {
      await pickAndSave(postId);
      qc.invalidateQueries({ queryKey: ["criapost-media", postId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não consegui abrir o Drive"); }
  };

  // Download INDIVIDUAL de uma mídia (util compartilhado em driveMedia.ts):
  // Storage baixa o blob, Drive manda pro link de download, vídeo abre o player.
  const [dlId, setDlId] = useState<string | null>(null);
  const onDownloadOne = async (m: CriaMedia, index: number) => {
    setDlId(m.id);
    try {
      const kind = await downloadMediaFile(m, mediaDownloadName(title, index, m));
      if (kind === "video") toast.info("Não achei o arquivo do vídeo: abri o player numa aba nova.");
      else if (kind === "opened") toast.info(m.file_type?.startsWith("video") || m.provider === "bunny" ? "Abri o vídeo numa aba nova: é só salvar de lá." : "Abri a imagem, é só segurar pra salvar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui baixar.");
    } finally {
      setDlId(null);
    }
  };

  const [zipping, setZipping] = useState(false);
  // Baixa todas as mídias (qualidade original) numeradas + legenda.txt num .zip.
  // Fetch direto (não invoke) pra receber o zip como BINÁRIO em stream e conseguir
  // ler o corpo do erro (motivo real) e os headers (nome + quantos pularam).
  const onDownloadZip = async () => {
    setZipping(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/criapost-download-zip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) {
        // Lê o motivo real da edge em vez de só "non-2xx status code".
        let motivo = `Erro ${res.status}`;
        try { const j = await res.json(); if (j?.error) motivo = String(j.error); } catch { /* corpo não-JSON */ }
        throw new Error(motivo);
      }
      const blob = await res.blob();
      const filename = res.headers.get("X-Zip-Filename") || "post.zip";
      const skipped = Number(res.headers.get("X-Zip-Skipped") || "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      if (skipped) toast.warning(`${skipped} mídia(s) não entraram (ex.: vídeo ou arquivo muito grande). Veja _avisos.txt no zip.`);
      else toast.success("Download pronto!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui gerar o zip.");
    } finally { setZipping(false); }
  };

  // O que continua no post (sem o que está marcado pra sair): é isto que a prévia,
  // o publicar e o "salvar no celular" usam.
  const visiveis = sai.size ? ordered.filter((m) => !sai.has(m.id)) : ordered;
  // Drive que continua sem tipo DEPOIS de perguntar de novo = arquivo Restrito.
  const comTipoDrive = useMidiaComTipoDrive(ordered);
  const privados = new Set(comTipoDrive
    .filter((m) => isUnknownDriveMedia(m) && driveJaRespondeu(getDriveFileId(m)))
    .map((m) => m.id));
  const primeiroPrivado = ordered.find((m) => privados.has(m.id) && !sai.has(m.id));
  const nPrivados = ordered.filter((m) => privados.has(m.id) && !sai.has(m.id)).length;
  const aspect = postAspect(platform, format);
  const vertical = aspect === "9 / 16";
  const isStory = (format || "").toLowerCase() === "story";
  const h = handle ? (handle.startsWith("@") ? handle : "@" + handle) : "@cliente";
  // Normaliza a legenda pra prévia: tira espaços no fim de cada linha, colapsa
  // 3+ quebras em no máximo 2 (uma linha em branco) e dá trim nas pontas.
  const cap = (caption ?? "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const onReady = () => toast.success("Vídeo pronto!");

  return (
    <div className="space-y-3">
      {/* Publicar direto pelo Cria (ciclo 5). Só aparece pra conta que pode;
          antes da aprovação do cliente mostra que libera depois. */}
      <PublicarNoInstagram postId={postId} formato={format} />
      {approved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-body font-bold text-green-800">Aprovado pelo cliente, pronto pra publicar.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CriaPostPublishButton caption={caption ?? ""} media={visiveis} />
            <Button type="button" size="sm" variant="outline" disabled={zipping || count === 0} onClick={onDownloadZip}>{zipping ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Baixar tudo (.zip)</Button>
          </div>
        </div>
      )}

      {/* Celular: todas as mídias pra Galeria de uma vez (no computador não aparece). */}
      <SalvarNoCelular midias={visiveis} titulo={title} />

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={imgRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => onPick(e, "image")} />
        <input ref={vidRef} type="file" accept="video/*" multiple hidden onChange={(e) => onPick(e, "video")} />
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => imgRef.current?.click()}><ImagePlus className="h-4 w-4 mr-1.5" /> Imagem</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => vidRef.current?.click()}><Video className="h-4 w-4 mr-1.5" /> Vídeo</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full || picking} onClick={onDrivePicker}>{picking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileImage className="h-4 w-4 mr-1.5" />} Selecionar do Drive</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => setShowDrive((s) => !s)}><Link2 className="h-4 w-4 mr-1.5" /> Link Drive</Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className={`ml-auto text-xs font-body ${full ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>{count}/{MAX_MEDIA}</span>
      </div>

      {showDrive && (
        <div>
          <div className="flex items-center gap-2">
            <Input ref={driveLinkRef} value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Cole o link do Google Drive" className="h-9 rounded-xl" />
            <Button type="button" size="sm" onClick={onDrive} disabled={addDriveLink.isPending}>Adicionar</Button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-1.5">
            Cole o link do <strong>arquivo</strong>, não o da pasta. E deixe o arquivo como <strong>"Qualquer pessoa com o link"</strong> no Drive, senão a prévia não aparece.
          </p>
        </div>
      )}

      {/* A capa mora logo abaixo dos botões de mídia: é parte do que sobe. */}
      {comCapa && <EditorDeCapa postId={postId} />}

      {ordered.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[11px] text-muted-foreground font-body">
              Arraste pela barrinha <GripVertical className="inline-block h-3 w-3 rotate-90 align-text-bottom" /> pra reordenar
            </p>
            {/* Total à direita: junto com a sombra da borda, é o que avisa que
                existem mais mídias fora da área visível. */}
            <span className="ml-auto shrink-0 text-[11px] font-body text-muted-foreground/80 tabular-nums">{ordered.length} mídias</span>
          </div>
          <div className="relative">
            <DragDropContext onDragEnd={onMediaDragEnd}>
              {/* O container de rolagem é ESTE (pai do Droppable): é assim que o
                  dnd descobre quem rolar sozinho quando o arraste encosta na borda. */}
              {/* pb-2.5 reserva a altura da barrinha (10px do .kanban-scroll) pra ela
                  não encostar nas miniaturas em Windows/Linux, onde a barra ocupa espaço. */}
              <div ref={tiraRef} onScroll={medirTira} className="overflow-x-auto overflow-y-hidden pb-2.5 kanban-scroll">
                {/* O respiro entre miniaturas é MARGEM (mr-2), não `gap`: o dnd mede a
                    margin-box de cada item pra calcular o quanto empurrar os vizinhos,
                    e `gap` ele não enxerga (os itens ficariam desalinhados no arraste). */}
                <Droppable droppableId="criapost-media" direction="horizontal">
                  {(dropP) => (
                    <div ref={dropP.innerRef} {...dropP.droppableProps} className="flex w-max">
                      {ordered.map((m, i) => (
                        <Draggable key={m.id} draggableId={m.id} index={i} disableInteractiveElementBlocking>
                          {(dragP, dragS) => {
                            const item = (
                              // data-drag-scroll-through: o corpo da miniatura não é punho,
                              // então ele pode rolar a tira no mouse (veja useDragScroll).
                              <div ref={dragP.innerRef} {...dragP.draggableProps} data-drag-scroll-through=""
                                style={{ ...dragP.draggableProps.style, ...dragThumbStyle }}
                                className={`relative shrink-0 w-16 h-16 mr-2 rounded-xl overflow-hidden border bg-muted select-none ${sai.has(m.id) ? "border-2 border-dashed border-destructive opacity-40" : "border-border"} ${dragS.isDragging ? "ring-2 ring-primary/50 shadow-lg" : ""}`}>
                                <Thumb m={m} privado={privados.has(m.id)} />
                                <span className="absolute top-0.5 left-0.5 z-10 bg-black/65 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{i + 1}</span>
                                {sai.has(m.id)
                                  ? <button type="button" onClick={() => onParaSairChange!([...sai].filter((x) => x !== m.id))} aria-label="Desfazer" title="Desfazer" className="absolute top-0.5 right-0.5 z-20 bg-white text-destructive border border-destructive/40 rounded-full p-0.5"><Undo2 className="h-3 w-3" /></button>
                                  : <button type="button" onClick={() => onRemoveMedia(m.id)} aria-label="Remover mídia" className="absolute top-0.5 right-0.5 z-20 bg-black/65 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>}
                                <MediaGrip handleProps={dragP.dragHandleProps ?? undefined} />
                              </div>
                            );
                            // Enquanto arrasta, o dnd usa position:fixed. Como o editor é um
                            // Dialog com translate (o transform vira bloco de contenção do
                            // fixed), a miniatura sairia deslocada do cursor. Mandar o item
                            // que está sendo arrastado pro <body> resolve.
                            return dragS.isDragging ? createPortal(item, document.body) : item;
                          }}
                        </Draggable>
                      ))}
                      {dropP.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </DragDropContext>
            {maisEsq && <span aria-hidden className="pointer-events-none absolute left-0 top-0 bottom-2.5 w-6 rounded-l-xl bg-gradient-to-r from-black/15 to-transparent" />}
            {maisDir && <span aria-hidden className="pointer-events-none absolute right-0 top-0 bottom-2.5 w-6 rounded-r-xl bg-gradient-to-l from-black/15 to-transparent" />}
          </div>
        </div>
      )}

      {sai.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-body text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{sai.size === 1 ? "1 mídia vai sair" : `${sai.size} mídias vão sair`} quando você clicar em <strong>Salvar</strong>.</span>
          <button type="button" onClick={() => onParaSairChange!([])} className="ml-auto font-bold underline">Desfazer</button>
        </div>
      )}

      {/* Anexos e links: COLAPSÁVEL e compacto (estilo Trello). Um cabeçalho com
          contador expande a lista de anexos (mídia + Drive) e do reference_url.
          Cada anexo é clicável (abre/prevê) + download; Drive abre direto no /view.
          "Excluir todas" apaga tudo de uma vez (otimista, com confirmação). */}
      {(ordered.length > 0 || hasRef) && (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <button type="button" onClick={toggleAtt} aria-expanded={attOpen}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Anexos e links ({attCount})</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${attOpen ? "rotate-180" : ""}`} />
          </button>

          {attOpen && (
            <div className="px-3 pb-3 space-y-2 border-t border-border">
              {/* BAIXAR TODAS (Gabriela, 16/10/2026): sempre à mão, não só depois da
                  aprovação. O arquivo vem da designer e ela precisa dele antes. */}
              {ordered.length > 0 && (
                <div className="flex justify-end gap-1 pt-2 -mb-0.5 flex-wrap">
                  <Button type="button" size="sm" variant="ghost" disabled={zipping}
                    className="h-8 text-primary hover:text-primary hover:bg-primary/10" onClick={onDownloadZip}>
                    {zipping ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />} Baixar todas (.zip)
                  </Button>
                  {ordered.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" disabled={removeAll.isPending}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onRemoveAll}>
                    {removeAll.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />} Excluir todas
                  </Button>
                  )}
                </div>
              )}

              {ordered.map((m, i) => {
                const drive = isDriveMedia(m);
                const video = isVideoMedia(m);
                // No Drive a gente já descobre o tipo real do arquivo, então mostra
                // "Drive · imagem" / "Drive · vídeo". Só fica "Drive" quando o arquivo
                // não é público e o tipo continua desconhecido.
                const tipo = drive
                  ? (video ? "Drive · vídeo" : m.file_type ? "Drive · imagem" : privados.has(m.id) ? "Drive · restrito, o cliente não vê" : "Drive")
                  : video ? "Vídeo" : "Imagem";
                const marcada = sai.has(m.id);
                return (
                  <div key={m.id} className={`flex items-center gap-2.5 ${marcada ? "rounded-lg bg-red-50 -mx-1.5 px-1.5 py-1" : ""}`}>
                    {/* Linha clicável: abre/prevê o arquivo (imagem cheia/Drive/vídeo). */}
                    <button type="button" onClick={() => openMedia(m)} title="Abrir / visualizar" className="flex items-center gap-2.5 min-w-0 flex-1 text-left group">
                      <span className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border bg-muted"><Thumb m={m} /></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs font-body truncate ${marcada ? "line-through text-red-800" : "text-foreground group-hover:text-primary group-hover:underline"}`}>{m.file_name || `Mídia ${i + 1}`}</span>
                        <span className={`block text-[10px] font-body ${marcada ? "text-red-700" : "text-muted-foreground"}`}>{marcada ? "sai quando você salvar" : tipo}</span>
                      </span>
                    </button>
                    {drive && (
                      <button type="button" title="Abrir no Drive"
                        onClick={() => { const u = getDriveViewPageUrl(m); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => onDownloadOne(m, i)} disabled={dlId === m.id} title="Baixar este arquivo"
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-50 transition-colors">
                      {dlId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </button>
                    {marcada ? (
                      <button type="button" onClick={() => onParaSairChange!([...sai].filter((x) => x !== m.id))} title="Desfazer"
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 bg-white text-red-700 hover:border-red-400 transition-colors">
                        <Undo2 className="h-4 w-4" />
                      </button>
                    ) : (
                    <button type="button" onClick={() => onRemoveMedia(m.id)} title="Remover"
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                );
              })}

              {refLinks.map((url, i) => (
                <a key={`ref-${i}`} href={refLinkHref(url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
                  <span className="shrink-0 w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground"><Link2 className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-body text-primary group-hover:underline truncate">
                      {refLinks.length > 1 ? `Referência / ideia ${i + 1}` : "Referência / ideia"}
                    </span>
                    <span className="block text-[10px] font-body text-muted-foreground truncate">{url}</span>
                  </span>
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground group-hover:text-primary transition-colors"><ExternalLink className="h-4 w-4" /></span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VERSÕES ANTERIORES (Gabriela, 16/10/2026): o que a designer trocou numa
          revisão sai da lista acima e fica aqui, fechado, só pra consulta. */}
      {(antigas.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <button type="button" onClick={() => setVelhasOpen((o) => !o)} aria-expanded={velhasOpen}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
            <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Versões anteriores ({antigas.data!.length})</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${velhasOpen ? "rotate-180" : ""}`} />
          </button>
          {velhasOpen && (
            <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border">
              <p className="text-[11px] font-body text-muted-foreground">Só consulta: não entra na prévia, no link do cliente nem no zip.</p>
              {antigas.data!.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <button type="button" onClick={() => openMedia(m)} title="Abrir / visualizar" className="flex items-center gap-2.5 min-w-0 flex-1 text-left group">
                    <span className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border bg-muted grayscale-[.5] opacity-80"><Thumb m={m} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-body text-foreground truncate group-hover:text-primary group-hover:underline">
                        {m.file_name || `Mídia ${i + 1}`}
                        <span className="ml-1.5 rounded px-1 py-px text-[10px] font-bold text-violet-700 bg-violet-100">v{(m.rodada ?? 0) + 1}</span>
                      </span>
                      <span className="block text-[10px] font-body text-muted-foreground">
                        trocada numa revisão{m.created_at ? ` · enviada em ${new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}
                      </span>
                    </span>
                  </button>
                  <button type="button" onClick={() => onDownloadOne(m, i)} disabled={dlId === m.id} title="Baixar este arquivo"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-50 transition-colors">
                    {dlId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {primeiroPrivado && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-body font-bold text-red-900">
              {nPrivados === 1 ? "1 arquivo está Restrito no Drive" : `${nPrivados} arquivos estão Restritos no Drive`}
            </p>
            <p className="text-[12px] font-body text-red-900/80 mt-0.5">O cliente não vai conseguir ver nem dar play. No Drive: Compartilhar → Acesso geral → "Qualquer pessoa com o link".</p>
          </div>
          <Button type="button" size="sm" className="shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
            onClick={() => { const u = getDriveViewPageUrl(primeiroPrivado); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}>
            Abrir no Drive
          </Button>
        </div>
      )}

      {isStory ? (
        <div className="mx-auto w-full max-w-[300px]">
          <StoryPreview media={visiveis} handle={handle} onRemove={onRemoveMedia} />
        </div>
      ) : (
      <div className={`bg-white border border-border rounded-2xl overflow-hidden mx-auto ${vertical ? "max-w-[360px]" : "max-w-[440px]"}`}>
        {vertical ? (
          <div className="relative">
            {/* Com capa, a prévia abre NA CAPA, como o Reels aparece no feed;
                tocar mostra o vídeo. */}
            <CapaSobreVideo capa={comCapa && visiveis.length <= 1 ? capa : null}>
              <PostMediaCarousel media={visiveis} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            </CapaSobreVideo>
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />
            <div className="absolute right-3 bottom-14 z-10 flex flex-col items-center gap-3.5 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
              <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6" />
            </div>
            {cap && (
              <div className="absolute left-3 right-14 bottom-3 z-10 text-white text-[12px] leading-snug pointer-events-none line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
                <span className="font-bold mr-1">{h}</span>{cap}
              </div>
            )}
          </div>
        ) : (
          <>
            <CapaSobreVideo capa={comCapa && visiveis.length <= 1 ? capa : null}>
              <PostMediaCarousel media={visiveis} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            </CapaSobreVideo>
            <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground/80">
              <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /><Bookmark className="h-5 w-5 ml-auto" />
            </div>
            {cap
              ? <p className="px-3.5 pb-3.5 text-[13px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{h}</span>{cap}</p>
              : <p className="px-3.5 pb-3.5 text-xs text-muted-foreground">A legenda aparece aqui.</p>}
          </>
        )}
      </div>
      )}
    </div>
  );
}
