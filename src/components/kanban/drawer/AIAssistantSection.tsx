import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  sectionsText: string;
  userId: string;
  profile: Profile | null;
  onCaptionGenerated: (text: string) => void;
};

export function AIAssistantSection({
  title,
  format,
  platform,
  pillarId,
  pillars,
  caption,
  sectionsText,
  userId,
  profile,
  onCaptionGenerated,
}: Props) {
  const [aiTone, setAiTone] = useState("descontraido");
  const [aiLength, setAiLength] = useState("medio");
  const [aiCaption, setAiCaption] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!title || loading) return;
    setLoading(true);
    setAiCaption("");
    try {
      const result = await callAIContextBuilder({
        userId,
        operation: "generate-caption",
        data: {
          titulo: title,
          formato: format,
          plataforma: platform,
          tom: aiTone,
          tamanho: aiLength,
          pilar: pillars.find(p => p.id === pillarId)?.name,
          nicho: profile?.niche,
          conteudo: caption,
          roteiro: sectionsText,
        },
      });
      const text = typeof result === "string" ? result.replace(/```\n?|```/g, "").trim() : String(result ?? "");
      setAiCaption(text);
    } catch (e) {
      console.error("Generate caption failed", e);
      toast.error("Erro ao gerar legenda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-display font-semibold text-foreground">Assistente IA</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1 block">Tom</Label>
          <select
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value)}
            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-body"
          >
            <option value="descontraido">Descontraído</option>
            <option value="profissional">Profissional</option>
            <option value="inspirador">Inspirador</option>
            <option value="educativo">Educativo</option>
            <option value="provocativo">Provocativo</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1 block">Tamanho</Label>
          <select
            value={aiLength}
            onChange={(e) => setAiLength(e.target.value)}
            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-body"
          >
            <option value="curto">Curto (1-2 linhas)</option>
            <option value="medio">Médio (3-5 linhas)</option>
            <option value="longo">Longo (storytelling)</option>
          </select>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={handleGenerate}
        disabled={!title || loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando legenda...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar legenda
          </>
        )}
      </Button>

      {aiCaption && (
        <div className="mt-3 bg-primary/5 border border-primary/15 rounded-xl p-3">
          <p className="text-sm font-body text-foreground whitespace-pre-line leading-relaxed">{aiCaption}</p>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                onCaptionGenerated(aiCaption);
                toast.success("Legenda adicionada ao post!");
              }}
            >
              Usar esta legenda
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleGenerate}>
              Gerar outra
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
