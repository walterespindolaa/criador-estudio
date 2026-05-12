import { useMemo, useState } from "react";
import { Sparkles, Loader2, Hash, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callAIContextBuilder } from "@/lib/ai/claude";
import type { Profile } from "@/hooks/useProfile";

type Pillar = { id: string; name: string };

type Props = {
  title: string;
  format: string;
  platform: string;
  pillarId: string;
  pillars: Pillar[];
  caption: string;
  userId: string;
  profile: Profile | null;
};

export function HashtagsSection({
  title,
  format,
  platform,
  pillarId,
  pillars,
  caption,
  userId,
  profile,
}: Props) {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => {
    const third = Math.ceil(suggested.length / 3);
    return {
      high: suggested.slice(0, third),
      medium: suggested.slice(third, third * 2),
      niche: suggested.slice(third * 2),
    };
  }, [suggested]);

  const toggle = (tag: string) => {
    setSelected(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const handleGenerate = async () => {
    if (!title || loading) return;
    setLoading(true);
    setSuggested([]);
    setSelected([]);
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "suggest-hashtags",
        data: {
          titulo: title,
          formato: format,
          plataforma: platform,
          pilar: pillars.find(p => p.id === pillarId)?.name,
          nicho: profile?.niche,
          legenda: caption,
        },
      });
      const raw = typeof result === "string" ? result.replace(/```json?\n?|\n?```/g, "").trim() : "";
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) tags = parsed.map(String);
      } catch {
        tags = raw.split(/[,\n]+/).map(t => t.replace(/^#?\s*/, "").trim()).filter(Boolean);
      }
      const clean = tags.slice(0, 30);
      setSuggested(clean);
      setSelected(clean.slice(0, 10));
    } catch (e) {
      console.error("Suggest hashtags failed", e);
      toast.error("Erro ao sugerir hashtags.");
    } finally {
      setLoading(false);
    }
  };

  const chipClasses = (tag: string) =>
    cn(
      "px-2 py-0.5 rounded-full text-[11px] font-body border transition-all",
      selected.includes(tag)
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-card border-border text-muted-foreground hover:border-primary/20"
    );

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
            <Hash className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-display font-semibold text-foreground">Hashtags</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={!title || loading}
          className="text-xs"
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
          ) : (
            <><Sparkles className="h-3 w-3 mr-1" /> Sugerir hashtags</>
          )}
        </Button>
      </div>

      {suggested.length > 0 && (
        <div className="space-y-2">
          {groups.high.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-emerald-600 mb-1">Alta relevância</p>
              <div className="flex flex-wrap gap-1">
                {groups.high.map(tag => (
                  <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClasses(tag)}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.medium.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-amber-600 mb-1">Média relevância</p>
              <div className="flex flex-wrap gap-1">
                {groups.medium.map(tag => (
                  <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClasses(tag)}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.niche.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-violet-600 mb-1">Nicho específico</p>
              <div className="flex flex-wrap gap-1">
                {groups.niche.map(tag => (
                  <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClasses(tag)}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground font-body">{selected.length} selecionadas</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => {
                    const text = selected.map(t => `#${t}`).join(" ");
                    navigator.clipboard.writeText(text);
                    toast.success("Hashtags copiadas!");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>
              <p className="text-xs font-body text-primary break-all">
                {selected.map(t => `#${t}`).join(" ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
