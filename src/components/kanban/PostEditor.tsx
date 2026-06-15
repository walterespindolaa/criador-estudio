import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  Sparkles, MessageSquareText, FileCode2, Anchor, PenLine, MessageSquare,
  ClipboardList, BarChart3, Eye, Bookmark, Target, Clock, Cloud, Image as ImageIcon, X, Trash2,
  Layers, Type, Radio, MousePointerClick, Link as LinkIcon, Download, BookOpen,
  Loader2, Hash, Copy, Repeat2, FileText, ListChecks, Calendar, ChevronDown,
  RefreshCw, Minus, Plus, SmilePlus, Briefcase, StickyNote,
  CalendarPlus, CalendarCheck, CalendarX,
  Play, Video, ExternalLink,
} from "lucide-react";
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
import { FORMAT_LABELS, PLATFORMS, FORMATS, STATUS_OPTIONS, BUNNY_CDN_HOSTNAME } from "@/lib/constants";
import * as tus from "tus-js-client";
import heic2any from "heic2any";

const VIDEO_EXTS = ["mov", "mp4", "m4v", "webm", "avi", "mkv", "hevc", "3gp"];
const HEIC_EXTS = ["heic", "heif"];
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB — teto de sanidade pro Bunny

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
} from "@/lib/ai/claude";
import { ScriptEditor, emptySection, type Section } from "./drawer/ScriptEditor";
import { RepurposeSheet } from "./RepurposeSheet";
import { PostPreviewModal } from "./PostPreviewModal";
import { PublishButton } from "./PublishButton";
import { useProfile } from "@/hooks/useProfile";
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
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

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
  { text: "Eu gastei [tempo] pra aprender isso — te conto em 60s", category: "curiosidade" },
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

export function PostEditor({ open, onOpenChange, post, pillars, userId, onSaved, initialFormat }: PostEditorProps) {
  const isNew = !post;
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("reels");
  const [pillarId, setPillarId] = useState("");
  const [status, setStatus] = useState("ideia");
  const [hook, setHook] = useState("");
  const [script, setScript] = useState("");
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [googleEventId, setGoogleEventId] = useState<string | null>(null);
  const [views, setViews] = useState("");
  const [saves, setSaves] = useState("");
  const [comments, setComments] = useState("");
  const [reach, setReach] = useState("");
  const [shares, setShares] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [sections, setSections] = useState<Section[]>(Array(5).fill(null).map(emptySection));
  const [referenceLink, setReferenceLink] = useState("");

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

  const [mobileTab, setMobileTab] = useState<"config" | "criar">("config");
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mobileTab === "criar") mainRef.current?.scrollTo({ top: 0 });
  }, [mobileTab]);

  // References panel
  const [refsOpen, setRefsOpen] = useState(false);
  const [isRefAiLoading, setIsRefAiLoading] = useState(false);
  const [aiHookCategories, setAiHookCategories] = useState<string[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [videoTipOpen, setVideoTipOpen] = useState(false);
  const [dontShowVideoTip, setDontShowVideoTip] = useState(false);

  // Auto-save indicator
  const [autoSaveStatus, setAutoSaveStatus] = useState<null | "saving" | "saved">(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadCompleteRef = useRef(false);

  const { profile } = useProfile();
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
  const { syncPost: syncCalendarPost, removeFromCalendar, syncing: calendarSyncing } = useGoogleCalendar();
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
      .order("created_at");
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
      // Se o invoke falhar, ainda removemos a row localmente — o purge de 30 dias é a rede de segurança.
      if (ref.provider === "bunny" && ref.external_file_id) {
        try {
          const { error } = await supabase.functions.invoke("bunny-delete-video", {
            body: { videoGuid: ref.external_file_id, accountId: userId },
          });
          if (error) console.error("[bunny-delete-video] invoke error", error);
        } catch (e) {
          console.error("[bunny-delete-video] invoke threw", e);
        }
      }
      await supabase.from("external_media_refs").delete().eq("id", ref.id);

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
      // Sempre limpar UI local — em ambos os arrays — e liberar o lock.
      setPendingDriveFiles((prev) => prev.filter((f) => f.id !== ref.id));
      setDriveMedia((prev) => prev.filter((m) => m.id !== ref.id));
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
      setGoogleEventId(post.google_event_id ?? null);
      setViews(post.result_views?.toString() || "");
      setSaves(post.result_saves?.toString() || "");
      setComments(post.result_comments?.toString() || "");
      setReach(post.result_reach?.toString() || "");
      setShares(post.result_shares?.toString() || "");
      setShowResults(post.status === "publicado");
      setReferenceLink((post as unknown as { reference_link?: string }).reference_link || "");
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
      setPillarId(""); setStatus("ideia"); setHook(""); setScript("");
      setCaption(""); setCta(""); setScheduledDate(""); setScheduledTime(""); setNotes("");
      setWeekNumber(null);
      setGoogleEventId(null);
      setViews(""); setSaves(""); setComments(""); setReach(""); setShares(""); setShowResults(false); setReferenceLink("");
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
    user_id: userId,
  }), [title, platform, format, pillarId, status, hook, script, caption, cta,
       scheduledDate, scheduledTime, notes, weekNumber, views, saves, comments, reach, shares, sections, referenceLink, userId]);

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
        setAutoSaveStatus(null);
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, platform, format, pillarId, status, hook, script, caption, cta,
       scheduledDate, scheduledTime, notes, weekNumber, referenceLink, sections, open, post?.id]);

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
    // FileList é live — `e.target.value = ""` esvazia o FileList referenciado, então
    // precisamos copiar para um Array primeiro.
    const fileList = e.target.files;
    const files: File[] = fileList ? Array.from(fileList) : [];
    e.target.value = ""; // agora seguro — `files` já é snapshot independente
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
            // Fallback: heic2any (libheif WASM) — funciona em Chrome/Firefox/Windows.
            try {
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
    // Off-screen mas no DOM — garante que o input não seja GC'd antes do change event
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
    if (!title.trim()) return;
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
        setPendingDriveFiles([]);
        setPendingSectionRefIds([]);
      }
    }

    if (wasPublished) {
      fireConfetti();
      toast.success("Conteúdo publicado!");
      setShowResults(true);
    } else {
      toast.success(post ? "Post atualizado!" : "Post criado!");
      onOpenChange(false);
    }
    onSaved();
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

  const mediaList: DriveRef[] = isNew ? pendingDriveFiles : driveMedia;
  const activeUpload = uploads.find((u) => u.status === "uploading") ?? null;

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
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && hasActiveUpload) {
            // Confirma fechar enquanto há upload rolando — TUS continua via context, mas
            // o ref insert do vídeo depende deste componente estar montado. Melhor avisar.
            const ok = window.confirm(
              "Há um upload de vídeo em andamento. Se fechar agora, ele pode ser perdido. Fechar mesmo assim?",
            );
            if (!ok) return;
          }
          onOpenChange(o);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Permite fechar via ESC, mas bloqueia "clique fora" — que é falsamente
            // disparado pelo file picker nativo do SO ao abrir <input type="file">.
            // Issue conhecida: radix-ui/primitives#1280.
            e.preventDefault();
          }}
          className="[&>button:last-child]:hidden top-0 translate-y-0 sm:top-1/2 sm:-translate-y-1/2 max-w-none w-full h-[100dvh] sm:w-[96vw] sm:h-[94vh] sm:max-w-[1400px] p-0 overflow-hidden overflow-x-hidden flex flex-col bg-background rounded-none sm:rounded-2xl"
        >
          <DialogHeader className="px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0 border-b border-border">
            <DialogTitle className="sr-only">{isNew ? "Novo Post" : "Editar Post"}</DialogTitle>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isNew ? "Sobre o que é esse post?" : "Sem título"}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-display text-lg sm:text-xl md:text-2xl font-extrabold text-foreground placeholder:text-muted-foreground/40"
                />
                {autoSaveStatus && (
                  <span
                    className={cn(
                      "text-[10px] font-body font-medium whitespace-nowrap transition-opacity",
                      autoSaveStatus === "saving" ? "text-muted-foreground" : "text-secondary"
                    )}
                  >
                    {autoSaveStatus === "saving" ? "Salvando…" : "Salvo ✓"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
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
                {!isNew && post && (status === "publicado" || status === "agendado") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRepurposeOpen(true)}
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reaproveitar</span>
                  </Button>
                )}
                {(status === "editando" || status === "agendado") && (
                  <PublishButton
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
                  />
                )}
                <Button variant="hero" size="sm" onClick={handleSave} disabled={!title.trim()}>
                  {isNew ? "Criar" : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Body: split view */}
          <div className="flex flex-1 overflow-hidden flex-col">
            {/* Mobile tab switcher */}
            <div className="flex md:hidden shrink-0 border-b border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setMobileTab("config")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-body font-semibold transition-colors",
                  mobileTab === "config"
                    ? "text-primary border-b-2 border-primary bg-card"
                    : "text-muted-foreground"
                )}
              >
                ⚙ Configurar
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("criar")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-body font-semibold transition-colors",
                  mobileTab === "criar"
                    ? "text-primary border-b-2 border-primary bg-card"
                    : "text-muted-foreground"
                )}
              >
                ✦ Criar conteúdo
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden md:flex-row">
            {/* ─── LEFT: Configuration + AI ─────────── */}
            <aside className={cn(
              "w-full md:w-[40%] md:max-w-[480px] md:border-r border-border bg-muted/30 overflow-y-auto overflow-x-hidden",
              mobileTab === "config" ? "block" : "hidden md:block"
            )}>
              <div className="p-4 sm:p-5 space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {/* Metadata */}
                <section className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
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

                  {pillars.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                        Pilar
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {pillars.map((p) => {
                          const active = pillarId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPillarId(active ? "" : p.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all whitespace-nowrap",
                                active
                                  ? "text-primary-foreground border-transparent shadow-sm"
                                  : "bg-card text-foreground border-border hover:border-primary/30"
                              )}
                              style={active ? { backgroundColor: p.color } : undefined}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
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
                </section>

                {/* Schedule */}
                <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-display font-semibold">Agendamento</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center h-4">Data</Label>
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="rounded-xl h-10 text-sm w-full min-w-0 px-3 text-left [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:text-left"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1 h-4">
                        <Clock className="h-3 w-3" /> Hora
                      </Label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="rounded-xl h-10 text-sm w-full min-w-0 px-3 text-left [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:text-left"
                      />
                    </div>
                  </div>

                  {!isNew && post && scheduledDate && (
                    <div className="space-y-2 pt-1">
                      <Button
                        variant={googleEventId ? "outline" : "secondary"}
                        size="sm"
                        disabled={calendarSyncing}
                        onClick={async () => {
                          const newId = await syncCalendarPost({
                            id: post.id,
                            title: title || post.title,
                            scheduled_date: scheduledDate,
                            scheduled_time: scheduledTime || null,
                            caption: caption || null,
                            notes: notes || null,
                            platform,
                            format,
                            google_event_id: googleEventId,
                          });
                          if (newId) setGoogleEventId(newId);
                        }}
                        className="w-full rounded-xl"
                      >
                        {calendarSyncing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sincronizando…</>
                        ) : googleEventId ? (
                          <><CalendarCheck className="h-4 w-4 mr-2" /> Atualizar na Agenda</>
                        ) : (
                          <><CalendarPlus className="h-4 w-4 mr-2" /> Adicionar à Google Agenda</>
                        )}
                      </Button>

                      {googleEventId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={calendarSyncing}
                          onClick={async () => {
                            await removeFromCalendar({
                              id: post.id,
                              title: title || post.title,
                              scheduled_date: scheduledDate,
                              scheduled_time: scheduledTime || null,
                              google_event_id: googleEventId,
                            });
                            setGoogleEventId(null);
                          }}
                          className="w-full rounded-xl text-muted-foreground hover:text-destructive"
                        >
                          <CalendarX className="h-4 w-4 mr-2" /> Remover da Agenda
                        </Button>
                      )}
                    </div>
                  )}
                </section>

                {/* Content Assistant */}
                <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-base font-display font-semibold">Content Assistant</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">IA</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Tom</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setAiTone(t.key)}
                          className={pillClass(aiTone === t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {LENGTH_OPTIONS.map((l) => (
                        <button
                          key={l.key}
                          type="button"
                          onClick={() => setAiLength(l.key)}
                          className={pillClass(aiLength === l.key)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    onClick={handleGenerateCaption}
                    disabled={!title || aiLoading}
                    className="w-full"
                  >
                    {aiLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando legenda…</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> Gerar legenda</>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleSuggestHashtags}
                    disabled={!title || hashLoading}
                    className="w-full"
                  >
                    {hashLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sugerindo…</>
                    ) : (
                      <><Hash className="h-4 w-4 mr-2" /> Sugerir hashtags</>
                    )}
                  </Button>

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
                </section>

                {/* Reference link */}
                <section className="space-y-3">
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
                </section>

                {showResults && (
                  <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
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
            </aside>

            {/* ─── RIGHT: Content tabs ─────────── */}
            <main
              ref={mainRef}
              className={cn(
                "flex-1 overflow-y-auto bg-card",
                mobileTab === "criar" ? "block" : "hidden md:block"
              )}
            >
              <Tabs defaultValue="legenda" className="h-full flex flex-col">
                <TabsList className="bg-transparent border-b border-border rounded-none px-4 sm:px-6 h-12 shrink-0 justify-start gap-0 max-w-full overflow-x-auto flex-nowrap whitespace-nowrap">
                  <TabsTrigger
                    value="legenda"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-body text-sm px-3"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Legenda
                  </TabsTrigger>
                  <TabsTrigger
                    value="roteiro"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-body text-sm px-3"
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1.5" /> Roteiro
                  </TabsTrigger>
                  <TabsTrigger
                    value="tarefas"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-body text-sm px-3"
                  >
                    <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Tarefas
                  </TabsTrigger>
                  <TabsTrigger
                    value="notas"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-body text-sm px-3"
                  >
                    <StickyNote className="h-3.5 w-3.5 mr-1.5" /> Notas
                  </TabsTrigger>
                  <TabsTrigger
                    value="refs"
                    onClick={() => { setRefsOpen(true); handleAiReferences(); }}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-body text-sm px-3"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Refs
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Legenda */}
                <TabsContent value="legenda" className="flex-1 px-4 sm:px-6 py-5 m-0 outline-none space-y-5">
                  <div className="relative">
                    <textarea
                      placeholder="Escreva sua legenda aqui ou gere com IA…"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full min-h-[280px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-body text-base text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                    />
                    <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                      {captionLen}/{captionMax}
                    </span>
                  </div>

                  {caption.length > 10 && (
                    <div className="flex flex-wrap gap-1.5 py-2 border-t border-border/50">
                      {([
                        { key: "rephrase", label: "Reescrever", icon: RefreshCw, instruction: "Reescreva essa legenda mantendo a mesma mensagem mas com palavras completamente diferentes." },
                        { key: "shorten", label: "Encurtar", icon: Minus, instruction: "Encurte essa legenda pra no máximo 2 linhas mantendo a essência e o CTA." },
                        { key: "expand", label: "Expandir", icon: Plus, instruction: "Expanda essa legenda com mais detalhes, storytelling e contexto. Mantenha o tom." },
                        { key: "casual", label: "Mais casual", icon: SmilePlus, instruction: "Reescreva essa legenda num tom mais casual, descontraído, como conversa entre amigos. Use gírias leves." },
                        { key: "formal", label: "Mais formal", icon: Briefcase, instruction: "Reescreva essa legenda num tom mais profissional e polido. Sem gírias, linguagem clara e direta." },
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

                  {/* Mídia final do post — todos os formatos exceto carrossel (que usa as lâminas) */}
                  {format !== "carrossel" && (
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground/80">
                        Mídia
                      </Label>
                      <div className="rounded-2xl border-2 border-dashed border-border/50 overflow-hidden bg-muted/20 hover:border-primary/30 transition-colors">
                        {activeUpload ? (
                          <div className="relative">
                            <div className="aspect-[4/5] relative overflow-hidden max-h-[60vh] sm:max-h-[360px] bg-muted">
                              <MediaPreparingPlaceholder pct={activeUpload.pct} label="Enviando vídeo…" />
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
                                        // Em vez de esconder, manter placeholder visível para o usuário saber que algo quebrou.
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
                              💡 Para melhor qualidade, use arquivos do Google Drive. Uploads diretos ficam disponíveis por 30 dias.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Roteiro */}
                <TabsContent value="roteiro" className="flex-1 px-4 sm:px-6 py-5 m-0 outline-none space-y-5">
                  {(() => {
                    const iconMap: Record<string, React.ElementType> = {
                      Anchor, Layers, Type, Radio, MousePointerClick, MessageSquare, PenLine,
                    };
                    return (
                      <>
                        {formatStructure.fields.map((field) => {
                          const IconComponent = iconMap[field.icon] || PenLine;
                          const value = field.key === "hook" ? hook
                            : field.key === "script" ? script
                            : field.key === "caption" ? caption
                            : field.key === "cta" ? cta : "";
                          const setter = field.key === "hook" ? setHook
                            : field.key === "script" ? setScript
                            : field.key === "caption" ? setCaption
                            : field.key === "cta" ? setCta : (() => {});
                          return (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="font-body text-sm flex items-center gap-2">
                                <IconComponent className="h-4 w-4" /> {field.label}
                              </Label>
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
                                    // Feed e Arquivos enxergarem; cota é incrementada.
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
                                        // backfill no save (mesmo mecanismo de pendingDriveFiles, mas em lista própria)
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
                                    toast.error("Erro ao enviar mídia.");
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
                              if (!refId) return; // mídia de Drive antiga sem mediaRefId → nada a sincronizar
                              try {
                                // Busca file_size pra devolver pra cota
                                const { data: refRow } = await supabase
                                  .from("external_media_refs")
                                  .select("file_size, provider, external_file_id")
                                  .eq("id", refId)
                                  .maybeSingle();
                                await supabase.from("external_media_refs").delete().eq("id", refId);
                                // remove do state de pending se ainda estava lá (post novo)
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
                      </>
                    );
                  })()}
                </TabsContent>

                {/* Tab: Tarefas */}
                <TabsContent value="tarefas" className="flex-1 px-4 sm:px-6 py-5 m-0 outline-none">
                  {!isNew && post ? (
                    <PostTasks postId={post.id} />
                  ) : (
                    <div className="text-center py-10 text-sm text-muted-foreground font-body">
                      Salve o post primeiro para adicionar tarefas.
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Notas */}
                <TabsContent value="notas" className="flex-1 px-4 sm:px-6 py-5 m-0 outline-none">
                  <div className="relative">
                    <textarea
                      placeholder="Anote ideias soltas, links de inspiração, lembretes para esse conteúdo…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full min-h-[400px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 font-body text-base text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                    />
                  </div>
                </TabsContent>

                {/* Tab: Refs */}
                <TabsContent value="refs" className="flex-1 px-4 sm:px-6 py-5 m-0 outline-none">
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
                            {f.tips && <p className="text-xs text-muted-foreground font-body italic">💡 {f.tips}</p>}
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
                </TabsContent>
              </Tabs>
            </main>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {post && (
        <RepurposeSheet
          open={repurposeOpen}
          onOpenChange={setRepurposeOpen}
          originalPost={post as unknown as DbPost}
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
        userName={profile?.name || "Criador"}
        userHandle={profile?.instagram_handle || profile?.tiktok_handle || "usuario"}
        avatarUrl={profile?.avatar_url || null}
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
              Você não precisa esperar: já pode tocar em Publicar que o vídeo vai direto pro app na hora. O envio pra pré-visualização leva de 1 a 3 minutos e roda em segundo plano — pode salvar o post e seguir usando o sistema normalmente.
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
