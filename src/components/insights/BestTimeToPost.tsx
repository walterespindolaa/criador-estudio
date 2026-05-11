import { useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post } from "@/hooks/usePosts";

type Props = {
  posts: Post[];
};

type Slot = {
  time: string;
  rating: number;
  label: string;
};

const DEFAULT_SLOTS: Slot[] = [
  { time: "11:30", rating: 5, label: "Ótimo" },
  { time: "18:00", rating: 4, label: "Bom" },
  { time: "20:30", rating: 3, label: "Regular" },
];

const BUCKET_TO_TIME: Record<string, string> = {
  manhã: "10:00",
  tarde: "16:00",
  noite: "20:00",
};

export function BestTimeToPost({ posts }: Props) {
  const publishedPosts = useMemo(
    () => posts.filter(p => p.status === "publicado" && p.scheduled_time),
    [posts]
  );

  const timeSlots = useMemo<Slot[]>(() => {
    if (publishedPosts.length < 3) return DEFAULT_SLOTS;

    const buckets: Record<string, number> = {};
    publishedPosts.forEach(p => {
      if (!p.scheduled_time) return;
      const hour = parseInt(p.scheduled_time.split(":")[0], 10);
      if (Number.isNaN(hour)) return;
      const bucket = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

    const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3).map((entry, i) => ({
      time: BUCKET_TO_TIME[entry[0]] ?? "12:00",
      rating: 5 - i,
      label: i === 0 ? "Ótimo" : i === 1 ? "Bom" : "Regular",
    }));
  }, [publishedPosts]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Clock className="h-4 w-4 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground">Melhores Horários</h3>
          <p className="text-[10px] text-muted-foreground font-body">
            {publishedPosts.length >= 3 ? "Baseado nos seus posts" : "Sugestão para o Instagram BR"}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {timeSlots.map((slot, i) => (
          <div key={`${slot.time}-${i}`} className="flex items-center gap-3">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                i === 0 ? "bg-emerald-500" : i === 1 ? "bg-amber-500" : "bg-muted-foreground/40"
              )}
            />
            <span className="text-sm font-body font-semibold text-foreground w-12">{slot.time}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <svg
                  key={j}
                  className={cn("h-3.5 w-3.5", j < slot.rating ? "text-amber-400" : "text-muted-foreground/30")}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span
              className={cn(
                "text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full",
                i === 0
                  ? "bg-emerald-50 text-emerald-600"
                  : i === 1
                  ? "bg-amber-50 text-amber-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {slot.label}
            </span>
          </div>
        ))}
      </div>

      {publishedPosts.length < 3 && (
        <p className="text-[10px] text-muted-foreground font-body mt-3 italic">
          Publique mais posts para receber horários personalizados baseados no seu público.
        </p>
      )}
    </div>
  );
}
