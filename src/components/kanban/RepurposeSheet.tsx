import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Repeat2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { FORMAT_LABELS } from "@/lib/constants";
import type { Post } from "@/hooks/usePosts";

type RepurposeResult = {
  titulo: string;
  legenda: string;
  hashtags: string[];
  dica: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPost: Post;
  // "repurpose" = adaptar pra outra plataforma. "recycle" = repostar conteúdo
  // que funcionou, mesma plataforma, com ângulo/gancho novo (perene).
  mode?: "repurpose" | "recycle";
};

const PLATFORMS: { id: string; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

const FORMATS_BY_PLATFORM: Record<string, string[]> = {
  instagram: ["reels", "carrossel", "foto", "story"],
  tiktok: ["video", "carrossel", "foto"],
  youtube: ["video", "shorts"],
};

const TONES: { id: string; label: string }[] = [
  { id: "descontraido", label: "Descontraído" },
  { id: "educativo", label: "Educativo" },
  { id: "provocativo", label: "Provocativo" },
];

function pickClasses(active: boolean) {
  return cn(
    "px-3 py-1.5 rounded-full text-sm font-body border transition-all hover:scale-[1.02]",
    active
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-card border-border text-foreground hover:border-primary/30"
  );
}

function parseRepurpose(raw: unknown): RepurposeResult | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "titulo" in raw) {
    return raw as RepurposeResult;
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/```json?\n?|\n?```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && "titulo" in parsed) return parsed as RepurposeResult;
    } catch {
      return null;
    }
  }
  return null;
}

export function RepurposeSheet({ open, onOpenChange, originalPost, mode = "repurpose" }: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { createPost } = usePosts();
  const navigate = useNavigate();
  const isRecycle = mode === "recycle";

  const initialPlatform = isRecycle
    ? originalPost.platform
    : originalPost.platform === "instagram" ? "tiktok" : "instagram";
  const [targetPlatform, setTargetPlatform] = useState(initialPlatform);
  const [targetFormat, setTargetFormat] = useState<string>(
    isRecycle ? originalPost.format : (FORMATS_BY_PLATFORM[initialPlatform]?.[0] ?? "reels")
  );
  const [targetTone, setTargetTone] = useState("descontraido");
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const availableFormats = useMemo(
    () => FORMATS_BY_PLATFORM[targetPlatform] ?? [],
    [targetPlatform]
  );

  useEffect(() => {
    if (!availableFormats.includes(targetFormat)) {
      setTargetFormat(availableFormats[0] ?? "reels");
    }
  }, [availableFormats, targetFormat]);

  // Ao abrir, ajusta os defaults conforme o modo (reciclar = mesma plataforma/formato).
  useEffect(() => {
    if (!open) {
      setResult(null);
      setLoading(false);
      setCreating(false);
      return;
    }
    const p = isRecycle ? originalPost.platform : (originalPost.platform === "instagram" ? "tiktok" : "instagram");
    setTargetPlatform(p);
    setTargetFormat(isRecycle ? originalPost.format : (FORMATS_BY_PLATFORM[p]?.[0] ?? "reels"));
  }, [open, isRecycle, originalPost]);

  const handleRepurpose = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const raw = await callAIContextBuilder({
        userId: user?.id,
        operation: "repurpose-content",
        data: {
          titulo_original: originalPost.title,
          legenda_original: originalPost.caption,
          formato_original: originalPost.format,
          plataforma_original: originalPost.platform,
          formato_destino: targetFormat,
          plataforma_destino: targetPlatform,
          tom: targetTone,
          nicho: profile?.niche,
        },
      });
      const parsed = parseRepurpose(raw);
      if (!parsed) throw new Error("Resposta inválida");
      setResult(parsed);
    } catch (e) {
      console.error("Repurpose failed", e);
      toast.error("Não consegui gerar a variação agora. Tenta de novo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!result || creating) return;
    setCreating(true);
    try {
      await createPost.mutateAsync({
        title: result.titulo,
        caption: result.legenda,
        platform: targetPlatform,
        format: targetFormat,
        pillar_id: originalPost.pillar_id,
        status: "ideia",
        notes: result.dica ? `Dica: ${result.dica}` : null,
      });
      toast.success(isRecycle ? "Nova versão criada em Ideia! ♻️" : "Post criado em Ideia. Bora produzir! 🎬");
      onOpenChange(false);
      navigate("/app/criando");
    } catch (e) {
      console.error("Create repurposed post failed", e);
      toast.error("Erro ao criar o novo post.");
    } finally {
      setCreating(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = [
      result.titulo,
      "",
      result.legenda,
      "",
      result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
      "",
      `Dica: ${result.dica}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Variação copiada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-border space-y-2 sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Repeat2 className="h-4 w-4 text-white" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-base font-display font-bold text-foreground text-left">
              {isRecycle ? "Reciclar conteúdo" : "Reaproveitar"}
            </DialogTitle>
          </div>
          <p className="text-xs font-body text-muted-foreground line-clamp-2 text-left">
            {isRecycle
              ? `Repostar com ângulo novo: ${originalPost.title}`
              : originalPost.title}
          </p>
        </DialogHeader>

        <div className="flex-1 px-5 py-5 space-y-6">
          <section className="space-y-2">
            <Label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
              Plataforma destino
            </Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTargetPlatform(p.id)}
                  className={cn(
                    pickClasses(targetPlatform === p.id),
                    "flex items-center gap-1.5"
                  )}
                >
                  <PlatformIcon platform={p.id} size="sm" />
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
              Formato destino
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTargetFormat(f)}
                  className={pickClasses(targetFormat === f)}
                >
                  {FORMAT_LABELS[f] ?? f}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
              Tom
            </Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetTone(t.id)}
                  className={pickClasses(targetTone === t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handleRepurpose}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" /> {isRecycle ? "Gerar nova versão" : "Gerar variação"}
              </>
            )}
          </Button>

          {result && (
            <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border border-primary/15 rounded-2xl p-4 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-primary mb-1">
                  Novo título
                </p>
                <p className="text-base font-display font-bold text-foreground leading-snug">
                  {result.titulo}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-primary mb-1">
                  Legenda
                </p>
                <p className="text-sm font-body text-foreground whitespace-pre-line leading-relaxed">
                  {result.legenda}
                </p>
              </div>

              {result.hashtags && result.hashtags.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-primary mb-1">
                    Hashtags
                  </p>
                  <p className="text-xs font-body text-primary break-all leading-relaxed">
                    {result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                  </p>
                </div>
              )}

              {result.dica && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/40 dark:border-amber-500/20 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Dica de execução
                  </p>
                  <p className="text-xs font-body text-amber-900 dark:text-amber-200 leading-relaxed">{result.dica}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={copyAll}
                  disabled={creating}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar tudo
                </Button>
                <Button
                  variant="hero"
                  size="sm"
                  className="flex-1"
                  onClick={handleCreatePost}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>Criar como novo post</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
