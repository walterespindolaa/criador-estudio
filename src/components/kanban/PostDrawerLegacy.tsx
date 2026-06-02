import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import { Sparkles, MessageSquareText, FileCode2, Anchor, PenLine, MessageSquare, Megaphone, ClipboardList, BarChart3, Eye, Bookmark, Target, Clock, Cloud, ExternalLink, X, Trash2, HardDrive, Play, Video, Layers, Type, Radio, MousePointerClick, Link, Download, Plus, Minus, BookOpen, Loader2, Hash, Copy, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFormatStructure } from "@/lib/format-structures";
import { PostTasks } from "./PostTasks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import { FORMAT_LABELS, PLATFORMS, FORMATS, STATUS_OPTIONS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { filterReferences, generateArchiveSummary, callAIContextBuilder } from "@/lib/ai/claude";
import { AIAssistantSection } from "./drawer/AIAssistantSection";
import { HashtagsSection } from "./drawer/HashtagsSection";
import { PostMetadataForm, PostScheduleFields } from "./drawer/PostMetadataForm";
import { ScriptEditor, emptySection, type Section } from "./drawer/ScriptEditor";
import { RepurposeSheet } from "./RepurposeSheet";
import { PostPreviewModal } from "./PostPreviewModal";
import { useProfile } from "@/hooks/useProfile";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { usePosts, type Post as DbPost, type CreatePostInput } from "@/hooks/usePosts";
import { useReferenceLibrary, useUserLibrary, type UserHook, type UserPrompt } from "@/hooks/useLibrary";
import { RoteiroPdfTemplate } from "@/components/pdf/RoteiroPdfTemplate";
import { usePdfExport } from "@/hooks/usePdfExport";
import { sanitizeText } from "@/lib/sanitize";

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
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  archive_summary: string | null;
  content_blocks: Record<string, unknown> | null;
  user_id: string;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

interface PostDrawerLegacyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  pillars: Pillar[];
  userId: string;
  onSaved: () => void;
}

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

export function PostDrawerLegacy({ open, onOpenChange, post, pillars, userId, onSaved }: PostDrawerLegacyProps) {
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
  const [views, setViews] = useState("");
  const [saves, setSaves] = useState("");
  const [comments, setComments] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHookCategories, setAiHookCategories] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>(Array(5).fill(null).map(emptySection));
  const [referenceLink, setReferenceLink] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const { profile } = useProfile();
  const pdfRef = useRef<HTMLDivElement>(null);
  const { exportPdf } = usePdfExport();

  // Drive media refs
  interface DriveRef { id: string; external_file_id?: string | null; file_name: string; file_type: string | null; thumbnail_url: string | null; view_url: string | null; provider?: string | null; }
  const [driveMedia, setDriveMedia] = useState<DriveRef[]>([]);

  // Pending drive files for new posts (no post_id yet)
  const [pendingDriveFiles, setPendingDriveFiles] = useState<DriveRef[]>([]);

  // Google Drive hook
  const { pickAndSave, picking } = useGoogleDrive();

  // Posts mutations
  const { createPost, updatePost, deletePost } = usePosts();

  // Library data
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
    const { data } = await supabase.from("external_media_refs").select("id, external_file_id, file_name, file_type, thumbnail_url, view_url, provider").eq("post_id", postId).order("created_at");
    setDriveMedia((data as DriveRef[]) || []);
  }, []);

  const removeDriveRef = async (refId: string) => {
    await supabase.from("external_media_refs").delete().eq("id", refId);
    setDriveMedia(prev => prev.filter(m => m.id !== refId));
  };

  useEffect(() => {
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
      setScheduledTime((post as unknown as { scheduled_time?: string }).scheduled_time || "");
      setViews(post.result_views?.toString() || "");
      setSaves(post.result_saves?.toString() || "");
      setComments(post.result_comments?.toString() || "");
      setShowResults(post.status === "publicado");
      setReferenceLink((post as unknown as { reference_link?: string }).reference_link || "");
      try {
        const parsed = JSON.parse((post as unknown as { sections?: string }).sections || "[]");
        setSections(parsed.length > 0 ? parsed.map((s: any) => typeof s === 'string' ? { ...emptySection(), text: s } : { ...emptySection(), ...s }) : Array(5).fill(null).map(emptySection));
      } catch { setSections(Array(5).fill(null).map(emptySection)); }
    } else {
      setTitle(""); setPlatform("instagram"); setFormat("reels");
      setPillarId(""); setStatus("ideia"); setHook(""); setScript("");
      setCaption(""); setCta(""); setScheduledDate(""); setScheduledTime(""); setNotes("");
      setViews(""); setSaves(""); setComments(""); setShowResults(false); setReferenceLink("");
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
  }, [post, open, fetchDriveMedia]);

  // Reset sections when format changes (only for new posts)
  useEffect(() => {
    if (isNew) {
      const structure = getFormatStructure(format);
      const count = structure.hasDynamicSections ? (structure.defaultSections || 5) : 0;
      setSections(count > 0 ? Array(count).fill(null).map(emptySection) : []);
    }
  }, [format, isNew]);

  const handleAiReferences = async () => {
    if (aiHookCategories.length > 0 || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const pillar = pillars.find(p => p.id === pillarId)?.name || "";
      const result = await filterReferences({ platform, format, pillar, title }, userId);
      if (result && result.hook_categories) {
        setAiHookCategories(result.hook_categories);
      }
    } catch (e) {
      console.error("AI References failed", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDrivePick = async () => {
    if (picking) return;
    if (isNew) {
      // New post: save without post_id, then fetch only newly created refs
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
          setPendingDriveFiles(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newFiles = (data as DriveRef[]).filter(d => !existingIds.has(d.id));
            return [...newFiles, ...prev];
          });
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Existing post: normal flow
      await pickAndSave(post?.id);
      if (post) fetchDriveMedia(post.id);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const wasPublished = status === "publicado" && post?.status !== "publicado";
    const data: CreatePostInput & { user_id?: string; archive_summary?: string; published_at?: string } = {
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
      result_views: views ? parseInt(views) : null,
      result_saves: saves ? parseInt(saves) : null,
      result_comments: comments ? parseInt(comments) : null,
      sections: JSON.stringify(sections.map(s => ({ ...s, text: sanitizeText(s.text), captacao: sanitizeText(s.captacao) }))),
      reference_link: referenceLink || null,
      user_id: userId,
    };

    if (wasPublished) {
      data.published_at = new Date().toISOString();
      try {
        const pillar = pillars.find(p => p.id === pillarId)?.name || "";
        const summary = await generateArchiveSummary({ title, platform, format, pillar }, userId);
        if (summary) {
          data.archive_summary = summary;
        }
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
        const created = await createPost.mutateAsync(data);
        newPostId = created.id;
      }
    } catch {
      toast.error("Erro ao salvar post.");
      return;
    }

    // Link pending drive files to the newly created post
    if (isNew && newPostId && pendingDriveFiles.length > 0) {
      const pendingIds = pendingDriveFiles.map(f => f.id);
      await supabase
        .from("external_media_refs")
        .update({ post_id: newPostId })
        .in("id", pendingIds);
      setPendingDriveFiles([]);
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
    if (newStatus === "publicado") {
      setShowResults(true);
    }
  };

  // Unified media list for rendering
  const mediaList: DriveRef[] = isNew ? pendingDriveFiles : driveMedia;

  const handleRemoveMedia = (refId: string) => {
    if (isNew) {
      // Delete from DB (orphaned ref) and remove from state
      supabase.from("external_media_refs").delete().eq("id", refId);
      setPendingDriveFiles(prev => prev.filter(f => f.id !== refId));
    } else {
      removeDriveRef(refId);
    }
  };

  const handleRemoveAllMedia = () => {
    if (isNew) {
      pendingDriveFiles.forEach(f => supabase.from("external_media_refs").delete().eq("id", f.id));
      setPendingDriveFiles([]);
    } else {
      driveMedia.forEach(m => removeDriveRef(m.id));
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col bg-background rounded-2xl">
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="font-display text-lg">
            {isNew ? "Novo Post" : "Editar Post"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Editor (grows to fill space) */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
              <div className="space-y-2">
                <Label className="font-body text-sm">Título</Label>
                <Input
                  placeholder="Sobre o que é esse post?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl text-base font-medium"
                />
              </div>

              <PostMetadataForm
                platform={platform}
                format={format}
                pillarId={pillarId}
                pillars={pillars}
                status={status}
                scheduledDate={scheduledDate}
                scheduledTime={scheduledTime}
                onPlatformChange={setPlatform}
                onFormatChange={setFormat}
                onPillarChange={setPillarId}
                onStatusChange={handleStatusChange}
                onScheduledDateChange={setScheduledDate}
                onScheduledTimeChange={setScheduledTime}
              />

              {/* Campos adaptativos por formato */}
              {(() => {
                const structure = getFormatStructure(format);
                const iconMap: Record<string, React.ElementType> = {
                  Anchor, Layers, Type, Radio, MousePointerClick, MessageSquare, PenLine,
                };

                return (
                  <>
                    {structure.fields.map(field => {
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
                        <div key={field.key} className="space-y-2">
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

                    {structure.hasDynamicSections && (
                      <ScriptEditor
                        sections={sections}
                        onChange={setSections}
                        sectionLabel={structure.sectionLabel ?? "Seção"}
                        picking={picking}
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
                            setSections(prev => prev.map((s, j) => j === index ? {
                              ...s,
                              driveFileId: data[0].external_file_id,
                              driveFileName: data[0].file_name,
                              driveThumbnail: data[0].thumbnail_url,
                            } : s));
                          }
                        }}
                      />
                    )}
                  </>
                );
              })()}

              {/* Tarefas do post */}
              {!isNew && post ? (
                <PostTasks postId={post.id} />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                    📋 Tarefas do post
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    Salve o post primeiro para adicionar tarefas.
                  </p>
                </div>
              )}

              <PostScheduleFields
                scheduledDate={scheduledDate}
                scheduledTime={scheduledTime}
                onScheduledDateChange={setScheduledDate}
                onScheduledTimeChange={setScheduledTime}
              />

              {/* Google Drive media — only for formats without dynamic sections */}
              {!getFormatStructure(format).hasDynamicSections && (
              <div className="space-y-2">
                <Label className="font-body text-sm">Mídia</Label>
                <div className="rounded-2xl border-2 border-dashed border-border/50 overflow-hidden bg-card/30 hover:border-primary/30 transition-colors">
                  {mediaList.length > 0 ? (
                    <div className="relative">
                      <div className="aspect-[4/5] relative overflow-hidden">
                        {(() => {
                          const primary = mediaList[0];
                          const fileId = primary.external_file_id || primary.id;
                          const isVideo = primary.file_type?.startsWith("video/");
                          const isBunny = isVideo && primary.provider === "bunny";
                          const imgSrc = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w600`;
                          return isBunny ? (
                            <iframe
                              src={primary.view_url ?? ""}
                              loading="lazy"
                              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          ) : isVideo ? (
                            <a
                              href={`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full h-full relative bg-black group"
                            >
                              <img
                                src={imgSrc}
                                alt={primary.file_name}
                                loading="lazy"
                                className="w-full h-full object-cover"
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
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`; }}
                            />
                          );
                        })()}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="flex items-center gap-1 bg-black/40 backdrop-blur rounded-full px-2 py-0.5">
                            <Cloud className="h-2.5 w-2.5 text-white" />
                            <span className="text-[9px] text-white font-body truncate max-w-[120px]">{mediaList[0].file_name}</span>
                          </div>
                          <button onClick={() => handleRemoveAllMedia()} className="bg-black/40 backdrop-blur rounded-full p-1">
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
                    <button
                      onClick={handleDrivePick}
                      disabled={picking}
                      className="w-full py-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Cloud className="h-6 w-6" />
                      <span className="text-xs font-body">{picking ? "Abrindo Drive..." : "Adicionar mídia do Google Drive"}</span>
                    </button>
                  )}
                </div>
              </div>
              )}

              {/* Reference link */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <Link className="h-4 w-4" /> Link de referência
                </Label>
                <Input
                  placeholder="Cole um link de vídeo de referência para edição..."
                  value={referenceLink}
                  onChange={(e) => setReferenceLink(e.target.value)}
                  className="rounded-xl font-body text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Notas
                </Label>
                <Textarea
                  placeholder="Anotações extras..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <AIAssistantSection
                title={title}
                format={format}
                platform={platform}
                pillarId={pillarId}
                pillars={pillars}
                caption={caption}
                sectionsText={sections.map(s => s.text).filter(Boolean).join(" | ")}
                userId={userId}
                profile={profile}
                onCaptionGenerated={(text) => setCaption(prev => prev ? `${prev}\n\n${text}` : text)}
              />

              <HashtagsSection
                title={title}
                format={format}
                platform={platform}
                pillarId={pillarId}
                pillars={pillars}
                caption={caption}
                userId={userId}
                profile={profile}
              />

              {/* Results section */}
              {showResults && (
                <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                  <p className="font-body font-semibold text-foreground text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Resultados do post
                  </p>
                  {status === "publicado" && !post?.result_views && (
                    <p className="text-sm text-muted-foreground font-body flex items-center gap-2">
                      <Target className="h-3.5 w-3.5" /> Ótimo! Quer registrar o resultado?
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="font-body text-xs flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Views
                      </Label>
                      <Input type="number" placeholder="0" value={views} onChange={(e) => setViews(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-xs flex items-center gap-1">
                        <Bookmark className="h-3 w-3" /> Salvos
                      </Label>
                      <Input type="number" placeholder="0" value={saves} onChange={(e) => setSaves(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-xs flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Comentários
                      </Label>
                      <Input type="number" placeholder="0" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Collapsible references panel */}
          <div className={`transition-all duration-300 overflow-hidden border-l border-border ${refsOpen ? "w-72" : "w-0"}`}>
            {refsOpen && (
              <div className="w-72 h-full overflow-y-auto px-4 py-4 bg-muted/20">
                <p className="text-sm font-body font-semibold text-foreground mb-3">Referências</p>
                <Tabs defaultValue="hooks" onValueChange={(val) => { if (val === "hooks") handleAiReferences(); }}>
                  <TabsList className="bg-card border border-border rounded-xl mb-4 w-full">
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
                    {isAiLoading && (
                      <div className="bg-card rounded-xl p-3 border border-border animate-pulse flex items-center justify-center">
                        <Sparkles className="h-4 w-4 mr-2 animate-spin text-primary" />
                        <span className="text-xs font-body text-muted-foreground">Filtrando referências...</span>
                      </div>
                    )}
                    {aiHookCategories.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Sugestões da IA</p>
                        <div className="flex flex-wrap gap-2">
                          {aiHookCategories.map(cat => (
                            <span key={cat} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/20">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {FALLBACK_HOOKS.map((h, i) => (
                      <div key={i} className={`bg-card rounded-xl p-3 border transition-all ${aiHookCategories.includes(h.category) ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-body mb-2 ${aiHookCategories.includes(h.category) ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                          {h.category}
                        </span>
                        <p className="text-sm font-body text-foreground mb-2">"{h.text}"</p>
                        <CopyButton text={h.text} />
                      </div>
                    ))}
                    {userRefHooks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Meus Hooks</p>
                        {userRefHooks.map((h: UserHook, i: number) => (
                          <div key={`uh-${i}`} className="bg-card rounded-xl p-3 border border-border mb-2">
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
                      const filtered = refFormats.filter(f => f.platform === platform || f.platform === "todos" || !platform);
                      if (filtered.length === 0) return (
                        <div className="bg-card rounded-xl p-4 border border-border text-center">
                          <p className="text-sm text-muted-foreground font-body">Nenhum formato cadastrado ainda.</p>
                        </div>
                      );
                      return filtered.map((f: any) => (
                        <div key={f.id} className="bg-card rounded-xl p-3 border border-border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={f.platform as any} size="sm" />
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
                      <div key={i} className="bg-card rounded-xl p-3 border border-border">
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
                        {userRefPrompts.map((p: UserPrompt, i: number) => (
                          <div key={i} className="bg-card rounded-xl p-3 border border-border mb-2">
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
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-card/50 shrink-0 flex gap-3">
          {!isNew && post && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Excluir "${title || post.title}"?`)) {
                  deletePost.mutate(post.id, {
                    onSuccess: () => {
                      toast.success("Post excluído");
                      onOpenChange(false);
                    },
                    onError: () => toast.error("Erro ao excluir post."),
                  });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportPdf(pdfRef, `roteiro-${title.slice(0, 20).replace(/\s+/g, "-").toLowerCase() || "post"}`)}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <button
            onClick={() => setRefsOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-body transition-colors ${
              refsOpen ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Refs</span>
          </button>
          <Button variant="outline" className="flex-1" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1.5" /> Prévia
          </Button>
          {!isNew && post && (status === "publicado" || status === "agendado") && (
            <Button variant="outline" className="flex-1" onClick={() => setRepurposeOpen(true)}>
              <Repeat2 className="h-4 w-4 mr-1.5" /> Reaproveitar
            </Button>
          )}
          <Button variant="hero" className="flex-[2]" onClick={handleSave} disabled={!title.trim()}>
            {isNew ? "Criar post 🎬" : "Salvar alterações"}
          </Button>
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
      mediaUrl={mediaList.length > 0
        ? (mediaList[0].file_type?.includes("video")
            ? `https://drive.google.com/uc?id=${encodeURIComponent(mediaList[0].external_file_id || mediaList[0].id)}`
            : `https://lh3.googleusercontent.com/d/${encodeURIComponent(mediaList[0].external_file_id || mediaList[0].id)}=w800`)
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
    </>
  );
}
