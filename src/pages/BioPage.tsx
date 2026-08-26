import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Loader2, Instagram, Youtube, Twitter, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail, sanitizeUrl } from "@/lib/sanitize";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { renderRichText } from "@/lib/richText";
import { cn } from "@/lib/utils";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { corDeDestaque, corSobre, faltaNoBloco } from "@/lib/bioBlocks";
import { BlocoPublico } from "@/components/bio/BlocoPublico";
import { SiteBio, PaginaItem, type MarcaSite, type ItemLite } from "@/components/bio/SiteBio";

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
  /* A seção "links" fica SEMPRE ligada. O interruptor dela era um jeito fácil
     de esvaziar a própria página sem entender por quê, e com os blocos ela
     deixou de ser uma seção pra virar o lugar onde a página inteira mora. */
  for (const s of out) { if (s.id === "links") s.on = true; }
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


type BlocoLite = { id: string; kind: string; data: Record<string, unknown>; position: number };
/** O telefone que a pessoa cadastrou no rodapé do site, pra a página de um
 *  serviço já abrir a conversa citando aquele serviço. */
function telefoneDoRodape(blocos: BlocoLite[]): string | undefined {
  const c = blocos.find((b) => b.kind === "contato");
  const t = c ? String((c.data as Record<string, unknown>)?.telefone ?? "") : "";
  return t.trim() || undefined;
}

type ItemPublico = {
  tipo: string; slug: string; titulo: string; resumo: string | null; capa: string | null;
  preco: number | null; preco_texto: string | null; conteudo: string | null;
  galeria: string[]; cta_texto: string | null; cta_url: string | null; publicado_em: string;
};

/* ── DE ONDE A PESSOA VEIO ──
   Um rótulo curto, resolvido aqui e não no servidor, porque o referrer só
   existe no navegador. A lista é fechada de propósito: guardar o endereço
   completo de onde a pessoa estava seria guardar dado de terceiro sem
   precisar, e ninguém filtra relatório por isso.

   O `?src=` na frente do referrer porque é explícito: é o que a gestora cola
   no QR do cardápio pra saber que aquela visita veio do material impresso. */
function descobrirOrigem(): string {
  try {
    const src = new URLSearchParams(window.location.search).get("src");
    if (src) {
      const s = src.toLowerCase();
      if (["qr", "instagram", "whatsapp", "facebook", "google", "tiktok"].includes(s)) return s;
      return "outro";
    }
    const r = (document.referrer || "").toLowerCase();
    if (!r) return "direto";
    if (r.includes("instagram")) return "instagram";
    if (r.includes("whatsapp") || r.includes("wa.me")) return "whatsapp";
    if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
    if (r.includes("google")) return "google";
    if (r.includes("tiktok")) return "tiktok";
    // Mesmo domínio (a pessoa navegou dentro da própria página) não é origem.
    if (r.includes(window.location.host)) return "direto";
    return "outro";
  } catch { return "direto"; }
}

const ConteudoDaBio = () => {
  const { slug, itemSlug } = useParams<{ slug: string; itemSlug?: string }>();
  const navegar = useNavigate();
  const location = useLocation();
  useForceLightTheme();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /* Separado do notFound de propósito: "não existe" é definitivo e a pessoa vai
     embora; "não carregou" pede pra tentar de novo. Misturar os dois fazia todo
     mundo no metrô achar que a página do cliente tinha saído do ar. */
  const [falhouRede, setFalhouRede] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  // Página montada pela social mídia (não é a conta de um criador). Muda de
  // onde vêm os leads e como a visita é contada.
  const [ehDaAgencia, setDaAgencia] = useState(false);
  const [links, setLinks] = useState<BioLinkLite[]>([]);
  const [blocos, setBlocos] = useState<BlocoLite[]>([]);
  const [produtos, setProdutos] = useState<ItemLite[]>([]);
  const [posts, setPosts] = useState<ItemLite[]>([]);
  const [item, setItem] = useState<ItemPublico | null>(null);
  const [itemFaltou, setItemFaltou] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) { setLoading(false); return; }
      setLoading(true);
      // Os dois zerados: trocar de endereço não pode herdar o "não existe" nem
      // o "não carregou" da tentativa anterior.
      setFalhouRede(false);
      setNotFound(false);
      /* try/catch/finally envolvendo TUDO. Antes, uma promessa rejeitada no
         meio (RPC que não existe, sessão do supabase-js estourando, rede
         caindo) pulava o setLoading(false) e o visitante ficava no rodinha
         PARA SEMPRE, sem mensagem e sem botão. */
      try {
        // Dois lugares podem responder por um endereço: a conta de um criador
        // (profiles) ou a página que uma social mídia montou pra um cliente dela
        // (bio_pages). O endereço é único entre os dois, então basta perguntar
        // pro primeiro e cair no segundo.
        const { data: profileRows, error: erroPerfil } = await supabase
          .rpc("get_public_profile_by_slug", { _slug: slug });
        let profileData = Array.isArray(profileRows) ? profileRows[0] : null;
        let daAgencia = false;
        let houveErro = !!erroPerfil;

        if (!profileData) {
          const { data: pageRows, error: erroPagina } = await sbRpc("get_public_bio_page_by_slug", { _slug: slug });
          const row = Array.isArray(pageRows) ? pageRows[0] : null;
          if (row) { profileData = row as typeof profileData; daAgencia = true; houveErro = false; }
          else if (erroPagina) houveErro = true;
        }

        if (cancelled) return;
        if (!profileData) {
          /* Erro de rede NÃO é página inexistente. No metrô, no elevador ou no
             4G ruim a pessoa lia "esse link não existe" e ia embora achando que
             o cliente tinha sumido da internet. São duas telas diferentes:
             uma é definitiva, a outra pede pra tentar de novo. */
          if (houveErro) setFalhouRede(true); else setNotFound(true);
          return;
        }

        // O estilo mora na aparência salva, e vale pros dois mundos: a conta usa
        // profiles.bio_settings, a página da agência usa bio_pages.settings, e a
        // RPC devolve os dois com o mesmo nome de coluna.
        const ehSite = parseSettings((profileData as { bio_settings?: unknown }).bio_settings).layout === "vitrine";

        /* Tudo o que falta vai JUNTO, não em fila. Eram até quatro idas ao
           banco uma esperando a outra, e em 4G brasileiro isso é segundo e meio
           de rodinha antes do primeiro pixel. Nenhuma delas depende do
           resultado da outra: só do estilo, que a gente já sabe aqui.

           No modo Site nem se pede a lista de links do formato antigo: ela não
           é usada lá, era uma ida ao banco jogada fora em toda visita. */
        const [linkRes, blocoRes, produtoRes, postRes] = await Promise.all([
          ehSite
            ? Promise.resolve({ data: [] as unknown })
            : (daAgencia
                ? sbRpc("get_public_bio_page_links_by_slug", { _slug: slug })
                : supabase.rpc("get_public_bio_links_by_slug", { _slug: slug })),
          // BLOCOS: o formato novo da página. Enquanto a migration não roda em
          // produção, a RPC não existe e a lista volta vazia, então a página cai
          // sozinha no formato antigo de links. Ninguém fica com a bio fora do ar
          // esperando alguém abrir o Supabase.
          sbRpc("get_public_bio_blocks", { _slug: slug, _estilo: ehSite ? "site" : "classico" }),
          ehSite ? sbRpc("get_public_bio_items", { _slug: slug, _tipo: "produto" }) : Promise.resolve({ data: [] }),
          ehSite ? sbRpc("get_public_bio_items", { _slug: slug, _tipo: "post" }) : Promise.resolve({ data: [] }),
        ]);

        if (cancelled) return;
        setProdutos(Array.isArray(produtoRes.data) ? (produtoRes.data as ItemLite[]) : []);
        setPosts(Array.isArray(postRes.data) ? (postRes.data as ItemLite[]) : []);
        setBlocos(Array.isArray(blocoRes.data) ? (blocoRes.data as BlocoLite[]) : []);
        setDaAgencia(daAgencia);
        setProfile(profileData as ProfileLite);
        // Array.isArray e não `?? []`: um objeto vindo daqui fazia links.map
        // lançar, e sem rede de segurança isso era tela branca.
        setLinks(Array.isArray(linkRes.data) ? (linkRes.data as BioLinkLite[]) : []);

        // Conta a visita 1x por sessão/navegador (evita inflar com refresh).
        const key = `bioviewed:${slug}`;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void supabase.functions.invoke("bio-track", {
              body: { type: "view", slug, kind: daAgencia ? "page" : "profile", origem: descobrirOrigem() },
            });
          }
        } catch { /* sessionStorage indisponível (aba anônima do Safari): ignora */ }
      } catch {
        if (!cancelled) setFalhouRede(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── PÁGINA INTERNA ──
  // /bio/:slug/p/:item é um serviço, /bio/:slug/blog/:item é um post. Cada um
  // tem endereço próprio pra o cliente mandar UM serviço no WhatsApp e pra o
  // Google conseguir indexar cada assunto separadamente.
  const tipoItem = itemSlug ? (location.pathname.includes("/blog/") ? "post" : "produto") : null;
  useEffect(() => {
    let cancelado = false;
    if (!slug || !itemSlug || !tipoItem) { setItem(null); setItemFaltou(false); return; }
    (async () => {
      const { data } = await sbRpc("get_public_bio_item", { _slug: slug, _tipo: tipoItem, _item: itemSlug });
      const row = Array.isArray(data) ? data[0] : null;
      if (cancelado) return;
      if (row) {
        const r = row as ItemPublico & { galeria?: unknown };
        setItem({ ...r, galeria: Array.isArray(r.galeria) ? (r.galeria as string[]) : [] });
        setItemFaltou(false);
      } else {
        setItem(null);
        setItemFaltou(true);
      }
    })();
    return () => { cancelado = true; };
  }, [slug, itemSlug, tipoItem]);

  const settings = useMemo(() => parseSettings(profile?.bio_settings), [profile?.bio_settings]);

  /* ── O QUE O GOOGLE E A ABA DO NAVEGADOR MOSTRAM ──
     Sem isso toda página do Cria se chama igual, e o resultado de busca do
     cliente aparece com o nome do sistema em vez do nome dele.

     Limite honesto: como o site é montado no navegador, a prévia que o
     WhatsApp mostra ao colar o link continua a genérica. Resolver isso exige
     renderizar no servidor, e ficou pra depois. */
  useEffect(() => {
    if (!profile) return;
    /* Guardar ANTES de escrever. Estava lá embaixo, depois do document.title já
       ter sido trocado, então o cleanup "restaurava" o próprio nome do cliente
       e ele ficava grudado na aba do navegador depois de sair da bio. */
    const tituloAntes = document.title;
    const tagExistia = !!document.querySelector('meta[name="description"]');
    const descAntes = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;

    const nome = (settings.header?.name ?? "").trim() || profile.name || "";
    const titulo = item ? `${item.titulo} · ${nome}` : nome;
    if (titulo) document.title = titulo;

    const desc = (item?.resumo || settings.header?.bio || profile.bio || "").trim().slice(0, 160);
    if (desc) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", desc);
    }
    return () => {
      document.title = tituloAntes;
      const tag = document.querySelector('meta[name="description"]');
      if (!tag) return;
      // A tag que a gente criou some junto; a que já existia volta ao que era.
      if (tagExistia) { if (descAntes !== null) tag.setAttribute("content", descAntes); }
      else tag.remove();
    };
  }, [profile, settings.header?.name, settings.header?.bio, item]);
  const radius = STYLE_RADIUS[settings.buttonStyle];
  const isOutline = settings.buttonStyle === "outline";
  const visualDosBlocos = {
    buttonColor: settings.buttonColor, buttonTextColor: settings.buttonTextColor,
    cardColor: settings.cardColor, cardTextColor: settings.cardTextColor,
    radius, isOutline,
  };
  const fontStack = fontStackFor(settings.fontFamily);

  const trackClick = (id: string) => {
    void supabase.functions.invoke("bio-track", { body: { type: "click", linkId: id, slug, origem: descobrirOrigem() } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (falhouRede) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-white px-6 text-center">
        <div className="max-w-xs">
          <p className="text-[15px] font-display font-bold text-gray-900">Não conseguimos carregar a página</p>
          <p className="mt-1.5 text-[13px] font-body text-gray-500 leading-relaxed">
            Pode ser a sua conexão. A página continua no ar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-11 px-5 rounded-full bg-gray-900 text-white text-[14px] font-display font-bold"
          >
            Tentar de novo
          </button>
        </div>
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

  // ── MODO SITE ──
  // A cor de destaque do Site pinta TEXTO sobre fundo branco (rótulo de seção,
  // data do post, preço). O padrão do botão é branco, e branco sobre branco
  // some. Então: usa a cor do botão quando ela é escura o bastante, e cai no
  // preto da marca quando não é.
  const corDestaque = corDeDestaque(settings.buttonColor);
  const marcaSite: MarcaSite = {
    nome: headerName || "Site",
    logo: settings.header?.avatar || profile.avatar_url,
    cor: corDestaque,
    corTexto: corSobre(corDestaque),
  };
  const voltarPraCasa = () => navegar(`/bio/${slug}`);
  const capturaDoBloco = (b: BlocoLite) => (
    <LeadForm
      slug={slug ?? ""} daAgencia={ehDaAgencia} blocoId={b.id}
      config={{
        title: String(b.data?.titulo ?? "Deixe seu contato"),
        subtitle: String(b.data?.subtitulo ?? ""),
        fields: b.data?.campos === "email" ? "email" : b.data?.campos === "telefone" ? "phone" : "both",
        buttonText: String(b.data?.botao ?? "Enviar"),
        consentText: String(b.data?.consentimento ?? ""),
      }}
      buttonColor={settings.buttonColor} buttonTextColor={settings.buttonTextColor} radius={radius}
      cardColor={settings.cardColor} cardTextColor={settings.cardTextColor} />
  );

  // Página interna de um serviço ou de um post.
  if (itemSlug) {
    if (itemFaltou) {
      return (
        <div className="min-h-[100dvh] grid place-items-center bg-white px-6 text-center">
          <div>
            <p className="font-display font-bold text-lg text-gray-900">Essa página não existe mais</p>
            <button type="button" onClick={voltarPraCasa} className="text-sm text-gray-600 underline mt-2 min-h-[44px]">
              Voltar para o início
            </button>
          </div>
        </div>
      );
    }
    if (!item) {
      return <div className="min-h-[100dvh] grid place-items-center bg-white text-sm text-gray-400">Carregando...</div>;
    }
    return (
      <>
        <BioFontStyle stack={fontStack} />
        <div className="bio-font-scope">
          <PaginaItem
            item={item} marca={marcaSite}
            voltarRotulo={item.tipo === "post" ? "Voltar para o blog" : "Voltar para os serviços"}
            aoVoltar={voltarPraCasa}
            whatsapp={telefoneDoRodape(blocos)} />
        </div>
      </>
    );
  }

  if (settings.layout === "vitrine") {
    // Site montado por blocos. Sem blocos, cai na Vitrine antiga, pra a página
    // de quem montou no formato velho continuar no ar.
    if (blocos.length > 0) {
      return (
        <>
          <BioFontStyle stack={fontStack} />
          <div className="bio-font-scope">
            <SiteBio
              blocos={blocos} marca={marcaSite} produtos={produtos} posts={posts}
              visual={visualDosBlocos}
              aoAbrirProduto={(sl) => navegar(`/bio/${slug}/p/${sl}`)}
              aoAbrirPost={(sl) => navegar(`/bio/${slug}/blog/${sl}`)}
              onClique={(id) => trackClick(id)}
              capturaDoBloco={capturaDoBloco} />
          </div>
        </>
      );
    }
    return <VitrineView settings={settings} headerName={headerName} headerBio={headerBio} activeSocials={activeSocials} />;
  }

  return (
    <div
      className="bio-font-scope relative min-h-[100dvh] w-full px-5 py-10 md:py-16 flex flex-col items-center"
      style={backgroundStyle(settings)}
    >
      <BioFontStyle stack={fontStack} />
      <BgOverlay amount={settings.bgOverlay} />
      {/* my-auto (e não justify-center): página com poucos links deixava um
          vazio enorme embaixo, e justify-center num flex que estoura a tela
          corta o topo no Safari. Com margem automática o conteúdo centraliza
          quando cabe e volta a rolar normal quando não cabe. */}
      <div className="relative z-10 w-full max-w-[520px] my-auto flex flex-col items-center">
        {/* BANNER = CAPA: fica ATRÁS da foto, como capa de perfil. Antes era um
            card solto no meio dos links e ficava perdido. */}
        {/* Antes o banner só aparecia se a seção "banner" estivesse ligada num
            interruptor separado, que vinha DESLIGADO de fábrica. A pessoa
            subia a imagem, salvava, e nada acontecia. Agora subir a imagem é
            o próprio ato de ligar: remover a imagem é que desliga. */}
        {settings.bannerImage && (
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
          {/* A foto é o primeiro sinal de que a pessoa chegou no lugar certo.
              Em 24 unidades ela competia de igual pra igual com os botões; em
              32 ela ancora o topo sem empurrar o resto pra fora da primeira
              tela do celular. */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[3px] mb-4 shadow-xl">
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
          // "Sobre mim" e "Captura de lead" viraram BLOCOS (Texto e Captura de
          // contato). Quem já montou no formato novo tem os dois lá, então
          // desenhar a seção antiga junto mostrava o mesmo card duas vezes.
          if (blocos.length > 0 && (sec.id === "about" || sec.id === "lead")) return null;
          if (sec.id === "about") {
            if (!settings.about.text && !settings.about.image) return null;
            return (
              <div key="about"
                className={`w-full mt-7 rounded-2xl shadow-md overflow-hidden text-left ${settings.cardColor ? "" : "bg-white/90 backdrop-blur-sm"}`}
                style={settings.cardColor ? { backgroundColor: settings.cardColor, color: settings.cardTextColor || undefined } : undefined}>
                {settings.about.image && (
                  <img src={settings.about.image} alt="" loading="lazy" decoding="async" className="w-full aspect-[16/9] object-cover" />
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
          // ── BLOCOS ──
          // Quando a página já foi montada no formato novo, é ele que manda.
          // O bloco de captura desenha o MESMO formulário da seção de lead,
          // pra não existirem duas versões do mesmo componente.
          if (blocos.length > 0) {
            return (
              <motion.div
                key="blocos"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
                className="w-full mt-7 space-y-3"
              >
                {blocos.map((b) => (
                  <motion.div key={b.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <BlocoPublico
                      kind={b.kind}
                      data={b.data ?? {}}
                      visual={visualDosBlocos}
                      onClique={() => trackClick(b.id)}
                      captura={
                        <LeadForm
                          slug={slug ?? ""} daAgencia={ehDaAgencia} blocoId={b.id}
                          config={{
                            title: String(b.data?.titulo ?? "Deixe seu contato"),
                            subtitle: String(b.data?.subtitulo ?? ""),
                            fields: (b.data?.campos === "email" || b.data?.campos === "phone" || b.data?.campos === "telefone")
                              ? (b.data?.campos === "email" ? "email" : "phone") : "both",
                            buttonText: String(b.data?.botao ?? "Enviar"),
                            consentText: String(b.data?.consentimento ?? ""),
                          }}
                          buttonColor={settings.buttonColor} buttonTextColor={settings.buttonTextColor} radius={radius}
                          cardColor={settings.cardColor} cardTextColor={settings.cardTextColor}
                        />
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
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
                      <div className="px-5 py-4 text-center whitespace-pre-line [text-wrap:balance]">
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

/** (00) 00000-0000 conforme digita. O visitante entende o campo sem ler o
 *  rótulo, e o número chega no mesmo formato pra quem vai ligar. */
function mascaraTelefone(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function LeadForm({
  slug, daAgencia, blocoId, config, buttonColor, buttonTextColor, radius, cardColor, cardTextColor,
}: {
  slug: string;
  /** Página montada pela social mídia: o lead é dela, não de um criador. */
  daAgencia?: boolean;
  /** De qual bloco veio. É o que permite o contato virar card no pipeline
   *  quando a chave daquele bloco está ligada. */
  blocoId?: string;
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

  /* Guarda contra envio duplo. O `disabled` do botão só vale DEPOIS do
     re-render, então dois toques rápidos no celular passavam os dois e a
     gestora recebia o mesmo contato duas vezes. A ref é síncrona. */
  const enviando = useRef(false);

  const submit = async () => {
    /* Antes, cada uma destas checagens era um `return` mudo: a pessoa tocava
       em Enviar e NADA acontecia, nem mensagem, nem borda vermelha. No celular
       isso se lê como "o site travou", e ela vai embora. */
    if (!consent) { setErr("Marque o aviso de consentimento pra continuar."); return; }

    const tel = phone.replace(/\D/g, "");
    const mail = email.trim();
    if (showEmail && showPhone && !mail && !tel) { setErr("Informe seu e-mail ou seu telefone."); return; }
    if (showEmail && !showPhone && !mail) { setErr("Informe seu e-mail."); return; }
    if (!showEmail && showPhone && !tel) { setErr("Informe seu telefone."); return; }

    /* Validar formato não é frescura: "joao" e "(41) 9" viram lead que ninguém
       consegue contatar, e a lista da gestora enche de contato morto. O limite
       de 10 dígitos é o mesmo que o bloco de WhatsApp já usa (DDD + número). */
    if (mail && !isValidEmail(mail)) { setErr("Esse e-mail parece incompleto. Confira."); return; }
    if (tel && tel.length < 10) { setErr("Telefone incompleto. Inclua o DDD."); return; }

    if (enviando.current) return;
    enviando.current = true;
    setErr(null);
    setSending(true);
    try {
      /* Passa pela edge e não direto na RPC porque só a edge enxerga o IP.
         Batendo direto, o único freio possível era por PÁGINA, e um robô que
         estourasse esse teto trancava o formulário pra todos os visitantes de
         verdade. Por IP, o robô para sozinho e a página continua funcionando. */
      const { data, error } = await supabase.functions.invoke("bio-track", {
        body: {
          type: "lead", slug, daAgencia: !!daAgencia,
          name: name.trim(), email: mail, phone: phone.trim(),
          blockId: blocoId ?? null,
        },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; erro?: string } | null;
      if (!r?.ok) {
        setErr(r?.erro === "muitas_tentativas"
          ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
          : "Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Não foi possível enviar. Tente novamente.");
    } finally {
      enviando.current = false;
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className={`w-full rounded-2xl shadow-md p-6 text-center ${cardColor ? "" : "bg-white/90 backdrop-blur-sm"}`}
        style={cardColor ? { backgroundColor: cardColor, color: cardTextColor || undefined } : undefined}>
        <p className={`font-display font-bold ${cardColor ? "" : "text-gray-900"}`}>Recebido!</p>
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
        {showPhone && <input aria-label="Seu telefone" type="tel" inputMode="tel" value={phone}
          onChange={(e) => setPhone(mascaraTelefone(e.target.value))}
          placeholder="(00) 00000-0000" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />}
        {/* py-1.5 e o quadrado em 16px: o alvo de toque do consentimento era
            do tamanho da letra, e no celular quem errava o dedo achava que o
            formulário não respondia. */}
        <label className={`flex items-start gap-2.5 py-1.5 cursor-pointer text-[11.5px] leading-snug ${cardColor ? "opacity-85" : "text-gray-600"}`}>
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(null); }}
            className="mt-[1px] h-4 w-4 shrink-0 accent-current" />
          <span>{config.consentText}</span>
        </label>
        <button type="button" onClick={submit} disabled={sending} className={cn("w-full min-h-[48px] font-body font-semibold py-3 shadow-md disabled:opacity-50 transition", radius)} style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
          {sending ? "Enviando..." : config.buttonText}
        </button>
        {err && <p role="alert" aria-live="polite" className="text-xs text-red-600 text-center">{err}</p>}
      </div>
    </div>
  );
}

/* MotionConfig com reducedMotion="user": quando a pessoa pediu menos movimento
   no sistema, o framer-motion desliga as animações de entrada sozinho, em toda
   a página, sem precisar lembrar disso em cada bloco. Isso não é enfeite: pra
   quem tem sensibilidade vestibular, uma página que desliza inteira ao abrir
   dá enjoo de verdade. */
const BioPage = () => (
  <MotionConfig reducedMotion="user">
    <ConteudoDaBio />
  </MotionConfig>
);

export default BioPage;
