import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext, Droppable, Draggable,
  type DropResult, type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  Sparkles, MessageSquareText, FileCode2, Anchor, PenLine, MessageSquare,
  ClipboardList, BarChart3, Eye, Bookmark, Target, Clock, Cloud, Image as ImageIcon, X, Trash2,
  Layers, Type, Radio, MousePointerClick, Link as LinkIcon, Download, BookOpen, CircleHelp,
  Loader2, Hash, Copy, Repeat2, Recycle, FileText, ListChecks, Calendar, ChevronDown,
  RefreshCw, Minus, Plus, SmilePlus, Briefcase, StickyNote,
  GripVertical,
  Play, Video, ExternalLink,
} from "lucide-react";
import { useTour } from "@/components/tour/TourProvider";
import { cn } from "@/lib/utils";
import { validateUpload } from "@/lib/upload-validation";
import { getFormatStructure } from "@/lib/format-structures";
import { PostTasks } from "./PostTasks";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import { StickerCelebration } from "@/components/shared/StickerCelebration";
import { FORMAT_LABELS, PLATFORMS, FORMATS, STATUS_OPTIONS, BUNNY_CDN_HOSTNAME } from "@/lib/constants";
import * as tus from "tus-js-client";

const VIDEO_EXTS = ["mov", "mp4", "m4v", "webm", "avi", "mkv", "hevc", "3gp"];
const HEIC_EXTS = ["heic", "heif"];
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB, teto de sanidade pro Bunny

/**
 * Decode HEIC nativamente via <img> + canvas. Funciona em iPhone/Safari/WebKit
 * (sistema decoda HEIC). Em Chrome/Windows lança erro → cai no heic2any.
 */
async function heicToJpegNative(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("native HEIC decode failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.drawImage(img, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob null")), "image/jpeg", 0.9),
    );
    return new File(
      [blob],
      file.name.replace(/\.(heic|heif)$/i, ".jpg"),
      { type: "image/jpeg" },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
import { getStatusClasses } from "@/lib/statusColors";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  filterReferences, generateArchiveSummary, callAIContextBuilder,
  type CaptionScore,
} from "@/lib/ai/claude";
import { ScriptEditor, emptySection, type Section } from "./drawer/ScriptEditor";
import { ArtStudio } from "./ArtStudio";
import { CarouselWriter } from "./CarouselWriter";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
import { RepurposeSheet } from "./RepurposeSheet";
import { BestTimesHint } from "@/components/shared/BestTimesHint";
import { PostPreviewModal, PostPreviewContent } from "./PostPreviewModal";
import { PublishButton } from "./PublishButton";
import { useProfile } from "@/hooks/useProfile";
import { usePostPreviewIdentity } from "@/hooks/usePostPreviewIdentity";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useUploadProgress } from "@/contexts/UploadProgressContext";
import { compressImage } from "@/lib/image-compress";
import { resolveShareableUrl, cacheShareFile } from "@/lib/social-share";
import { VideoMediaSlot, MediaPreparingPlaceholder } from "./VideoMediaSlot";
import { rememberLocalVideo } from "@/lib/media-cache";
import { usePosts, type Post as DbPost } from "@/hooks/usePosts";
import { useReferenceLibrary, useUserLibrary } from "@/hooks/useLibrary";
import { useBrandContext } from "@/hooks/useBrandContext";
import { RoteiroPdfTemplate } from "@/components/pdf/RoteiroPdfTemplate";
import { usePdfExport } from "@/hooks/usePdfExport";
import { sanitizeText } from "@/lib/sanitize";
import { confirmar } from "@/components/shared/Confirm";
import { SeletorDeGanchos } from "@/components/shared/SeletorDeGanchos";


interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  pillar_id: string | null;
  status: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  published_at: string | null;
  notes: string | null;
  week_number: number | null;
  google_event_id: string | null;
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  result_reach: number | null;
  result_shares: number | null;
  archive_summary: string | null;
  content_blocks: unknown | null;
  user_id: string;
  // Post de cliente do Cria Post: a PRÉVIA mostra o perfil do cliente, não o do gestor.
  external_client_id?: string | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

interface PostEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  pillars: Pillar[];
  userId: string;
  onSaved: () => void;
  initialFormat?: string;
  /** Post novo já nasce neste status (o + no cabeçalho da coluna do board). */
  initialStatus?: string;
  /** Post novo já nasce com esta data (o + no dia do calendário). */
  initialDate?: string;
}

interface DriveRef {
  id: string;
  external_file_id?: string | null;
  file_name: string;
  file_type: string | null;
  thumbnail_url: string | null;
  view_url: string | null;
  provider?: string | null;
}

const sanitizeStoragePath = (name: string): string => {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const clean = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "file";
  return `${clean}${ext.toLowerCase()}`;
};

const TONE_OPTIONS = [
  { key: "descontraido", label: "Descontraído" },
  { key: "profissional", label: "Profissional" },
  { key: "inspirador", label: "Inspirador" },
  { key: "educativo", label: "Educativo" },
  { key: "provocativo", label: "Provocativo" },
];

const LENGTH_OPTIONS = [
  { key: "curto", label: "Curto" },
  { key: "medio", label: "Médio" },
  { key: "longo", label: "Longo" },
];

const FALLBACK_HOOKS = [
  { text: "Você sabia que [dado surpreendente]?", category: "curiosidade" },
  { text: "O erro que [público] comete sem perceber...", category: "dor" },
  { text: "3 coisas que eu faria diferente se começasse hoje", category: "identificação" },
  { text: "A verdade que ninguém fala sobre [tema]", category: "polêmica" },
  { text: "Pare de [ação comum] se quiser [resultado]", category: "contraste" },
  { text: "Eu gastei [tempo] pra aprender isso, te conto em 60s", category: "curiosidade" },
  { text: "Se você [dor do público], esse vídeo é pra você", category: "identificação" },
  { text: "O segredo que [referência] não te conta", category: "promessa" },
];

const FALLBACK_PROMPTS = [
  { title: "Gerar ideias", text: "Me dê 10 ideias de conteúdo para [NICHO] focando em [PILAR].", category: "ideia" },
  { title: "Escrever legenda", text: "Escreva uma legenda para Instagram sobre [TEMA]. Tom: [TOM]. Inclua CTA e hashtags.", category: "legenda" },
  { title: "Roteiro de Reels", text: "Crie um roteiro de Reels de 30-60s sobre [TEMA]. Comece com hook forte.", category: "roteiro" },
  { title: "Brainstorm de hooks", text: "Me dê 5 hooks para um post sobre [TEMA]. Estilo: [curiosidade/polêmica].", category: "ideia" },
  { title: "Carrossel", text: "Monte carrossel de 8 slides sobre [TEMA]. Slide 1 = hook. Último = CTA.", category: "roteiro" },
];

export function PostEditor({ open, onOpenChange, post, pillars, userId, onSaved, initialFormat, initialStatus, initialDate }: PostEditorProps) {
  const { startTour } = useTour();
  const isNew = !post;
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("reels");
  const [pillarId, setPillarId] = useState("");
  const [status, setStatus] = useState("ideia");
  const [hook, setHook] = useState("");
  const [script, setScript] = useState("");
  const [caption, setCaption] = useState("");
  const captionRef = useRef<HTMLTextAreaElement>(null);
  // Insere o emoji na posição do cursor da legenda (não só no fim).
  const insertEmoji = (emoji: string) => {
    const ta = captionRef.current;
    if (!ta) { setCaption((c) => c + emoji); return; }
    const start = ta.selectionStart ?? caption.length;
    const end = ta.selectionEnd ?? caption.length;
    setCaption(caption.slice(0, start) + emoji + caption.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };
  const [cta, setCta] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  // Melhores horários pra postar: acessível de forma compacta perto da data (topo),
  // escondido atrás de um clique pra não ocupar espaço no fluxo.
  const [showBestTimes, setShowBestTimes] = useState(false);
  const [notes, setNotes] = useState("");
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  
  const [views, setViews] = useState("");
  const [saves, setSaves] = useState("");
  const [comments, setComments] = useState("");
  const [reach, setReach] = useState("");
  const [shares, setShares] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showPublishCeleb, setShowPublishCeleb] = useState(false);
  const [sections, setSections] = useState<Section[]>(Array(5).fill(null).map(emptySection));
  const [referenceLink, setReferenceLink] = useState("");
  // Link do conteúdo final (arte no Canva, arquivo no Drive, etc.). Reaproveita
  // a coluna drive_folder_url da tabela posts, já usada pelos posts externos.
  const [contentLink, setContentLink] = useState("");

  // AI / generation state (inlined from AIAssistantSection so we can render
  // the controls as pills in the new layout).
  const [aiTone, setAiTone] = useState("descontraido");
  const [aiLength, setAiLength] = useState("medio");
  const [aiCaption, setAiCaption] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Hashtags (inlined from HashtagsSection).
  const [hashSuggested, setHashSuggested] = useState<string[]>([]);
  const [hashSelected, setHashSelected] = useState<string[]>([]);
  const [hashLoading, setHashLoading] = useState(false);

  // Caption refinement
  const [refineLoading, setRefineLoading] = useState<string | null>(null);
  const [refinedPreview, setRefinedPreview] = useState<string | null>(null);
  // Caption score (nota de gancho + variações)
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<CaptionScore | null>(null);

  // Refs de rolagem: mainRef é o container do fluxo vertical; conteudoRef é o
  // passo 1 (o Estúdio manda a pessoa de volta pro conteúdo com scroll suave).
  const mainRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // References panel
  const [isRefAiLoading, setIsRefAiLoading] = useState(false);
  const [aiHookCategories, setAiHookCategories] = useState<string[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [repurposeMode, setRepurposeMode] = useState<"repurpose" | "recycle">("repurpose");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [videoTipOpen, setVideoTipOpen] = useState(false);
  const [dontShowVideoTip, setDontShowVideoTip] = useState(false);

  // Auto-save indicator
  const [autoSaveStatus, setAutoSaveStatus] = useState<null | "saving" | "saved" | "error">(null);
  const [saving, setSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadCompleteRef = useRef(false);

  const { profile } = useProfile();
  // Mapa invertido pilarId -> dias da semana, a partir da linha editorial das
  // Configuracoes (profile.editorial_line: CHAVE = dia "SEG"/"TER"..., VALOR = pilar.id).
  // Serve so de enfeite visual: ao lado de cada pilar mostramos o(s) dia(s) sugerido(s).
  // Um pilar pode cair em varios dias (mostra todos) ou nenhum (nao mostra nada).
  const EDITORIAL_DAY_ORDER = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  const pillarDays = useMemo(() => {
    const map: Record<string, string[]> = {};
    const line = profile?.editorial_line;
    if (!line) return map;
    for (const [day, pid] of Object.entries(line)) {
      if (typeof pid !== "string" || !pid) continue;
      (map[pid] ||= []).push(day);
    }
    // ordena os dias na sequencia natural da semana
    for (const pid of Object.keys(map)) {
      map[pid].sort((a, b) => EDITORIAL_DAY_ORDER.indexOf(a) - EDITORIAL_DAY_ORDER.indexOf(b));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.editorial_line]);
  // Identidade da PRÉVIA: dono do post (cliente do Cria Post → conta ativa → neutro),
  // nunca automaticamente o usuário logado. No criador (conta própria) o tiktok_handle
  // dele ainda serve de fallback quando não há handle do Instagram.
  const previewIdentity = usePostPreviewIdentity(
    post?.external_client_id ?? null,
    profile?.id === userId ? profile?.tiktok_handle : null,
  );
  const { brandContext } = useBrandContext();
  const pdfRef = useRef<HTMLDivElement>(null);
  const { exportPdf } = usePdfExport();

  const [driveMedia, setDriveMedia] = useState<DriveRef[]>([]);
  const [pendingDriveFiles, setPendingDriveFiles] = useState<DriveRef[]>([]);
  // Ref ids de mídia de slide (carrossel) inserida com post_id=null
  // que precisa de backfill no save. Não vai em pendingDriveFiles
  // porque mediaList usa essa lista pra renderizar a mídia primária do post.
  const [pendingSectionRefIds, setPendingSectionRefIds] = useState<string[]>([]);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { pickAndSave, picking } = useGoogleDrive();
  const { startUpload, updateUpload, finishUpload, hasActive: hasActiveUpload, uploads } = useUploadProgress();
  const queryClient = useQueryClient();
  
  const { createPost, updatePost, deletePost } = usePosts();
  const { referenceFormats } = useReferenceLibrary();
  const { userHooks, userPrompts } = useUserLibrary();

  const refFormats = useMemo(
    () => [...referenceFormats].sort((a, b) => a.platform.localeCompare(b.platform)),
    [referenceFormats],
  );
  const userRefHooks = useMemo(
    () => [...userHooks].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)),
    [userHooks],
  );
  const userRefPrompts = useMemo(
    () => [...userPrompts].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)),
    [userPrompts],
  );

  const fetchDriveMedia = useCallback(async (postId: string) => {
    const { data } = await supabase
      .from("external_media_refs")
      .select("id, external_file_id, file_name, file_type, thumbnail_url, view_url, provider")
      .eq("post_id", postId)
      // Ordem do carrossel: a `position` gravada no reorder manda; quem nunca
      // foi reordenado (position null) cai pro created_at, ordem de chegada.
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    setDriveMedia((data as DriveRef[]) || []);
  }, []);

  const removeDriveRef = async (ref: DriveRef) => {
    // Lock por id: evita re-invocação se o usuário clica no X várias vezes
    // enquanto a primeira chamada ainda está rolando.
    if (removingIds.has(ref.id)) return;
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(ref.id);
      return next;
    });
    // Só limpamos a UI local quando a remoção realmente foi concluída; se abortar
    // (falha no Bunny), o item precisa continuar visível pra o usuário tentar de novo.
    let removalDone = false;
    try {
      // Pega o file_size pra devolver pra cota (DriveRef em memória não tem esse campo).
      let refSize: number | null = null;
      const countsTowardQuota = ref.provider === "bunny" || ref.provider === "storage";
      if (countsTowardQuota && !ref.id.startsWith("temp-")) {
        const { data: sizeRow } = await supabase
          .from("external_media_refs")
          .select("file_size")
          .eq("id", ref.id)
          .maybeSingle();
        refSize = (sizeRow as { file_size: number | null } | null)?.file_size ?? null;
      }

      // Vídeos do Bunny: tentar deletar no Bunny PRIMEIRO (a edge confere a ref antes de deletar).
      // A edge trata 404 como sucesso (idempotência); só retorna erro em falha real.
      // Se o invoke falhar, ABORTA a remoção: NÃO apagamos a ref (senão o vídeo pago
      // fica órfão no Bunny sem ninguém pra rastreá-lo). O usuário tenta de novo.
      if (ref.provider === "bunny" && ref.external_file_id) {
        let bunnyFailed = false;
        try {
          const { error } = await supabase.functions.invoke("bunny-delete-video", {
            body: { videoGuid: ref.external_file_id, accountId: userId },
          });
          if (error) { console.error("[bunny-delete-video] invoke error", error); bunnyFailed = true; }
        } catch (e) {
          console.error("[bunny-delete-video] invoke threw", e);
          bunnyFailed = true;
        }
        if (bunnyFailed) {
          toast.error("Não foi possível remover o vídeo agora, tente de novo.");
          return; // finally libera o lock; a ref e a UI local permanecem
        }
      }
      await supabase.from("external_media_refs").delete().eq("id", ref.id);
      removalDone = true;

      // Devolve cota (bunny + storage). Drive nunca conta.
      if (countsTowardQuota && refSize && refSize > 0 && userId) {
        const { error: decErr } = await (supabase.rpc as unknown as (
          fn: string, args: unknown,
        ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: -refSize });
        if (decErr) console.error("[bunny] increment_storage failed (-)", decErr);
        queryClient.invalidateQueries({ queryKey: ["active-profile"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    } finally {
      // Só limpa a UI local se a remoção foi concluída (abortou = item permanece).
      // O lock é SEMPRE liberado.
      if (removalDone) {
        setPendingDriveFiles((prev) => prev.filter((f) => f.id !== ref.id));
        setDriveMedia((prev) => prev.filter((m) => m.id !== ref.id));
      }
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(ref.id);
        return next;
      });
    }
  };

  // Load post data into form state
  useEffect(() => {
    initialLoadCompleteRef.current = false;
    if (post) {
      setTitle(post.title);
      setPlatform(post.platform);
      setFormat(post.format);
      setPillarId(post.pillar_id || "");
      setStatus(post.status);
      setHook(post.hook || "");
      setScript(post.script || "");
      setCaption(post.caption || "");
      setCta(post.cta || "");
      setScheduledDate(post.scheduled_date || "");
      setScheduledTime(post.scheduled_time || "");
      setNotes(post.notes || "");
      setWeekNumber(post.week_number ?? null);
      
      setViews(post.result_views?.toString() || "");
      setSaves(post.result_saves?.toString() || "");
      setComments(post.result_comments?.toString() || "");
      setReach(post.result_reach?.toString() || "");
      setShares(post.result_shares?.toString() || "");
      setShowResults(post.status === "publicado");
      setReferenceLink((post as unknown as { reference_link?: string }).reference_link || "");
      setContentLink((post as unknown as { drive_folder_url?: string }).drive_folder_url || "");
      try {
        const parsed = JSON.parse((post as unknown as { sections?: string }).sections || "[]");
        setSections(
          parsed.length > 0
            ? parsed.map((s: unknown) =>
                typeof s === "string" ? { ...emptySection(), text: s } : { ...emptySection(), ...(s as object) }
              )
            : Array(5).fill(null).map(emptySection)
        );
      } catch {
        setSections(Array(5).fill(null).map(emptySection));
      }
    } else {
      setTitle(""); setPlatform("instagram"); setFormat(initialFormat || "reels");
      setPillarId(""); setStatus(initialStatus || "ideia"); setHook(""); setScript("");
      setCaption(""); setCta(""); setScheduledDate(initialDate || ""); setScheduledTime(""); setNotes("");
      setWeekNumber(null);
      
      setViews(""); setSaves(""); setComments(""); setReach(""); setShares(""); setShowResults(false); setReferenceLink(""); setContentLink("");
      setSections(Array(5).fill(null).map(emptySection));
      setDriveMedia([]);
      setPendingDriveFiles([]);
      if (userId) {
        supabase
          .from("external_media_refs")
          .delete()
          .eq("user_id", userId)
          .is("post_id", null)
          .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .then(() => {});
      }
    }
    if (post) fetchDriveMedia(post.id);

    // Allow auto-save once initial load has settled.
    const t = setTimeout(() => { initialLoadCompleteRef.current = true; }, 250);
    return () => clearTimeout(t);
  }, [post, open, fetchDriveMedia, userId]);

  // Reset sections when format changes (only for new posts)
  useEffect(() => {
    if (isNew) {
      const structure = getFormatStructure(format);
      const count = structure.hasDynamicSections ? (structure.defaultSections || 5) : 0;
      setSections(count > 0 ? Array(count).fill(null).map(emptySection) : []);
    }
  }, [format, isNew]);

  const buildSavePayload = useCallback(() => ({
    title: sanitizeText(title),
    platform,
    format,
    pillar_id: pillarId || null,
    status,
    hook: hook ? sanitizeText(hook) : null,
    script: script ? sanitizeText(script) : null,
    caption: caption ? sanitizeText(caption) : null,
    cta: cta ? sanitizeText(cta) : null,
    scheduled_date: scheduledDate || null,
    scheduled_time: scheduledTime || null,
    notes: notes ? sanitizeText(notes) : null,
    week_number: weekNumber,
    result_views: views ? parseInt(views) : null,
    result_saves: saves ? parseInt(saves) : null,
    result_comments: comments ? parseInt(comments) : null,
    result_reach: reach ? parseInt(reach) : null,
    result_shares: shares ? parseInt(shares) : null,
    sections: JSON.stringify(
      sections.map((s) => ({ ...s, text: sanitizeText(s.text), captacao: sanitizeText(s.captacao) }))
    ),
    reference_link: referenceLink || null,
    // Link do conteúdo final (Drive/Canva). Reaproveita drive_folder_url.
    drive_folder_url: contentLink || null,
    user_id: userId,
  }), [title, platform, format, pillarId, status, hook, script, caption, cta,
       scheduledDate, scheduledTime, notes, weekNumber, views, saves, comments, reach, shares, sections, referenceLink, contentLink, userId]);

  // Debounced auto-save for existing posts.
  // Skipped for new posts (would create empty drafts) and during initial load.
  useEffect(() => {
    if (!post || !open || !initialLoadCompleteRef.current) return;
    if (!title.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("saving");
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await updatePost.mutateAsync({ id: post.id, updates: buildSavePayload() });
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus(null), 1500);
      } catch {
        // Falha do auto-save não pode sumir em silêncio (usuário perderia o texto ao fechar).
        setAutoSaveStatus("error");
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, platform, format, pillarId, status, hook, script, caption, cta,
       scheduledDate, scheduledTime, notes, weekNumber, referenceLink, contentLink, sections, open, post?.id]);

  const handleAiReferences = async () => {
    if (aiHookCategories.length > 0 || isRefAiLoading) return;
    setIsRefAiLoading(true);
    try {
      const pillar = pillars.find((p) => p.id === pillarId)?.name || "";
      const result = await filterReferences({ platform, format, pillar, title }, userId);
      if (result && result.hook_categories) {
        setAiHookCategories(result.hook_categories);
      }
    } catch (e) {
      console.error("AI References failed", e);
    } finally {
      setIsRefAiLoading(false);
    }
  };

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // CRÍTICO: snapshot dos arquivos como Array ANTES de qualquer manipulação.
    // FileList é live, `e.target.value = ""` esvazia o FileList referenciado, então
    // precisamos copiar para um Array primeiro.
    const fileList = e.target.files;
    const files: File[] = fileList ? Array.from(fileList) : [];
    e.target.value = ""; // agora seguro, `files` já é snapshot independente
    const hasVideo = files.some((f) => {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      return (f.type || "").toLowerCase().startsWith("video/") || VIDEO_EXTS.includes(ext);
    });
    if (hasVideo && localStorage.getItem("hide_video_upload_tip") !== "true") {
      setVideoTipOpen(true);
    }

    if (files.length === 0 || !userId) {
      return;
    }
    let anyUploaded = false;
    try {
      setUploadingLocal(true);
      for (const initialRaw of files) {
        let raw = initialRaw;
        const ext = (raw.name.split(".").pop() || "").toLowerCase();
        const mimeLower = (raw.type || "").toLowerCase();
        // Detecta vídeo por MIME OU extensão (browsers às vezes não setam MIME pra .mov/.hevc).
        const isVideo = mimeLower.startsWith("video/") || VIDEO_EXTS.includes(ext);
        // HEIC/HEIF inclui Live Photos do iPhone (image/heic-sequence, image/heif-sequence)
        // e variantes em uppercase (alguns iOS Safari mandam "IMAGE/HEIC").
        const isHeic =
          /heic|heif/.test(mimeLower) || HEIC_EXTS.includes(ext);

        if (raw.size === 0) {
          toast.error(`${raw.name}: arquivo vazio.`);
          continue;
        }

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        if (isVideo) {
          // Vídeo: sem limite de 50MB; teto de sanidade de 2GB. Cota do plano controla totais.
          if (raw.size > VIDEO_MAX_BYTES) {
            toast.error(`${raw.name}: vídeo muito grande (máx 2GB).`);
            continue;
          }
          // Vídeo → Bunny Stream via TUS (player transcodifica qualquer codec)
          const toastId = toast.loading(`Preparando ${raw.name}…`);
          let trackedUploadId: string | null = null;
          let createdRefId: string | null = null;   // ref já exibido (pra limpar se o envio falhar)
          let createdRefIsTemp = false;
          try {
            const { data: sig, error: sigErr } = await supabase.functions.invoke("bunny-create-video", {
              body: { fileName: raw.name, accountId: userId },
            });
            if (sigErr || !sig?.videoGuid) {
              let reason: string | undefined = (sig as { error?: string } | null)?.error;
              if (!reason && sigErr) {
                try {
                  const body = await (sigErr as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
                  reason = body?.error;
                } catch { /* corpo já consumido */ }
                reason = reason ?? (sigErr as Error).message;
              }
              console.error("[bunny] create-video failed", reason, sigErr ?? sig);
              toast.error(`Falha ao iniciar: ${reason ?? "erro desconhecido"}`, { id: toastId });
              continue;
            }
            const { videoGuid, libraryId, signature, expiration } = sig as {
              videoGuid: string; libraryId: string | number; signature: string; expiration: number;
            };

            const viewUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`;
            const thumbUrl = `https://${BUNNY_CDN_HOSTNAME}/${videoGuid}/thumbnail.jpg`;

            // 1) Cacheia o arquivo local AGORA → já dá pra publicar na hora, sem esperar o envio.
            const _shareUrl = resolveShareableUrl(viewUrl, "bunny");
            if (_shareUrl) void cacheShareFile(_shareUrl, raw);
            rememberLocalVideo(viewUrl, raw);

            // 2) Mostra o vídeo no editor JÁ (publicável). O envio pro Bunny roda em segundo plano.
            if (post?.id) {
              const { data: inserted, error: insErr } = await supabase
                .from("external_media_refs")
                .insert({
                  user_id: userId,
                  post_id: post.id,
                  provider: "bunny",
                  bunny_video_id: videoGuid,
                  external_file_id: videoGuid,
                  file_name: raw.name,
                  file_type: raw.type,
                  file_size: raw.size,
                  thumbnail_url: thumbUrl,
                  view_url: viewUrl,
                  expires_at: expiresAt,
                })
                .select("id, external_file_id, file_name, file_type, thumbnail_url, view_url, provider")
                .single();
              if (insErr || !inserted) {
                console.error("[bunny] ref insert error", insErr);
                toast.error(`Erro ao salvar referência de ${raw.name}`, { id: toastId });
                continue;
              }
              setDriveMedia((prev) => [...prev, inserted as DriveRef]);
              createdRefId = (inserted as DriveRef).id;
              createdRefIsTemp = false;
            } else {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const tempRef: DriveRef = {
                id: tempId,
                file_name: raw.name,
                file_type: raw.type,
                thumbnail_url: thumbUrl,
                view_url: viewUrl,
                external_file_id: videoGuid,
                provider: "bunny",
              };
              setPendingDriveFiles((prev) => [...prev, tempRef]);
              createdRefId = tempId;
              createdRefIsTemp = true;
            }

            // 3) Envio em segundo plano.
            toast.loading(`Enviando ${raw.name}… 0%`, { id: toastId });
            startUpload(videoGuid, raw.name);
            trackedUploadId = videoGuid;

            await new Promise<void>((resolve, reject) => {
              const upload = new tus.Upload(raw, {
                endpoint: "https://video.bunnycdn.com/tusupload",
                retryDelays: [0, 3000, 5000, 10000, 20000],
                headers: {
                  AuthorizationSignature: signature,
                  AuthorizationExpire: String(expiration),
                  VideoId: videoGuid,
                  LibraryId: String(libraryId),
                },
                metadata: { filetype: raw.type, title: raw.name },
                onProgress: (sent, total) => {
                  const pct = Math.round((sent / total) * 100);
                  toast.loading(`Enviando ${raw.name}… ${pct}%`, { id: toastId });
                  updateUpload(videoGuid, pct);
                },
                onError: (e) => reject(e),
                onSuccess: () => resolve(),
              });
              upload.start();
            });

            // 4) Envio concluído → conta cota e finaliza.
            const { error: incErr } = await (supabase.rpc as unknown as (
              fn: string, args: unknown,
            ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: raw.size });
            if (incErr) console.error("[bunny] increment_storage failed (+)", incErr);
            queryClient.invalidateQueries({ queryKey: ["active-profile"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            toast.success(`${raw.name} enviado!`, { id: toastId });
            if (trackedUploadId) finishUpload(trackedUploadId, "done");
            anyUploaded = true;
            continue;
          } catch (e) {
            console.error("[bunny] upload failed", e);
            toast.error(`Falha no upload de ${raw.name}`, { id: toastId });
            if (trackedUploadId) finishUpload(trackedUploadId, "error");
            // Remove o vídeo que já tinha sido exibido (o envio falhou).
            if (createdRefId) {
              const refId = createdRefId;
              if (createdRefIsTemp) {
                setPendingDriveFiles((prev) => prev.filter((f) => f.id !== refId));
              } else {
                setDriveMedia((prev) => prev.filter((m) => m.id !== refId));
                await supabase.from("external_media_refs").delete().eq("id", refId);
              }
            }
            continue;
          }
        }

        // FOTO → Storage (HEIC→JPEG se necessário, compressão, upload, ref device)
        if (isHeic) {
          let converted: File | null = null;
          // Caminho principal: decode nativo (Safari/WebKit/iPhone resolve isso).
          try {
            converted = await heicToJpegNative(raw);
          } catch (errNative) {
            console.warn("[upload] heic native decode failed, trying heic2any", { name: initialRaw.name, errNative });
            // Fallback: heic2any (libheif WASM), funciona em Chrome/Firefox/Windows.
            try {
              // Import dinâmico: heic2any é pesado (~350 kB gzip). Só baixa no
              // fallback real de conversão HEIC, não a cada abertura de post.
              const heic2any = (await import("heic2any")).default;
              const out = await heic2any({ blob: raw, toType: "image/jpeg", quality: 0.85 });
              const blob = Array.isArray(out) ? out[0] : out;
              converted = new File(
                [blob as Blob],
                raw.name.replace(/\.(heic|heif)$/i, ".jpg"),
                { type: "image/jpeg" },
              );
            } catch (errLib) {
              console.error("[upload] heic conversion failed (native + heic2any)", { name: initialRaw.name, mime: initialRaw.type, errLib });
              toast.error(`Não consegui converter ${initialRaw.name}. Tente exportar como JPEG.`);
              continue;
            }
          }
          raw = converted;
        }
        const validation = validateUpload(raw, "postMedia");
        if (!validation.ok) {
          toast.error(validation.reason);
          continue;
        }
        const file = await compressImage(raw);
        const safeName = sanitizeStoragePath(file.name);
        const path = `${userId}/${Date.now()}-${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) {
          console.error("[upload] storage error", upErr);
          toast.error(`Erro ao enviar ${file.name}: ${upErr.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        if (post?.id) {
          const { data: inserted, error: insErr } = await supabase
            .from("external_media_refs")
            .insert({
              user_id: userId,
              post_id: post.id,
              provider: "device",
              file_name: file.name,
              file_type: file.type,
              thumbnail_url: publicUrl,
              view_url: publicUrl,
              external_file_id: path,
              expires_at: expiresAt,
            })
            .select("id, external_file_id, file_name, file_type, thumbnail_url, view_url, provider")
            .single();
          if (insErr || !inserted) {
            console.error("[upload] insert error", insErr);
            toast.error(`Erro ao salvar referência de ${file.name}`);
            continue;
          }
          setDriveMedia((prev) => [...prev, inserted as DriveRef]);
        } else {
          const tempRef: DriveRef = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file_name: file.name,
            file_type: file.type,
            thumbnail_url: publicUrl,
            view_url: publicUrl,
            external_file_id: path,
          };
          setPendingDriveFiles((prev) => [...prev, tempRef]);
        }
        anyUploaded = true;
      }
      if (anyUploaded) toast.success("Mídia adicionada!");
    } catch (err) {
      console.error("[upload] unexpected", err);
      toast.error("Erro ao enviar mídia.");
    } finally {
      setUploadingLocal(false);
    }
  };

  const openLocalFilePicker = useCallback(() => {
    if (!userId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    // Off-screen mas no DOM, garante que o input não seja GC'd antes do change event
    input.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none";

    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.addEventListener("change", async (e) => {
      try {
        await handleLocalUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
      } finally {
        cleanup();
      }
    }, { once: true });

    // Chrome dispara 'cancel' quando o usuário fecha o picker sem selecionar nada
    input.addEventListener("cancel", cleanup, { once: true });

    // Fallback: se nada acontecer em 5min, limpa
    setTimeout(() => {
      if (!input.files || input.files.length === 0) cleanup();
    }, 5 * 60 * 1000);

    document.body.appendChild(input);
    input.click();
  }, [userId, handleLocalUpload]);

  const handleDrivePick = async () => {
    if (picking) return;
    if (isNew) {
      try {
        const pickStartedAt = new Date().toISOString();
        await pickAndSave(undefined);
        const { data } = await supabase
          .from("external_media_refs")
          .select("id, external_file_id, file_name, file_type, thumbnail_url, view_url, provider")
          .eq("user_id", userId)
          .is("post_id", null)
          .gte("created_at", pickStartedAt)
          .order("created_at", { ascending: false });
        if (data && data.length > 0) {
          setPendingDriveFiles((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newFiles = (data as DriveRef[]).filter((d) => !existingIds.has(d.id));
            return [...newFiles, ...prev];
          });
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      await pickAndSave(post?.id);
      if (post) fetchDriveMedia(post.id);
    }
  };


  const handleSave = async () => {
    if (!title.trim() || saving) return; // trava double-submit (inclui a etapa de IA)
    setSaving(true);
    try {
    const wasPublished = status === "publicado" && post?.status !== "publicado";
    const data: Record<string, unknown> = { ...buildSavePayload() };

    if (wasPublished) {
      data.published_at = new Date().toISOString();
      try {
        const pillar = pillars.find((p) => p.id === pillarId)?.name || "";
        const summary = await generateArchiveSummary({ title, platform, format, pillar }, userId);
        if (summary) data.archive_summary = summary;
      } catch (e) {
        console.error("AI Summary failed", e);
      }
    }

    let newPostId: string | undefined;
    try {
      if (post) {
        await updatePost.mutateAsync({ id: post.id, updates: data });
        newPostId = post.id;
      } else {
        const created = await createPost.mutateAsync(data as never);
        newPostId = created.id;
      }
    } catch {
      toast.error("Erro ao salvar post.");
      return;
    }

    if (isNew && newPostId) {
      const driveIds = pendingDriveFiles.map((f) => f.id);
      const allPendingIds = [...driveIds, ...pendingSectionRefIds];
      if (allPendingIds.length > 0) {
        await supabase
          .from("external_media_refs")
          .update({ post_id: newPostId })
          .in("id", allPendingIds);
        // Grava a ordem do carrossel (posição) na ordem em que a tira ficou,
        // pra o reorder feito antes do primeiro save sobreviver ao recarregar.
        await Promise.all(
          driveIds.map((id, idx) =>
            id.startsWith("temp-")
              ? Promise.resolve()
              : supabase.from("external_media_refs").update({ position: idx }).eq("id", id),
          ),
        );
        setPendingDriveFiles([]);
        setPendingSectionRefIds([]);
      }
    }

    if (wasPublished) {
      fireConfetti();
      setShowPublishCeleb(true);
      toast.success("Conteúdo publicado!");
      setShowResults(true);
    } else {
      toast.success(post ? "Post atualizado!" : "Post criado!");
      onOpenChange(false);
    }
    onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus === "publicado") setShowResults(true);
  };

  // AI: generate caption (inlined from AIAssistantSection)
  const handleGenerateCaption = async () => {
    if (!title || aiLoading) return;
    setAiLoading(true);
    setAiCaption("");
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "generate-caption",
        data: {
          titulo: title,
          formato: format,
          plataforma: platform,
          tom: aiTone,
          tamanho: aiLength,
          pilar: pillars.find((p) => p.id === pillarId)?.name,
          nicho: profile?.niche,
          conteudo: caption,
          roteiro: sections.map((s) => s.text).filter(Boolean).join(" | "),
          brandContext,
        },
      });
      const text = typeof result === "string" ? result.replace(/```\n?|```/g, "").trim() : String(result ?? "");
      setAiCaption(text);
    } catch (e) {
      console.error("Generate caption failed", e);
      toast.error("Erro ao gerar legenda.");
    } finally {
      setAiLoading(false);
    }
  };

  // AI: suggest hashtags (inlined from HashtagsSection)
  const hashGroups = useMemo(() => {
    const third = Math.ceil(hashSuggested.length / 3);
    return {
      high: hashSuggested.slice(0, third),
      medium: hashSuggested.slice(third, third * 2),
      niche: hashSuggested.slice(third * 2),
    };
  }, [hashSuggested]);

  const handleSuggestHashtags = async () => {
    if (!title || hashLoading) return;
    setHashLoading(true);
    setHashSuggested([]);
    setHashSelected([]);
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "suggest-hashtags",
        data: {
          titulo: title,
          formato: format,
          plataforma: platform,
          pilar: pillars.find((p) => p.id === pillarId)?.name,
          nicho: profile?.niche,
          legenda: caption,
          brandContext,
        },
      });
      const raw = typeof result === "string" ? result.replace(/```json?\n?|\n?```/g, "").trim() : "";
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) tags = parsed.map(String);
      } catch {
        tags = raw.split(/[,\n]+/).map((t) => t.replace(/^#?\s*/, "").trim()).filter(Boolean);
      }
      const clean = tags.slice(0, 30);
      setHashSuggested(clean);
      setHashSelected(clean.slice(0, 10));
    } catch (e) {
      console.error("Suggest hashtags failed", e);
      toast.error("Erro ao sugerir hashtags.");
    } finally {
      setHashLoading(false);
    }
  };

  const toggleHash = (tag: string) => {
    setHashSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // AI: refine existing caption (rephrase / shorten / expand / tone shifts)
  const handleRefineCaption = async (key: string, instruction: string) => {
    if (!caption || refineLoading) return;
    setRefineLoading(key);
    setRefinedPreview(null);
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "refine-caption",
        data: {
          legenda_original: caption,
          instrucao: instruction,
          nicho: profile?.niche,
          plataforma: platform,
          formato: format,
          brandContext,
        },
      });
      const text =
        typeof result === "string"
          ? result.replace(/```\n?|```/g, "").replace(/^["']|["']$/g, "").trim()
          : String(result ?? "");
      setRefinedPreview(text);
    } catch {
      toast.error("Erro ao refinar legenda.");
    } finally {
      setRefineLoading(null);
    }
  };

  // AI: avaliar legenda (nota de gancho + melhorias + 3 variações)
  const handleScoreCaption = async () => {
    if (!caption || caption.length < 10 || scoreLoading) return;
    setScoreLoading(true);
    setScoreResult(null);
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "score-caption",
        data: { legenda: caption, plataforma: platform, formato: format, nicho: profile?.niche },
      });
      const obj = (typeof result === "string" ? JSON.parse(result) : result) as CaptionScore;
      if (obj && typeof obj.nota === "number") setScoreResult(obj);
      else throw new Error("formato inesperado");
    } catch (e) {
      console.error("Score caption failed", e);
      toast.error("Erro ao avaliar legenda.");
    } finally {
      setScoreLoading(false);
    }
  };

  const mediaList: DriveRef[] = isNew ? pendingDriveFiles : driveMedia;
  const activeUpload = uploads.find((u) => u.status === "uploading") ?? null;

  // Mídia da PRÉVIA (mockup do feed/Instagram). Derivada da mídia primária do post,
  // reaproveitada tanto na prévia fixa do desktop quanto no modal fullscreen do mobile.
  const previewMediaUrl = mediaList.length > 0
    ? (() => {
        const first = mediaList[0];
        const fid = first.external_file_id || first.id;
        if (first.file_type?.includes("video")) {
          return first.view_url || `https://drive.google.com/uc?id=${encodeURIComponent(fid)}`;
        }
        return first.thumbnail_url || first.view_url || `https://lh3.googleusercontent.com/d/${encodeURIComponent(fid)}=w800`;
      })()
    : undefined;
  const previewMediaType = mediaList.length > 0 ? (mediaList[0].file_type?.includes("video") ? "video" : "image") : "image";

  // Reordena a mídia (carrossel): a ordem da tira = a ordem dos slides.
  // Atualiza o estado local na hora e, no post já salvo, grava a nova `position`
  // em cada ref pra ordem sobreviver ao recarregar. No post novo, a ordem do
  // array de pendências já basta (o backfill do save mantém essa ordem).
  const reorderMedia = useCallback((orderedIds: string[]) => {
    const applyOrder = (arr: DriveRef[]) => {
      const byId = new Map(arr.map((m) => [m.id, m]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as DriveRef[];
      // Preserva qualquer item que por acaso não esteja na lista de ids (segurança).
      for (const m of arr) if (!orderedIds.includes(m.id)) next.push(m);
      return next;
    };
    if (isNew) {
      setPendingDriveFiles((prev) => applyOrder(prev));
    } else {
      setDriveMedia((prev) => applyOrder(prev));
      orderedIds.forEach((id, idx) => {
        if (id.startsWith("temp-")) return;
        void supabase.from("external_media_refs").update({ position: idx }).eq("id", id);
      });
    }
  }, [isNew]);

  const handleRemoveAllMedia = () => {
    // removeDriveRef já cuida do lock + cleanup dos dois arrays.
    if (isNew) {
      pendingDriveFiles.forEach((f) => removeDriveRef(f));
    } else {
      driveMedia.forEach((m) => removeDriveRef(m));
    }
  };

  const handleDelete = () => {
    if (!post) return;
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!post) return;
    deletePost.mutate(post.id, {
      onSuccess: () => {
        toast.success("Post excluído");
        setConfirmDeleteOpen(false);
        onOpenChange(false);
        onSaved();
      },
      onError: () => {
        toast.error("Erro ao excluir post.");
        setConfirmDeleteOpen(false);
      },
    });
  };

  const formatStructure = getFormatStructure(format);
  const captionLen = caption.length;
  const captionMax = 2200;

  // Re-usable pill class helper
  const pillClass = (selected: boolean) =>
    cn(
      "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer border whitespace-nowrap",
      selected
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
    );

  return (
    <>
      <StickerCelebration
        show={showPublishCeleb}
        title="Publicado!"
        subtitle="Mais uma da ideia ao post."
        onDone={() => setShowPublishCeleb(false)}
      />

      <Dialog
        open={open}
        onOpenChange={async (o) => {
          if (!o && hasActiveUpload) {
            // Confirma fechar enquanto há upload rolando, TUS continua via context, mas
            // o ref insert do vídeo depende deste componente estar montado. Melhor avisar.
            const ok = await confirmar({
              titulo: "Tem um vídeo subindo agora",
              descricao: "Se você fechar, o upload pode se perder e vai ter que começar de novo.",
              acao: "Fechar mesmo assim",
              cancelar: "Esperar o upload",
            });
            if (!ok) return;
          }
          onOpenChange(o);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Permite fechar via ESC, mas bloqueia "clique fora", que é falsamente
            // disparado pelo file picker nativo do SO ao abrir <input type="file">.
            // Issue conhecida: radix-ui/primitives#1280.
            e.preventDefault();
          }}
          // No mobile o editor era um retângulo reto colado nas bordas: cara de
          // página quebrada, não de app. Agora ele desce um pouco do topo e ganha
          // canto arredondado em cima e embaixo, como uma folha sobre a tela.
          className="[&>button:last-child]:hidden top-2 translate-y-0 sm:top-1/2 sm:-translate-y-1/2 max-w-none w-[calc(100vw-0.75rem)] h-[calc(100dvh-1rem)] sm:w-[96vw] sm:h-[94vh] sm:max-w-[1400px] p-0 overflow-hidden overflow-x-hidden flex flex-col bg-background rounded-3xl sm:rounded-2xl"
        >
          {/* CABEÇALHO
              No mobile o título disputava espaço com 6 botões e virava "O gargalo qu…".
              Agora são duas faixas: em cima SÓ as ações (fechar, tutorial, excluir,
              PDF, prévia, salvar), embaixo o título com a linha inteira pra ele.
              No desktop volta pra uma faixa só, com o título no meio. */}
          <DialogHeader className="px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0 border-b border-border gap-2">
            <DialogTitle className="sr-only">{isNew ? "Novo Post" : "Editar Post"}</DialogTitle>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => startTour("post-editor")}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary shrink-0"
                aria-label="Ver tutorial do editor"
              >
                <CircleHelp className="h-4 w-4" />
              </button>

              {/* Título inline: só no desktop, onde sobra largura.
                  Virou textarea auto-crescente (pedido do Walter, 31/08): título
                  longo QUEBRA pra baixo em vez de escorrer por cima dos botões,
                  e a fonte diminuiu um degrau. */}
              <div className="hidden sm:flex flex-1 min-w-0 items-start gap-3">
                <textarea
                  value={title}
                  rows={1}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  ref={(el) => {
                    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
                  }}
                  placeholder={isNew ? "Sobre o que é esse post?" : "Sem título"}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-display text-lg md:text-xl font-extrabold text-foreground placeholder:text-muted-foreground/40 resize-none leading-snug max-h-[3.4em] overflow-hidden"
                />
                {autoSaveStatus && (
                  <span
                    className={cn(
                      "text-[10px] font-body font-medium whitespace-nowrap transition-opacity",
                      autoSaveStatus === "saving" ? "text-muted-foreground" : autoSaveStatus === "error" ? "text-destructive" : "text-secondary"
                    )}
                  >
                    {autoSaveStatus === "saving" ? "Salvando…" : autoSaveStatus === "error" ? "Não salvo, salve manualmente" : "Salvo ✓"}
                  </span>
                )}
              </div>

              {/* ml-auto empurra as ações pra direita; flex-wrap deixa elas caírem
                  pra segunda linha no mobile em vez de estourar a tela e cortar o
                  botão Salvar. */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 ml-auto min-w-0">
                {!isNew && post && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => exportPdf(pdfRef, `roteiro-${title.slice(0, 20).replace(/\s+/g, "-").toLowerCase() || "post"}`)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Prévia</span>
                </Button>
                {!isNew && post && status === "publicado" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label="Reciclar conteúdo (repostar com ângulo novo)"
                    title="Reciclar conteúdo (repostar com ângulo novo)"
                    onClick={() => { setRepurposeMode("recycle"); setRepurposeOpen(true); }}
                  >
                    <Recycle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reciclar</span>
                  </Button>
                )}
                {!isNew && post && (status === "publicado" || status === "agendado") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label="Reaproveitar (adaptar para outra plataforma)"
                    title="Reaproveitar (adaptar para outra plataforma)"
                    onClick={() => { setRepurposeMode("repurpose"); setRepurposeOpen(true); }}
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reaproveitar</span>
                  </Button>
                )}
                {/* Publicar é fluxo de CELULAR (copia a legenda e abre o app do
                   Instagram); no computador o botão só confundia (Walter, 31/08). */}
                {(status === "editando" || status === "agendado") && (
                  <span className="sm:hidden"><PublishButton
                    caption={caption}
                    mediaUrl={
                      mediaList.length > 0
                        ? (() => {
                            const first = mediaList[0];
                            const fid = first.external_file_id || first.id;
                            if (first.file_type?.includes("video")) {
                              return first.view_url || `https://drive.google.com/uc?id=${encodeURIComponent(fid)}`;
                            }
                            return first.thumbnail_url || first.view_url || `https://lh3.googleusercontent.com/d/${encodeURIComponent(fid)}=w800`;
                          })()
                        : undefined
                    }
                    mediaType={mediaList.length > 0 ? (mediaList[0].file_type?.includes("video") ? "video" : "image") : "image"}
                  /></span>
                )}
                <Button variant="hero" size="sm" onClick={handleSave} disabled={!title.trim() || saving}>
                  {saving ? "Salvando…" : isNew ? "Criar" : "Salvar"}
                </Button>
              </div>
            </div>

            {/* MOBILE: o título ganha a linha inteira, como campo de verdade. */}
            <div className="sm:hidden">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isNew ? "Sobre o que é esse post?" : "Sem título"}
                className="w-full bg-muted/40 rounded-2xl px-3.5 py-2.5 border border-border outline-none focus:border-primary/50 focus:ring-0 font-display text-lg font-extrabold text-foreground placeholder:text-muted-foreground/40 placeholder:font-body placeholder:font-normal"
              />
              {autoSaveStatus && (
                <p className={cn(
                  "mt-1 text-[11px] font-body font-medium",
                  autoSaveStatus === "saving" ? "text-muted-foreground" : autoSaveStatus === "error" ? "text-destructive" : "text-secondary",
                )}>
                  {autoSaveStatus === "saving" ? "Salvando…" : autoSaveStatus === "error" ? "Não salvo, salve manualmente" : "Salvo ✓"}
                </p>
              )}
            </div>

            {/* PILAR NO TOPO, estilo o "+ Etiqueta" do Cria Post (pedido do
               Walter, 31/08): a etiqueta do post do criador é o pilar, e ela
               mora logo abaixo do título, não enterrada no passo 1. */}
            {pillars.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    {(() => {
                      const p = pillars.find((x) => x.id === pillarId);
                      return p ? (
                        <button type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-body font-semibold transition-colors"
                          style={{ backgroundColor: `${p.color}1c`, color: p.color, borderColor: `${p.color}66` }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                          {pillarDays[p.id]?.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-white/60">{pillarDays[p.id].join(" · ")}</span>
                          )}
                        </button>
                      ) : (
                        <button type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-body text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                          + Pilar
                        </button>
                      );
                    })()}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60 p-1.5">
                    <button type="button" onClick={() => setPillarId("")}
                      className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-body hover:bg-muted text-left", !pillarId && "font-semibold")}>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Sem pilar
                    </button>
                    {pillars.map((p) => (
                      <button key={p.id} type="button" onClick={() => setPillarId(p.id)}
                        className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-body hover:bg-muted text-left", pillarId === p.id && "font-semibold")}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        {pillarDays[p.id]?.length > 0 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{pillarDays[p.id].join(" · ")}</span>
                        )}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </DialogHeader>

          {/* CORPO: FLUXO NUMERADO + PRÉVIA
              No celular: uma coluna só, de cima pra baixo, na ordem que a cabeça
              pensa (1 conteúdo, 2 legenda, 3 arte, 4 quando publicar); a prévia
              abre pelo botão "Prévia" do topo, em tela cheia.
              No desktop (lg pra cima): duas colunas. À esquerda (~60%) o fluxo
              numerado rolável; à direita (~40%) a prévia do post fixa (sticky),
              sempre visível enquanto a pessoa escreve. */}
          <div ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20">
            {/* Coluna da direita agora tem largura FIXA (a da prévia): antes era
               2fr e a prévia de 380px boiava no meio dela, deixando faixas
               vazias dos dois lados (pedido do Walter, 31/08: menos margem). */}
            <div className="mx-auto w-full max-w-3xl lg:max-w-none px-3 sm:px-5 py-4 sm:py-6 pb-[calc(3rem+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-5 lg:items-start">

              {/* COLUNA ESQUERDA: o fluxo numerado (no mobile, a coluna única). */}
              <div className="space-y-4 min-w-0">

              {/* 1. A ARTE / MIDIA no TOPO do fluxo (Walter, 31/08: "poderia ficar em cima, igual no cria social media") */}
              <section className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-4">
                <BlocoCabecalho numero={1} titulo="A arte / mídia" subtitulo="Imagem, vídeo ou o link do arquivo pronto." />

                {format !== "carrossel" ? (
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                      Midia
                    </Label>
                    <div className="rounded-2xl border-2 border-dashed border-border/50 overflow-hidden bg-muted/20 hover:border-primary/30 transition-colors">
                      {activeUpload ? (
                        <div className="relative">
                          <div className="aspect-[4/5] relative overflow-hidden max-h-[60vh] sm:max-h-[360px] bg-muted">
                            <MediaPreparingPlaceholder pct={activeUpload.pct} label="Enviando vídeo..." />
                          </div>
                        </div>
                      ) : mediaList.length > 0 ? (
                        <div className="relative">
                          <div className="aspect-[4/5] relative overflow-hidden max-h-[60vh] sm:max-h-[360px] bg-muted">
                            {(() => {
                              const primary = mediaList[0];
                              const fileId = primary.external_file_id || primary.id;
                              const isVideo = primary.file_type?.startsWith("video/");
                              const isBunny = isVideo && primary.provider === "bunny";
                              const isSupabaseUpload = !!primary.thumbnail_url
                                && !primary.thumbnail_url.includes("drive.google")
                                && !primary.thumbnail_url.includes("lh3.google");
                              const driveImgSrc = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w600`;
                              const imgSrc = primary.thumbnail_url || primary.view_url || driveImgSrc;
                              return isBunny ? (
                                <VideoMediaSlot viewUrl={primary.view_url ?? ""} videoGuid={primary.external_file_id} className="w-full h-full border-0" />
                              ) : isVideo ? (
                                <a
                                  href={`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block w-full h-full relative bg-black group"
                                >
                                  <img
                                    src={driveImgSrc}
                                    alt={primary.file_name}
                                    loading="lazy"
                                    className="w-full h-full object-contain sm:object-cover"
                                    onError={(e) => {
                                      const el = e.target as HTMLImageElement;
                                      el.classList.add("hidden");
                                      el.nextElementSibling?.classList.remove("hidden");
                                    }}
                                  />
                                  <div className="hidden absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2 px-4 text-center">
                                    <Video className="h-10 w-10 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground font-body truncate max-w-full">{primary.file_name}</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-primary font-body font-semibold">
                                      <ExternalLink className="h-3 w-3" /> Abrir no Drive
                                    </span>
                                  </div>
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gradient-to-t from-black/30 to-transparent group-hover:from-black/40 transition-colors">
                                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                      <Play className="h-6 w-6 text-black ml-0.5" fill="currentColor" />
                                    </div>
                                  </div>
                                </a>
                              ) : (
                                <img
                                  src={imgSrc}
                                  alt={primary.file_name}
                                  className="w-full h-full object-contain sm:object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const el = e.target as HTMLImageElement;
                                    if (!isSupabaseUpload) {
                                      el.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                                    } else {
                                      console.warn("[media] Supabase upload falhou ao carregar", {
                                        src: el.src,
                                        fileName: primary.file_name,
                                        path: primary.external_file_id,
                                      });
                                      // Em vez de esconder, manter placeholder visivel para o usuario saber que algo quebrou.
                                      el.src = "/placeholder.svg";
                                      el.classList.add("opacity-40");
                                    }
                                  }}
                                />
                              );
                            })()}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                              <div className="flex items-center gap-1 bg-black/40 backdrop-blur rounded-full px-2 py-0.5">
                                <Cloud className="h-2.5 w-2.5 text-white" />
                                <span className="text-[9px] text-white font-body truncate max-w-[120px]">{mediaList[0].file_name}</span>
                              </div>
                              <button
                                onClick={() => handleRemoveAllMedia()}
                                disabled={removingIds.size > 0}
                                className="bg-black/40 backdrop-blur rounded-full p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          </div>
                          {mediaList[0].file_type?.startsWith("video/") && mediaList[0].provider !== "bunny" && (
                            <a
                              href={`https://drive.google.com/file/d/${encodeURIComponent(mediaList[0].external_file_id || mediaList[0].id)}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary font-body hover:underline mt-2 px-3"
                            >
                              <ExternalLink className="h-3 w-3" /> Abrir vídeo no Google Drive
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleDrivePick}
                              disabled={picking}
                              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40 transition-all p-4 text-center"
                            >
                              <Cloud className="h-6 w-6 text-muted-foreground" />
                              <span className="text-xs font-body text-muted-foreground">
                                {picking ? "Abrindo..." : "Google Drive"}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={openLocalFilePicker}
                              disabled={uploadingLocal}
                              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40 transition-all p-4 text-center"
                            >
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              <span className="text-xs font-body text-muted-foreground">
                                {uploadingLocal ? "Enviando..." : "Galeria / PC"}
                              </span>
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 font-body text-center">
                            Para melhor qualidade, use arquivos do Google Drive. Uploads diretos ficam disponíveis por 30 dias.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* CARROSSEL: um lugar só pra TODA a mídia. Sobe várias imagens de
                     uma vez e reordena arrastando pela barrinha. A ordem da tira é
                     a ordem dos slides. Nada de mídia por lâmina no carrossel. */
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                      Imagens do carrossel
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDrivePick}
                        disabled={picking}
                        className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40 transition-all px-3 py-2 text-xs font-body text-muted-foreground disabled:opacity-50"
                      >
                        <Cloud className="h-4 w-4" />
                        {picking ? "Abrindo..." : "Google Drive"}
                      </button>
                      <button
                        type="button"
                        onClick={openLocalFilePicker}
                        disabled={uploadingLocal}
                        className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40 transition-all px-3 py-2 text-xs font-body text-muted-foreground disabled:opacity-50"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {uploadingLocal ? "Enviando..." : "Galeria / PC"}
                      </button>
                      {(uploadingLocal || activeUpload) && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {mediaList.length > 0 && (
                        <span className="ml-auto text-[11px] font-body text-muted-foreground tabular-nums">
                          {mediaList.length} {mediaList.length === 1 ? "imagem" : "imagens"}
                        </span>
                      )}
                    </div>
                    {mediaList.length > 0 ? (
                      <CarouselMediaStrip
                        media={mediaList}
                        onReorder={reorderMedia}
                        onRemove={removeDriveRef}
                        removingIds={removingIds}
                      />
                    ) : (
                      <p className="text-[11px] font-body text-muted-foreground/70 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-center">
                        Nenhuma imagem ainda. Suba as imagens do carrossel pelos botões acima.
                      </p>
                    )}
                  </div>
                )}

                {/* Link do conteudo final (Drive/Canva/arquivo pronto). */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                    <Cloud className="h-3 w-3" /> Link do conteúdo (Drive/Canva)
                  </Label>
                  <Input
                    placeholder="Cole o link do Drive, Canva ou arquivo final..."
                    value={contentLink}
                    onChange={(e) => setContentLink(e.target.value)}
                    className="rounded-xl h-10 text-sm bg-card"
                  />
                  {contentLink.trim() && /^https?:\/\//i.test(contentLink.trim()) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 mt-1"
                      onClick={() => window.open(contentLink.trim(), "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir conteúdo
                    </Button>
                  )}
                </div>

                {/* Gerador de prompt do Estudio (arte a partir do conteudo real). */}
                <div className="pt-1 border-t border-border/50">
                  <ArtStudio
                    titulo={title}
                    formato={format}
                    sections={sections}
                    postId={post?.id ?? null}
                    roteiro={[hook, script, cta].filter(Boolean).join("\n\n")}
                    onSalvar={(texto) => setNotes((n) => (n ? `${n}\n\n${texto}` : texto))}
                    onIrParaRoteiro={() => conteudoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  />
                </div>
              </section>

              {/* 2. O CONTEUDO DO POST */}
              <section ref={conteudoRef} className="scroll-mt-4 rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-4">
                <BlocoCabecalho numero={2} titulo="O conteúdo do post" subtitulo="Escolha o formato e escreva a estrutura." />

                <div data-tour="editor-plataforma" className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                      Plataforma
                    </Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="rounded-xl h-10 bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            <span className="flex items-center gap-2">
                              <PlatformIcon platform={p} size="sm" />
                              <span className="capitalize">{p}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                      Formato
                    </Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="rounded-xl h-10 bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((f) => (
                          <SelectItem key={f} value={f}>{FORMAT_LABELS[f] || f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* DETALHES (pilar, status, semana): decisões importantes, ficam
                    VISÍVEIS e no topo do passo 1, logo depois de plataforma/formato.
                    Antes estavam escondidas num recolhível apagado no fim do passo. */}
                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
                  {/* O PILAR saiu daqui: subiu pro topo do editor, logo abaixo
                     do título, no estilo do "+ Etiqueta" do Cria Post
                     (pedido do Walter, 31/08). */}

                  <div data-tour="editor-status" className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                      Status
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((s) => {
                        const active = status === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => handleStatusChange(s.key)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all whitespace-nowrap",
                              active
                                ? getStatusClasses(s.key).replace("bg-", "bg-").replace("/10", "/20") + " font-semibold"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
                            )}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                        Semana
                      </Label>
                      <Select
                        value={weekNumber === null ? "none" : String(weekNumber)}
                        onValueChange={(val) => setWeekNumber(val === "none" ? null : Number(val))}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-sm bg-card">
                          <SelectValue placeholder="Sem semana" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Sem semana</span>
                          </SelectItem>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              Semana {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                        <LinkIcon className="h-3 w-3" /> Link de referência
                      </Label>
                      <Input
                        placeholder="Cole um link de vídeo de referência..."
                        value={referenceLink}
                        onChange={(e) => setReferenceLink(e.target.value)}
                        className="rounded-xl h-10 text-sm bg-card"
                      />
                    </div>
                  </div>

                  {/* DATA E HORA: compactos e no topo, junto dos detalhes. Antes
                      moravam num bloco grande so no fim do fluxo (passo 4), forcando
                      a pessoa a rolar ate embaixo pra definir a data. O widget de
                      melhores horarios virou um "ver melhores horarios" que expande,
                      logo abaixo, secundario. */}
                  <div data-tour="editor-agendamento" className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" /> Data
                        </Label>
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="rounded-xl h-10 text-sm w-full min-w-0 px-3 text-left bg-card [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:text-left"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Hora
                        </Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="rounded-xl h-10 text-sm w-full min-w-0 px-3 text-left bg-card [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:text-left"
                        />
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowBestTimes((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-body font-semibold text-primary hover:underline"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {showBestTimes ? "Ocultar melhores horários" : "Ver melhores horários pra postar"}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBestTimes && "rotate-180")} />
                      </button>
                      {showBestTimes && (
                        <div className="mt-2">
                          <BestTimesHint platform={platform} niche={profile?.niche} onPick={setScheduledTime} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Roteiro/estrutura (muda conforme o formato). A LEGENDA saiu daqui
                    de proposito: agora tem lugar unico no passo 2, pra ninguem mais
                    procurar "onde escrevo a legenda". */}
                {(() => {
                  const iconMap: Record<string, React.ElementType> = {
                    Anchor, Layers, Type, Radio, MousePointerClick, MessageSquare, PenLine,
                  };
                  return (
                    <div className="space-y-4">
                      {formatStructure.fields.map((field) => {
                        if (field.key === "caption") return null; // legenda vive no passo 2
                        const IconComponent = iconMap[field.icon] || PenLine;
                        const value = field.key === "hook" ? hook
                          : field.key === "script" ? script
                          : field.key === "cta" ? cta : "";
                        const setter = field.key === "hook" ? setHook
                          : field.key === "script" ? setScript
                          : field.key === "cta" ? setCta : (() => {});
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="font-body text-sm flex items-center gap-2">
                                <IconComponent className="h-4 w-4" /> {field.label}
                              </Label>
                              {field.key === "hook" && format !== "live" && (
                                <SeletorDeGanchos valorAtual={hook} onPick={setHook} />
                              )}
                            </div>
                            <Textarea
                              placeholder={field.placeholder}
                              value={value}
                              onChange={(e) => setter(e.target.value)}
                              className="rounded-xl"
                              rows={field.rows}
                            />
                          </div>
                        );
                      })}
                      {formatStructure.hasDynamicSections && (
                        <CarouselWriter
                          titulo={title}
                          formato={format}
                          pilar={pillarId ?? undefined}
                          sections={sections}
                          onChange={setSections}
                          hook={hook}
                          onHook={setHook}
                          cta={cta}
                          onCta={setCta}
                          unify={formatStructure.devField}
                        />
                      )}
                      {formatStructure.hasDynamicSections && !formatStructure.devField && (
                        <ScriptEditor
                          sections={sections}
                          onChange={setSections}
                          sectionLabel={formatStructure.sectionLabel ?? "Seção"}
                          picking={picking}
                          uploadingLocal={uploadingLocal}
                          onUploadLocalForSection={(index) => {
                            if (!userId) return;
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none";

                            const cleanup = () => {
                              if (input.parentNode) input.parentNode.removeChild(input);
                            };

                            input.addEventListener("change", async () => {
                              try {
                                const raw = input.files?.[0];
                                if (!raw) return;
                                const validation = validateUpload(raw, "postMedia");
                                if (!validation.ok) {
                                  toast.error(validation.reason);
                                  return;
                                }
                                try {
                                  setUploadingLocal(true);
                                  const file = await compressImage(raw);
                                  const safeName = sanitizeStoragePath(file.name);
                                  const path = `${userId}/${Date.now()}-${safeName}`;
                                  const { error: upErr } = await supabase.storage
                                    .from("media")
                                    .upload(path, file, { upsert: true, contentType: file.type });
                                  if (upErr) {
                                    console.error("[section-upload] storage error", upErr);
                                    toast.error(`Erro ao enviar ${file.name}: ${upErr.message}`);
                                    return;
                                  }
                                  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

                                  // Registra em external_media_refs (provider='storage') pra
                                  // Feed e Arquivos enxergarem; cota e incrementada.
                                  let mediaRefId: string | null = null;
                                  const { data: inserted, error: insErr } = await supabase
                                    .from("external_media_refs")
                                    .insert({
                                      user_id: userId,
                                      post_id: post?.id ?? null,
                                      provider: "storage",
                                      external_file_id: path,
                                      file_name: file.name,
                                      file_type: file.type || null,
                                      file_size: file.size,
                                      thumbnail_url: urlData.publicUrl,
                                      view_url: urlData.publicUrl,
                                    })
                                    .select("id")
                                    .single();
                                  if (insErr) {
                                    console.error("[section-upload] external_media_refs insert error", insErr);
                                  } else if (inserted) {
                                    mediaRefId = (inserted as { id: string }).id;
                                    if (!post?.id) {
                                      // backfill no save (mesmo mecanismo de pendingDriveFiles, mas em lista propria)
                                      setPendingSectionRefIds((prev) => [...prev, mediaRefId!]);
                                    }
                                    const { error: incErr } = await (supabase.rpc as unknown as (
                                      fn: string, args: unknown,
                                    ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: file.size });
                                    if (incErr) console.error("[section-upload] increment_storage failed (+)", incErr);
                                  }

                                  setSections((prev) =>
                                    prev.map((s, j) =>
                                      j === index
                                        ? {
                                            ...s,
                                            driveFileId: path,
                                            driveFileName: file.name,
                                            driveThumbnail: urlData.publicUrl,
                                            mediaRefId,
                                          }
                                        : s
                                    )
                                  );
                                } catch (err) {
                                  console.error("[section-upload] unexpected", err);
                                  toast.error("Erro ao enviar midia.");
                                } finally {
                                  setUploadingLocal(false);
                                }
                              } finally {
                                cleanup();
                              }
                            }, { once: true });

                            input.addEventListener("cancel", cleanup, { once: true });
                            setTimeout(() => {
                              if (!input.files || input.files.length === 0) cleanup();
                            }, 5 * 60 * 1000);

                            document.body.appendChild(input);
                            input.click();
                          }}
                          onRemoveSectionMedia={async (index) => {
                            const sec = sections[index];
                            const refId = sec?.mediaRefId ?? null;
                            const storagePath = sec?.driveFileId ?? null;
                            // 1) limpa a UI imediatamente
                            setSections((prev) =>
                              prev.map((s, j) =>
                                j === index
                                  ? {
                                      ...s,
                                      driveFileId: null,
                                      driveFileName: null,
                                      driveThumbnail: null,
                                      mediaRefId: null,
                                    }
                                  : s
                              )
                            );
                            if (!refId) return; // midia de Drive antiga sem mediaRefId, nada a sincronizar
                            try {
                              // Busca file_size pra devolver pra cota
                              const { data: refRow } = await supabase
                                .from("external_media_refs")
                                .select("file_size, provider, external_file_id")
                                .eq("id", refId)
                                .maybeSingle();
                              await supabase.from("external_media_refs").delete().eq("id", refId);
                              // remove do state de pending se ainda estava la (post novo)
                              setPendingSectionRefIds((prev) => prev.filter((id) => id !== refId));
                              const provider = (refRow as { provider?: string | null } | null)?.provider;
                              const sizeBytes = (refRow as { file_size?: number | null } | null)?.file_size ?? null;
                              const filePath = ((refRow as { external_file_id?: string | null } | null)?.external_file_id) ?? storagePath;
                              if (provider === "storage" && filePath) {
                                await supabase.storage.from("media").remove([filePath]);
                                if (sizeBytes && sizeBytes > 0 && userId) {
                                  const { error: decErr } = await (supabase.rpc as unknown as (
                                    fn: string, args: unknown,
                                  ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: -sizeBytes });
                                  if (decErr) console.error("[section-upload] increment_storage failed (-)", decErr);
                                }
                              }
                            } catch (e) {
                              console.error("[section-upload] remove sync failed", e);
                            }
                          }}
                          onPickDriveForSection={async (index) => {
                            const before = new Date().toISOString();
                            await pickAndSave(undefined);
                            const { data } = await supabase
                              .from("external_media_refs")
                              .select("external_file_id, file_name, thumbnail_url")
                              .eq("user_id", userId)
                              .is("post_id", null)
                              .gte("created_at", before)
                              .order("created_at", { ascending: false })
                              .limit(1);
                            if (data && data[0]) {
                              setSections((prev) =>
                                prev.map((s, j) =>
                                  j === index
                                    ? {
                                        ...s,
                                        driveFileId: data[0].external_file_id,
                                        driveFileName: data[0].file_name,
                                        driveThumbnail: data[0].thumbnail_url,
                                      }
                                    : s
                                )
                              );
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                })()}

              </section>

              {/* 3. A LEGENDA */}
              <section className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-4">
                <BlocoCabecalho numero={3} titulo="A legenda" subtitulo="Escreva aqui. A IA te ajuda a gerar, encurtar e melhorar. É o único lugar da legenda." />

                {/* O textarea vem primeiro e grande: e a resposta pra "onde escrevo?". */}
                <div className="relative rounded-2xl border border-border bg-muted/10 p-3">
                  {/* Emoji sempre visivel no canto superior direito da legenda. */}
                  <div className="absolute top-2 right-2 z-10 rounded-full bg-card/90 backdrop-blur-sm shadow-sm border border-border">
                    <EmojiPicker onPick={insertEmoji} />
                  </div>
                  <textarea
                    ref={captionRef}
                    placeholder="Escreva sua legenda aqui ou gere com IA..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full min-h-[220px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-body text-base text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed pr-10"
                  />
                  <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                    {captionLen}/{captionMax}
                  </span>
                </div>

                {caption.length > 10 && (
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: "rephrase", label: "Reescrever", icon: RefreshCw, instruction: "Reescreva essa legenda mantendo a mesma mensagem mas com palavras completamente diferentes." },
                      { key: "shorten", label: "Encurtar", icon: Minus, instruction: "Encurte essa legenda pra no maximo 2 linhas mantendo a essencia e o CTA." },
                      { key: "expand", label: "Expandir", icon: Plus, instruction: "Expanda essa legenda com mais detalhes, storytelling e contexto. Mantenha o tom." },
                      { key: "casual", label: "Mais casual", icon: SmilePlus, instruction: "Reescreva essa legenda num tom mais casual, descontraido, como conversa entre amigos. Use girias leves." },
                      { key: "formal", label: "Mais formal", icon: Briefcase, instruction: "Reescreva essa legenda num tom mais profissional e polido. Sem girias, linguagem clara e direta." },
                    ] as const).map((action) => {
                      const isLoading = refineLoading === action.key;
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.key}
                          type="button"
                          disabled={!!refineLoading}
                          onClick={() => handleRefineCaption(action.key, action.instruction)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-body font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 disabled:hover:bg-card"
                        >
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                          {action.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={scoreLoading}
                      onClick={handleScoreCaption}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-xs font-body font-semibold text-primary transition-all disabled:opacity-50"
                    >
                      {scoreLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                      Avaliar legenda
                    </button>
                  </div>
                )}

                {/* Ajuda da IA: recolhida por padrao pra deixar menos coisa a mostra.
                    Abre no clique com o mesmo padrao dos blocos Tarefas/Notas/Refs.
                    Fechada ocupa uma linha; o gerar/hashtags continua funcionando aberto. */}
                <div data-tour="editor-ia">
                  <Recolhivel icon={Sparkles} titulo="Ajuda da IA: gerar legenda, escolher tom, hashtags">
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Tom</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {TONE_OPTIONS.map((t) => (
                            <button key={t.key} type="button" onClick={() => setAiTone(t.key)} className={pillClass(aiTone === t.key)}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {LENGTH_OPTIONS.map((l) => (
                            <button key={l.key} type="button" onClick={() => setAiLength(l.key)} className={pillClass(aiLength === l.key)}>
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button variant="hero" onClick={handleGenerateCaption} disabled={!title || aiLoading} className="w-full">
                          {aiLoading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando legenda...</>
                          ) : (
                            <><Sparkles className="h-4 w-4 mr-2" /> Gerar legenda</>
                          )}
                        </Button>
                        <Button variant="secondary" onClick={handleSuggestHashtags} disabled={!title || hashLoading} className="w-full">
                          {hashLoading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sugerindo...</>
                          ) : (
                            <><Hash className="h-4 w-4 mr-2" /> Sugerir hashtags</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Recolhivel>
                </div>

                {aiCaption && (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                    <p className="text-sm font-body text-foreground whitespace-pre-line leading-relaxed">{aiCaption}</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setCaption((prev) => (prev ? `${prev}\n\n${aiCaption}` : aiCaption));
                          toast.success("Legenda adicionada ao post!");
                        }}
                      >
                        Usar esta legenda
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={handleGenerateCaption}>
                        Gerar outra
                      </Button>
                    </div>
                  </div>
                )}

                {scoreResult && (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const nota = scoreResult.nota;
                        const cls = nota >= 8 ? "text-emerald-600 bg-emerald-500/10"
                          : nota >= 6 ? "text-amber-600 bg-amber-500/10"
                          : "text-destructive bg-destructive/10";
                        return (
                          <div className={`flex flex-col items-center justify-center h-14 w-14 rounded-2xl shrink-0 ${cls}`}>
                            <span className="text-xl font-display font-extrabold leading-none tabular-nums">
                              {nota.toFixed(1)}
                            </span>
                            <span className="text-[9px] font-body opacity-70">/ 10</span>
                          </div>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80 mb-0.5">
                          Nota de gancho
                        </p>
                        <p className="text-sm font-body text-foreground">{scoreResult.veredito}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScoreResult(null)}
                        className="shrink-0 p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
                        aria-label="Fechar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {scoreResult.melhorias?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                          Como melhorar
                        </p>
                        <ul className="space-y-1">
                          {scoreResult.melhorias.map((m, i) => (
                            <li key={i} className="flex gap-2 text-xs font-body text-muted-foreground">
                              <span className="text-primary">•</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Atalho pros 60 ganchos prontos: aqui nao existe campo de
                        gancho (a nota e da legenda), entao o modo e COPIAR, e a
                        pessoa cola no comeco da legenda se quiser. */}
                    <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
                      <span>Travou no gancho?</span>
                      <SeletorDeGanchos modo="copiar" label="Experimente um destes" className="h-6 px-1.5" />
                    </div>

                    {scoreResult.variacoes?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                          Variações prontas
                        </p>
                        {scoreResult.variacoes.map((v, i) => (
                          <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-2">
                            <p className="text-sm font-body text-foreground whitespace-pre-line">{v}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setCaption(v);
                                setScoreResult(null);
                                toast.success("Legenda atualizada!");
                              }}
                              className="text-xs font-body font-semibold text-primary hover:underline"
                            >
                              Usar esta
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {refinedPreview && (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-display font-semibold text-primary">Sugestão da IA</span>
                    </div>
                    <div className="bg-destructive/5 rounded-lg p-2.5">
                      <p className="text-xs font-body text-muted-foreground line-through whitespace-pre-line">
                        {caption.slice(0, 200)}{caption.length > 200 ? "..." : ""}
                      </p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2.5 border border-emerald-200/50">
                      <p className="text-sm font-body text-foreground whitespace-pre-line">{refinedPreview}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setCaption(refinedPreview);
                          setRefinedPreview(null);
                          toast.success("Legenda atualizada!");
                        }}
                      >
                        Substituir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setRefinedPreview(null)}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}

                {hashSuggested.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                        Hashtags sugeridas
                      </p>
                      {hashSelected.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const text = hashSelected.map((t) => `#${t}`).join(" ");
                            navigator.clipboard.writeText(text);
                            toast.success("Hashtags copiadas!");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar {hashSelected.length}
                        </Button>
                      )}
                    </div>
                    {hashGroups.high.length > 0 && (
                      <HashGroup label="Alta relevância" color="text-emerald-600" tags={hashGroups.high} selected={hashSelected} onToggle={toggleHash} />
                    )}
                    {hashGroups.medium.length > 0 && (
                      <HashGroup label="Média relevância" color="text-amber-600" tags={hashGroups.medium} selected={hashSelected} onToggle={toggleHash} />
                    )}
                    {hashGroups.niche.length > 0 && (
                      <HashGroup label="Nicho específico" color="text-violet-600" tags={hashGroups.niche} selected={hashSelected} onToggle={toggleHash} />
                    )}
                    {hashSelected.length > 0 && (
                      <p className="text-xs font-body text-primary break-all border-t border-border pt-2">
                        {hashSelected.map((t) => `#${t}`).join(" ")}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* O antigo passo 4 "Quando publicar" saiu daqui: data e hora agora
                  vivem compactos no topo (bloco de detalhes do passo 1), e o widget
                  de melhores horarios virou um "ver melhores horarios" ao lado da
                  data. Assim a pessoa define a data sem rolar ate o fim do fluxo. */}

              {/* MAIS: organizacao interna (secundario), recolhido pra nao poluir o fluxo. */}
              <div className="space-y-3">
                <Recolhivel icon={ListChecks} titulo="Tarefas">
                  <div className="pt-1">
                    {!isNew && post ? (
                      <PostTasks postId={post.id} />
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground font-body">
                        Salve o post primeiro para adicionar tarefas.
                      </div>
                    )}
                  </div>
                </Recolhivel>

                <Recolhivel icon={StickyNote} titulo="Notas">
                  <div className="relative pt-1">
                    <textarea
                      placeholder="Anote ideias soltas, links de inspiração, lembretes para esse conteúdo..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full min-h-[220px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-body text-base text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                    />
                  </div>
                </Recolhivel>

                <Recolhivel icon={BookOpen} titulo="Referências (hooks, formatos, prompts)" onOpen={handleAiReferences}>
                  <div className="pt-1">
                    <Tabs defaultValue="hooks">
                      <TabsList className="bg-muted/40 border border-border rounded-xl mb-4 w-full">
                        <TabsTrigger value="hooks" className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <Sparkles className="h-3 w-3 mr-1" /> Hooks
                        </TabsTrigger>
                        <TabsTrigger value="formatos" className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <FileCode2 className="h-3 w-3 mr-1" /> Formatos
                        </TabsTrigger>
                        <TabsTrigger value="prompts" className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <MessageSquareText className="h-3 w-3 mr-1" /> Prompts
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="hooks" className="space-y-2">
                        {isRefAiLoading && (
                          <div className="bg-card rounded-xl p-3 border border-border animate-pulse flex items-center justify-center">
                            <Sparkles className="h-4 w-4 mr-2 animate-spin text-primary" />
                            <span className="text-xs font-body text-muted-foreground">Filtrando referências...</span>
                          </div>
                        )}
                        {aiHookCategories.length > 0 && (
                          <div className="mb-4">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Sugestões da IA</p>
                            <div className="flex flex-wrap gap-2">
                              {aiHookCategories.map((cat) => (
                                <span key={cat} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/20">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {FALLBACK_HOOKS.map((h, i) => (
                          <div key={i} className={`bg-muted/30 rounded-xl p-3 border transition-all ${aiHookCategories.includes(h.category) ? "border-primary/40 shadow-sm" : "border-border"}`}>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-body mb-2 ${aiHookCategories.includes(h.category) ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                              {h.category}
                            </span>
                            <p className="text-sm font-body text-foreground mb-2">"{h.text}"</p>
                            <CopyButton text={h.text} />
                          </div>
                        ))}
                        {userRefHooks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Meus Hooks</p>
                            {userRefHooks.map((h, i) => (
                              <div key={`uh-${i}`} className="bg-muted/30 rounded-xl p-3 border border-border mb-2">
                                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-body bg-secondary/10 text-secondary mb-1 capitalize">
                                  {h.category}
                                </span>
                                <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                                <CopyButton text={h.hook_text} className="mt-1" />
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="formatos" className="space-y-2">
                        {(() => {
                          const filtered = refFormats.filter((f) => f.platform === platform || f.platform === "todos" || !platform);
                          if (filtered.length === 0)
                            return (
                              <div className="bg-muted/30 rounded-xl p-4 border border-border text-center">
                                <p className="text-sm text-muted-foreground font-body">Nenhum formato cadastrado ainda.</p>
                              </div>
                            );
                          return filtered.map((f) => (
                            <div key={f.id} className="bg-muted/30 rounded-xl p-3 border border-border space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <PlatformIcon platform={f.platform} size="sm" />
                                  <span className="font-body font-medium text-sm text-foreground">{f.name}</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-secondary/10 text-secondary">{f.format_type}</span>
                              </div>
                              <p className="text-xs text-muted-foreground font-body whitespace-pre-line">{f.structure}</p>
                              {f.tips && <p className="text-xs text-muted-foreground font-body italic">{f.tips}</p>}
                              <CopyButton text={f.structure || f.name} />
                            </div>
                          ));
                        })()}
                      </TabsContent>

                      <TabsContent value="prompts" className="space-y-2">
                        <p className="text-xs text-muted-foreground font-body mb-3">
                          Copie, preencha os [COLCHETES] e cole no ChatGPT ou Claude
                        </p>
                        {FALLBACK_PROMPTS.map((p, i) => (
                          <div key={i} className="bg-muted/30 rounded-xl p-3 border border-border">
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-body bg-secondary/10 text-secondary mb-2">
                              {p.category}
                            </span>
                            <p className="font-body font-medium text-sm text-foreground mb-1">{p.title}</p>
                            <p className="text-xs text-muted-foreground font-body mb-2">{p.text}</p>
                            <CopyButton text={p.text} />
                          </div>
                        ))}
                        {userRefPrompts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Meus Prompts</p>
                            {userRefPrompts.map((p, i) => (
                              <div key={i} className="bg-muted/30 rounded-xl p-3 border border-border mb-2">
                                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-body bg-secondary/10 text-secondary mb-1 capitalize">
                                  {p.category}
                                </span>
                                <p className="text-sm font-body font-medium text-foreground mb-1">{p.title}</p>
                                <p className="text-xs text-muted-foreground font-body">{p.prompt_text}</p>
                                <CopyButton text={p.prompt_text} className="mt-1" />
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </Recolhivel>
              </div>

              {showResults && (
                <section className="rounded-3xl bg-card border border-border p-4 sm:p-5 space-y-3">
                  <p className="font-body font-semibold text-foreground text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Resultados do post
                  </p>
                  {status === "publicado" && !post?.result_views && (
                    <p className="text-xs text-muted-foreground font-body flex items-center gap-1.5">
                      <Target className="h-3 w-3" /> Quer registrar o resultado?
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="font-body text-[10px] flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Views
                      </Label>
                      <Input type="number" placeholder="0" value={views} onChange={(e) => setViews(e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-[10px] flex items-center gap-1">
                        <Bookmark className="h-3 w-3" /> Salvos
                      </Label>
                      <Input type="number" placeholder="0" value={saves} onChange={(e) => setSaves(e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-[10px] flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Coment.
                      </Label>
                      <Input type="number" placeholder="0" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-[10px] flex items-center gap-1">
                        <Radio className="h-3 w-3" /> Alcance
                      </Label>
                      <Input type="number" placeholder="0" value={reach} onChange={(e) => setReach(e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-[10px] flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" /> Compart.
                      </Label>
                      <Input type="number" placeholder="0" value={shares} onChange={(e) => setShares(e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                  </div>
                </section>
              )}
              </div>
              {/* FIM da coluna esquerda */}

              {/* COLUNA DIREITA (só desktop): a PRÉVIA do post, fixa enquanto rola.
                  No mobile ela não aparece aqui: fica no botão "Prévia" do topo. */}
              <aside className="hidden lg:block lg:sticky lg:top-4 self-start">
                <div className="w-full rounded-3xl border border-border bg-background overflow-hidden shadow-sm">
                  <div className="px-3 py-2 border-b border-border bg-card/50 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-display font-semibold text-foreground">Prévia do post</span>
                  </div>
                  <PostPreviewContent
                    key={platform}
                    title={title}
                    hook={hook}
                    caption={caption}
                    platform={platform}
                    format={format}
                    userName={previewIdentity.name}
                    userHandle={previewIdentity.handle}
                    avatarUrl={previewIdentity.avatarUrl}
                    mediaUrl={previewMediaUrl}
                    mediaType={previewMediaType}
                    sections={sections}
                  />
                </div>
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {post && (
        <RepurposeSheet
          open={repurposeOpen}
          onOpenChange={setRepurposeOpen}
          originalPost={post as unknown as DbPost}
          mode={repurposeMode}
        />
      )}
      <PostPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={title}
        hook={hook}
        caption={caption}
        platform={platform}
        format={format}
        userName={previewIdentity.name}
        userHandle={previewIdentity.handle}
        avatarUrl={previewIdentity.avatarUrl}
        mediaUrl={previewMediaUrl}
        mediaType={previewMediaType}
        sections={sections}
      />
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        <RoteiroPdfTemplate
          ref={pdfRef}
          title={title}
          format={format}
          hook={hook}
          caption={caption}
          sections={sections}
          /* No carrossel o desenvolvimento (slides do meio + CTA) mora na
             coluna cta, entao ele entra no PDF por aqui, nao pelas laminas. */
          development={formatStructure.devField ? cta : undefined}
          referenceLink={referenceLink}
          userName={profile?.name}
          platform={platform}
        />
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir post?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {post ? `"${title || post.title}" será removido permanentemente. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              onClick={handleConfirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={videoTipOpen} onOpenChange={setVideoTipOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vídeo adicionado 🎬</AlertDialogTitle>
            <AlertDialogDescription>
              Você não precisa esperar: já pode tocar em Publicar que o vídeo vai direto pro app na hora. O envio pra pré-visualização leva de 1 a 3 minutos e roda em segundo plano, pode salvar o post e seguir usando o sistema normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm text-muted-foreground font-body cursor-pointer px-1">
            <input
              type="checkbox"
              checked={dontShowVideoTip}
              onChange={(e) => setDontShowVideoTip(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Não mostrar este aviso novamente
          </label>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              if (dontShowVideoTip) localStorage.setItem("hide_video_upload_tip", "true");
              setVideoTipOpen(false);
            }}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Helper components
// ────────────────────────────────────────────────────────────

// ─── Punho de arraste da tira do carrossel (mesmo padrão do gestor): só a
// barrinha de baixo é alça, então no celular o dedo ainda rola a tira por cima
// da miniatura e o arraste começa pegando o punho.
function MediaGrip({ handleProps }: { handleProps?: DraggableProvidedDragHandleProps }) {
  return (
    <span
      {...(handleProps ?? {})}
      aria-label="Arrastar para reordenar"
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-10 h-6 grid place-items-center bg-black/60 text-white/95 cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical className="h-4 w-4 rotate-90" />
    </span>
  );
}

// ─── Tira reordenável da mídia do carrossel. Uma imagem por slide, na ordem da
// tira. Enquanto arrasta, o item vai pro <body> via portal, porque o editor é um
// Dialog com transform, e o transform quebra o position:fixed que o dnd usa.
function CarouselMediaStrip({
  media, onReorder, onRemove, removingIds,
}: {
  media: DriveRef[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (ref: DriveRef) => void;
  removingIds: Set<string>;
}) {
  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const from = r.source.index;
    const to = r.destination.index;
    if (from === to) return;
    const ids = media.map((m) => m.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  };
  return (
    <div className="overflow-x-auto overflow-y-hidden pb-2.5 kanban-scroll">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="carousel-media" direction="horizontal">
          {(dropP) => (
            <div ref={dropP.innerRef} {...dropP.droppableProps} className="flex w-max">
              {media.map((m, i) => {
                const isVideo = m.file_type?.includes("video");
                const src = m.thumbnail_url || m.view_url || "";
                return (
                  <Draggable key={m.id} draggableId={m.id} index={i} disableInteractiveElementBlocking>
                    {(dragP, dragS) => {
                      const item = (
                        <div
                          ref={dragP.innerRef}
                          {...dragP.draggableProps}
                          style={{
                            ...dragP.draggableProps.style,
                            WebkitUserSelect: "none",
                            userSelect: "none",
                            WebkitTouchCallout: "none",
                          }}
                          className={cn(
                            "relative shrink-0 w-16 h-16 mr-2 rounded-xl overflow-hidden border border-border bg-muted select-none",
                            dragS.isDragging && "ring-2 ring-primary/50 shadow-lg",
                          )}
                        >
                          {src ? (
                            <img
                              src={src}
                              alt=""
                              draggable={false}
                              loading="lazy"
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                          {isVideo && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Play className="h-5 w-5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" />
                            </span>
                          )}
                          <span className="absolute top-0.5 left-0.5 z-10 bg-black/65 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemove(m)}
                            disabled={removingIds.has(m.id)}
                            aria-label="Remover imagem"
                            className="absolute top-1 right-1 z-20 grid place-items-center bg-black/65 text-white rounded-full p-1 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <MediaGrip handleProps={dragP.dragHandleProps ?? undefined} />
                        </div>
                      );
                      return dragS.isDragging ? createPortal(item, document.body) : item;
                    }}
                  </Draggable>
                );
              })}
              {dropP.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

// ─── Bloco numerado do fluxo vertical: badge com o número + título + orientação.
function BlocoCabecalho({ numero, titulo, subtitulo }: { numero: number; titulo: string; subtitulo: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-extrabold text-sm shadow-sm">
        {numero}
      </span>
      <div className="min-w-0 pt-0.5">
        <h3 className="font-display font-bold text-[15px] sm:text-base text-foreground leading-tight">{titulo}</h3>
        <p className="text-xs font-body text-muted-foreground mt-0.5 leading-snug">{subtitulo}</p>
      </div>
    </div>
  );
}

// ─── Seção recolhível (Detalhes, Tarefas, Notas, Referências): mantém o fluxo
// principal limpo e guarda o secundário atrás de um clique.
function Recolhivel({
  icon: Icon,
  titulo,
  defaultOpen,
  onOpen,
  children,
}: {
  icon: React.ElementType;
  titulo: string;
  defaultOpen?: boolean;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const alternar = () => {
    setOpen((o) => {
      const proximo = !o;
      if (proximo) onOpen?.();
      return proximo;
    });
  };
  return (
    <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={alternar}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 font-display font-semibold text-sm text-foreground">{titulo}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function HashGroup({
  label,
  color,
  tags,
  selected,
  onToggle,
}: {
  label: string;
  color: string;
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div>
      <p className={cn("text-[10px] uppercase tracking-wider font-body font-semibold mb-1", color)}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-body border transition-all",
              selected.includes(tag)
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card border-border text-muted-foreground hover:border-primary/20"
            )}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}
