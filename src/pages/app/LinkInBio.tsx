import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Facebook,
  Loader2,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Download,
  Check,
  X,
  Crop,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeUrl } from "@/lib/sanitize";
import { RichTextInput } from "@/lib/richText";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBioLinks, type BioLink } from "@/hooks/useBioLinks";
import { useBioAlvo } from "@/contexts/BioAlvoContext";
import { useBioBlocks } from "@/hooks/useBioBlocks";
import { EditorBlocos } from "@/components/bio/EditorBlocos";
import { SiteBio, type ItemLite } from "@/components/bio/SiteBio";
import { useBioItems } from "@/hooks/useBioItems";
import type { AparenciaModelo } from "@/lib/bioTemplates";
import { PainelDesempenho } from "@/components/bio/PainelDesempenho";
import { BlocoPublico } from "@/components/bio/BlocoPublico";
import { corDeDestaque, corSobre, nomeDaMarcaSite } from "@/lib/bioBlocks";
import type { BioBloco, EstiloBio } from "@/lib/bioBlocks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { validateUpload } from "@/lib/upload-validation";
import { useBioLeads } from "@/hooks/useBioLeads";
import { confirmar } from "@/components/shared/Confirm";
import { escapeCsvCell } from "@/lib/csv";

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
  facebook: string;
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
  /* A seção "links" fica SEMPRE ligada. O interruptor dela era um jeito fácil
     de esvaziar a própria página sem entender por quê, e com os blocos ela
     deixou de ser uma seção pra virar o lugar onde a página inteira mora. */
  for (const s of out) { if (s.id === "links") s.on = true; }
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
  // Cor dos CARDS (Sobre mim e Captura de lead). Vazio = branco translúcido,
  // o visual antigo. Existe porque o card era fixo e não seguia a identidade.
  cardColor: string;
  cardTextColor: string;
  // Cor do nome e da bio no topo. Vazio = automática (contraste com o fundo).
  // Nasceu do pedido da Gabi: "não consigo alterar a cor do título/subtítulo".
  headerColor: string;
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
  cardColor: "",
  cardTextColor: "",
  headerColor: "",
  socialLinks: { instagram: "", tiktok: "", youtube: "", twitter: "", facebook: "" },
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

/* Quais blocos têm faixa própria e portanto fundo. Capa e rodapé têm desenho
   fixo, e mexer no fundo deles quebra o contraste do menu e da assinatura. */
const SECOES_COM_FUNDO = new Set(["sobre", "produtos", "blog", "depoimentos", "texto", "captura", "mapa", "faq"]);

/** Luminância aproximada, só pra decidir se o tema é claro ou escuro. */
function temaEscuro(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

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
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "sua-pagina",
    icon: Facebook,
    urlBuilder: (h) => {
      const v = h.trim();
      if (/^https?:\/\//.test(v)) return v;
      return `https://facebook.com/${v.replace(/^@/, "")}`;
    },
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
    cardColor: typeof t.cardColor === "string" ? t.cardColor : "",
    cardTextColor: typeof t.cardTextColor === "string" ? t.cardTextColor : "",
    headerColor: typeof t.headerColor === "string" ? t.headerColor : "",
    socialLinks: {
      instagram: typeof socialRaw.instagram === "string" ? socialRaw.instagram : "",
      tiktok: typeof socialRaw.tiktok === "string" ? socialRaw.tiktok : "",
      youtube: typeof socialRaw.youtube === "string" ? socialRaw.youtube : "",
      twitter: typeof socialRaw.twitter === "string" ? socialRaw.twitter : "",
      facebook: typeof socialRaw.facebook === "string" ? socialRaw.facebook : "",
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

// Campo de imagem de fundo com preview ajustável (zoom, rotação, reposição).
// Ao escolher, abre o ImageCropModal no formato retrato (9:16) da bio; ao
// confirmar, a imagem já sai "assada" (crop + zoom + rotação) e sobe pronta.
// A página pública só usa bgImage com background-size cover, então não precisa
// mais dos controles de encaixe/posição (os campos antigos seguem no parse
// defensivo, sem quebrar quem já salvou).
function BgImageField({
  bgImage,
  uploading,
  onBake,
  onRemove,
}: {
  bgImage: string | null;
  uploading: boolean;
  onBake: (blob: Blob) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // A bio é vertical no celular, mas quem abre no computador vê a imagem
  // esticada. Aqui a pessoa escolhe o recorte antes de ajustar.
  const [enquadre, setEnquadre] = useState<"retrato" | "paisagem">("retrato");

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setRawSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.onerror = () => toast.error("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  // Reajustar: reabre o preview. Se a imagem original desta sessão ainda estiver
  // em memória, usa ela; senão cai na imagem já salva (best-effort via CORS).
  const reopenAdjust = () => {
    if (rawSrc) {
      setCropOpen(true);
      return;
    }
    if (bgImage) {
      setRawSrc(bgImage);
      setCropOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" onChange={handleSelect} className="hidden" />
      {bgImage ? (
        <>
          <div className="relative w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: "9 / 16", maxHeight: 220 }}>
            <img src={bgImage} alt="Fundo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={reopenAdjust}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crop className="h-4 w-4 mr-2" />}
              {uploading ? "Enviando..." : "Reajustar"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Trocar imagem
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={uploading} onClick={onRemove}>
              <Trash2 className="h-4 w-4 mr-2" /> Remover
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-primary text-sm text-muted-foreground transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Enviando..." : "Escolher imagem de fundo"}
        </button>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground">Enquadrar como:</span>
        {([["retrato", "Celular (9:16)"], ["paisagem", "Computador (16:9)"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setEnquadre(k)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-body font-semibold transition-colors ${
              enquadre === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {l}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        Ajuste zoom, rotação e posição no formato escolhido. A imagem é salva já ajustada.
      </p>
      {rawSrc && (
        <ImageCropModal
          open={cropOpen}
          onOpenChange={(o) => {
            setCropOpen(o);
            if (!o) setRawSrc(null);
          }}
          imageSrc={rawSrc}
          onCropComplete={onBake}
          aspectRatio={enquadre === "paisagem" ? 16 / 9 : 9 / 16}
          cropShape="rect"
        />
      )}
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
// bio_pages é tabela nova e ainda não está nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

/* ═══════════════════════════════════════════════════════════════════════════
   OS PASSOS DO EDITOR

   Antes a tela era uma pilha de nove cards na mesma hierarquia: link público,
   desempenho, blocos, estrutura, perfil, aparência, leads. Quem abria pela
   primeira vez não sabia por onde começar, e quem já tinha montado tropeçava
   nos cards de configuração antes de chegar no conteúdo.

   Agora é a ordem de quem monta de verdade: escolhe o estilo, monta o
   conteúdo, dá a cara, publica, acompanha. Cada passo é um título numerado
   com uma frase explicando pra que serve.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   A PRÉVIA QUE ACOMPANHA A ROLAGEM

   Isto deveria ser uma linha de CSS (`position: sticky`) e foi, três vezes.
   Nesta árvore ela não pega: com o editor aberto e alto, a prévia sobe junto
   com a página em vez de grudar. Varri a cadeia inteira de ancestrais atrás
   dos suspeitos de sempre (overflow que vira contêiner de rolagem, contain,
   content-visibility, altura travada) e não achei nenhum. Sem conseguir
   reproduzir aqui, cada tentativa nova era um palpite caro.

   Então a prévia passa a ser posicionada por medição, que não depende de
   descobrir quem está sabotando o sticky:

   - o TRILHO é a grade inteira, e não a coluna da direita. A altura da grade
     é a da linha, ou seja, a do editor, e ela é a mesma tenha a coluna
     esticado ou não. Isso tira do caminho justamente a dúvida que sobrou.
   - o deslocamento é `transform`, não `top`: não mexe no layout, não força
     recálculo de largura e não briga com o `overflow` do painel.
   - `capture: true` no scroll porque o evento de rolagem não borbulha. Se
     quem rola for algum contêiner interno em vez da janela, ainda assim
     chega aqui.

   O limite embaixo (`sobra`) é o que impede a prévia de passar do fim do
   formulário e sair flutuando sozinha no rodapé. */
function usePainelGrudado(topo = 16) {
  const trilho = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const largo = window.matchMedia("(min-width: 1024px)");
    let quadro = 0;

    const posicionar = () => {
      quadro = 0;
      const t = trilho.current;
      const p = painel.current;
      if (!t || !p) return;
      // No celular a prévia fica embaixo do editor, em coluna: nada a grudar.
      if (!largo.matches) { p.style.transform = ""; return; }
      const sobra = t.offsetHeight - p.offsetHeight;
      if (sobra <= 0) { p.style.transform = ""; return; }
      const y = Math.min(Math.max(topo - t.getBoundingClientRect().top, 0), sobra);
      p.style.transform = y > 0 ? `translate3d(0, ${Math.round(y)}px, 0)` : "";
    };

    const agendar = () => { if (!quadro) quadro = requestAnimationFrame(posicionar); };

    posicionar();
    window.addEventListener("scroll", agendar, { passive: true, capture: true });
    window.addEventListener("resize", agendar);
    largo.addEventListener("change", agendar);
    // Abrir um card faz o editor crescer, e o trilho junto. Sem observar isso,
    // a prévia continuaria calculada pela altura antiga.
    const observador = new ResizeObserver(agendar);
    if (trilho.current) observador.observe(trilho.current);
    if (painel.current) observador.observe(painel.current);

    return () => {
      if (quadro) cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", agendar, { capture: true });
      window.removeEventListener("resize", agendar);
      largo.removeEventListener("change", agendar);
      observador.disconnect();
    };
  }, [topo]);

  return { trilho, painel };
}

type AbaBio = "conteudo" | "visual" | "publicar" | "resultados";

/* A ordem é a do trabalho: monta, deixa com a cara da marca, publica, e só
   então acompanha. Quem entra pela segunda vez em diante costuma ir direto na
   primeira ou na última. */
const ABAS_BIO: { id: AbaBio; nome: string }[] = [
  { id: "conteudo", nome: "Conteúdo" },
  { id: "visual", nome: "Visual" },
  { id: "publicar", nome: "Publicar" },
  { id: "resultados", nome: "Resultados" },
];

/** O título de cada aba já está no botão dela, então aqui sobra só a frase que
 *  explica o que fazer. Repetir o nome logo abaixo do botão aceso era ruído. */
function Aba({ explica, marca, children }: { explica: string; marca?: string; children: ReactNode }) {
  return (
    <section data-tour={marca} className="space-y-3">
      <p className="text-[11.5px] font-body text-muted-foreground leading-snug px-0.5 pt-0.5">{explica}</p>
      {children}
    </section>
  );
}

/* Quantos leads chegaram desde a última vez que ela abriu Resultados. Sem isto
   a aba fica muda e o lead dorme: ninguém abre um painel de métricas por
   hábito, mas todo mundo olha uma bolinha vermelha. */
const CHAVE_LEADS_VISTOS = "cria:bio:leads-vistos";
function useLeadsNovos(leads: { id: string; created_at: string }[], aba: AbaBio) {
  const [visto, setVisto] = useState<number>(() => {
    const g = Number(localStorage.getItem(CHAVE_LEADS_VISTOS) ?? 0);
    return Number.isFinite(g) ? g : 0;
  });
  useEffect(() => {
    if (aba !== "resultados") return;
    const agora = Date.now();
    localStorage.setItem(CHAVE_LEADS_VISTOS, String(agora));
    setVisto(agora);
  }, [aba, leads.length]);
  // Na primeira visita (nunca marcou nada) não acusa nada: um badge com o
  // histórico inteiro no primeiro acesso é alarme falso.
  if (!visto) return 0;
  return leads.filter((l) => new Date(l.created_at).getTime() > visto).length;
}

const LinkInBio = () => {
  const [aba, setAba] = useState<AbaBio>("conteudo");
  const { trilho: trilhoDaPrevia, painel: painelDaPrevia } = usePainelGrudado();
  const { user } = useAuth();
  const alvo = useBioAlvo();
  const { activeAccountId } = useActiveAccount();
  const { profile: selfProfile, updateProfile, isLoading: selfProfileLoading } = useProfile();
  const { links, isLoading, createLink, updateLink, deleteLink, reorderLinks } = useBioLinks();
  // O formato novo da página. Enquanto a migration dos blocos não roda, a lista
  // volta vazia e a tela continua mostrando o editor antigo de links, pra
  // ninguém ficar sem conseguir mexer na bio que já está no ar.
  const { blocos: blocosClassico } = useBioBlocks("classico");
  // Os do modo Site, pra saber quando a Vitrine antiga pode sair de cena.
  const { blocos: blocosSite, atualizar: atualizarBlocoSite } = useBioBlocks("site");
  // Os itens do Site alimentam as seções de Produtos e de Blog na prévia.
  const { itens: produtosDoSite } = useBioItems("produto");
  const { itens: postsDoSite } = useBioItems("post");
  const queryClient = useQueryClient();

  // Quando o manager gerencia outro, lê/escreve no profile da conta ATIVA,
  // não no useProfile (que controla auth/gate da SESSÃO).
  const ownerId = (alvo?.tipo === "conta" ? alvo.ownerId : activeAccountId) || user?.id || "";
  const isOwnAccount = !alvo && (!activeAccountId || activeAccountId === user?.id);
  const managedProfileKey = ["bio-profile", ownerId] as const;

  type BioProfileSubset = Pick<
    Profile,
    "id" | "name" | "avatar_url" | "niche" | "instagram_handle" | "bio" | "bio_slug" | "bio_settings"
  >;

  const { data: managedProfile, isLoading: managedLoading } = useQuery<BioProfileSubset | null>({
    queryKey: managedProfileKey,
    enabled: !!ownerId && !isOwnAccount,
    queryFn: async () => {
      // Caminho seguro: RPC SECURITY DEFINER devolve SO colunas nao sensiveis
      // (sem stripe/pix/subscription). Funciona pro dono e pro membro ativo.
      const { data, error } = await sbRpc("get_managed_profile", { _owner: ownerId });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] ?? null) : null;
      return row as BioProfileSubset | null;
    },
  });

  /* ── A PÁGINA DE UM CLIENTE SEM CONTA CRIA ──
     Esse cliente não tem linha em profiles, então a página dele mora em
     bio_pages. Aqui a gente monta um objeto com a MESMA cara de um perfil
     (nome, foto, endereço, aparência) pra que o resto desta tela, que são
     milhares de linhas, não precise saber de onde os dados vieram. */
  const daFicha = alvo?.tipo === "ficha" ? alvo : null;
  const { data: fichaBio, isLoading: fichaLoading } = useQuery<BioProfileSubset | null>({
    queryKey: ["bio-page-profile", daFicha?.pageId ?? ""],
    enabled: !!daFicha,
    queryFn: async () => {
      const [pg, cli] = await Promise.all([
        sbFrom("bio_pages").select("id, slug, settings, views").eq("id", daFicha!.pageId).maybeSingle(),
        sbFrom("crm_clients").select("name, display_name, logo, segment, instagram").eq("id", daFicha!.crmClientId).maybeSingle(),
      ]);
      const page = pg.data as { id: string; slug: string | null; settings: unknown; views: number | null } | null;
      if (!page) return null;
      const c = (cli.data ?? {}) as { name?: string; display_name?: string | null; logo?: string | null; segment?: string | null; instagram?: string | null };
      return {
        id: page.id,
        name: c.display_name || c.name || "Cliente",
        avatar_url: c.logo ?? null,
        niche: c.segment ?? null,
        instagram_handle: c.instagram ?? null,
        bio: null,
        bio_slug: page.slug,
        bio_settings: page.settings,
        // O contador desta página mora em bio_pages.views. Entra aqui com o
        // mesmo nome de sempre pra o painel de visitas não precisar saber disso.
        bio_views: page.views ?? 0,
      } as unknown as BioProfileSubset;
    },
  });

  const profile = (daFicha ? fichaBio : (isOwnAccount ? selfProfile : managedProfile)) as Profile | null;
  const profileLoading = daFicha ? fichaLoading : (isOwnAccount ? selfProfileLoading : managedLoading);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const isSavingAppearance = isOwnAccount ? updateProfile.isPending : savingAppearance;

  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [settings, setSettings] = useState<BioSettings>(DEFAULT_SETTINGS);
  const { leads, isLoading: leadsLoading, deleteLead } = useBioLeads();
  const leadsNovos = useLeadsNovos(leads, aba);
  const exportLeadsCsv = () => {
    const rows = [["Nome", "Email", "Telefone", "Data"], ...leads.map((l) => [l.name ?? "", l.email ?? "", l.phone ?? "", new Date(l.created_at).toLocaleString("pt-BR")])];
    // escapeCsvCell: além de escapar aspas, neutraliza injeção de fórmula (=,+,-,@,TAB,CR).
    const csv = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
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
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  /* BUG (31/08): a pessoa montava a bio, abria a página pública em outra aba
     pra testar e, ao VOLTAR, tudo que não estava salvo sumia. O retorno do
     foco faz o react-query refazer o fetch do perfil; bio_settings volta como
     um objeto NOVO (mesmo conteúdo, outra referência), este efeito rodava de
     novo e descartava o estado local. Regra agora: só re-hidrata do servidor
     quando NÃO há mudança não salva, ou quando a conta ativa trocou. */
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = appearanceDirty; }, [appearanceDirty]);
  const hydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profile) return;
    const trocouConta = hydratedForRef.current !== profile.id;
    if (!trocouConta && dirtyRef.current) return;
    hydratedForRef.current = profile.id;
    setSlug(profile.bio_slug ?? "");
    setSettings(parseSettings(profile.bio_settings));
    setAppearanceDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Recebe o blob já ajustado/assado pelo preview (crop + zoom + rotação) e sobe
  // como imagem de fundo. Como sai pronta, a página pública usa cover direto.
  const handleBgBake = async (blob: Blob) => {
    if (!user) return;
    setUploadingBg(true);
    const file = new File([blob], `bg-${Date.now()}.jpg`, { type: "image/jpeg" });
    const url = await uploadBioImage(file, "bg");
    if (url) {
      setSettings((s) => ({ ...s, bgType: "image", bgImage: url }));
      setAppearanceDirty(true);
    }
    setUploadingBg(false);
  };

  const handleBgRemove = () => {
    setSettings((s) => ({ ...s, bgImage: null }));
    setAppearanceDirty(true);
  };

  const uploadBioImage = async (file: File, prefix: string): Promise<string | null> => {
    const validation = validateUpload(file, "bioMedia");
    if (!validation.ok) { toast.error(validation.reason); return null; }
    // A pasta é a de quem está logado, e não a do dono da página: a policy do
    // bucket compara com auth.uid(). Com o ownerId aqui, a gestora subindo
    // imagem pra página de um cliente levava "não autorizado".
    const path = `${user?.id ?? ownerId}/${prefix}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
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

  /* patchAbout, patchLead e a Vitrine inteira (capa, serviços, produtos) saíram
     daqui. "Sobre mim" e "Captura de lead" viraram blocos, e a Vitrine virou o
     modo Site, também montado por blocos. Os dados continuam no bio_settings
     salvo, mas quem escreve neles agora é o editor de blocos. */

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
      if (daFicha) {
        setSavingAppearance(true);
        // .select() de propósito: sem ele, um bloqueio de permissão volta como
        // "0 linhas alteradas" SEM erro, e a tela diria "salvo" sem ter salvo.
        const { data: salvo, error } = await sbFrom("bio_pages")
          .update({ slug: cleanSlug, settings, updated_at: new Date().toISOString() })
          .eq("id", daFicha.pageId).select("id").maybeSingle();
        if (error) throw error;
        if (!salvo) throw new Error("Não consegui salvar esta página. Recarregue e tente de novo.");
        queryClient.invalidateQueries({ queryKey: ["bio-page-profile", daFicha.pageId] });
        // Prefixo: a chave real é ["bio-page", agencyOwnerId, crmClientId].
        queryClient.invalidateQueries({ queryKey: ["bio-page"] });
        queryClient.invalidateQueries({ queryKey: ["bio-pages"] });
      } else if (isOwnAccount) {
        await updateProfile.mutateAsync({
          bio_slug: cleanSlug,
          bio_settings: settings as unknown as never,
        });
      } else {
        // Conta de cliente: o update direto em profiles casava ZERO linhas (não
        // existe policy de UPDATE pra gestora) e a tela dizia "salvo" mesmo
        // assim. A RPC valida o vínculo e grava de verdade.
        const alvoId = alvo?.tipo === "conta" ? alvo.ownerId : activeAccountId;
        if (!alvoId) throw new Error("Conta ativa não identificada.");
        setSavingAppearance(true);
        const { error } = await sbRpc("manager_save_client_bio", {
          _owner: alvoId, _slug: cleanSlug, _settings: settings,
        });
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

  /** Modelo aplicado: a aparência dele substitui a atual. Estrutura acrescenta,
   *  aparência troca, porque duas cores ao mesmo tempo não existe. */
  const aplicarAparenciaDoModelo = (a: AparenciaModelo) => {
    setSettings((x) => ({
      ...x,
      bgType: a.bgType, bgColor: a.bgColor, bgGradient: a.bgGradient,
      buttonColor: a.buttonColor, buttonTextColor: a.buttonTextColor,
      buttonStyle: a.buttonStyle,
      cardColor: a.cardColor, cardTextColor: a.cardTextColor,
      fontFamily: a.fontFamily,
    }));
    setAppearanceDirty(true);
    toast.success("Modelo aplicado. Confira a prévia e clique em Salvar aparência.");
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

    /* NO SITE O TEMA TAMBÉM PINTA AS SEÇÕES.
       Antes ele mexia só no fundo da página, e no Site fundo de página não
       existe: quem manda é o "Fundo da seção" de cada bloco. Resultado, metade
       do tema não fazia nada e a pessoa clicava esperando ver o site mudar.

       Agora ele preenche seção por seção, alternando pra a página não virar uma
       parede de uma cor só, e continua dando pra ajustar bloco a bloco depois:
       isto é um ponto de partida, não uma trava. */
    if (settings.layout !== "vitrine") return;
    const escuro = temaEscuro(theme.bg);
    let i = 0;
    for (const b of blocosSite) {
      if (!SECOES_COM_FUNDO.has(b.kind)) continue;
      const fundo = escuro
        ? (i % 2 === 0 ? "escuro" : "claro")
        : (i % 2 === 0 ? "claro" : "creme");
      i += 1;
      const atual = (b.data ?? {}) as Record<string, unknown>;
      if (atual.fundo === fundo) continue;
      atualizarBlocoSite.mutate({ id: b.id, patch: { data: { ...atual, fundo } } });
    }
  };

  const patchSocial = (key: keyof SocialLinks, value: string) => {
    setSettings((s) => ({ ...s, socialLinks: { ...s.socialLinks, [key]: value } }));
    setAppearanceDirty(true);
  };

  /* O card "Estrutura da página" saiu. Ele ligava e ordenava seções fixas
     (banner, sobre, links, captura) que hoje são BLOCOS: a pessoa liga e
     arrasta bloco por bloco no passo 2. Ter os dois era pedir pra alguém
     desligar a seção "links" e não entender por que a página ficou vazia.
     As seções continuam no objeto salvo pra não quebrar quem já montou. */

  /* Um editor de blocos só, que troca de estilo. O key força remontar: sem
     ele o formulário aberto de um bloco do Clássico ficava na tela depois de
     trocar pro Site, mostrando campos de outro bloco. */
  const estiloBlocos: EstiloBio = settings.layout === "vitrine" ? "site" : "classico";

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

        {/* A prévia é um celular de largura FIXA (300px + moldura), então a
            coluna dela é fixa também. Como fração (1fr) ela virava refém do
            editor: bastava um link comprido sem espaço, um do WhatsApp com
            parâmetros, pra coluna do editor exigir a largura inteira do texto e
            espremer a prévia num filete de dois dedos, com o título caindo uma
            letra por linha. minmax(0,1fr) é o que autoriza o editor a encolher:
            coluna de grid não encolhe abaixo do próprio conteúdo por padrão. */}
        <div ref={trilhoDaPrevia} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_356px] gap-6">
          {/* ── Editor ──────────────────────────────── */}
          <div className="space-y-5 min-w-0">
            {/* ── A BARRA DE COMANDO ───────────────────────────────────────
                Antes esta tela era um rolo único de cinco passos, onde escolher
                a fonte (uma vez na vida) tinha o mesmo peso e o mesmo lugar que
                conferir um lead novo (toda semana). E o endereço público, que é
                a única coisa que a pessoa vem buscar com pressa, ficava no
                passo 4, a três telas de rolagem.

                Agora o que é constante mora aqui em cima, grudado: o estilo, o
                Salvar, o endereço e as quatro abas. O resto é conteúdo de aba. */}
            <div data-tour="bio-estilo" className="sticky top-0 z-30 rounded-2xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-[15px] font-display font-bold text-foreground leading-tight truncate">Sua página</h2>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex gap-1 rounded-full border border-primary/15 bg-primary/[0.06] p-1">
                  {([
                    { id: "classic", label: "Clássico" },
                    { id: "vitrine", label: "Site" },
                  ] as { id: BioSettings["layout"]; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchSettings({ layout: opt.id })}
                      className={cn(
                        "px-5 py-1.5 rounded-full text-sm font-display font-semibold transition-colors",
                        settings.layout === opt.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-primary/70 hover:text-primary hover:bg-primary/10"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* O ENDEREÇO, sempre à mão. É o que se copia pra colar na bio
                    do Instagram, e era o campo mais escondido da tela. */}
                {publicPath && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="hidden xl:inline text-[11px] font-body text-muted-foreground truncate max-w-[210px]">
                      criasocialclub.com/bio/{slug || profile?.bio_slug}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 px-2.5" title="Copiar o endereço">
                      <Copy className="h-3.5 w-3.5" />
                      <span className="ml-1.5 hidden sm:inline text-xs">Copiar</span>
                    </Button>
                    <a href={publicPath} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 px-2.5" title="Abrir a página pública">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="ml-1.5 hidden sm:inline text-xs">Abrir</span>
                      </Button>
                    </a>
                  </div>
                )}
              </div>

              {/* AS ABAS. Rolam na horizontal no celular em vez de quebrar em
                  duas linhas e comer a altura da barra fixa. */}
              {/* Pílulas com contorno: sem elas as abas apagadas eram texto
                  solto no creme e a barra inteira sumia. Agora se lê como um
                  seletor mesmo antes de alguém clicar. */}
              <div className="mt-3 -mx-1 px-1 flex gap-1.5 overflow-x-auto pb-0.5">
                {ABAS_BIO.map((t) => {
                  const ativa = aba === t.id;
                  const alerta = t.id === "resultados" && leadsNovos > 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAba(t.id)}
                      aria-current={ativa ? "page" : undefined}
                      className={cn(
                        "relative shrink-0 px-4 h-9 rounded-full text-[13px] font-display font-semibold border transition-colors",
                        ativa
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/[0.06]",
                      )}>
                      {t.nome}
                      {alerta && (
                        <span
                          aria-label={`${leadsNovos} lead(s) novo(s)`}
                          className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                          {leadsNovos > 9 ? "9+" : leadsNovos}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {aba === "conteudo" && (
            <Aba marca="bio-conteudo"
              explica="Cada pedaço da página é um bloco: link, texto, vídeo, formulário, endereço com mapa. Adicione, arraste pra ordenar e ligue quando estiver pronto.">
              {/* O CAMINHO EM 3 PASSOS (pedido do Walter, 01/09: o fluxo estava
                  "mal redigido e difícil de compreender"). Um parágrafo denso
                  virou três passos curtos e numerados: escolher o estilo,
                  montar os blocos, ajustar e publicar. É o mapa da tela. */}
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 space-y-2">
                {[
                  <>Escolha o estilo lá em cima: <strong className="font-semibold text-foreground/85">Clássico</strong> é
                  a página de bio (coluna de botões, um toque e sai); <strong className="font-semibold text-foreground/85">Site</strong> é
                  uma página completa, com seções, produtos e blog. Trocar não apaga nada: cada estilo guarda o seu.</>,
                  <>Monte de cima pra baixo: preencha <strong className="font-semibold text-foreground/85">o topo</strong> (banner,
                  foto, nome e redes) e depois os <strong className="font-semibold text-foreground/85">blocos</strong>. Arraste pra
                  ordenar; tudo salva sozinho e aparece na prévia do celular.</>,
                  <>Termine na aba <strong className="font-semibold text-foreground/85">Visual</strong> (cores, fonte e fundo)
                  e copie o seu link na aba <strong className="font-semibold text-foreground/85">Publicar</strong>.</>,
                ].map((passo, i) => (
                  <p key={i} className="flex items-start gap-2.5 text-[12px] font-body text-muted-foreground leading-snug">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-display font-bold grid place-items-center mt-px">
                      {i + 1}
                    </span>
                    <span>{passo}</span>
                  </p>
                ))}
              </div>
              {/* ── 1 · O TOPO DA PÁGINA (só no Clássico) ──
                  A aba agora segue a ordem da própria página: primeiro o que o
                  visitante vê ao abrir (banner, foto, nome, bio e redes),
                  depois os blocos. Antes isso morava na aba Visual e ninguém
                  achava (reclamação do Walter, 01/09: "fluxo difícil de
                  compreender"). */}
              {settings.layout === "classic" && (
              <Card className="p-4 md:p-5 rounded-2xl border-border space-y-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[12px] font-display font-bold grid place-items-center shrink-0">1</span>
                  <div>
                    <h2 className="font-display font-semibold text-foreground leading-tight">O topo da página</h2>
                    <p className="text-xs text-muted-foreground">Banner, foto, nome, bio e redes. É a primeira coisa que o visitante vê.</p>
                  </div>
                </div>

                {/* Banner (capa atrás da foto) */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-display font-semibold">Banner</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Imagem larga que preenche o topo, atrás da sua foto, como capa de perfil.</p>
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

                {/* Foto, nome e bio */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div>
                    <Label className="text-sm font-display font-semibold">Foto, nome e bio</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Deixe em branco pra usar o que já está no seu perfil.</p>
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
                  {/* Cor do nome e da bio: antes era automática e pronto, e a Gabi
                      não tinha como clarear o texto sobre uma foto escura. */}
                  <div className="flex items-end gap-3 flex-wrap pt-1">
                    <ColorField
                      value={settings.headerColor || "#1A2420"}
                      onChange={(v) => patchSettings({ headerColor: v })}
                      label="Cor do nome e da bio"
                    />
                    {settings.headerColor && (
                      <Button type="button" variant="ghost" size="sm" className="h-9"
                        onClick={() => patchSettings({ headerColor: "" })}>
                        Voltar à automática
                      </Button>
                    )}
                  </div>
                </div>

                {/* Redes sociais (ícones abaixo da bio) */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div>
                    <Label className="text-sm font-display font-semibold">Redes sociais</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Os ícones aparecem logo abaixo da bio.</p>
                  </div>
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
              </Card>
              )}

              {/* No Site o topo é a Capa: o nome e a foto do menu saem dela. */}
              {settings.layout === "vitrine" && (
                <p className="text-[11.5px] font-body text-muted-foreground leading-snug px-0.5">
                  O nome e a foto que aparecem no menu do site saem do <strong className="text-foreground/80">título
                  da Capa</strong> e da foto do seu perfil. É a primeira seção aqui embaixo.
                </p>
              )}

              <Card className="p-4 md:p-5 rounded-2xl border-border">
                <EditorBlocos key={estiloBlocos} estilo={estiloBlocos} aoAplicarAparencia={aplicarAparenciaDoModelo}
                  slugPublico={slug || profile?.bio_slug} numero={settings.layout === "classic" ? "2" : "1"} />
              </Card>

              {settings.layout === "classic" && blocosClassico.length === 0 && sortedLinks.length > 0 && (
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
                <p className="text-[11px] font-body text-muted-foreground mt-3">
                  Estes são os botões do formato antigo. Eles já viraram blocos lá em cima: edite por lá. Esta lista
                  some sozinha assim que você mexer no primeiro bloco.
                </p>
              </Card>
              )}
            </Aba>
            )}

            {aba === "visual" && (
            <Aba marca="bio-aparencia"
              explica="Cores, fonte, fundo e formato dos botões. O conteúdo do topo (foto, nome, banner e redes) mora na aba Conteúdo.">
              {/* O card de identidade, o banner e as redes MUDARAM pra aba
                  Conteúdo (01/09): são conteúdo do topo da página, e aqui no
                  Visual ninguém os achava. Esta aba ficou só com aparência. */}

              {/* ── Appearance ─────────────────────────── */}
              <Card className="p-4 md:p-5 rounded-2xl border-border space-y-6">
                <h2 className="font-display font-semibold text-foreground">Aparência</h2>

                {/* Fonte */}
                <div className="space-y-3">
                  <Label className="text-sm font-display font-semibold">Fonte</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Vale nos dois estilos. Cada opção mostra uma amostra da letra.
                  </p>
                  {/* DEZ AMOSTRAS ABERTAS ocupavam meia tela de rolagem por uma
                      escolha que se faz uma vez e não se mexe mais. Agora é um
                      campo só, e a grade abre por cima quando a pessoa quer. */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button"
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-border hover:border-primary/40 bg-background px-3.5 h-11 text-left transition-colors">
                        <span className="text-sm text-foreground truncate"
                          style={{ fontFamily: fontStackFor(settings.fontFamily) ?? undefined }}>
                          {BIO_FONTS.find((f) => f.value === settings.fontFamily)?.label ?? "Padrão"}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-2 rounded-2xl">
                  <div className="grid grid-cols-2 gap-2">
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
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Themes (presets) */}
                <div className="space-y-3">
                  <Label className="text-sm font-display font-semibold">Temas</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {settings.layout === "vitrine"
                      ? "Pinta as seções do site, a cor dos botões e o formato deles de uma vez. Depois dá pra ajustar seção por seção lá no Conteúdo."
                      : "Aplica fundo, cor e estilo dos botões de uma vez."}
                  </p>
                  {/* Oito retângulos altos numa coluna larga viravam meia tela
                      de amostra pra uma escolha de um clique. Fica mais gente
                      por linha, cada um baixinho: dá pra comparar todos sem
                      rolar, que é o que a pessoa quer aqui. */}
                  <div className="grid grid-cols-4 cq-sm:grid-cols-4 gap-2">
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
                            className="w-full h-14 rounded-xl border border-border overflow-hidden px-2.5 flex flex-col justify-center gap-[3px] transition-all group-hover:border-primary/40 group-hover:shadow-sm"
                            style={previewBg}
                          >
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-[3px] w-full",
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

                {/* FUNDO DA PÁGINA: só existe no Clássico.
                    No Site não há "fundo da página": quem pinta é o "Fundo da
                    seção" de cada bloco, e o tema preenche todos de uma vez.
                    Deixar o controle aqui era prometer uma mudança que não
                    acontecia, que é o mesmo defeito do card de identidade. */}
                {settings.layout === "classic" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-sm font-display font-semibold">Fundo</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Cor sólida, gradiente ou imagem atrás dos seus botões.
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
                    <>
                      <BgImageField
                        bgImage={settings.bgImage}
                        uploading={uploadingBg}
                        onBake={handleBgBake}
                        onRemove={handleBgRemove}
                      />
                      {/* Com foto de fundo o conteúdo mora num CARTÃO sólido e a
                          foto vira moldura. A cor desse cartão é o bgColor, mas o
                          seletor dele só aparecia no modo "Cor sólida": não havia
                          NENHUM controle pra pintar o cartão (pergunta do Walter,
                          01/09, na página da Organnah). Agora ele mora aqui. */}
                      {settings.bgImage && (
                        <div className="space-y-1 pt-1">
                          <ColorField
                            value={settings.bgColor}
                            onChange={(v) => patchSettings({ bgColor: v })}
                            label="Cor do cartão sobre a foto"
                          />
                          <p className="text-[11px] text-muted-foreground/70">
                            Com fundo de foto, o conteúdo fica dentro de um cartão desta cor e a foto aparece em volta, como moldura.
                          </p>
                        </div>
                      )}
                    </>
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
                )}

                {/* Button style */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-sm font-display font-semibold">Estilo dos links</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {settings.layout === "vitrine"
                      ? "O canto dos botões: os dois da Capa e os dos blocos que você adiciona. Contorno deixa o botão vazado, só com a borda na cor da marca."
                      : "O canto dos seus botões. Contorno deixa o botão vazado, só com a borda."}
                  </p>
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

                  {/* Cor dos CARDS: Sobre mim e Captura de lead eram brancos fixos e
                      não seguiam a identidade da pessoa. Vazio = branco de antes. */}
                  <div className="pt-2">
                    <Label className="text-sm font-display font-semibold">Cards (blocos de texto e de contato)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Deixe vazio pra manter o card branco.</p>
                    <div className="flex gap-4 pt-2 flex-wrap items-end">
                      <ColorField
                        value={settings.cardColor || "#FFFFFF"}
                        onChange={(v) => patchSettings({ cardColor: v })}
                        label="Cor do card"
                      />
                      <ColorField
                        value={settings.cardTextColor || "#1F2937"}
                        onChange={(v) => patchSettings({ cardTextColor: v })}
                        label="Cor do texto do card"
                      />
                      {settings.cardColor && (
                        <Button type="button" variant="ghost" size="sm" className="h-9"
                          onClick={() => patchSettings({ cardColor: "", cardTextColor: "" })}>
                          Voltar ao branco
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* "Sobre mim" e "Captura de lead" saíram daqui: os dois viraram
                    BLOCOS (Texto e Captura de contato), montados junto com o resto
                    da página. Ter os mesmos campos em dois lugares fazia a pessoa
                    editar num e não ver mudança no outro. */}

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
            </Aba>
            )}

            {aba === "publicar" && (
            <Aba
              explica="Este é o endereço que você cola na bio do Instagram. Escolha um nome curto e fácil de digitar.">
              <Card data-tour="bio-link" className="p-4 md:p-5 rounded-2xl border-border">
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
                {/* No topo da tela este botão some no celular, e é justamente no
                    celular que a pessoa quer conferir a página antes de colar
                    o link. Aqui ele fica junto do endereço, sempre visível. */}
                {publicPath && (
                  <a href={publicPath} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir a página pública
                    </Button>
                  </a>
                )}
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
            </Aba>
            )}

            {aba === "resultados" && (
            <Aba
              explica="Quantos entraram, no que clicaram e quem deixou contato.">
              <Card data-tour="bio-desempenho" className="p-4 md:p-5 rounded-2xl border-border">
                <PainelDesempenho estilo={estiloBlocos} />
                {/* Os totais de sempre continuam embaixo: eles somam desde o
                    primeiro dia, e o painel de cima olha só o período escolhido.
                    São perguntas diferentes, não uma versão velha da outra. */}
                <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-2">
                  Desde o começo
                </p>
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
                  <p className="text-sm text-muted-foreground">Nenhum lead ainda. Adicione um bloco de "Captura de contato" no passo 2 pra começar a coletar.</p>
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
            </Aba>
            )}
          </div>

          {/* ── Preview ─────────────────────────────── */}
          {/* Quem faz esta coluna acompanhar a rolagem é o usePainelGrudado lá
              em cima, por medição. A explicação de por que não é `sticky` está
              no comentário do gancho. */}
          <div className="min-w-0">
           <div ref={painelDaPrevia}
             className="lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overflow-x-clip lg:pb-2 lg:will-change-transform">
            <Card className="p-4 rounded-2xl border-border">
              <p className="text-xs text-center font-display font-semibold uppercase tracking-wider text-muted-foreground/80 mb-4">
                Pré-visualização
              </p>
              <BioPreview profile={profile} links={activeLinks}
                blocos={settings.layout === "vitrine" ? blocosSite : blocosClassico}
                produtos={produtosDoSite} posts={postsDoSite} settings={settings} />
            </Card>
           </div>
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
  blocos?: BioBloco[];
  produtos?: ItemLite[];
  posts?: ItemLite[];
  settings: BioSettings;
};

const BioPreview = memo(function BioPreview({ profile, links, blocos = [], produtos = [], posts = [], settings }: PreviewProps) {
  const radius = radiusFor(settings.buttonStyle);
  const isOutline = settings.buttonStyle === "outline";
  const hasSocials = SOCIAL_FIELDS.some((f) => settings.socialLinks[f.key].trim());
  const fontStack = fontStackFor(settings.fontFamily);

  // MODO SITE: a prévia usa o MESMO componente da página pública, dentro do
  // celular. E ele se monta pela largura DESTA moldura (container queries), não
  // pela do monitor: antes o site abria aqui com o menu de computador e a grade
  // de três colunas espremida em 300px, e a prévia mentia feio.
  if (settings.layout === "vitrine") {
    // Mesma correção da página pública: cor clara demais não vira texto.
    const corDestaque = corDeDestaque(settings.buttonColor);
    return (
      <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
        <BioFontStyle stack={fontStack} />
        <div className="bio-font-scope w-full h-[560px] rounded-[32px] overflow-y-auto overflow-x-hidden bg-white">
          {blocos.length === 0 ? (
            <div className="h-full grid place-items-center px-6 text-center">
              <p className="text-xs font-body text-gray-500">
                Adicione uma seção pra ver o site aqui. O jeito mais rápido é aplicar um modelo.
              </p>
            </div>
          ) : (
            <SiteBio
              blocos={blocos.filter((b) => b.is_active).map((b) => ({ id: b.id, kind: b.kind, data: b.data ?? {}, position: b.position }))}
              marca={{
                nome: nomeDaMarcaSite(blocos, settings.header?.name, profile?.name),
                logo: settings.header?.avatar || profile?.avatar_url,
                cor: corDestaque, corTexto: settings.buttonTextColor,
              }}
              produtos={produtos} posts={posts}
              visual={{
                buttonColor: settings.buttonColor, buttonTextColor: settings.buttonTextColor,
                cardColor: settings.cardColor, cardTextColor: settings.cardTextColor,
                radius: radiusFor(settings.buttonStyle), isOutline: settings.buttonStyle === "outline",
              }}
              aoAbrirProduto={() => {}} aoAbrirPost={() => {}} alturaCheia={false} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[300px] mx-auto bg-white rounded-[40px] border-[8px] border-gray-800 p-2 shadow-2xl">
      <BioFontStyle stack={fontStack} />
      <div
        className="bio-font-scope relative w-full h-[560px] rounded-[32px] overflow-y-auto"
        style={backgroundStyle(settings)}
      >
        <BgOverlay amount={settings.bgOverlay} />
        {/* O TOPO AQUI É O MESMO DA PÁGINA PÚBLICA, só em escala menor.
            Antes a prévia desenhava o banner como uma faixa colada no topo e a
            página pública desenhava como um card arredondado com a foto por
            cima. Duas montagens diferentes pro mesmo lugar: a prévia mostrava
            uma página que não existia, e a foto aparecia cortada. */}
        {/* ARQUITETURA HOPP, igual à página pública: fundo de FOTO ganha uma
            coluna sólida na cor da marca; fundo de cor segue transparente. */}
        <div
          className={`relative z-10 px-5 py-6 flex flex-col items-center min-h-full ${
            settings.bgType === "image" && settings.bgImage ? "m-2 rounded-[20px] shadow-2xl overflow-hidden min-h-0" : ""
          }`}
          style={settings.bgType === "image" && settings.bgImage ? { backgroundColor: settings.bgColor } : undefined}
        >

        {/* Capa sangrada até as bordas, igual à página pública: o canto é
            aparado pelo arredondado da "tela" do celular ou da coluna. */}
        {settings.bannerImage && (
          <div className="-mx-5 -mt-6 w-[calc(100%+2.5rem)] mb-[-34px] overflow-hidden shadow-md">
            <img src={settings.bannerImage} alt="" className="w-full h-24 object-cover" />
          </div>
        )}

        {profile && (
          <>
            {/* Moldura na cor do botão, igual à página pública. */}
            <div className="w-24 h-24 rounded-full p-[2px] mb-3 shadow-xl" style={{ backgroundColor: settings.buttonColor }}>
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
            {/* Cor do cabeçalho e ícones ABAIXO da bio: espelho fiel da página
                pública (estilo Hopp), senão a prévia mente. */}
            {(() => {
              const emColuna = settings.bgType === "image" && !!settings.bgImage;
              const ink = settings.headerColor || (emColuna ? corSobre(settings.bgColor) : "#1A2420");
              return (
                <>
                  <h3 className="font-display font-extrabold text-[17px] text-center drop-shadow-sm" style={{ color: ink }}>
                    {settings.header?.name || profile.name || "Seu nome"}
                  </h3>
                  {(settings.header?.bio || profile.bio) && (
                    <p className="text-[12.5px] leading-relaxed text-center mt-1.5 whitespace-pre-line font-body drop-shadow-sm opacity-90" style={{ color: ink }}>
                      {settings.header?.bio || profile.bio}
                    </p>
                  )}
                  {hasSocials && (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {SOCIAL_FIELDS.map((f) =>
                        settings.socialLinks[f.key].trim() ? (
                          <div key={f.key} className="w-7 h-7 grid place-items-center" aria-label={f.label} style={{ color: ink }}>
                            <f.icon className="h-4 w-4" strokeWidth={1.8} />
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        <div className="w-full mt-6 space-y-3">
          {settings.sections.filter((s) => s.on).map((sec) => {
            // O banner virou CAPA do topo (renderizada acima, atrás da foto).
            if (sec.id === "banner") return null;
            // "Sobre mim" e "Captura de lead" viraram BLOCOS (Texto e Captura de
            // contato). Quem já montou no formato novo tem os dois lá, então
            // desenhar a seção antiga junto mostrava o mesmo card duas vezes.
            if (blocos.length > 0 && (sec.id === "about" || sec.id === "lead")) return null;
            if (sec.id === "about") {
              if (!settings.about.text && !settings.about.image) return null;
              return (
                <div key="about" className={`w-full rounded-xl overflow-hidden text-left shadow-sm ${settings.cardColor ? "" : "bg-white/90"}`}
                  style={settings.cardColor ? { backgroundColor: settings.cardColor, color: settings.cardTextColor || undefined } : undefined}>
                  {settings.about.image && <img src={settings.about.image} alt="" loading="lazy" className="w-full max-h-28 object-cover" />}
                  <div className="p-3">
                    {settings.about.title && <p className={`font-display font-bold text-xs mb-1 ${settings.cardColor ? "" : "text-gray-900"}`}>{settings.about.title}</p>}
                    {/* Sem line-clamp: a prévia cortava o Sobre mim em 4 linhas e
                        parecia que a página pública tinha perdido o texto. A
                        prévia mostra o que a página pública mostra: tudo. */}
                    {settings.about.text && <p className={`text-[11px] whitespace-pre-line ${settings.cardColor ? "opacity-90" : "text-gray-700"}`}>{settings.about.text}</p>}
                  </div>
                </div>
              );
            }
            if (sec.id === "lead") {
              return (
                <div key="lead" className={`w-full rounded-xl shadow-sm p-3 text-center ${settings.cardColor ? "" : "bg-white/90"}`}
                  style={settings.cardColor ? { backgroundColor: settings.cardColor, color: settings.cardTextColor || undefined } : undefined}>
                  <p className={`font-display font-bold text-xs ${settings.cardColor ? "" : "text-gray-900"}`}>{settings.lead.title}</p>
                  {settings.lead.subtitle && <p className={`text-[10px] mt-0.5 mb-2 ${settings.cardColor ? "opacity-85" : "text-gray-600"}`}>{settings.lead.subtitle}</p>}
                  {/* A prévia mostrava UM retângulo cinza e escondia o aviso de
                      consentimento. Quem monta a página não conseguia conferir
                      nem quantos campos o visitante ia ver, nem se o aviso
                      estava legível. Agora mostra os campos escolhidos, com o
                      exemplo dentro, e o aviso embaixo do botão. */}
                  <div className="space-y-1.5 mb-2 text-left">
                    <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">Seu nome</div>
                    {(settings.lead.fields === "email" || settings.lead.fields === "both") && (
                      <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">Seu e-mail</div>
                    )}
                    {(settings.lead.fields === "phone" || settings.lead.fields === "both") && (
                      <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">(00) 00000-0000</div>
                    )}
                  </div>
                  {settings.lead.consentText && (
                    <div className={`flex items-start gap-1 text-left text-[8px] leading-snug mb-2 ${settings.cardColor ? "opacity-85" : "text-gray-500"}`}>
                      <span className="mt-[1px] w-2 h-2 rounded-[2px] border border-current shrink-0" />
                      <span>{settings.lead.consentText}</span>
                    </div>
                  )}
                  <div className="h-7 rounded-md font-semibold text-[11px] flex items-center justify-center" style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor }}>
                    {settings.lead.buttonText}
                  </div>
                </div>
              );
            }
            // BLOCOS na prévia: o MESMO componente da página pública. Se
            // fossem dois desenhos, a prévia mentiria na primeira alteração.
            if (blocos.length > 0) {
              return (
                <div key="blocos" className="space-y-2.5">
                  {blocos.map((b) => (
                    <div key={b.id} className={b.is_active ? "" : "opacity-40"}>
                      <BlocoPublico
                        kind={b.kind}
                        data={b.data ?? {}}
                        visual={{
                          buttonColor: settings.buttonColor, buttonTextColor: settings.buttonTextColor,
                          cardColor: settings.cardColor, cardTextColor: settings.cardTextColor,
                          radius, isOutline,
                        }}
                        captura={
                          <div className={`w-full rounded-2xl shadow-sm p-3 text-center ${settings.cardColor ? "" : "bg-white/90"}`}
                            style={settings.cardColor ? { backgroundColor: settings.cardColor, color: settings.cardTextColor || undefined } : undefined}>
                            <p className="font-display font-bold text-xs">{String(b.data?.titulo ?? "Deixe seu contato")}</p>
                            {!!b.data?.subtitulo && <p className="text-[10px] opacity-80 mt-0.5 mb-2">{String(b.data.subtitulo)}</p>}
                            <div className="space-y-1.5 mb-2 text-left">
                              <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">Seu nome</div>
                              {(b.data?.campos === "email" || b.data?.campos === "ambos" || !b.data?.campos) && (
                                <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">Seu e-mail</div>
                              )}
                              {(b.data?.campos === "telefone" || b.data?.campos === "ambos" || !b.data?.campos) && (
                                <div className="h-6 rounded-md bg-gray-100 flex items-center px-2 text-[9px] text-gray-400">(00) 00000-0000</div>
                              )}
                            </div>
                            {!!b.data?.consentimento && (
                              <div className="flex items-start gap-1 text-left text-[8px] leading-snug mb-2 opacity-70">
                                <span className="mt-[1px] w-2 h-2 rounded-[2px] border border-current shrink-0" />
                                <span>{String(b.data.consentimento)}</span>
                              </div>
                            )}
                            <div className="h-7 rounded-md font-semibold text-[11px] flex items-center justify-center"
                              style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor }}>
                              {String(b.data?.botao ?? "Enviar")}
                            </div>
                          </div>
                        }
                      />
                    </div>
                  ))}
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
                      <div className="px-4 py-3 text-center whitespace-pre-line [text-wrap:balance]">
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

/* VitrinePreview saiu: o modo Site agora é montado por blocos e a prévia
   usa o mesmo SiteBio da página pública. */
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
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
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
