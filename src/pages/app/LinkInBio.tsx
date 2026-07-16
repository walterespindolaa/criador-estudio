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
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Download,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeUrl } from "@/lib/sanitize";
import { RichTextInput, renderRichText } from "@/lib/richText";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBioLinks, type BioLink } from "@/hooks/useBioLinks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { validateUpload } from "@/lib/upload-validation";
import { useBioLeads } from "@/hooks/useBioLeads";
import { confirmar } from "@/components/shared/Confirm";

type BgType = "color" | "gradient" | "image";
type BgImageSize = "cover" | "contain";
type BgImagePosition = "center" | "top" | "bottom";
type ButtonStyle = "rounded" | "pill" | "square" | "outline";

// Fontes já carregadas no index.html do projeto (sem dependência de rede nova).
// value = family CSS; stack = pilha aplicada. "" mantém o visual atual.
const BIO_FONTS: { label: string; value: string; stack: string }[] = [
  { label: "Baloo 2", value: "Baloo 2", stack: "'Baloo 2', system-ui, sans-serif" },
  { label: "Nunito", value: "Nunito", stack: "'Nunito', system-ui, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif" },
  { label: "DM Serif Display", value: "DM Serif Display", stack: "'DM Serif Display', Georgia, serif" },
  { label: "Outfit", value: "Outfit", stack: "'Outfit', system-ui, sans-serif" },
  { label: "Quicksand", value: "Quicksand", stack: "'Quicksand', system-ui, sans-serif" },
  { label: "Sora", value: "Sora", stack: "'Sora', system-ui, sans-serif" },
  { label: "Bricolage Grotesque", value: "Bricolage Grotesque", stack: "'Bricolage Grotesque', system-ui, sans-serif" },
  { label: "Grand Hotel", value: "Grand Hotel", stack: "'Grand Hotel', cursive" },
];

function fontStackFor(value: string): string | null {
  const f = BIO_FONTS.find((x) => x.value === value);
  return f ? f.stack : null;
}

function clamp01(n: number, max: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

// Estilo <style> escopado: só afeta elementos dentro de .bio-font-scope.
// stack vem de whitelist, então é seguro.
function BioFontStyle({ stack }: { stack: string | null }) {
  if (!stack) return null;
  return <style>{`.bio-font-scope,.bio-font-scope *{font-family:${stack} !important}`}</style>;
}

// Sobreposição escura opcional pra legibilidade sobre imagem/gradiente.
function BgOverlay({ amount }: { amount: number }) {
  if (!amount || amount <= 0) return null;
  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ backgroundColor: `rgba(0,0,0,${amount})` }}
    />
  );
}

type SocialLinks = {
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
};

type BioSectionId = "banner" | "about" | "links" | "lead";
type BioSection = { id: BioSectionId; on: boolean };
type LeadFields = "email" | "phone" | "both";
type BioAbout = { image: string | null; title: string; text: string };
type BioHeader = { name: string; avatar: string; bio: string };
type BioLeadForm = { title: string; subtitle: string; fields: LeadFields; buttonText: string; consentText: string };

type BioLayout = "classic" | "vitrine";
export type VitrineService = { id: string; title: string; desc: string; image: string | null; url: string };
export type VitrineProduct = { id: string; title: string; desc: string; cover: string | null; ctaText: string; url: string };
type VitrineSettings = { baseColor: string; cover: string | null; services: VitrineService[]; products: VitrineProduct[] };

function genBioId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_VITRINE: VitrineSettings = { baseColor: "#0A0A0A", cover: null, services: [], products: [] };
const VITRINE_COLORS = ["#0A0A0A", "#EA4918", "#0061EE", "#01A652", "#F27EB5", "#7C90F0"];

function parseVitrineServices(raw: unknown): VitrineService[] {
  if (!Array.isArray(raw)) return [];
  const out: VitrineService[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : genBioId(),
      title: typeof o.title === "string" ? o.title : "",
      desc: typeof o.desc === "string" ? o.desc : "",
      image: typeof o.image === "string" && o.image ? o.image : null,
      url: typeof o.url === "string" ? o.url : "",
    });
  }
  return out;
}

function parseVitrineProducts(raw: unknown): VitrineProduct[] {
  if (!Array.isArray(raw)) return [];
  const out: VitrineProduct[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : genBioId(),
      title: typeof o.title === "string" ? o.title : "",
      desc: typeof o.desc === "string" ? o.desc : "",
      cover: typeof o.cover === "string" && o.cover ? o.cover : null,
      ctaText: typeof o.ctaText === "string" && o.ctaText ? o.ctaText : "Garanta o seu",
      url: typeof o.url === "string" ? o.url : "",
    });
  }
  return out;
}

function parseVitrine(raw: unknown): VitrineSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<VitrineSettings>;
  return {
    baseColor: typeof v.baseColor === "string" && v.baseColor ? v.baseColor : DEFAULT_VITRINE.baseColor,
    cover: typeof v.cover === "string" && v.cover ? v.cover : null,
    services: parseVitrineServices((v as { services?: unknown }).services),
    products: parseVitrineProducts((v as { products?: unknown }).products),
  };
}

const BIO_SECTION_IDS: BioSectionId[] = ["banner", "about", "links", "lead"];
const SECTION_LABELS: Record<BioSectionId, string> = {
  banner: "Banner",
  about: "Sobre mim",
  links: "Links",
  lead: "Captura de lead",
};
const DEFAULT_SECTIONS: BioSection[] = [
  { id: "banner", on: false },
  { id: "about", on: false },
  { id: "links", on: true },
  { id: "lead", on: false },
];
function normalizeSections(raw: unknown): BioSection[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<BioSectionId>();
  const out: BioSection[] = [];
  for (const item of arr) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id === "string" && (BIO_SECTION_IDS as string[]).includes(id) && !seen.has(id as BioSectionId)) {
      seen.add(id as BioSectionId);
      out.push({ id: id as BioSectionId, on: Boolean((item as { on?: unknown })?.on) });
    }
  }
  for (const def of DEFAULT_SECTIONS) { if (!seen.has(def.id)) out.push({ ...def }); }
  return out;
}

export type BioSettings = {
  bgType: BgType;
  bgColor: string;
  bgGradient: string;
  bgImage: string | null;
  bgImageSize: BgImageSize;
  bgImagePosition: BgImagePosition;
  bgOverlay: number;
  fontFamily: string;
  buttonStyle: ButtonStyle;
  buttonColor: string;
  buttonTextColor: string;
  socialLinks: SocialLinks;
  bannerImage: string | null;
  about: BioAbout;
  header: BioHeader;
  lead: BioLeadForm;
  sections: BioSection[];
  layout: BioLayout;
  vitrine: VitrineSettings;
};

const DEFAULT_SETTINGS: BioSettings = {
  bgType: "color",
  bgColor: "#FDF2F8",
  bgGradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  bgImage: null,
  bgImageSize: "cover",
  bgImagePosition: "center",
  bgOverlay: 0,
  fontFamily: "",
  buttonStyle: "rounded",
  buttonColor: "#FFFFFF",
  buttonTextColor: "#1F2937",
  socialLinks: { instagram: "", tiktok: "", youtube: "", twitter: "" },
  bannerImage: null,
  about: { image: null, title: "Sobre mim", text: "" },
  header: { name: "", avatar: "", bio: "" },
  lead: {
    title: "Receba novidades",
    subtitle: "Deixe seu contato e eu te chamo.",
    fields: "email",
    buttonText: "Enviar",
    consentText: "Ao enviar, você autoriza o uso dos seus dados para contato.",
  },
  sections: DEFAULT_SECTIONS,
  layout: "classic",
  vitrine: DEFAULT_VITRINE,
};

type BioThemePreset = {
  key: string;
  label: string;
  bg: string;
  bgGradient: string | null;
  buttonColor: string;
  buttonTextColor: string;
  buttonStyle: ButtonStyle;
};

const BIO_THEMES: BioThemePreset[] = [
  { key: "clean", label: "Clean", bg: "#ffffff", bgGradient: null, buttonColor: "#0A0D12", buttonTextColor: "#ffffff", buttonStyle: "rounded" },
  { key: "dark", label: "Dark", bg: "#0A0D12", bgGradient: null, buttonColor: "#ffffff", buttonTextColor: "#0A0D12", buttonStyle: "rounded" },
  { key: "sunset", label: "Sunset", bg: "#FFF5EB", bgGradient: null, buttonColor: "#FF6B35", buttonTextColor: "#ffffff", buttonStyle: "pill" },
  { key: "ocean", label: "Ocean", bg: "#EEF4FF", bgGradient: null, buttonColor: "#3B82F6", buttonTextColor: "#ffffff", buttonStyle: "pill" },
  { key: "forest", label: "Forest", bg: "#F0FFF4", bgGradient: null, buttonColor: "#16A34A", buttonTextColor: "#ffffff", buttonStyle: "rounded" },
  {
    key: "purple",
    label: "Purple Vibes",
    bg: "#FAF5FF",
    bgGradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #fb923c 100%)",
    buttonColor: "#EA4918",
    buttonTextColor: "#ffffff",
    buttonStyle: "pill",
  },
  { key: "neon", label: "Neon Night", bg: "#0F0F23", bgGradient: null, buttonColor: "#FACC15", buttonTextColor: "#0F0F23", buttonStyle: "square" },
  { key: "rose", label: "Rosé", bg: "#FFF1F2", bgGradient: null, buttonColor: "#F43F5E", buttonTextColor: "#ffffff", buttonStyle: "pill" },
];

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
  const bgImageSize: BgImageSize = t.bgImageSize === "contain" ? "contain" : "cover";
  const bgImagePosition: BgImagePosition =
    t.bgImagePosition === "top" || t.bgImagePosition === "bottom" ? t.bgImagePosition : "center";
  const bgOverlay = typeof t.bgOverlay === "number" ? clamp01(t.bgOverlay, 0.6) : 0;
  const fontFamily =
    typeof t.fontFamily === "string" && fontStackFor(t.fontFamily) ? t.fontFamily : "";
  const buttonStyle: ButtonStyle =
    t.buttonStyle === "pill" ||
    t.buttonStyle === "square" ||
    t.buttonStyle === "outline"
      ? t.buttonStyle
      : "rounded";
  const socialRaw = (t.socialLinks ?? {}) as Partial<SocialLinks>;
  const ta = (t.about ?? {}) as Partial<BioAbout>;
  const tl = (t.lead ?? {}) as Partial<BioLeadForm>;
  return {
    bgType,
    bgColor: typeof t.bgColor === "string" ? t.bgColor : DEFAULT_SETTINGS.bgColor,
    bgGradient: typeof t.bgGradient === "string" ? t.bgGradient : DEFAULT_SETTINGS.bgGradient,
    bgImage: typeof t.bgImage === "string" && t.bgImage ? t.bgImage : null,
    bgImageSize,
    bgImagePosition,
    bgOverlay,
    fontFamily,
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
    bannerImage: typeof t.bannerImage === "string" && t.bannerImage ? t.bannerImage : null,
    about: {
      image: typeof ta.image === "string" && ta.image ? ta.image : null,
      title: typeof ta.title === "string" ? ta.title : DEFAULT_SETTINGS.about.title,
      text: typeof ta.text === "string" ? ta.text : "",
    },
    header: {
      name: typeof (t.header as Partial<BioHeader> | undefined)?.name === "string" ? (t.header as BioHeader).name : "",
      avatar: typeof (t.header as Partial<BioHeader> | undefined)?.avatar === "string" ? (t.header as BioHeader).avatar : "",
      bio: typeof (t.header as Partial<BioHeader> | undefined)?.bio === "string" ? (t.header as BioHeader).bio : "",
    },
    lead: {
      title: typeof tl.title === "string" ? tl.title : DEFAULT_SETTINGS.lead.title,
      subtitle: typeof tl.subtitle === "string" ? tl.subtitle : DEFAULT_SETTINGS.lead.subtitle,
      fields: tl.fields === "phone" || tl.fields === "both" ? tl.fields : "email",
      buttonText: typeof tl.buttonText === "string" ? tl.buttonText : DEFAULT_SETTINGS.lead.buttonText,
      consentText: typeof tl.consentText === "string" ? tl.consentText : DEFAULT_SETTINGS.lead.consentText,
    },
    sections: normalizeSections(t.sections),
    layout: t.layout === "vitrine" ? "vitrine" : "classic",
    vitrine: parseVitrine(t.vitrine),
  };
}

export function backgroundStyle(settings: BioSettings): React.CSSProperties {
  if (settings.bgType === "gradient") {
    return { backgroundImage: settings.bgGradient };
  }
  if (settings.bgType === "image" && settings.bgImage) {
    return {
      backgroundImage: `url(${settings.bgImage})`,
      backgroundSize: settings.bgImageSize,
      backgroundPosition: settings.bgImagePosition,
      backgroundRepeat: "no-repeat",
      backgroundColor: settings.bgColor,
    };
  }
  return { backgroundColor: settings.bgColor };
}

// input type=color exige hex de 6 dígitos; senão cai num fallback seguro.
function safeColorInput(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

// Seletor de cor personalizada: quadradinho (input color) + campo hex.
function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  const commitText = (v: string) => {
    setText(v);
    const clean = v.trim();
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(clean)) onChange(clean);
  };
  return (
    <div className="space-y-1">
      {label && <Label className="text-[11px] text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeColorInput(value)}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
          className="w-10 h-9 rounded cursor-pointer border border-border shrink-0"
          aria-label={label ? `${label}: escolher cor` : "Escolher cor"}
        />
        <Input
          value={text}
          onChange={(e) => commitText(e.target.value)}
          placeholder="#000000"
          className="h-9 rounded-lg w-28 font-mono text-xs"
          maxLength={7}
          aria-label={label ? `${label}: código hex` : "Código hex"}
        />
      </div>
    </div>
  );
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

// RPC nova ainda não está nos tipos gerados, cast (padrão do projeto).
type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

const LinkInBio = () => {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const { profile: selfProfile, updateProfile, isLoading: selfProfileLoading } = useProfile();
  const { links, isLoading, createLink, updateLink, deleteLink, reorderLinks } = useBioLinks();
  const queryClient = useQueryClient();

  // Quando o manager gerencia outro, lê/escreve no profile da conta ATIVA,
  // não no useProfile (que controla auth/gate da SESSÃO).
  const ownerId = activeAccountId || user?.id || "";
  const isOwnAccount = !activeAccountId || activeAccountId === user?.id;
  const managedProfileKey = ["bio-profile", ownerId] as const;

  type BioProfileSubset = Pick<
    Profile,
    "id" | "name" | "avatar_url" | "niche" | "instagram_handle" | "bio" | "bio_slug" | "bio_settings"
  >;

  const { data: managedProfile, isLoading: managedLoading } = useQuery<BioProfileSubset | null>({
    queryKey: managedProfileKey,
    enabled: !!ownerId && !isOwnAccount,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, niche, instagram_handle, bio, bio_slug, bio_settings")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data as BioProfileSubset | null;
    },
  });

  const profile = (isOwnAccount ? selfProfile : managedProfile) as Profile | null;
  const profileLoading = isOwnAccount ? selfProfileLoading : managedLoading;
  const [savingAppearance, setSavingAppearance] = useState(false);
  const isSavingAppearance = isOwnAccount ? updateProfile.isPending : savingAppearance;

  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [settings, setSettings] = useState<BioSettings>(DEFAULT_SETTINGS);
  const { leads, isLoading: leadsLoading, deleteLead } = useBioLeads();
  const exportLeadsCsv = () => {
    const rows = [["Nome", "Email", "Telefone", "Data"], ...leads.map((l) => [l.name ?? "", l.email ?? "", l.phone ?? "", new Date(l.created_at).toLocaleString("pt-BR")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const aboutInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setSlug(profile.bio_slug ?? "");
    setSettings(parseSettings(profile.bio_settings));
    setAppearanceDirty(false);
  }, [profile?.id, profile?.bio_slug, profile?.bio_settings]);

  // Checagem de disponibilidade do slug (debounce).
  useEffect(() => {
    const clean = normalizeSlug(slug);
    if (!clean) { setSlugStatus("idle"); return; }
    const current = normalizeSlug(profile?.bio_slug ?? "");
    if (clean === current) { setSlugStatus("available"); return; }
    setSlugStatus("checking");
    const handle = setTimeout(async () => {
      try {
        const { data, error } = await sbRpc("bio_slug_available", { _slug: clean, _exclude: profile?.id ?? null });
        if (error) throw error;
        setSlugStatus(data ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [slug, profile?.bio_slug, profile?.id]);

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

  // Analytics
  const totalClicks = useMemo(
    () => sortedLinks.reduce((s, l) => (l.link_type === "header" ? s : s + (l.clicks ?? 0)), 0),
    [sortedLinks]
  );
  const bioViews = profile?.bio_views ?? 0;
  const conversao = bioViews > 0 ? Math.min(100, Math.round((totalClicks / bioViews) * 100)) : 0;
  const topLink = useMemo(
    () => sortedLinks.filter((l) => l.link_type !== "header").sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))[0] ?? null,
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

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ titulo: "Remover este item do seu link?", acao: "Remover" }))) return;
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

    const validation = validateUpload(file, "bioMedia");
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    try {
      setUploadingBg(true);
      const path = `${ownerId}/bg-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
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

  const uploadBioImage = async (file: File, prefix: string): Promise<string | null> => {
    const validation = validateUpload(file, "bioMedia");
    if (!validation.ok) { toast.error(validation.reason); return null; }
    const path = `${ownerId}/${prefix}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error: upErr } = await supabase.storage
      .from("bio-media")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (upErr) { toast.error("Erro ao enviar imagem."); return null; }
    const { data: urlData } = supabase.storage.from("bio-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    setUploadingBanner(true);
    const url = await uploadBioImage(file, "banner");
    if (url) { setSettings((s) => ({ ...s, bannerImage: url })); setAppearanceDirty(true); }
    setUploadingBanner(false);
  };

  const handleAboutImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    setUploadingAbout(true);
    const url = await uploadBioImage(file, "about");
    if (url) { setSettings((s) => ({ ...s, about: { ...s.about, image: url } })); setAppearanceDirty(true); }
    setUploadingAbout(false);
  };

  const handleHeaderAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    setUploadingHeader(true);
    const url = await uploadBioImage(file, "header");
    if (url) { setSettings((s) => ({ ...s, header: { ...s.header, avatar: url } })); setAppearanceDirty(true); }
    setUploadingHeader(false);
  };

  const patchHeader = (patch: Partial<BioSettings["header"]>) => {
    setSettings((s) => ({ ...s, header: { ...s.header, ...patch } }));
    setAppearanceDirty(true);
  };

  const patchAbout = (patch: Partial<BioAbout>) => {
    setSettings((s) => ({ ...s, about: { ...s.about, ...patch } }));
    setAppearanceDirty(true);
  };

  const patchLead = (patch: Partial<BioLeadForm>) => {
    setSettings((s) => ({ ...s, lead: { ...s.lead, ...patch } }));
    setAppearanceDirty(true);
  };

  // ── Vitrine ──────────────────────────────────
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const patchVitrine = (patch: Partial<BioSettings["vitrine"]>) => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, ...patch } }));
    setAppearanceDirty(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    setUploadingCover(true);
    const url = await uploadBioImage(file, "cover");
    if (url) patchVitrine({ cover: url });
    setUploadingCover(false);
  };

  const addService = () => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, services: [...s.vitrine.services, { id: genBioId(), title: "", desc: "", image: null, url: "" }] } }));
    setAppearanceDirty(true);
  };
  const updateService = (id: string, patch: Partial<VitrineService>) => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, services: s.vitrine.services.map((it) => (it.id === id ? { ...it, ...patch } : it)) } }));
    setAppearanceDirty(true);
  };
  const removeService = (id: string) => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, services: s.vitrine.services.filter((it) => it.id !== id) } }));
    setAppearanceDirty(true);
  };
  const moveService = (index: number, dir: -1 | 1) => {
    setSettings((s) => {
      const next = [...s.vitrine.services];
      const j = index + dir;
      if (j < 0 || j >= next.length) return s;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...s, vitrine: { ...s.vitrine, services: next } };
    });
    setAppearanceDirty(true);
  };

  const addProduct = () => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, products: [...s.vitrine.products, { id: genBioId(), title: "", desc: "", cover: null, ctaText: "Garanta o seu", url: "" }] } }));
    setAppearanceDirty(true);
  };
  const updateProduct = (id: string, patch: Partial<VitrineProduct>) => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, products: s.vitrine.products.map((it) => (it.id === id ? { ...it, ...patch } : it)) } }));
    setAppearanceDirty(true);
  };
  const removeProduct = (id: string) => {
    setSettings((s) => ({ ...s, vitrine: { ...s.vitrine, products: s.vitrine.products.filter((it) => it.id !== id) } }));
    setAppearanceDirty(true);
  };
  const moveProduct = (index: number, dir: -1 | 1) => {
    setSettings((s) => {
      const next = [...s.vitrine.products];
      const j = index + dir;
      if (j < 0 || j >= next.length) return s;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...s, vitrine: { ...s.vitrine, products: next } };
    });
    setAppearanceDirty(true);
  };

  const handleSaveAppearance = async () => {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) {
      toast.error("Escolha um nome para o seu link público.");
      return;
    }
    if (slugStatus === "taken") {
      toast.error("Esse nome de link já está em uso. Escolha outro.");
      return;
    }
    try {
      if (isOwnAccount) {
        await updateProfile.mutateAsync({
          bio_slug: cleanSlug,
          bio_settings: settings as unknown as never,
        });
      } else {
        if (!activeAccountId) throw new Error("Conta ativa não identificada.");
        setSavingAppearance(true);
        const { error } = await supabase
          .from("profiles")
          .update({
            bio_slug: cleanSlug,
            bio_settings: settings as unknown as never,
          })
          .eq("id", activeAccountId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: managedProfileKey });
      }
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
    } finally {
      setSavingAppearance(false);
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

  const applyTheme = (theme: BioThemePreset) => {
    setSettings((s) => ({
      ...s,
      bgType: theme.bgGradient ? "gradient" : "color",
      bgColor: theme.bg,
      bgGradient: theme.bgGradient ?? s.bgGradient,
      bgImage: null,
      buttonStyle: theme.buttonStyle,
      buttonColor: theme.buttonColor,
      buttonTextColor: theme.buttonTextColor,
    }));
    setAppearanceDirty(true);
  };

  const patchSocial = (key: keyof SocialLinks, value: string) => {
    setSettings((s) => ({ ...s, socialLinks: { ...s.socialLinks, [key]: value } }));
    setAppearanceDirty(true);
  };

  const toggleSection = (id: BioSectionId) => {
    setSettings((s) => ({ ...s, sections: s.sections.map((sec) => (sec.id === id ? { ...sec, on: !sec.on } : sec)) }));
    setAppearanceDirty(true);
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    setSettings((s) => {
      const next = [...s.sections];
      const j = index + dir;
      if (j < 0 || j >= next.length) return s;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...s, sections: next };
    });
    setAppearanceDirty(true);
  };

  if (profileLoading || isLoading) return <PageSkeleton />;

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0 md:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-400 flex items-center justify-center shadow-sm shrink-0">
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
            {/* ── Cabeçalho: seletor de estilo + salvar (fixo no topo) ─────── */}
            <div className="sticky top-0 z-30 rounded-2xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex gap-1 rounded-full border border-border bg-muted/40 p-1">
                  {([
                    { id: "classic", label: "Clássico" },
                    { id: "vitrine", label: "Vitrine" },
                  ] as { id: BioSettings["layout"]; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchSettings({ layout: opt.id })}
                      className={cn(
                        "px-5 py-1.5 rounded-full text-sm font-display font-semibold transition-colors",
                        settings.layout === opt.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "text-[11px] font-body hidden sm:inline",
                      isSavingAppearance
                        ? "text-muted-foreground"
                        : appearanceDirty
                          ? "text-amber-600"
                          : "text-emerald-600"
                    )}
                  >
                    {isSavingAppearance ? "Salvando..." : appearanceDirty ? "Alterações não salvas" : "Tudo salvo"}
                  </span>
                  <Button
                    onClick={handleSaveAppearance}
                    disabled={!appearanceDirty || isSavingAppearance}
                    size="sm"
                    variant="hero"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {isSavingAppearance ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Escolha um estilo e edite. Trocar de estilo não apaga o conteúdo do outro; cada estilo guarda o seu.
              </p>
            </div>

            {/* ── Controles da Vitrine ─────────────── */}
            {settings.layout === "vitrine" && (
              <>
              <Card className="p-4 md:p-5 rounded-2xl border-border space-y-6">
                <h2 className="font-display font-semibold text-foreground">Vitrine</h2>

                {!settings.vitrine.cover && settings.vitrine.services.length === 0 && settings.vitrine.products.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                    <p className="text-sm font-display font-semibold text-foreground">Monte sua vitrine em 3 passos</p>
                    <p className="mt-0.5 mb-3 text-xs text-muted-foreground">Comece por aqui. Dá pra ajustar tudo depois.</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button type="button" onClick={() => coverInputRef.current?.click()} className="text-left rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#EA4918" }}>1</span>
                        <span className="mt-2 block text-sm font-semibold text-foreground">Escolha sua capa</span>
                        <span className="block text-[11px] text-muted-foreground">Imagem de destaque no topo</span>
                      </button>
                      <button type="button" onClick={addService} className="text-left rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#0061EE" }}>2</span>
                        <span className="mt-2 block text-sm font-semibold text-foreground">Adicione seus serviços</span>
                        <span className="block text-[11px] text-muted-foreground">O que você oferece</span>
                      </button>
                      <button type="button" onClick={addProduct} className="text-left rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#01A652" }}>3</span>
                        <span className="mt-2 block text-sm font-semibold text-foreground">Adicione seus produtos</span>
                        <span className="block text-[11px] text-muted-foreground">Infoprodutos pra vender</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Cor base */}
                <div className="space-y-2">
                  <Label className="text-sm font-display font-semibold">Cor base</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Pinta os cards de serviço, o corpo dos produtos, etiquetas, setas e sublinhados.</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {VITRINE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patchVitrine({ baseColor: c })}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          settings.vitrine.baseColor.toLowerCase() === c.toLowerCase() ? "border-foreground ring-2 ring-foreground/20 scale-110" : "border-border"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                  <ColorField
                    value={settings.vitrine.baseColor}
                    onChange={(v) => patchVitrine({ baseColor: v })}
                    label="Cor personalizada (qualquer cor)"
                  />
                </div>

                {/* Capa */}
                <div className="space-y-2">
                  <Label className="text-sm font-display font-semibold">Capa</Label>
                  {settings.vitrine.cover ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={settings.vitrine.cover} alt="Capa" loading="lazy" className="w-full h-40 object-cover" />
                      <button type="button" onClick={() => patchVitrine({ cover: null })} className="absolute top-1.5 right-1.5 bg-background/90 rounded-full p-1 shadow">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ) : null}
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {uploadingCover ? "Enviando..." : settings.vitrine.cover ? "Trocar capa" : "Enviar capa"}
                  </Button>
                </div>

                {/* Serviços */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-display font-semibold">Serviços</Label>
                    <Button type="button" variant="secondary" size="sm" onClick={addService}>
                      <Plus className="h-4 w-4 mr-1" /> Serviço
                    </Button>
                  </div>
                  {settings.vitrine.services.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum serviço ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {settings.vitrine.services.map((sv, i) => (
                        <VitrineServiceEditor
                          key={sv.id}
                          item={sv}
                          index={i}
                          total={settings.vitrine.services.length}
                          onUpdate={updateService}
                          onRemove={removeService}
                          onMove={moveService}
                          onUploadImage={(file) => uploadBioImage(file, "service")}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Infoprodutos */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-display font-semibold">Infoprodutos</Label>
                    <Button type="button" variant="secondary" size="sm" onClick={addProduct}>
                      <Plus className="h-4 w-4 mr-1" /> Produto
                    </Button>
                  </div>
                  {settings.vitrine.products.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum infoproduto ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {settings.vitrine.products.map((pr, i) => (
                        <VitrineProductEditor
                          key={pr.id}
                          item={pr}
                          index={i}
                          total={settings.vitrine.products.length}
                          onUpdate={updateProduct}
                          onRemove={removeProduct}
                          onMove={moveProduct}
                          onUploadImage={(file) => uploadBioImage(file, "product")}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleSaveAppearance} disabled={!appearanceDirty || isSavingAppearance} className="w-full" variant="hero">
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingAppearance ? "Salvando..." : "Salvar alterações"}
                </Button>
              </Card>

              {/* Identidade da vitrine (nome e bio compartilhados) */}
              <Card className="p-4 md:p-5 rounded-2xl border-border space-y-3">
                <div>
                  <h2 className="font-display font-semibold text-foreground mb-1">Identidade</h2>
                  <p className="text-xs text-muted-foreground">Nome e bio que aparecem na sua vitrine. Deixe em branco para usar os dados do seu perfil.</p>
                </div>
                <input value={settings.header.name} onChange={(e) => patchHeader({ name: e.target.value })} placeholder={profile?.name || "Seu nome"} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <RichTextInput value={settings.header.bio} onChange={(v) => patchHeader({ bio: v })} placeholder={profile?.bio || "Escreva uma bio curta"} rows={3} />
              </Card>

              {/* Aparência da vitrine (fonte, fundo e redes compartilhados) */}
              <Card className="p-4 md:p-5 rounded-2xl border-border space-y-6">
                <h2 className="font-display font-semibold text-foreground">Aparência</h2>

                {/* Fonte */}
                <div className="space-y-3">
                  <Label className="text-sm font-display font-semibold">Fonte</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Muda a fonte da sua página pública (vale nos dois estilos). Cada opção mostra uma amostra.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => patchSettings({ fontFamily: "" })}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-colors",
                        settings.fontFamily === "" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      )}
                    >
                      <span className="block text-sm font-semibold text-foreground">Padrão</span>
                      <span className="block text-[11px] text-muted-foreground">Visual atual</span>
                    </button>
                    {BIO_FONTS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => patchSettings({ fontFamily: f.value })}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left transition-colors",
                          settings.fontFamily === f.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                        )}
                      >
                        <span className="block text-sm text-foreground leading-tight" style={{ fontFamily: f.stack }}>{f.label}</span>
                        <span className="block text-[11px] text-muted-foreground" style={{ fontFamily: f.stack }}>Ag Bço 123</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fundo */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-sm font-display font-semibold">Fundo</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Escolha cor sólida, gradiente ou imagem de fundo. Vale nos dois estilos (Clássico e Vitrine).
                  </p>
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {BG_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => patchSettings({ bgColor: c })}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-all",
                              settings.bgColor.toLowerCase() === c.toLowerCase()
                                ? "border-primary ring-2 ring-primary/20 scale-110"
                                : "border-border"
                            )}
                            style={{ backgroundColor: c }}
                            aria-label={`Cor ${c}`}
                          />
                        ))}
                      </div>
                      <ColorField
                        value={settings.bgColor}
                        onChange={(v) => patchSettings({ bgColor: v })}
                        label="Cor personalizada (qualquer cor)"
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

                      {/* Encaixe da imagem de fundo */}
                      <div className="space-y-1 pt-1">
                        <Label className="text-[11px] text-muted-foreground">Encaixe</Label>
                        <div className="flex gap-2">
                          {([
                            { id: "cover", label: "Preencher" },
                            { id: "contain", label: "Caber inteira" },
                          ] as { id: BgImageSize; label: string }[]).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => patchSettings({ bgImageSize: o.id })}
                              className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                                settings.bgImageSize === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Posição</Label>
                        <div className="flex gap-2">
                          {([
                            { id: "top", label: "Topo" },
                            { id: "center", label: "Centro" },
                            { id: "bottom", label: "Base" },
                          ] as { id: BgImagePosition; label: string }[]).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => patchSettings({ bgImagePosition: o.id })}
                              className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                                settings.bgImagePosition === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sobreposição escura (legibilidade sobre imagem/gradiente) */}
                  {(settings.bgType === "image" || settings.bgType === "gradient") && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">Escurecer o fundo</Label>
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{Math.round(settings.bgOverlay * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.6}
                        step={0.05}
                        value={settings.bgOverlay}
                        onChange={(e) => patchSettings({ bgOverlay: clamp01(Number(e.target.value), 0.6) })}
                        className="w-full accent-primary cursor-pointer"
                        aria-label="Escurecer o fundo para legibilidade"
                      />
                      <p className="text-[11px] text-muted-foreground/70">Ajuda o texto a ficar legível quando o fundo é claro ou movimentado.</p>
                    </div>
                  )}
                </div>

                {/* Redes sociais */}
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

                <Button onClick={handleSaveAppearance} disabled={!appearanceDirty || isSavingAppearance} className="w-full" variant="hero">
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingAppearance ? "Salvando..." : "Salvar alterações"}
                </Button>
              </Card>
              </>
            )}

            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <Label className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground/80">
                Seu link público
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-body text-muted-foreground whitespace-nowrap">
                  criasocialclub.com/bio/
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
              {slug.trim() && (
                <p className="mt-1.5 text-[11px] font-body flex items-center gap-1">
                  {slugStatus === "checking" && (
                    <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> verificando disponibilidade…</span>
                  )}
                  {slugStatus === "available" && (
                    <span className="text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> disponível</span>
                  )}
                  {slugStatus === "taken" && (
                    <span className="text-destructive flex items-center gap-1"><X className="h-3 w-3" /> já está em uso, escolha outro</span>
                  )}
                </p>
              )}
            </Card>

            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <h2 className="font-display font-semibold text-foreground mb-4">Desempenho</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-2xl font-display font-extrabold text-foreground">{bioViews.toLocaleString("pt-BR")}</p>
                  <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide mt-0.5">Visitas</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-2xl font-display font-extrabold text-foreground">{totalClicks.toLocaleString("pt-BR")}</p>
                  <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide mt-0.5">Cliques</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-2xl font-display font-extrabold text-foreground">{conversao}%</p>
                  <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide mt-0.5">Conversão</p>
                </div>
              </div>
              {topLink && (topLink.clicks ?? 0) > 0 && (
                <p className="text-xs font-body text-muted-foreground mt-3">
                  Link mais clicado: <span className="font-semibold text-foreground">{topLink.title}</span> · {topLink.clicks} cliques
                </p>
              )}
              <p className="text-[11px] font-body text-muted-foreground/70 mt-2">Visitas contam 1x por visitante na sessão. Cliques somam todos os toques nos links.</p>
            </Card>

            {settings.layout === "classic" && (
              <>
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
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
                  <p className="text-sm font-display font-semibold text-foreground">Adicione seu primeiro link</p>
                  <p className="mt-1 mb-3 text-xs text-muted-foreground font-body">
                    Links levam seus seguidores pra onde importa: loja, WhatsApp, agenda, seus conteúdos.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="hero" size="sm" onClick={handleAddLink}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar link
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleAddHeader}>
                      <TypeIcon className="h-4 w-4 mr-1" /> Título
                    </Button>
                  </div>
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

            {/* ── Estrutura / Seções ─────────────────── */}
            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <h2 className="font-display font-semibold text-foreground mb-1">Estrutura da página</h2>
              <p className="text-xs text-muted-foreground mb-4">Ligue/desligue e ordene as seções da sua página pública.</p>
              <div className="space-y-2">
                {settings.sections.map((sec, i) => (
                  <div key={sec.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                    <div className="flex flex-col -my-1">
                      <button type="button" aria-label="Subir" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label="Descer" onClick={() => moveSection(i, 1)} disabled={i === settings.sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{SECTION_LABELS[sec.id]}</span>
                    <Switch checked={sec.on} onCheckedChange={() => toggleSection(sec.id)} />
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Perfil (topo) ──────────────────────── */}
            <Card className="p-4 md:p-5 rounded-2xl border-border space-y-3">
              <div>
                <h2 className="font-display font-semibold text-foreground mb-1">Perfil (topo)</h2>
                <p className="text-xs text-muted-foreground">Foto, nome e bio do topo. Deixe em branco para usar os dados do seu perfil.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                  {(settings.header.avatar || profile?.avatar_url) ? (
                    <img src={settings.header.avatar || profile?.avatar_url || ""} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-muted-foreground font-display font-bold text-xl">{(settings.header.name || profile?.name || "C").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeaderAvatarUpload} />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingHeader} onClick={() => headerInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {uploadingHeader ? "Enviando..." : "Trocar foto"}
                  </Button>
                  {settings.header.avatar && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => patchHeader({ avatar: "" })}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                    </Button>
                  )}
                </div>
              </div>
              <input value={settings.header.name} onChange={(e) => patchHeader({ name: e.target.value })} placeholder={profile?.name || "Seu nome"} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <RichTextInput value={settings.header.bio} onChange={(v) => patchHeader({ bio: v })} placeholder={profile?.bio || "Escreva uma bio curta"} rows={3} />
            </Card>

            {/* ── Appearance ─────────────────────────── */}
            <Card className="p-4 md:p-5 rounded-2xl border-border space-y-6">
              <h2 className="font-display font-semibold text-foreground">Aparência</h2>

              {/* Fonte */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Fonte</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Muda a fonte da sua página pública (vale nos dois estilos). Cada opção mostra uma amostra.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => patchSettings({ fontFamily: "" })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors",
                      settings.fontFamily === "" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">Padrão</span>
                    <span className="block text-[11px] text-muted-foreground">Visual atual</span>
                  </button>
                  {BIO_FONTS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => patchSettings({ fontFamily: f.value })}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-colors",
                        settings.fontFamily === f.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      )}
                    >
                      <span className="block text-sm text-foreground leading-tight" style={{ fontFamily: f.stack }}>{f.label}</span>
                      <span className="block text-[11px] text-muted-foreground" style={{ fontFamily: f.stack }}>Ag Bço 123</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Themes (presets) */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Temas</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Aplica fundo, cor e estilo dos botões de uma vez.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {BIO_THEMES.map((theme) => {
                    const previewBg = theme.bgGradient
                      ? { backgroundImage: theme.bgGradient }
                      : { backgroundColor: theme.bg };
                    return (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => applyTheme(theme)}
                        className="group flex flex-col items-center gap-1 text-center"
                      >
                        <div
                          className="w-full aspect-[3/5] rounded-lg border border-border overflow-hidden p-2 flex flex-col justify-center gap-1 transition-all group-hover:border-primary/40 group-hover:shadow-md"
                          style={previewBg}
                        >
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1.5 w-full",
                                theme.buttonStyle === "pill" && "rounded-full",
                                theme.buttonStyle === "rounded" && "rounded-md",
                                theme.buttonStyle === "square" && "rounded-sm",
                                theme.buttonStyle === "outline" && "rounded-md border"
                              )}
                              style={{
                                backgroundColor:
                                  theme.buttonStyle === "outline" ? "transparent" : theme.buttonColor,
                                borderColor:
                                  theme.buttonStyle === "outline" ? theme.buttonTextColor : undefined,
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-body font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          {theme.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-display font-semibold">Fundo</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Escolha cor sólida, gradiente ou imagem de fundo. Vale nos dois estilos (Clássico e Vitrine).
                </p>
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {BG_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => patchSettings({ bgColor: c })}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            settings.bgColor.toLowerCase() === c.toLowerCase()
                              ? "border-primary ring-2 ring-primary/20 scale-110"
                              : "border-border"
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`Cor ${c}`}
                        />
                      ))}
                    </div>
                    <ColorField
                      value={settings.bgColor}
                      onChange={(v) => patchSettings({ bgColor: v })}
                      label="Cor personalizada (qualquer cor)"
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

                    {/* Encaixe da imagem de fundo */}
                    <div className="space-y-1 pt-1">
                      <Label className="text-[11px] text-muted-foreground">Encaixe</Label>
                      <div className="flex gap-2">
                        {([
                          { id: "cover", label: "Preencher" },
                          { id: "contain", label: "Caber inteira" },
                        ] as { id: BgImageSize; label: string }[]).map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => patchSettings({ bgImageSize: o.id })}
                            className={cn(
                              "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                              settings.bgImageSize === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Posição</Label>
                      <div className="flex gap-2">
                        {([
                          { id: "top", label: "Topo" },
                          { id: "center", label: "Centro" },
                          { id: "bottom", label: "Base" },
                        ] as { id: BgImagePosition; label: string }[]).map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => patchSettings({ bgImagePosition: o.id })}
                            className={cn(
                              "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                              settings.bgImagePosition === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sobreposição escura (legibilidade sobre imagem/gradiente) */}
                {(settings.bgType === "image" || settings.bgType === "gradient") && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground">Escurecer o fundo</Label>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{Math.round(settings.bgOverlay * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.6}
                      step={0.05}
                      value={settings.bgOverlay}
                      onChange={(e) => patchSettings({ bgOverlay: clamp01(Number(e.target.value), 0.6) })}
                      className="w-full accent-primary cursor-pointer"
                      aria-label="Escurecer o fundo para legibilidade"
                    />
                    <p className="text-[11px] text-muted-foreground/70">Ajuda o texto a ficar legível quando o fundo é claro ou movimentado.</p>
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

                <div className="flex gap-4 pt-1 flex-wrap">
                  <ColorField
                    value={settings.buttonColor}
                    onChange={(v) => patchSettings({ buttonColor: v })}
                    label="Cor do botão"
                  />
                  <ColorField
                    value={settings.buttonTextColor}
                    onChange={(v) => patchSettings({ buttonTextColor: v })}
                    label="Cor do texto"
                  />
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

              {/* Banner */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Banner</Label>
                <p className="text-xs text-muted-foreground -mt-1">Imagem larga no topo da página (opcional).</p>
                {settings.bannerImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={settings.bannerImage} alt="Banner" loading="lazy" className="w-full h-24 object-cover" />
                    <button type="button" onClick={() => patchSettings({ bannerImage: null })} className="absolute top-1.5 right-1.5 bg-background/90 rounded-full p-1 shadow">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ) : null}
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                <Button type="button" variant="outline" size="sm" disabled={uploadingBanner} onClick={() => bannerInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {uploadingBanner ? "Enviando..." : settings.bannerImage ? "Trocar banner" : "Enviar banner"}
                </Button>
              </div>

              {/* Sobre mim */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Sobre mim</Label>
                {settings.about.image ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-border">
                    <img src={settings.about.image} alt="Sobre mim" loading="lazy" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => patchAbout({ image: null })} className="absolute top-1 right-1 bg-background/90 rounded-full p-1 shadow">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ) : null}
                <input ref={aboutInputRef} type="file" accept="image/*" className="hidden" onChange={handleAboutImageUpload} />
                <Button type="button" variant="outline" size="sm" disabled={uploadingAbout} onClick={() => aboutInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {uploadingAbout ? "Enviando..." : settings.about.image ? "Trocar foto" : "Enviar foto"}
                </Button>
                <input value={settings.about.title} onChange={(e) => patchAbout({ title: e.target.value })} placeholder="Título (ex.: Sobre mim)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <RichTextInput value={settings.about.text} onChange={(v) => patchAbout({ text: v })} placeholder="Escreva um pouco sobre você..." rows={4} />
              </div>

              {/* Captura de lead */}
              <div className="space-y-3">
                <Label className="text-sm font-display font-semibold">Captura de lead</Label>
                <p className="text-xs text-muted-foreground -mt-1">Formulário pra visitantes deixarem o contato. Ative a seção "Captura de lead" em Estrutura da página.</p>
                <input value={settings.lead.title} onChange={(e) => patchLead({ title: e.target.value })} placeholder="Título" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <input value={settings.lead.subtitle} onChange={(e) => patchLead({ subtitle: e.target.value })} placeholder="Subtítulo" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Campos</Label>
                  <div className="flex gap-2 mt-1">
                    {(["email", "phone", "both"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => patchLead({ fields: f })} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors", settings.lead.fields === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                        {f === "email" ? "Email" : f === "phone" ? "Telefone" : "Ambos"}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={settings.lead.buttonText} onChange={(e) => patchLead({ buttonText: e.target.value })} placeholder="Texto do botão" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <textarea value={settings.lead.consentText} onChange={(e) => patchLead({ consentText: e.target.value })} placeholder="Texto de consentimento" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y" />
              </div>

              <Button
                onClick={handleSaveAppearance}
                disabled={!appearanceDirty || isSavingAppearance}
                className="w-full"
                variant="hero"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingAppearance ? "Salvando..." : "Salvar alterações"}
              </Button>
            </Card>

            {/* ── Leads capturados ──────────────────── */}
            <Card className="p-4 md:p-5 rounded-2xl border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-foreground">
                  Leads capturados {leads.length > 0 && <span className="text-muted-foreground font-normal">({leads.length})</span>}
                </h2>
                {leads.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={exportLeadsCsv}>
                    <Download className="h-4 w-4 mr-2" /> CSV
                  </Button>
                )}
              </div>
              {leadsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lead ainda. Ative a seção "Captura de lead" pra começar a coletar.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {leads.map((ld) => (
                    <div key={ld.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
                      <div className="min-w-0">
                        {ld.name && <p className="text-sm font-medium text-foreground truncate">{ld.name}</p>}
                        {ld.email && <p className="text-xs text-muted-foreground truncate">{ld.email}</p>}
                        {ld.phone && <p className="text-xs text-muted-foreground truncate">{ld.phone}</p>}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{new Date(ld.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <button type="button" aria-label="Remover" onClick={() => deleteLead.mutate(ld.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
              </>
            )}
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
  const [rawThumbSrc, setRawThumbSrc] = useState<string | null>(null);
  const [thumbCropOpen, setThumbCropOpen] = useState(false);

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
    let next = url.trim();
    if (next && next !== "https://") {
      if (!/^https?:\/\//i.test(next)) next = "https://" + next;
      const safe = sanitizeUrl(next);
      if (!safe) { toast.error("Link inválido, confira o endereço."); return; }
      next = safe;
    }
    if (next !== link.url) onUpdate(link.id, { url: next });
  };
  const commitIcon = () => {
    const next = icon || null;
    if (next !== (link.icon ?? null)) onUpdate(link.id, { icon: next });
  };

  const handleThumbSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validation = validateUpload(file, "bioMedia");
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawThumbSrc(reader.result as string);
      setThumbCropOpen(true);
    };
    reader.onerror = () => toast.error("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  const handleThumbCropped = async (croppedBlob: Blob) => {
    if (!userId) return;
    try {
      setUploadingThumb(true);
      const path = `${userId}/thumb-${link.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("bio-media")
        .upload(path, croppedBlob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("bio-media").getPublicUrl(path);
      onUpdate(link.id, { thumbnail_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success("Imagem atualizada!");
    } catch {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingThumb(false);
      setRawThumbSrc(null);
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
    <>
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={cn(
        "group relative bg-background rounded-xl border border-border p-3 transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...provided.dragHandleProps}
          className="text-muted-foreground hover:text-foreground touch-none mt-2"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Thumbnail picker */}
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          onChange={handleThumbSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => thumbInputRef.current?.click()}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-dashed border-border bg-muted/40 hover:border-primary transition-colors flex items-center justify-center overflow-hidden shrink-0"
          aria-label="Imagem do link"
        >
          {uploadingThumb ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : link.thumbnail_url ? (
            <img src={link.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              onBlur={commitIcon}
              placeholder="🔗"
              className="h-9 w-11 text-center rounded-lg shrink-0"
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
              className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50 shrink-0"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
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
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 to-pink-400"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-6 text-right">
                {clicks}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    {rawThumbSrc && (
      <ImageCropModal
        open={thumbCropOpen}
        onOpenChange={(open) => {
          setThumbCropOpen(open);
          if (!open) setRawThumbSrc(null);
        }}
        imageSrc={rawThumbSrc}
        onCropComplete={handleThumbCropped}
        aspectRatio={16 / 9}
        cropShape="rect"
      />
    )}
    </>
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
  const fontStack = fontStackFor(settings.fontFamily);

  if (settings.layout === "vitrine") {
    return <VitrinePreview profile={profile} settings={settings} />;
  }

  return (
    <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
      <BioFontStyle stack={fontStack} />
      <div
        className="bio-font-scope relative w-full h-[560px] rounded-[32px] overflow-y-auto"
        style={backgroundStyle(settings)}
      >
        <BgOverlay amount={settings.bgOverlay} />
        <div className="relative z-10 px-5 py-7 flex flex-col items-center min-h-full">
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
                {(settings.header?.avatar || profile.avatar_url) ? (
                  <img src={settings.header?.avatar || profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-display font-bold text-2xl">
                    {getInitial(settings.header?.name || profile.name)}
                  </span>
                )}
              </div>
            </div>
            <h3 className="font-display font-bold text-base text-gray-900 text-center drop-shadow-sm">
              {settings.header?.name || profile.name || "Seu nome"}
            </h3>
            {(settings.header?.bio || profile.bio) && (
              <p className="text-xs text-gray-800 text-center mt-1 line-clamp-3 font-body drop-shadow-sm">
                {settings.header?.bio || profile.bio}
              </p>
            )}
          </>
        )}

        <div className="w-full mt-5 space-y-2.5">
          {settings.sections.filter((s) => s.on).map((sec) => {
            if (sec.id === "banner") {
              return settings.bannerImage ? (
                <img key="banner" src={settings.bannerImage} alt="" loading="lazy" className="w-full rounded-xl object-cover max-h-24" />
              ) : null;
            }
            if (sec.id === "about") {
              if (!settings.about.text && !settings.about.image) return null;
              return (
                <div key="about" className="w-full rounded-xl bg-white/90 overflow-hidden text-left shadow-sm">
                  {settings.about.image && <img src={settings.about.image} alt="" loading="lazy" className="w-full max-h-28 object-cover" />}
                  <div className="p-3">
                    {settings.about.title && <p className="font-display font-bold text-xs text-gray-900 mb-1">{settings.about.title}</p>}
                    {settings.about.text && <p className="text-[11px] text-gray-700 whitespace-pre-line line-clamp-4">{settings.about.text}</p>}
                  </div>
                </div>
              );
            }
            if (sec.id === "lead") {
              return (
                <div key="lead" className="w-full rounded-xl bg-white/90 shadow-sm p-3 text-center">
                  <p className="font-display font-bold text-xs text-gray-900">{settings.lead.title}</p>
                  {settings.lead.subtitle && <p className="text-[10px] text-gray-600 mt-0.5 mb-2">{settings.lead.subtitle}</p>}
                  <div className="h-7 rounded-md bg-gray-100 mb-2" />
                  <div className="h-7 rounded-md font-semibold text-[11px] flex items-center justify-center" style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor }}>
                    {settings.lead.buttonText}
                  </div>
                </div>
              );
            }
            return links.length === 0 ? (
              <p key="links-empty" className="text-xs text-center text-gray-500 font-body py-6">
                Adicione links para ver a prévia.
              </p>
            ) : (
              <div key="links" className="space-y-2.5">
                {links.map((link) =>
                  link.link_type === "header" ? (
                    <p key={link.id} className="text-center font-display font-bold text-sm text-gray-900 drop-shadow-sm pt-3 pb-1">
                      {link.title || "Título"}
                    </p>
                  ) : (
                    <div
                      key={link.id}
                      className={cn("w-full font-body font-semibold text-sm shadow-sm overflow-hidden", radius, isOutline && "border-2 bg-transparent")}
                      style={{
                        backgroundColor: isOutline ? "transparent" : settings.buttonColor,
                        color: settings.buttonTextColor,
                        borderColor: isOutline ? settings.buttonTextColor : undefined,
                      }}
                    >
                      {link.thumbnail_url && (
                        <div className="w-full aspect-video overflow-hidden">
                          <img src={link.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="px-4 py-3 text-center truncate">
                        {!link.thumbnail_url && link.icon && <span className="mr-1.5">{link.icon}</span>}
                        {link.title || "Sem título"}
                      </div>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
});

const VitrinePreview = memo(function VitrinePreview({ profile, settings }: { profile: PreviewProps["profile"]; settings: BioSettings }) {
  const base = settings.vitrine.baseColor;
  const name = settings.header?.name || profile?.name || "Seu nome";
  const bio = settings.header?.bio || profile?.bio || "";
  const activeSocials = SOCIAL_FIELDS.filter((f) => settings.socialLinks[f.key].trim());
  const fontStack = fontStackFor(settings.fontFamily);
  const untouchedBg = settings.bgType === "color" && settings.bgColor === DEFAULT_SETTINGS.bgColor;
  const vitrineBg: React.CSSProperties = untouchedBg ? { backgroundColor: "#F5F3E7" } : backgroundStyle(settings);

  return (
    <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
      <BioFontStyle stack={fontStack} />
      <div className="bio-font-scope relative w-full h-[560px] rounded-[32px] overflow-y-auto" style={vitrineBg}>
        <BgOverlay amount={settings.bgOverlay} />
        <div className="relative z-10">
        <div className="mx-4 mt-4">
          <div
            className="w-full h-40 rounded-2xl bg-cover bg-center shadow"
            style={{ backgroundColor: "#cfcabb", backgroundImage: settings.vitrine.cover ? `url(${settings.vitrine.cover})` : undefined }}
          />
        </div>
        <div className="px-4">
          <h3 className="font-display font-extrabold text-lg text-gray-900 mt-3 leading-tight">{name}</h3>
          {bio && <p className="text-xs text-gray-700 mt-1.5 whitespace-pre-line">{renderRichText(bio)}</p>}
          {activeSocials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {activeSocials.map((f) => (
                <span key={f.key} className="h-7 px-2.5 rounded-lg flex items-center text-[0.62rem] font-display font-bold tracking-wide text-white" style={{ backgroundColor: base }}>
                  {f.label.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {settings.vitrine.services.length > 0 && (
            <>
              <p className="font-display font-extrabold text-sm text-gray-900 mt-5 mb-2">Serviços</p>
              <div className="grid gap-2">
                {settings.vitrine.services.map((sv) => (
                  <div key={sv.id} className="h-14 rounded-xl overflow-hidden flex items-center justify-between" style={{ backgroundColor: base }}>
                    <span className="text-white font-display font-bold text-xs pl-3 truncate">{sv.title || "Serviço"}</span>
                    <span className="w-14 h-14 shrink-0 bg-cover bg-center" style={{ backgroundColor: "#b9b4a6", backgroundImage: sv.image ? `url(${sv.image})` : undefined }} />
                  </div>
                ))}
              </div>
            </>
          )}

          {settings.vitrine.products.length > 0 && (
            <>
              <p className="font-display font-extrabold text-sm text-gray-900 mt-5 mb-2">Infoprodutos</p>
              <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {settings.vitrine.products.map((pr) => (
                  <div key={pr.id} className="shrink-0 w-40 rounded-2xl overflow-hidden shadow" style={{ backgroundColor: base }}>
                    <div className="h-24 bg-cover bg-center" style={{ backgroundColor: "#b9b4a6", backgroundImage: pr.cover ? `url(${pr.cover})` : undefined }} />
                    <div className="px-2.5 py-2 text-white">
                      <b className="font-display font-bold text-xs leading-tight block">{pr.title || "Infoproduto"}</b>
                      {pr.desc && <p className="text-[0.62rem] text-white/80 leading-snug mt-1 whitespace-pre-line line-clamp-3">{renderRichText(pr.desc)}</p>}
                      <span className="font-display font-bold text-[0.62rem] text-white underline decoration-2 underline-offset-2 mt-1.5 inline-block" style={{ textDecorationColor: "#FFCF03" }}>
                        {pr.ctaText || "Garanta o seu"} →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-center py-5">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-500">
            feito com <img src="/logo-cria.png" alt="Cria" style={{ height: 14 }} />
          </span>
        </div>
        </div>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────────────────────
// Vitrine editors
// ────────────────────────────────────────────────────────────

function ReorderControls({ index, total, onMove }: { index: number; total: number; onMove: (index: number, dir: -1 | 1) => void }) {
  return (
    <div className="flex flex-col -my-1">
      <button type="button" aria-label="Subir" onClick={() => onMove(index, -1)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button type="button" aria-label="Descer" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

function VitrineServiceEditor({
  item, index, total, onUpdate, onRemove, onMove, onUploadImage,
}: {
  item: VitrineService;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<VitrineService>) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await onUploadImage(file);
    if (url) onUpdate(item.id, { image: url });
    setUploading(false);
  };
  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <ReorderControls index={index} total={total} onMove={onMove} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative w-14 h-14 rounded-lg border border-dashed border-border bg-muted/40 hover:border-primary transition-colors flex items-center justify-center overflow-hidden shrink-0"
          aria-label="Imagem do serviço"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Input value={item.title} onChange={(e) => onUpdate(item.id, { title: e.target.value })} placeholder="Título do serviço" className="h-9 rounded-lg flex-1 min-w-0" maxLength={80} />
        <button type="button" onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50 shrink-0" aria-label="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <RichTextInput value={item.desc} onChange={(v) => onUpdate(item.id, { desc: v })} placeholder="Descrição (opcional)" rows={2} />
      <Input value={item.url} onChange={(e) => onUpdate(item.id, { url: e.target.value })} placeholder="https://" className="h-8 rounded-lg text-xs font-mono" maxLength={500} />
    </div>
  );
}

function VitrineProductEditor({
  item, index, total, onUpdate, onRemove, onMove, onUploadImage,
}: {
  item: VitrineProduct;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<VitrineProduct>) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await onUploadImage(file);
    if (url) onUpdate(item.id, { cover: url });
    setUploading(false);
  };
  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <ReorderControls index={index} total={total} onMove={onMove} />
        <Input value={item.title} onChange={(e) => onUpdate(item.id, { title: e.target.value })} placeholder="Título do infoproduto" className="h-9 rounded-lg flex-1 min-w-0" maxLength={80} />
        <button type="button" onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50 shrink-0" aria-label="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {item.cover ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={item.cover} alt="Capa" loading="lazy" className="w-full h-24 object-cover" />
          <button type="button" onClick={() => onUpdate(item.id, { cover: null })} className="absolute top-1.5 right-1.5 bg-background/90 rounded-full p-1 shadow">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-4 w-4 mr-2" />
        {uploading ? "Enviando..." : item.cover ? "Trocar capa" : "Enviar capa"}
      </Button>
      <RichTextInput value={item.desc} onChange={(v) => onUpdate(item.id, { desc: v })} placeholder="Descrição (opcional)" rows={2} />
      <Input value={item.ctaText} onChange={(e) => onUpdate(item.id, { ctaText: e.target.value })} placeholder="Texto do CTA" className="h-9 rounded-lg" maxLength={40} />
      <Input value={item.url} onChange={(e) => onUpdate(item.id, { url: e.target.value })} placeholder="https://" className="h-8 rounded-lg text-xs font-mono" maxLength={500} />
    </div>
  );
}

export default LinkInBio;
