import { Film, Grid3X3, Pencil, UserCircle } from "lucide-react";
import type { Profile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

// Dados REAIS do Instagram conectado (via instagram-sync). Quando presentes,
// o header vira um espelho do perfil de verdade: foto, @ e seguidores atuais.
export type IgHeaderData = {
  username: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following?: number | null;
};

type Props = {
  profile: Profile | null;
  postCount: number;
  ig?: IgHeaderData | null;
  // So aparece quando e a propria conta (manager gerenciando outro nao edita aqui).
  onEdit?: () => void;
};

// 12345 -> "12,3 mil" (jeito que o proprio Instagram abrevia em PT).
function formataSeguidores(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

export function FeedProfileHeader({ profile, postCount, ig, onEdit }: Props) {
  const name = profile?.name || "Criador";
  const niche = profile?.niche || "";
  const bio = profile?.bio || "";
  const initial = name.charAt(0).toUpperCase();
  const avatar = ig?.avatarUrl || profile?.avatar_url || null;
  const handle = ig?.username || profile?.instagram_handle?.replace(/^@/, "") || null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full ring-[3px] ring-primary/30 ring-offset-2 ring-offset-background overflow-hidden shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                // Link do CDN da Meta expirado: cai pra foto do perfil do CRIA
                // em vez de mostrar o icone de imagem quebrada.
                onError={(e) => {
                  const img = e.currentTarget;
                  if (profile?.avatar_url && img.src !== profile.avatar_url) img.src = profile.avatar_url;
                  else img.style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-2xl font-display font-bold text-white">{initial}</span>
              </div>
            )}
          </div>

          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-xl font-display font-extrabold text-foreground">{postCount}</p>
              <p className="text-xs text-muted-foreground font-body">{postCount === 1 ? "post" : "posts"}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-display font-extrabold text-foreground">
                {typeof ig?.followers === "number" ? formataSeguidores(ig.followers) : "-"}
              </p>
              <p className="text-xs text-muted-foreground font-body">seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-display font-extrabold text-foreground">
                {typeof ig?.following === "number" ? formataSeguidores(ig.following) : "-"}
              </p>
              <p className="text-xs text-muted-foreground font-body">seguindo</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-display font-bold text-foreground">{name}</h2>
          {handle && <p className="text-xs text-muted-foreground font-body">@{handle}</p>}
          {niche && <p className="text-xs text-muted-foreground font-body mt-0.5">{niche}</p>}
          {bio && (
            <p className="text-sm text-foreground font-body mt-1.5 leading-relaxed whitespace-pre-line">{bio}</p>
          )}
        </div>

        {onEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
            Editar perfil
          </Button>
        )}
      </div>

      <div className="flex border-t border-border">
        <button type="button" className="flex-1 py-3 flex justify-center border-b-2 border-foreground" aria-label="Grid">
          <Grid3X3 className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <button type="button" className="flex-1 py-3 flex justify-center text-muted-foreground" aria-label="Reels">
          <Film className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button type="button" className="flex-1 py-3 flex justify-center text-muted-foreground" aria-label="Marcações">
          <UserCircle className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
