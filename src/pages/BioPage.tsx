import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Instagram, Youtube, Twitter, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUrl } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

type BgType = "color" | "gradient" | "image";
type ButtonStyle = "rounded" | "pill" | "square" | "outline";

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
  buttonStyle: ButtonStyle;
  buttonColor: string;
  buttonTextColor: string;
  socialLinks: SocialLinks;
  bannerImage: string | null;
  about: BioAbout;
  header: BioHeader;
  lead: BioLeadForm;
  sections: BioSection[];
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
  };
}

function backgroundStyle(settings: BioSettings): React.CSSProperties {
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

const BioPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [links, setLinks] = useState<BioLinkLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      const { data: profileRows, error: profileError } = await supabase
        .rpc("get_public_profile_by_slug", { _slug: slug });
      const profileData = Array.isArray(profileRows) ? profileRows[0] : null;

      if (cancelled) return;
      if (profileError || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: linkData } = await supabase
        .rpc("get_public_bio_links_by_slug", { _slug: slug });

      if (cancelled) return;
      setProfile(profileData as ProfileLite);
      setLinks((linkData ?? []) as BioLinkLite[]);
      setLoading(false);

      // Conta a visita 1x por sessão/navegador (evita inflar com refresh).
      if (slug) {
        const key = `bioviewed:${slug}`;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void supabase.functions.invoke("bio-track", { body: { type: "view", slug } });
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

  return (
    <div
      className="min-h-screen w-full px-5 py-10 flex flex-col items-center"
      style={backgroundStyle(settings)}
    >
      <div className="relative w-full max-w-md flex flex-col items-center">
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
              {headerBio}
            </p>
          )}
        </motion.div>

        {settings.sections.filter((s) => s.on).map((sec) => {
          if (sec.id === "banner") {
            return settings.bannerImage ? (
              <div key="banner" className="w-full mt-7">
                <img src={settings.bannerImage} alt="" loading="lazy" className="w-full rounded-2xl object-cover max-h-48 shadow-md" />
              </div>
            ) : null;
          }
          if (sec.id === "about") {
            if (!settings.about.text && !settings.about.image) return null;
            return (
              <div key="about" className="w-full mt-7 rounded-2xl bg-white/90 backdrop-blur-sm shadow-md overflow-hidden text-left">
                {settings.about.image && (
                  <img src={settings.about.image} alt="" loading="lazy" className="w-full max-h-56 object-cover" />
                )}
                <div className="p-5">
                  {settings.about.title && <h2 className="font-display font-bold text-gray-900 mb-2">{settings.about.title}</h2>}
                  {settings.about.text && <p className="text-sm text-gray-700 whitespace-pre-line font-body leading-relaxed">{settings.about.text}</p>}
                </div>
              </div>
            );
          }
          if (sec.id === "lead") {
            return (
              <div key="lead" className="w-full mt-7">
                <LeadForm slug={slug ?? ""} config={settings.lead} buttonColor={settings.buttonColor} buttonTextColor={settings.buttonTextColor} radius={radius} />
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
                      <div className="px-5 py-4 text-center truncate">
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

        <p className="text-center text-[10px] text-gray-900/50 mt-8 font-body drop-shadow-sm">
          Feito com 💜{" "}
          <Link to="/" className="underline hover:text-gray-900/80 transition">
            cria
          </Link>
        </p>
      </div>
    </div>
  );
};

function LeadForm({
  slug, config, buttonColor, buttonTextColor, radius,
}: {
  slug: string;
  config: BioLeadForm;
  buttonColor: string;
  buttonTextColor: string;
  radius: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
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
      ) => Promise<{ error: { message: string } | null }>)("submit_bio_lead", {
        _slug: slug,
        _name: name.trim() || null,
        _email: email.trim() || null,
        _phone: phone.trim() || null,
      });
      if (error) throw error;
      setDone(true);
    } catch {
      alert("Não foi possível enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="w-full rounded-2xl bg-white/90 backdrop-blur-sm shadow-md p-6 text-center">
        <p className="font-display font-bold text-gray-900">Recebido! 💜</p>
        <p className="text-sm text-gray-700 mt-1">Logo entro em contato.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white/90 backdrop-blur-sm shadow-md p-6">
      <h2 className="font-display font-bold text-gray-900 text-center">{config.title}</h2>
      {config.subtitle && <p className="text-sm text-gray-600 text-center mt-1 mb-4">{config.subtitle}</p>}
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
        {showEmail && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu email" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />}
        {showPhone && <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Seu telefone" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />}
        <label className="flex items-start gap-2 text-[11px] text-gray-600 leading-snug">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          {config.consentText}
        </label>
        <button type="button" onClick={submit} disabled={sending || !consent} className={cn("w-full font-body font-semibold py-3 shadow-md disabled:opacity-50 transition", radius)} style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
          {sending ? "Enviando..." : config.buttonText}
        </button>
      </div>
    </div>
  );
}

export default BioPage;
