import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUrl } from "@/lib/sanitize";
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

const STYLE_RADIUS: Record<ButtonStyle, string> = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
  square: "rounded-md",
};

type ProfileLite = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  niche: string | null;
  instagram_handle: string | null;
  bio_theme: unknown;
};

type BioLinkLite = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number | null;
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
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, bio, avatar_url, niche, instagram_handle, bio_theme")
        .eq("bio_slug", slug)
        .maybeSingle();

      if (cancelled) return;
      if (profileError || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: linkData } = await supabase
        .from("bio_links")
        .select("id, title, url, icon, position")
        .eq("user_id", profileData.id)
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (cancelled) return;
      setProfile(profileData as ProfileLite);
      setLinks((linkData ?? []) as BioLinkLite[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const theme = useMemo(() => parseTheme(profile?.bio_theme), [profile?.bio_theme]);

  const trackClick = (id: string) => {
    void supabase.rpc("increment_bio_link_click", { link_id: id });
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

  const initial = profile.name?.charAt(0)?.toUpperCase() || "C";

  return (
    <div
      className="min-h-screen w-full px-5 py-10 flex flex-col items-center"
      style={{
        background: `linear-gradient(180deg, ${theme.bgColor} 0%, ${theme.bgColor}cc 100%)`,
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {theme.useProfile && (
          <>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[3px] mb-4 shadow-xl">
              <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-display font-bold text-3xl">{initial}</span>
                )}
              </div>
            </div>
            <h1 className="font-display font-extrabold text-xl text-gray-900 text-center">
              {profile.name}
            </h1>
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 font-body mt-1 hover:underline"
              >
                @{profile.instagram_handle.replace(/^@/, "")}
              </a>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-700 text-center mt-3 max-w-xs font-body whitespace-pre-line">
                {profile.bio}
              </p>
            )}
          </>
        )}

        <div className="w-full mt-6 space-y-3">
          {links.length === 0 ? (
            <p className="text-sm text-center text-gray-600 font-body py-8">
              Sem links no momento.
            </p>
          ) : (
            links.map((link) => {
              const safeUrl = sanitizeUrl(link.url);
              if (!safeUrl) return null;
              return (
                <a
                  key={link.id}
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick(link.id)}
                  className={cn(
                    "block w-full px-6 py-4 backdrop-blur text-center font-body font-semibold text-gray-900",
                    "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] transition-all duration-200",
                    "shadow-sm",
                    STYLE_RADIUS[theme.buttonStyle]
                  )}
                  style={{ backgroundColor: theme.buttonColor }}
                >
                  {link.icon && <span className="mr-2">{link.icon}</span>}
                  {link.title}
                </a>
              );
            })
          )}
        </div>

        <Link
          to="/"
          className="mt-12 text-xs text-gray-700/80 hover:text-gray-900 font-body transition"
        >
          Feito com 💜 CreatorsFlow
        </Link>
      </div>
    </div>
  );
};

export default BioPage;
