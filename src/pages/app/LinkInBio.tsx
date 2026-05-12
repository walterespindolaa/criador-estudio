import { memo, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useProfile } from "@/hooks/useProfile";
import { useBioLinks, type BioLink } from "@/hooks/useBioLinks";
import { cn } from "@/lib/utils";

type ButtonStyle = "rounded" | "pill" | "square";

type BioTheme = {
  bgColor: string;
  buttonColor: string;
  buttonStyle: ButtonStyle;
  useProfile: boolean;
};

const DEFAULT_THEME: BioTheme = {
  bgColor: "#FDF2F8",
  buttonColor: "#FFFFFF",
  buttonStyle: "rounded",
  useProfile: true,
};

const BG_PRESETS = [
  "#FDF2F8", "#EEF2FF", "#ECFDF5", "#FEF3C7",
  "#FCE7F3", "#E0E7FF", "#FFE4E6", "#0F172A",
];

const BUTTON_PRESETS = [
  "#FFFFFF", "#F9FAFB", "#FEE2E2", "#FEF3C7",
  "#DBEAFE", "#E0E7FF", "#F3E8FF", "#1F2937",
];

const STYLE_RADIUS: Record<ButtonStyle, string> = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
  square: "rounded-md",
};

function parseTheme(raw: unknown): BioTheme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const t = raw as Partial<BioTheme>;
  const style: ButtonStyle =
    t.buttonStyle === "pill" || t.buttonStyle === "square" ? t.buttonStyle : "rounded";
  return {
    bgColor: typeof t.bgColor === "string" ? t.bgColor : DEFAULT_THEME.bgColor,
    buttonColor: typeof t.buttonColor === "string" ? t.buttonColor : DEFAULT_THEME.buttonColor,
    buttonStyle: style,
    useProfile: typeof t.useProfile === "boolean" ? t.useProfile : true,
  };
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
  const { profile, updateProfile, isLoading: profileLoading } = useProfile();
  const { links, isLoading, createLink, updateLink, deleteLink, reorderLinks } = useBioLinks();

  const [slug, setSlug] = useState("");
  const [theme, setTheme] = useState<BioTheme>(DEFAULT_THEME);
  const [appearanceDirty, setAppearanceDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSlug(profile.bio_slug ?? "");
    setTheme(parseTheme(profile.bio_theme));
    setAppearanceDirty(false);
  }, [profile?.id, profile?.bio_slug, profile?.bio_theme]);

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [links]
  );

  const maxClicks = useMemo(
    () => sortedLinks.reduce((max, l) => Math.max(max, l.clicks ?? 0), 0),
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
      { title: "Novo link", url: "https://", icon: null, is_active: true },
      {
        onError: () => toast.error("Não foi possível adicionar o link."),
      }
    );

  const handleUpdate = (id: string, patch: Partial<BioLink>) =>
    updateLink.mutate({ id, updates: patch });

  const handleDelete = (id: string) => {
    if (!confirm("Remover este link?")) return;
    deleteLink.mutate(id, {
      onSuccess: () => toast.success("Link removido."),
      onError: () => toast.error("Erro ao remover link."),
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

  const handleSaveAppearance = async () => {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) {
      toast.error("Escolha um nome para o seu link público.");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        bio_slug: cleanSlug,
        bio_theme: theme as unknown as never,
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

  const updateTheme = <K extends keyof BioTheme>(key: K, value: BioTheme[K]) => {
    setTheme((t) => ({ ...t, [key]: value }));
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
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex"
            >
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-foreground">Seus links</h2>
                <Button variant="secondary" size="sm" onClick={handleAddLink}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar link
                </Button>
              </div>

              {sortedLinks.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground font-body">
                  Nenhum link ainda. Clique em <span className="font-semibold">Adicionar link</span> para começar.
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="bio-links">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2"
                      >
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

            <Card className="p-4 md:p-5 rounded-2xl border-border space-y-4">
              <h2 className="font-display font-semibold text-foreground">Aparência</h2>

              <div>
                <Label className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Cor de fundo
                </Label>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateTheme("bgColor", c)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        theme.bgColor === c ? "border-primary scale-110" : "border-border"
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={theme.bgColor}
                    onChange={(e) => updateTheme("bgColor", e.target.value)}
                    className="w-8 h-8 rounded-full border border-border cursor-pointer"
                    aria-label="Escolher cor de fundo"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Cor dos botões
                </Label>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {BUTTON_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateTheme("buttonColor", c)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        theme.buttonColor === c ? "border-primary scale-110" : "border-border"
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={theme.buttonColor}
                    onChange={(e) => updateTheme("buttonColor", e.target.value)}
                    className="w-8 h-8 rounded-full border border-border cursor-pointer"
                    aria-label="Escolher cor dos botões"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Estilo dos botões
                </Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["rounded", "pill", "square"] as ButtonStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateTheme("buttonStyle", s)}
                      className={cn(
                        "h-10 border-2 font-body text-sm font-medium transition-all",
                        STYLE_RADIUS[s],
                        theme.buttonStyle === s
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {s === "rounded" ? "Arredondado" : s === "pill" ? "Pílula" : "Quadrado"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="text-sm font-body font-medium text-foreground">
                    Mostrar avatar e bio do perfil
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usa a foto, nome e bio configurados no seu perfil.
                  </p>
                </div>
                <Switch
                  checked={theme.useProfile}
                  onCheckedChange={(v) => updateTheme("useProfile", v)}
                />
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
              <BioPreview
                profile={profile}
                links={activeLinks}
                theme={theme}
              />
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

type LinkCardProps = {
  link: BioLink;
  maxClicks: number;
  provided: DraggableProvided;
  isDragging: boolean;
  onUpdate: (id: string, updates: Partial<BioLink>) => void;
  onDelete: (id: string) => void;
};

// Local state for the text inputs so each keystroke doesn't trigger a
// network call or a re-render of the parent (which would re-render the
// preview). Server sync happens on blur.
function LinkCard({
  link,
  maxClicks,
  provided,
  isDragging,
  onUpdate,
  onDelete,
}: LinkCardProps) {
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [icon, setIcon] = useState(link.icon ?? "");

  // Resync local state only when this slot becomes a different link
  // (e.g. after reorder/delete shifts indexes). Skipping this on every
  // link prop change avoids clobbering in-progress edits when our own
  // mutation refetches the list.
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

type PreviewProps = {
  profile: ReturnType<typeof useProfile>["profile"];
  links: BioLink[];
  theme: BioTheme;
};

const BioPreview = memo(function BioPreview({ profile, links, theme }: PreviewProps) {
  const showProfile = theme.useProfile && profile;
  return (
    <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
      <div
        className="w-full h-[560px] rounded-[32px] overflow-y-auto px-5 py-8 flex flex-col items-center"
        style={{ backgroundColor: theme.bgColor }}
      >
        {showProfile && (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[2px] mb-3">
              <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-display font-bold text-2xl">
                    {getInitial(profile?.name)}
                  </span>
                )}
              </div>
            </div>
            <h3 className="font-display font-bold text-base text-gray-900 text-center">
              {profile?.name || "Seu nome"}
            </h3>
            {profile?.bio && (
              <p className="text-xs text-gray-700 text-center mt-1 line-clamp-3 font-body">
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
            links.map((link) => (
              <div
                key={link.id}
                className={cn(
                  "w-full px-4 py-3 text-center font-body font-semibold text-sm text-gray-900 shadow-sm",
                  STYLE_RADIUS[theme.buttonStyle]
                )}
                style={{ backgroundColor: theme.buttonColor }}
              >
                {link.icon && <span className="mr-1.5">{link.icon}</span>}
                {link.title || "Sem título"}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export default LinkInBio;
