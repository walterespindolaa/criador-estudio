import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DraggableProvided,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Copy,
  ExternalLink,
  BarChart3,
  Upload,
  Type as TypeIcon,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useBioLinks, type BioLink } from "@/hooks/useBioLinks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type BgType = "color" | "gradient" | "image";
type ButtonStyle = "rounded" | "pill" | "square" | "outline";

type SocialLinks = {
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
};

export type BioSettings = {
  bgType: BgType;
  bgColor: string;
  bgGradient: string;
  bgImage: string | null;
  buttonStyle: ButtonStyle;
  buttonColor: string;
  buttonTextColor: string;
  socialLinks: SocialLinks;
};

const DEFAULT_SETTINGS: BioSettings = {
  bgType: "color",
  bgColor: "#FDF2F8",
  bgGradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  bgImage: null,
  buttonStyle: "rounded",
  buttonColor: "#FFFFFF",
  buttonTextColor: "#1F2937",
  socialLinks: { instagram: "", tiktok: "", youtube: "", twitter: "" },
};

const BG_COLOR_PRESETS = [
  "#ffffff", "#0A0D12", "#1a1a2e", "#f0e6d3",
  "#d4e4bc", "#fce4ec", "#e8eaf6", "#fff3e0",
];

const GRADIENT_PRESETS: { id: string; css: string }[] = [
  { id: "purple-pink", css: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)" },
  { id: "blue-cyan", css: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)" },
  { id: "amber-red", css: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" },
  { id: "emerald-teal", css: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)" },
  { id: "slate-dark", css: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" },
  { id: "rose-orange", css: "linear-gradient(135deg, #fb7185 0%, #fb923c 100%)" },
];

const BUTTON_STYLES: { key: ButtonStyle; label: string; radius: string }[] = [
  { key: "rounded", label: "Arredondado", radius: "rounded-xl" },
  { key: "pill", label: "Pílula", radius: "rounded-full" },
  { key: "square", label: "Quadrado", radius: "rounded-md" },
  { key: "outline", label: "Contorno", radius: "rounded-xl" },
];

const SOCIAL_FIELDS: {
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  icon: typeof Instagram;
  urlBuilder: (handle: string) => string;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "seuhandle",
    icon: Instagram,
    urlBuilder: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "seuhandle",
    icon: Music2,
    urlBuilder: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "canal-ou-@handle",
    icon: Youtube,
    urlBuilder: (h) => {
      const v = h.trim();
      if (/^https?:\/\//.test(v)) return v;
      return `https://youtube.com/${v.startsWith("@") ? v : `@${v}`}`;
    },
  },
  {
    key: "twitter",
    label: "Twitter / X",
    placeholder: "seuhandle",
    icon: Twitter,
    urlBuilder: (h) => `https://twitter.com/${h.replace(/^@/, "")}`,
  },
];

function radiusFor(style: ButtonStyle): string {
  return BUTTON_STYLES.find((s) => s.key === style)?.radius ?? "rounded-xl";
}

function parseSettings(raw: unknown): BioSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const t = raw as Partial<BioSettings>;
  const bgType: BgType =
    t.bgType === "gradient" || t.bgType === "image" ? t.bgType : "color";
  const buttonStyle: ButtonStyle =
    t.buttonStyle === "pill" ||
    t.buttonStyle === "square" ||
    t.buttonStyle === "outline"
      ? t.buttonStyle
      : "rounded";
  const socialRaw = (t.socialLinks ?? {}) as Partial<SocialLinks>;
  return {
    bgType,
    bgColor: typeof t.bgColor === "string" ? t.bgColor : DEFAULT_SETTINGS.bgColor,
    bgGradient: typeof t.bgGradient === "string" ? t.bgGradient : DEFAULT_SETTINGS.bgGradient,
    bgImage: typeof t.bgImage === "string" && t.bgImage ? t.bgImage : null,
    buttonStyle,
    buttonColor: typeof t.buttonColor === "string" ? t.buttonColor : DEFAULT_SETTINGS.buttonColor,
    buttonTextColor:
      typeof t.buttonTextColor === "string" ? t.buttonTextColor : DEFAULT_SETTINGS.buttonTextColor,
    socialLinks: {
      instagram: typeof socialRaw.instagram === "string" ? socialRaw.instagram : "",
      tiktok: typeof socialRaw.tiktok === "string" ? socialRaw.tiktok : "",
      youtube: typeof socialRaw.youtube === "string" ? socialRaw.youtube : "",
      twitter: typeof socialRaw.twitter === "string" ? socialRaw.twitter : "",
    },
  };
}

export function backgroundStyle(settings: BioSettings): React.CSSProperties {
  if (settings.bgType === "gradient") {
    return { backgroundImage: settings.bgGradient };
  }
  if (settings.bgType === "image" && settings.bgImage) {
    return {
      backgroundImage: `url(${settings.bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { backgroundColor: settings.bgColor };
}

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getInitial(name?: string | null): string {
  return name?.trim().charAt(0).toUpperCase() || "C";
}

const LinkInBio = () => {
  const { user } = useAuth();
  const { profile, updateProfile, isLoading: profileLoading } = useProfile();
  const { links, isLoading, createLink, updateLink, deleteLink, reorderLinks } = useBioLinks();

  const [slug, setSlug] = useState("");
  const [settings, setSettings] = useState<BioSettings>(DEFAULT_SETTINGS);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setSlug(profile.bio_slug ?? "");
    setSettings(parseSettings(profile.bio_settings));
    setAppearanceDirty(false);
  }, [profile?.id, profile?.bio_slug, profile?.bio_settings]);

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [links]
  );

  // Click bar uses only real links, not headers (which have no clicks).
  const maxClicks = useMemo(
    () =>
      sortedLinks.reduce(
        (max, l) => (l.link_type === "header" ? max : Math.max(max, l.clicks ?? 0)),
        0
      ),
    [sortedLinks]
  );

  const activeLinks = useMemo(
    () => sortedLinks.filter((l) => l.is_active),
    [sortedLinks]
  );

  const publicPath = slug ? `/bio/${slug}` : null;
  const publicUrl = publicPath
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}`
    : "";

  const handleAddLink = () =>
    createLink.mutate(
      {
        title: "Novo link",
        url: "https://",
        icon: null,
        is_active: true,
        link_type: "link",
      },
      { onError: () => toast.error("Não foi possível adicionar o link.") }
    );

  const handleAddHeader = () =>
    createLink.mutate(
      {
        title: "Título da seção",
        url: "",
        icon: null,
        is_active: true,
        link_type: "header",
      },
      { onError: () => toast.error("Não foi possível adicionar o título.") }
    );

  const handleUpdate = (id: string, patch: Partial<BioLink>) =>
    updateLink.mutate({ id, updates: patch });

  const handleDelete = (id: string) => {
    if (!confirm("Remover este item?")) return;
    deleteLink.mutate(id, {
      onSuccess: () => toast.success("Item removido."),
      onError: () => toast.error("Erro ao remover."),
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const next = [...sortedLinks];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    reorderLinks.mutate(next.map((l) => l.id));
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    try {
      setUploadingBg(true);
      const path = `${user.id}/bg-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("bio-media")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("bio-media").getPublicUrl(path);
      setSettings((s) => ({ ...s, bgType: "image", bgImage: urlData.publicUrl }));
      setAppearanceDirty(true);
    } catch {
      toast.error("Erro ao enviar imagem de fundo.");
    } finally {
      setUploadingBg(false);
    }
  };

  const handleSaveAppearance = async () => {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) {
      toast.error("Escolha um nome para o seu link público.");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        bio_slug: cleanSlug,
        bio_settings: settings as unknown as never,
      });
      setSlug(cleanSlug);
      setAppearanceDirty(false);
      toast.success("Aparência salva!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      if (msg.toLowerCase().includes("duplicate")) {
        toast.error("Esse nome de link já está em uso.");
      } else {
        toast.error(msg);
      }
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  };

  const patchSettings = (patch: Partial<BioSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setAppearanceDirty(true);
  };

  const patchSocial = (key: keyof SocialLinks, value: string) => {
    setSettings((s) => ({ ...s, socialLinks: { ...s.socialLinks, [key]: value } }));
    setAppearanceDirty(true);
  };

  if (profileLoading || isLoading) return <PageSkeleton />;

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-sm shrink-0">
              <LinkIcon className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Link in Bio</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">
                Sua mini landing page com todos os links que importam.
              </p>
            </div>
          </div>
          {publicPath && (
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Ver pública
              </Button>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* ── Editor ──────────────────────────────── */}
          <div className="space-y-5">
            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <Label className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground/80">
                Seu link público
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-body text-muted-foreground whitespace-nowrap">
                  criadores.flow/bio/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setAppearanceDirty(true);
                  }}
                  placeholder="seu-nome"
                  className="h-9 rounded-xl"
                  maxLength={40}
                />
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!publicPath}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-foreground">Seus links</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleAddHeader}>
                    <TypeIcon className="h-4 w-4 mr-1" /> Título
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleAddLink}>
                    <Plus className="h-4 w-4 mr-1" /> Link
                  </Button>
                </div>
              </div>

              {sortedLinks.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground font-body">
                  Nenhum item ainda. Adicione um <span className="font-semibold">link</span> ou um{" "}
                  <span className="font-semibold">título</span> de seção para começar.
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="bio-links">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {sortedLinks.map((link, index) => (
                          <Draggable key={link.id} draggableId={link.id} index={index}>
                            {(prov, snapshot) => (
                              <LinkCard
                                link={link}
                                maxClicks={maxClicks}
                                provided={prov}
                                isDragging={snapshot.isDragging}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                userId={user?.id}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Card>

            {/* ── Appearance ─────────────────────────── */}
            <Card className="p-4 md:p-5 rounded-2xl border-border space-y-6">
              <h2 className="font-display font-semibold text-foreground">Aparência</h2>

              {/* Background */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Fundo</Label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "color", label: "Cor sólida" },
                    { id: "gradient", label: "Gradiente" },
                    { id: "image", label: "Imagem" },
                  ] as { id: BgType; label: string }[]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => patchSettings({ bgType: t.id })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-body border transition-colors",
                        settings.bgType === t.id
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {settings.bgType === "color" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {BG_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patchSettings({ bgColor: c })}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          settings.bgColor === c
                            ? "border-primary ring-2 ring-primary/20 scale-110"
                            : "border-border"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) => patchSettings({ bgColor: e.target.value })}
                      className="w-8 h-8 rounded-full border border-border cursor-pointer"
                      aria-label="Escolher cor de fundo"
                    />
                  </div>
                )}

                {settings.bgType === "gradient" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {GRADIENT_PRESETS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => patchSettings({ bgGradient: g.css })}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 transition-all",
                          settings.bgGradient === g.css
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent"
                        )}
                        style={{ backgroundImage: g.css }}
                        aria-label={g.id}
                      />
                    ))}
                  </div>
                )}

                {settings.bgType === "image" && (
                  <div className="space-y-2">
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBgImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => bgInputRef.current?.click()}
                      disabled={uploadingBg}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-primary text-sm text-muted-foreground transition-colors disabled:opacity-50"
                    >
                      {uploadingBg ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadingBg ? "Enviando..." : "Escolher imagem de fundo"}
                    </button>
                    {settings.bgImage && (
                      <img
                        src={settings.bgImage}
                        alt="Fundo"
                        className="w-full h-20 object-cover rounded-xl border border-border"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Button style */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-display font-semibold">Estilo dos links</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUTTON_STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => patchSettings({ buttonStyle: s.key })}
                      className={cn(
                        "px-3 py-2 text-xs font-body border transition-all",
                        s.radius,
                        s.key === "outline" && "border-2 bg-transparent",
                        settings.buttonStyle === s.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/30"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Cor do botão</Label>
                    <input
                      type="color"
                      value={settings.buttonColor}
                      onChange={(e) => patchSettings({ buttonColor: e.target.value })}
                      className="block w-12 h-9 rounded cursor-pointer border border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Cor do texto</Label>
                    <input
                      type="color"
                      value={settings.buttonTextColor}
                      onChange={(e) => patchSettings({ buttonTextColor: e.target.value })}
                      className="block w-12 h-9 rounded cursor-pointer border border-border"
                    />
                  </div>
                </div>
              </div>

              {/* Social links */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-display font-semibold">Redes sociais</Label>
                <p className="text-xs text-muted-foreground">Os ícones aparecem no topo da sua página.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SOCIAL_FIELDS.map((f) => (
                    <div key={f.key} className="relative">
                      <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={settings.socialLinks[f.key]}
                        onChange={(e) => patchSocial(f.key, e.target.value)}
                        placeholder={`${f.label}: ${f.placeholder}`}
                        className="h-9 rounded-xl pl-9 text-sm"
                        maxLength={120}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSaveAppearance}
                disabled={!appearanceDirty || updateProfile.isPending}
                className="w-full"
                variant="hero"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </Card>
          </div>

          {/* ── Preview ─────────────────────────────── */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-5 rounded-2xl border-border">
              <p className="text-xs text-center font-display font-semibold uppercase tracking-wider text-muted-foreground/80 mb-4">
                Pré-visualização
              </p>
              <BioPreview profile={profile} links={activeLinks} settings={settings} />
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// LinkCard
// ────────────────────────────────────────────────────────────

type LinkCardProps = {
  link: BioLink;
  maxClicks: number;
  provided: DraggableProvided;
  isDragging: boolean;
  onUpdate: (id: string, updates: Partial<BioLink>) => void;
  onDelete: (id: string) => void;
  userId?: string;
};

// Local state for text inputs so each keystroke doesn't trigger a
// network call or a re-render of the parent. Server sync happens on blur.
function LinkCard({
  link,
  maxClicks,
  provided,
  isDragging,
  onUpdate,
  onDelete,
  userId,
}: LinkCardProps) {
  const isHeader = link.link_type === "header";

  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [icon, setIcon] = useState(link.icon ?? "");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(link.title);
    setUrl(link.url);
    setIcon(link.icon ?? "");
  }, [link.id]);

  const clicks = link.clicks ?? 0;
  const widthPct = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;

  const commitTitle = () => {
    if (title !== link.title) onUpdate(link.id, { title });
  };
  const commitUrl = () => {
    if (url !== link.url) onUpdate(link.id, { url });
  };
  const commitIcon = () => {
    const next = icon || null;
    if (next !== (link.icon ?? null)) onUpdate(link.id, { icon: next });
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    try {
      setUploadingThumb(true);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/thumb-${link.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("bio-media")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("bio-media").getPublicUrl(path);
      onUpdate(link.id, { thumbnail_url: `${urlData.publicUrl}?t=${Date.now()}` });
    } catch {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingThumb(false);
    }
  };

  if (isHeader) {
    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        className={cn(
          "group relative bg-muted/30 rounded-xl border border-dashed border-border p-3 transition-shadow",
          isDragging && "shadow-lg ring-2 ring-primary/30"
        )}
      >
        <div className="flex items-center gap-2">
          <button
            {...provided.dragHandleProps}
            className="text-muted-foreground hover:text-foreground touch-none"
            aria-label="Arrastar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-foreground/10 text-foreground/70 shrink-0">
            Título
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            placeholder="Título da seção"
            className="h-9 rounded-lg flex-1 min-w-0 font-display font-semibold"
            maxLength={80}
          />
          <Switch
            checked={link.is_active ?? true}
            onCheckedChange={(v) => onUpdate(link.id, { is_active: v })}
            aria-label="Ativo"
          />
          <button
            type="button"
            onClick={() => onDelete(link.id)}
            className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={cn(
        "group relative bg-background rounded-xl border border-border p-3 transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          {...provided.dragHandleProps}
          className="text-muted-foreground hover:text-foreground touch-none"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Thumbnail picker */}
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          onChange={handleThumbUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => thumbInputRef.current?.click()}
          className="relative w-10 h-10 rounded-lg border border-dashed border-border bg-muted/40 hover:border-primary transition-colors flex items-center justify-center overflow-hidden shrink-0"
          aria-label="Imagem do link"
        >
          {uploadingThumb ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : link.thumbnail_url ? (
            <img src={link.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <Input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          onBlur={commitIcon}
          placeholder="🔗"
          className="h-9 w-12 text-center rounded-lg"
          maxLength={4}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          placeholder="Título"
          className="h-9 rounded-lg flex-1 min-w-0 font-medium"
          maxLength={80}
        />
        <Switch
          checked={link.is_active ?? true}
          onCheckedChange={(v) => onUpdate(link.id, { is_active: v })}
          aria-label="Ativo"
        />
        <button
          type="button"
          onClick={() => onDelete(link.id)}
          className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-6">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={commitUrl}
          placeholder="https://"
          className="h-8 rounded-lg flex-1 text-xs font-mono"
          maxLength={500}
        />
        <div className="hidden sm:flex items-center gap-1.5 min-w-[90px]">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <div className="relative flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 to-purple-500"
              style={{ width: `${widthPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-6 text-right">
            {clicks}
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BioPreview
// ────────────────────────────────────────────────────────────

type PreviewProps = {
  profile: ReturnType<typeof useProfile>["profile"];
  links: BioLink[];
  settings: BioSettings;
};

const BioPreview = memo(function BioPreview({ profile, links, settings }: PreviewProps) {
  const radius = radiusFor(settings.buttonStyle);
  const isOutline = settings.buttonStyle === "outline";
  const hasSocials = SOCIAL_FIELDS.some((f) => settings.socialLinks[f.key].trim());

  return (
    <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
      <div
        className="w-full h-[560px] rounded-[32px] overflow-y-auto px-5 py-7 flex flex-col items-center"
        style={backgroundStyle(settings)}
      >
        {hasSocials && (
          <div className="flex items-center gap-2.5 mb-4">
            {SOCIAL_FIELDS.map((f) =>
              settings.socialLinks[f.key].trim() ? (
                <div
                  key={f.key}
                  className="w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm"
                  aria-label={f.label}
                >
                  <f.icon className="h-3.5 w-3.5 text-gray-900" />
                </div>
              ) : null
            )}
          </div>
        )}

        {profile && (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[2px] mb-3">
              <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-display font-bold text-2xl">
                    {getInitial(profile.name)}
                  </span>
                )}
              </div>
            </div>
            <h3 className="font-display font-bold text-base text-gray-900 text-center drop-shadow-sm">
              {profile.name || "Seu nome"}
            </h3>
            {profile.bio && (
              <p className="text-xs text-gray-800 text-center mt-1 line-clamp-3 font-body drop-shadow-sm">
                {profile.bio}
              </p>
            )}
          </>
        )}

        <div className="w-full mt-5 space-y-2.5">
          {links.length === 0 ? (
            <p className="text-xs text-center text-gray-500 font-body py-6">
              Adicione links para ver a prévia.
            </p>
          ) : (
            links.map((link) =>
              link.link_type === "header" ? (
                <p
                  key={link.id}
                  className="text-center font-display font-bold text-sm text-gray-900 drop-shadow-sm pt-3 pb-1"
                >
                  {link.title || "Título"}
                </p>
              ) : (
                <div
                  key={link.id}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-2 font-body font-semibold text-sm shadow-sm",
                    radius,
                    isOutline && "border-2 bg-transparent"
                  )}
                  style={{
                    backgroundColor: isOutline ? "transparent" : settings.buttonColor,
                    color: settings.buttonTextColor,
                    borderColor: isOutline ? settings.buttonTextColor : undefined,
                  }}
                >
                  {link.thumbnail_url ? (
                    <img
                      src={link.thumbnail_url}
                      alt=""
                      className="w-8 h-8 rounded-md object-cover shrink-0"
                    />
                  ) : link.icon ? (
                    <span className="text-base">{link.icon}</span>
                  ) : null}
                  <span className="flex-1 text-center truncate">
                    {link.title || "Sem título"}
                  </span>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
});

export default LinkInBio;
