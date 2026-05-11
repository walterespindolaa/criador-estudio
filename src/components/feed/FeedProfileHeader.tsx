import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/hooks/useProfile";

type Props = {
  profile: Profile | null;
  postCount: number;
};

export function FeedProfileHeader({ profile, postCount }: Props) {
  const name = profile?.name || "Seu nome";
  const handle = profile?.instagram_handle?.replace(/^@/, "") || "";
  const niche = profile?.niche || "";
  const bio = profile?.bio || "Sua bio aparece aqui.";

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CF";

  return (
    <div className="px-4 sm:px-6 py-5 bg-card rounded-t-2xl border border-b-0 border-border">
      <div className="flex items-start gap-4 sm:gap-6">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-primary/10 shrink-0">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={name} /> : null}
          <AvatarFallback className="bg-muted text-foreground text-lg font-display font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="font-display font-bold text-base sm:text-lg text-foreground truncate">
              {name}
            </p>
            {(handle || niche) && (
              <p className="text-xs sm:text-sm font-body text-muted-foreground truncate">
                {handle && `@${handle}`}
                {handle && niche && " · "}
                {niche}
              </p>
            )}
          </div>

          <p className="text-sm font-body text-foreground/80 mt-1.5 leading-snug line-clamp-3 whitespace-pre-line">
            {bio}
          </p>

          <div className="mt-3 pt-3 border-t border-border/60">
            <span className="text-sm font-body">
              <span className="font-display font-bold text-foreground">{postCount}</span>{" "}
              <span className="text-muted-foreground">{postCount === 1 ? "post" : "posts"}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
