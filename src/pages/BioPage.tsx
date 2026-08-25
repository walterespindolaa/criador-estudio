import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Instagram, Youtube, Twitter, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUrl } from "@/lib/sanitize";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { renderRichText } from "@/lib/richText";
import { cn } from "@/lib/utils";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";

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

// Estilo <style> escopado: só afeta elementos dentro de .bio-font-scope,
// sem tocar no resto do app. stack vem de whitelist, então é seguro.
function BioFontStyle({ stack }: { stack: string | null }) {
  if (!stack) return null;
  return <style>{`.bio-font-scope,.bio-font-scope *{font-family:${stack} !important}`}</style>;
}

// Sobreposição escura opcional pra dar legibilidade sobre imagem/gradiente.
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
type VitrineService = { id: string; title: string; desc: string; image: string | null; url: string };
type VitrineProduct = { id: string; title: string; desc: string; cover: string | null; ctaText: string; url: string };
type VitrineSettings = { baseColor: string; cover: string | null; services: VitrineService[]; products: VitrineProduct[] };

function genBioId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_VITRINE: VitrineSettings = { baseColor: "#0A0A0A", cover: null, services: [], products: [] };

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
  return out;
}

type BioSettings = {
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
  // Cor dos CARDS (Sobre mim e Captura de lead). Vazio = branco translúcido.
  cardColor: string;
  cardTextColor: string;
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

const STYLE_RADIUS: Record<ButtonStyle, string> = {
  rounded: "rounded-xl",
  pill: "rounded-full",
  square: "rounded-md",
  outline: "rounded-xl",
};

const SOCIAL_FIELDS: {
  key: keyof SocialLinks;
  label: string;
  icon: typeof Instagram;
  urlBuilder: (handle: string) => string;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    urlBuilder: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    urlBuilder: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  {
    key: "youtube",
    label: "YouTube",
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
    icon: Twitter,
    urlBuilder: (h) => `https://twitter.com/${h.replace(/^@/, "")}`,
  },
];

type ProfileLite = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  niche: string | null;
  instagram_handle: string | null;
  bio_settings: unknown;
};

type BioLinkLite = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number | null;
  link_type: string | null;
  thumbnail_url: string | null;
};

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
    cardColor: typeof t.cardColor === "string" ? t.cardColor : "",
    cardTextColor: typeof t.cardTextColor === "string" ? t.cardTextColor : "",
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

function backgroundStyle(settings: BioSettings): React.CSSProperties {
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

// RPCs novas ainda não estão nos tipos gerados, cast (padrão do projeto).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

const BioPage = () => {
  const { slug } = useParams<{ slug: string }>();
  useForceLightTheme();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  // Página montada pela social mídia (não é a conta de um criador). Muda de
  // onde vêm os leads e como a visita é contada.
  const [ehDaAgencia, setDaAgencia] = useState(false);
  const [links, setLinks] = useState<BioLinkLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      // Dois lugares podem responder por um endereço: a conta de um criador
      // (profiles) ou a página que uma social mídia montou pra um cliente dela
      // (bio_pages). O endereço é único entre os dois, então basta perguntar
      // pro primeiro e cair no segundo.
      const { data: profileRows } = await supabase
        .rpc("get_public_profile_by_slug", { _slug: slug });
      let profileData = Array.isArray(profileRows) ? profileRows[0] : null;
      let daAgencia = false;

      if (!profileData) {
        const { data: pageRows } = await sbRpc("get_public_bio_page_by_slug", { _slug: slug });
        const row = Array.isArray(pageRows) ? pageRows[0] : null;
        if (row) { profileData = row as typeof profileData; daAgencia = true; }
      }

      if (cancelled) return;
      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: linkData } = daAgencia
        ? await sbRpc("get_public_bio_page_links_by_slug", { _slug: slug })
        : await supabase.rpc("get_public_bio_links_by_slug", { _slug: slug });

      if (cancelled) return;
      setDaAgencia(daAgencia);
      setProfile(profileData as ProfileLite);
      setLinks((linkData ?? []) as BioLinkLite[]);
      setLoading(false);

      // Conta a visita 1x por sessão/navegador (evita inflar com refresh).
      if (slug) {
        const key = `bioviewed:${slug}`;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void supabase.functions.invoke("bio-track", { body: { type: "view", slug, kind: daAgencia ? "page" : "profile" } });
          }
        } catch { /* sessionStorage indisponível: ignora */ }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const settings = useMemo(() => parseSettings(profile?.bio_settings), [profile?.bio_settings]);
  const radius = STYLE_RADIUS[settings.buttonStyle];
  const isOutline = settings.buttonStyle === "outline";
  const fontStack = fontStackFor(settings.fontFamily);

  const trackClick = (id: string) => {
    void supabase.functions.invoke("bio-track", { body: { type: "click", linkId: id, slug } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-muted-foreground font-body mb-6">
          Esse link de bio não existe ou foi desativado.
        </p>
        <Link to="/" className="text-sm font-body text-primary underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const headerName = (settings.header?.name ?? "").trim() || profile.name;
  const headerAvatar = (settings.header?.avatar ?? "").trim() || profile.avatar_url;
  const headerBio = (settings.header?.bio ?? "").trim() || profile.bio;
  const initial = headerName?.charAt(0)?.toUpperCase() || "C";
  const activeSocials = SOCIAL_FIELDS.filter((f) => settings.socialLinks[f.key].trim());

  if (settings.layout === "vitrine") {
    return <VitrineView settings={settings} headerName={headerName} headerBio={headerBio} activeSocials={activeSocials} />;
  }

  return (
    <div
      className="bio-font-scope relative min-h-screen w-full px-5 py-10 md:py-16 flex flex-col items-center"
      style={backgroundStyle(settings)}
    >
      <BioFontStyle stack={fontStack} />
      <BgOverlay amount={settings.bgOverlay} />
      <div className="relative z-10 w-full max-w-[520px] flex flex-col items-center">
        {/* BANNER = CAPA: fica ATRÁS da foto, como capa de perfil. Antes era um
            card solto no meio dos links e ficava perdido. */}
        {settings.bannerImage && settings.sections.some((x) => x.id === "banner" && x.on) && (
          <div className="w-full -mt-2 mb-[-44px] rounded-2xl overflow-hidden shadow-md">
            <img src={settings.bannerImage} alt="" loading="lazy" className="w-full h-32 sm:h-40 object-cover" />
          </div>
        )}
        {/* Desktop: floating column of social icons to the left */}
        {activeSocials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="hidden md:flex absolute -left-16 top-32 flex-col gap-3 z-10"
          >
            {activeSocials.map((f) => {
              const handle = settings.socialLinks[f.key];
              const href = f.urlBuilder(handle);
              return (
                <a
                  key={f.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={f.label}
                  className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <f.icon className="h-5 w-5 text-gray-900" />
                </a>
              );
            })}
          </motion.div>
        )}

        {/* Mobile: horizontal row above content */}
        {activeSocials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="md:hidden flex items-center gap-3 mb-6"
          >
            {activeSocials.map((f) => {
              const handle = settings.socialLinks[f.key];
              const href = f.urlBuilder(handle);
              return (
                <a
                  key={f.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={f.label}
                  className="w-10 h-10 rounded-full bg-white/85 backdrop-blur flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                >
                  <f.icon className="h-4 w-4 text-gray-900" />
                </a>
              );
            })}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col items-center"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[3px] mb-4 shadow-xl">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
              {headerAvatar ? (
                <img
                  src={headerAvatar}
                  alt={headerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-primary font-display font-bold text-3xl">{initial}</span>
              )}
            </div>
          </div>
          <h1 className="font-display font-extrabold text-xl text-gray-900 text-center drop-shadow-sm">
            {headerName}
          </h1>
          {headerBio && (
            <p className="text-sm text-gray-800 text-center mt-2 max-w-xs font-body whitespace-pre-line drop-shadow-sm">
              {renderRichText(headerBio)}
            </p>
          )}
        </motion.div>

        {settings.sections.filter((s) => s.on).map((sec) => {
          // O banner virou CAPA do topo (renderizada acima, atrás da foto).
          if (sec.id === "banner") return null;
          if (sec.id === "about") {
            if (!settings.about.text && !settings.about.image) return null;
            return (
              <div key="about"
                className={`w-full mt-7 rounded-2xl shadow-md overflow-hidden text-left ${settings.cardColor ? "" : "bg-white/90 backdrop-blur-sm"}`}
                style={settings.cardColor ? { backgroundColor: settings.cardColor, color: settings.cardTextColor || undefined } : undefined}>
                {settings.about.image && (
                  <img src={settings.about.image} alt="" loading="lazy" className="w-full max-h-56 object-cover" />
                )}
                <div className="p-5">
                  {settings.about.title && <h2 className={`font-display font-bold mb-2 ${settings.cardColor ? "" : "text-gray-900"}`}>{settings.about.title}</h2>}
                  {settings.about.text && <p className={`text-sm whitespace-pre-line font-body leading-relaxed ${settings.cardColor ? "opacity-90" : "text-gray-700"}`}>{renderRichText(settings.about.text)}</p>}
                </div>
              </div>
            );
          }
          if (sec.id === "lead") {
            return (
              <div key="lead" className="w-full mt-7">
                <LeadForm slug={slug ?? ""} daAgencia={ehDaAgencia} config={settings.lead} buttonColor={settings.buttonColor} buttonTextColor={settings.buttonTextColor} radius={radius}
                  cardColor={settings.cardColor} cardTextColor={settings.cardTextColor} />
              </div>
            );
          }
          return (
            <motion.div
              key="links"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
              }}
              className="w-full mt-7 space-y-3"
            >
              {links.length === 0 ? (
                <p className="text-sm text-center text-gray-700 font-body py-8">
                  Sem links no momento.
                </p>
              ) : (
                links.map((link) => {
                  if (link.link_type === "header") {
                    return (
                      <motion.p
                        key={link.id}
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        className="text-center font-display font-bold text-base text-gray-900 drop-shadow-sm pt-3 pb-1"
                      >
                        {link.title}
                      </motion.p>
                    );
                  }
                  const safeUrl = sanitizeUrl(link.url);
                  if (!safeUrl) return null;
                  return (
                    <motion.a
                      key={link.id}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackClick(link.id)}
                      className={cn(
                        "block w-full overflow-hidden font-body font-semibold shadow-md",
                        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] transition-all duration-200",
                        radius,
                        isOutline && "border-2 bg-transparent"
                      )}
                      style={{
                        backgroundColor: isOutline ? "transparent" : settings.buttonColor,
                        color: settings.buttonTextColor,
                        borderColor: isOutline ? settings.buttonTextColor : undefined,
                      }}
                    >
                      {link.thumbnail_url && (
                        <div className="w-full aspect-video overflow-hidden">
                          <img
                            src={link.thumbnail_url}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="px-5 py-4 text-center line-clamp-2">
                        {!link.thumbnail_url && link.icon && (
                          <span className="mr-2">{link.icon}</span>
                        )}
                        {link.title}
                      </div>
                    </motion.a>
                  );
                })
              )}
            </motion.div>
          );
        })}

        <BioFooter className="mt-8" />
      </div>
    </div>
  );
};

// Assinatura do Cria na bio. Usa a pastilha branca porque o fundo aqui é
// escolhido pela pessoa (cor, gradiente ou foto), então logo solto pode sumir.
function BioFooter({ className }: { className?: string }) {
  return (
    <div className={cn("w-full flex justify-center", className)}>
      <AssinaturaCria variante="rodape" tom="pastilha" />
    </div>
  );
}

type SocialField = (typeof SOCIAL_FIELDS)[number];

function VitrineView({
  settings,
  headerName,
  headerBio,
  activeSocials,
}: {
  settings: BioSettings;
  headerName: string;
  headerBio: string | null;
  activeSocials: SocialField[];
}) {
  const base = settings.vitrine.baseColor;
  const services = settings.vitrine.services;
  const products = settings.vitrine.products;
  const railRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const railMove = (dir: -1 | 1) => {
    railRef.current?.scrollBy({ left: dir * 250, behavior: "smooth" });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const rail = railRef.current;
    if (!rail) return;
    dragState.current = { down: true, startX: e.pageX, startLeft: rail.scrollLeft, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const rail = railRef.current;
    if (!rail || !dragState.current.down) return;
    e.preventDefault();
    const delta = e.pageX - dragState.current.startX;
    if (Math.abs(delta) > 4) dragState.current.moved = true;
    rail.scrollLeft = dragState.current.startLeft - delta;
  };
  const endDrag = () => {
    dragState.current.down = false;
  };

  const fontStack = fontStackFor(settings.fontFamily);
  // Vitrine agora respeita o fundo escolhido (cor, gradiente ou imagem).
  // Se ninguém mexeu no fundo, cai no creme da marca pra manter o visual atual.
  const untouchedBg = settings.bgType === "color" && settings.bgColor === DEFAULT_SETTINGS.bgColor;
  const vitrineBg: React.CSSProperties = untouchedBg
    ? { backgroundColor: "#F5F3E7" }
    : backgroundStyle(settings);

  return (
    <div className="bio-font-scope relative min-h-screen w-full flex flex-col items-center" style={vitrineBg}>
      <BioFontStyle stack={fontStack} />
      <BgOverlay amount={settings.bgOverlay} />
      <div className="relative z-10 w-full max-w-[520px] pb-10 md:pt-6">
        {/* Capa */}
        <div className="mx-5 mt-5">
          <div
            className="w-full h-[340px] rounded-[22px] overflow-hidden shadow-lg bg-cover bg-center"
            style={{
              backgroundColor: "#cfcabb",
              backgroundImage: settings.vitrine.cover ? `url(${settings.vitrine.cover})` : undefined,
            }}
          />
        </div>

        <div className="px-5">
          <h1 className="font-display font-extrabold text-[1.85rem] leading-[1.02] text-gray-900 mt-5">
            {headerName}
          </h1>
          {headerBio && (
            <p className="text-[0.95rem] text-gray-700 leading-relaxed mt-3 whitespace-pre-line">
              {renderRichText(headerBio)}
            </p>
          )}

          {activeSocials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {activeSocials.map((f) => {
                const handle = settings.socialLinks[f.key];
                const href = sanitizeUrl(f.urlBuilder(handle));
                if (!href) return null;
                return (
                  <a
                    key={f.key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-[34px] px-3.5 rounded-[10px] flex items-center font-display font-bold text-[0.76rem] tracking-wide text-white"
                    style={{ backgroundColor: base }}
                  >
                    {f.label.toUpperCase()}
                  </a>
                );
              })}
            </div>
          )}

          {/* Serviços */}
          {services.length > 0 && (
            <>
              <div className="flex items-center gap-2 font-display font-extrabold text-[1.12rem] text-gray-900 mt-7 mb-3">
                Serviços
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ fill: base }}><path d="M12 16l-6-6h12z" /></svg>
              </div>
              <div className="grid gap-3">
                {services.map((s) => {
                  const href = sanitizeUrl(s.url);
                  const inner = (
                    <>
                      <span className="text-white font-display font-bold text-base pl-[18px]">{s.title}</span>
                      <span
                        className="w-[74px] h-[74px] shrink-0 bg-cover bg-center"
                        style={{
                          backgroundColor: "#b9b4a6",
                          backgroundImage: s.image ? `url(${s.image})` : undefined,
                        }}
                      />
                    </>
                  );
                  const cls = "h-[74px] rounded-2xl overflow-hidden flex items-center justify-between";
                  return href ? (
                    <a key={s.id} href={href} target="_blank" rel="noopener noreferrer" className={cls} style={{ backgroundColor: base }}>
                      {inner}
                    </a>
                  ) : (
                    <div key={s.id} className={cls} style={{ backgroundColor: base }}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Infoprodutos */}
        {products.length > 0 && (
          <>
            <div className="px-5 flex items-center gap-2 font-display font-extrabold text-[1.12rem] text-gray-900 mt-7 mb-3">
              Infoprodutos
              <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ fill: base }}><path d="M12 16l-6-6h12z" /></svg>
            </div>
            <div
              ref={railRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              className="flex gap-3.5 overflow-x-auto px-5 pb-2 cursor-grab select-none"
              style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
            >
              {products.map((p) => {
                const href = sanitizeUrl(p.url);
                return (
                  <div
                    key={p.id}
                    className="shrink-0 w-[236px] rounded-[20px] overflow-hidden shadow-lg"
                    style={{ backgroundColor: base, scrollSnapAlign: "center" }}
                  >
                    <div
                      className="h-[150px] bg-cover bg-center"
                      style={{
                        backgroundColor: "#b9b4a6",
                        backgroundImage: p.cover ? `url(${p.cover})` : undefined,
                      }}
                    />
                    <div className="px-4 py-3.5 text-white">
                      <b className="font-display font-bold text-[1.05rem] leading-tight block">{p.title}</b>
                      {p.desc && (
                        <p className="text-[0.84rem] text-white/80 leading-snug mt-1.5 mb-3 whitespace-pre-line">
                          {renderRichText(p.desc)}
                        </p>
                      )}
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (dragState.current.moved) e.preventDefault();
                          }}
                          className="font-display font-bold text-[0.9rem] text-white underline decoration-2 underline-offset-[3px]"
                          style={{ textDecorationColor: "#FFCF03" }}
                        >
                          {p.ctaText} →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 flex gap-3 pt-2.5">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => railMove(-1)}
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center"
                style={{ backgroundColor: base }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M15 5l-7 7 7 7z" /></svg>
              </button>
              <button
                type="button"
                aria-label="Próximo"
                onClick={() => railMove(1)}
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center"
                style={{ backgroundColor: base }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M9 5l7 7-7 7z" /></svg>
              </button>
            </div>
          </>
        )}

        <BioFooter className="mt-8" />
      </div>
    </div>
  );
}

function LeadForm({
  slug, daAgencia, config, buttonColor, buttonTextColor, radius, cardColor, cardTextColor,
}: {
  slug: string;
  /** Página montada pela social mídia: o lead é dela, não de um criador. */
  daAgencia?: boolean;
  config: BioLeadForm;
  buttonColor: string;
  buttonTextColor: string;
  radius: string;
  // Cor do card escolhida no editor. Vazio = branco translúcido de antes.
  cardColor?: string;
  cardTextColor?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const showEmail = config.fields === "email" || config.fields === "both";
  const showPhone = config.fields === "phone" || config.fields === "both";

  const submit = async () => {
    if (!consent) return;
    if (showEmail && !email.trim() && !(showPhone && phone.trim())) return;
    if (!showEmail && showPhone && !phone.trim()) return;
    setSending(true);
    try {
      const { error } = await (supabase.rpc as unknown as (
        fn: string, args: Record<string, unknown>
      ) => Promise<{ error: { message: string } | null }>)(daAgencia ? "submit_bio_page_lead" : "submit_bio_lead", {
        _slug: slug,
        _name: name.trim() || null,
        _email: email.trim() || null,
        _phone: phone.trim() || null,
      });
      if (error) throw error;
      setDone(true);
    } catch {
      setErr("Não foi possível enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className={`w-full rounded-2xl shadow-md p-6 text-center ${cardColor ? "" : "bg-white/90 backdrop-blur-sm"}`}
        style={cardColor ? { backgroundColor: cardColor, color: cardTextColor || undefined } : undefined}>
        <p className={`font-display font-bold ${cardColor ? "" : "text-gray-900"}`}>Recebido! 💜</p>
        <p className={`text-sm mt-1 ${cardColor ? "opacity-90" : "text-gray-700"}`}>Logo entro em contato.</p>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-2xl shadow-md p-6 ${cardColor ? "" : "bg-white/90 backdrop-blur-sm"}`}
      style={cardColor ? { backgroundColor: cardColor, color: cardTextColor || undefined } : undefined}>
      <h2 className={`font-display font-bold text-center ${cardColor ? "" : "text-gray-900"}`}>{config.title}</h2>
      {config.subtitle && <p className={`text-sm text-center mt-1 mb-4 ${cardColor ? "opacity-85" : "text-gray-600"}`}>{config.subtitle}</p>}
      <div className="space-y-3">
        <input aria-label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
        {showEmail && <input aria-label="Seu email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu email" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />}
        {showPhone && <input aria-label="Seu telefone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Seu telefone" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />}
        <label className={`flex items-start gap-2 text-[11px] leading-snug ${cardColor ? "opacity-85" : "text-gray-600"}`}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          {config.consentText}
        </label>
        <button type="button" onClick={submit} disabled={sending || !consent} className={cn("w-full font-body font-semibold py-3 shadow-md disabled:opacity-50 transition", radius)} style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
          {sending ? "Enviando..." : config.buttonText}
        </button>
        {err && <p role="alert" className="text-xs text-red-600 text-center">{err}</p>}
      </div>
    </div>
  );
}

export default BioPage;
