import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import { Sparkles, MessageSquareText, FileCode2, Anchor, PenLine, MessageSquare, Megaphone, ClipboardList, BarChart3, Eye, Bookmark, Target, Clock, Cloud, ExternalLink, X, Trash2, HardDrive } from "lucide-react";
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
import { filterReferences, generateArchiveSummary } from "@/lib/ai/claude";
import { PostPreviewModal } from "./PostPreviewModal";
import { useProfile } from "@/hooks/useProfile";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface ContentBlocks {
  tema: string;
  roteiro: string;
  midia: string;
  legenda: string;
}

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
  content_blocks: ContentBlocks | null;
  user_id: string;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

interface PostDrawerProps {
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

export function PostDrawer({ open, onOpenChange, post, pillars, userId, onSaved }: PostDrawerProps) {
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
  const [refFormats, setRefFormats] = useState<any[]>([]);
  const [contentBlocks, setContentBlocks] = useState<ContentBlocks>({ tema: "pendente", roteiro: "pendente", midia: "pendente", legenda: "pendente" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const { profile } = useProfile();

  // Drive media refs
  interface DriveRef { id: string; external_file_id?: string | null; file_name: string; file_type: string | null; thumbnail_url: string | null; view_url: string | null; }
  const [driveMedia, setDriveMedia] = useState<DriveRef[]>([]);

  // Pending drive files for new posts (no post_id yet)
  const [pendingDriveFiles, setPendingDriveFiles] = useState<DriveRef[]>([]);

  // Google Drive hook
  const { pickAndSave, picking } = useGoogleDrive();

  // User personal references
  const [userRefHooks, setUserRefHooks] = useState<any[]>([]);
  const [userRefPrompts, setUserRefPrompts] = useState<any[]>([]);

  const fetchDriveMedia = useCallback(async (postId: string) => {
    const { data } = await supabase.from("external_media_refs").select("id, external_file_id, file_name, file_type, thumbnail_url, view_url").eq("post_id", postId).order("created_at");
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
      setScheduledTime((post as any).scheduled_time || "");
      setViews(post.result_views?.toString() || "");
      setSaves(post.result_saves?.toString() || "");
      setComments(post.result_comments?.toString() || "");
      setShowResults(post.status === "publicado");
      setContentBlocks((post as any).content_blocks || { tema: "pendente", roteiro: "pendente", midia: "pendente", legenda: "pendente" });
    } else {
      setTitle(""); setPlatform("instagram"); setFormat("reels");
      setPillarId(""); setStatus("ideia"); setHook(""); setScript("");
      setCaption(""); setCta(""); setScheduledDate(""); setScheduledTime(""); setNotes("");
      setViews(""); setSaves(""); setComments(""); setShowResults(false);
      setContentBlocks({ tema: "pendente", roteiro: "pendente", midia: "pendente", legenda: "pendente" });
      setDriveMedia([]);
      setPendingDriveFiles([]);
    }
    if (post) fetchDriveMedia(post.id);
  }, [post, open, fetchDriveMedia]);

  // Fetch reference formats and user personal refs
  useEffect(() => {
    if (!open) return;
    supabase.from("reference_formats").select("*").eq("is_active", true).order("platform").then(({ data }) => {
      setRefFormats(data || []);
    });
    if (userId) {
      supabase.from("user_hooks").select("*").eq("user_id", userId).order("is_favorite", { ascending: false })
        .then(({ data }) => setUserRefHooks(data || []));
      supabase.from("user_prompts").select("*").eq("user_id", userId).order("is_favorite", { ascending: false })
        .then(({ data }) => setUserRefPrompts(data || []));
    }
  }, [open, userId]);

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
      // New post: save without post_id, then fetch orphaned refs
      try {
        await pickAndSave(undefined);
        const { data } = await supabase
          .from("external_media_refs")
          .select("id, external_file_id, file_name, file_type, thumbnail_url, view_url")
          .eq("user_id", userId)
          .is("post_id", null)
          .order("created_at", { ascending: false })
          .limit(10);
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
    const data: any = {
      title: title.trim(),
      platform,
      format,
      pillar_id: pillarId || null,
      status,
      hook: hook || null,
      script: script || null,
      caption: caption || null,
      cta: cta || null,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      notes: notes || null,
      result_views: views ? parseInt(views) : null,
      result_saves: saves ? parseInt(saves) : null,
      result_comments: comments ? parseInt(comments) : null,
      content_blocks: contentBlocks,
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

    let error;
    let newPostId: string | undefined;
    if (post) {
      ({ error } = await supabase.from("posts").update(data).eq("id", post.id));
      newPostId = post.id;
    } else {
      const result = await supabase.from("posts").insert(data).select("id").single();
      error = result.error;
      newPostId = result.data?.id;
    }

    if (error) {
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

        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Left side — Post editor (60%) */}
          <div className="flex-[3] overflow-y-auto px-6 py-4 border-r border-border">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-body text-sm">Título</Label>
                <Input
                  placeholder="Sobre o que é esse post?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl text-base font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Plataforma</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p} value={p}>
                          <div className="flex items-center gap-2">
                            <PlatformIcon platform={p as any} size="sm" />
                            <span className="font-body capitalize">{p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Formato</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMATS.map(f => (
                        <SelectItem key={f} value={f}>{FORMAT_LABELS[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pillar */}
              <div className="space-y-2">
                <Label className="font-body text-sm">Pilar</Label>
                <div className="flex flex-wrap gap-2">
                  {pillars.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPillarId(pillarId === p.id ? "" : p.id)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                        pillarId === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
                      }`}
                      style={pillarId === p.id ? { backgroundColor: p.color } : {}}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="font-body text-sm">Status</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content blocks - production checklist */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Etapas de produção
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "tema" as const, label: "📋 Tema definido" },
                    { key: "roteiro" as const, label: "✍️ Roteiro escrito" },
                    { key: "midia" as const, label: "🎬 Mídia gravada" },
                    { key: "legenda" as const, label: "💬 Legenda pronta" },
                  ]).map(block => {
                    const done = contentBlocks[block.key] === "feito";
                    return (
                      <button key={block.key}
                        onClick={() => setContentBlocks(prev => ({ ...prev, [block.key]: done ? "pendente" : "feito" }))}
                        className={`px-3 py-2 rounded-xl text-xs font-body border transition-all text-left ${done ? "bg-secondary/20 border-secondary text-secondary-foreground" : "bg-card border-border text-muted-foreground"}`}>
                        {block.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Post Tasks */}
              {!isNew && post && (
                <PostTasks postId={post.id} userId={userId} />
              )}

              <div className="space-y-2">
                <Label className="font-body text-sm">Data e horário agendados</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="rounded-xl pl-9"
                      placeholder="HH:MM"
                    />
                  </div>
                </div>
              </div>

              {/* Google Drive media — visual preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-body text-sm">Mídia</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={picking}
                    onClick={handleDrivePick}
                    className="rounded-xl"
                  >
                    <HardDrive className="h-4 w-4 mr-1" />
                    {picking ? "Abrindo..." : "Google Drive"}
                  </Button>
                </div>
                {mediaList.length > 0 ? (
                  <div className="space-y-3">
                    {/* Primary preview */}
                    {(() => {
                      const primary = mediaList[0];
                      const fileId = primary.external_file_id || primary.id;
                      const isVideo = primary.file_type?.startsWith("video/");
                      const imgSrc = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w800`;
                      const fallbackSrc = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w400`;
                      return (
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border max-h-64">
                          {isVideo ? (
                            <video controls className="w-full h-full object-contain bg-black" src={`https://drive.google.com/uc?export=download&id=${fileId}`} />
                          ) : (
                            <img
                              src={imgSrc}
                              alt={primary.file_name}
                              className="w-full h-full object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).src = fallbackSrc; }}
                            />
                          )}
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-0.5">
                            <Cloud className="h-3 w-3 text-white" />
                            <span className="text-[10px] text-white font-body">Drive</span>
                          </div>
                          {primary.view_url && (
                            <a href={primary.view_url} target="_blank" rel="noopener noreferrer"
                              className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-1 text-[10px] text-white font-body flex items-center gap-1 hover:bg-black/70 transition-colors">
                              <ExternalLink className="h-3 w-3" /> Abrir
                            </a>
                          )}
                        </div>
                      );
                    })()}
                    {/* Additional thumbnails */}
                    {mediaList.length > 1 && (
                      <div className="flex gap-2 flex-wrap">
                        {mediaList.slice(1).map(m => {
                          const fid = m.external_file_id || m.id;
                          return (
                            <div key={m.id} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border bg-muted group">
                              <img
                                src={`https://lh3.googleusercontent.com/d/${encodeURIComponent(fid)}=w200`}
                                alt={m.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              <button
                                onClick={() => handleRemoveMedia(m.id)}
                                className="absolute top-0.5 right-0.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={handleRemoveAllMedia}
                      className="text-xs text-destructive font-body flex items-center gap-1 hover:underline">
                      <Trash2 className="h-3 w-3" /> Remover mídia
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                    <Cloud className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-body">Nenhuma mídia vinculada</p>
                    <p className="text-[10px] text-muted-foreground/60 font-body mt-0.5">Clique em "Google Drive" para selecionar</p>
                  </div>
                )}
              </div>

              {/* Hook */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <Anchor className="h-4 w-4" /> Hook (gancho)
                </Label>
                <Textarea
                  placeholder="A primeira frase que prende a atenção..."
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  className="rounded-xl min-h-[60px]"
                />
              </div>

              {/* Script */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <PenLine className="h-4 w-4" /> Roteiro
                </Label>
                <Textarea
                  placeholder="Escreva seu roteiro aqui..."
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="rounded-xl min-h-[140px]"
                />
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Legenda
                </Label>
                <Textarea
                  placeholder="Legenda do post..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="rounded-xl min-h-[80px]"
                />
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <Label className="font-body text-sm flex items-center gap-2">
                  <Megaphone className="h-4 w-4" /> CTA
                </Label>
                <Input
                  placeholder="Ex: Salva esse post!"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  className="rounded-xl"
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

              {/* Results section */}
              {showResults && (
                <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
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
                      <Input
                        type="number"
                        placeholder="0"
                        value={views}
                        onChange={(e) => setViews(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-xs flex items-center gap-1">
                        <Bookmark className="h-3 w-3" /> Salvos
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={saves}
                        onChange={(e) => setSaves(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-xs flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Comentários
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right side - References (40%) */}
          <div className="flex-[2] overflow-y-auto px-5 py-4 bg-muted/30">
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
                    {userRefHooks.map((h: any, i: number) => (
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
                    {userRefPrompts.map((p: any, i: number) => (
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
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-border bg-card/50 shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1.5" /> Prévia
          </Button>
          <Button variant="hero" className="flex-[2]" onClick={handleSave} disabled={!title.trim()}>
            {isNew ? "Criar post 🎬" : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    />
    </>
  );
}
