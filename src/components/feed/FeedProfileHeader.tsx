import { Film, Grid3X3, UserCircle } from "lucide-react";
import type { Profile } from "@/hooks/useProfile";

type Props = {
  profile: Profile | null;
  postCount: number;
};

export function FeedProfileHeader({ profile, postCount }: Props) {
  const name = profile?.name || "Criador";
  const niche = profile?.niche || "";
  const bio = profile?.bio || "";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full ring-[3px] ring-primary/30 ring-offset-2 ring-offset-background overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
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
              <p className="text-xl font-display font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-body">seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-display font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-body">seguindo</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-display font-bold text-foreground">{name}</h2>
          {niche && <p className="text-xs text-muted-foreground font-body mt-0.5">{niche}</p>}
          {bio && (
            <p className="text-sm text-foreground font-body mt-1.5 leading-relaxed whitespace-pre-line">{bio}</p>
          )}
        </div>
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
