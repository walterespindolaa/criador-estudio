import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Share2, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIdeas } from "@/hooks/useIdeas";
import { useFiles } from "@/hooks/useFiles";

/* ═══════════════════════════════════════════════════════════════════════════
   O QUE VOCÊ COMPARTILHOU COM O CRIA

   O gesto mais natural desse público: a pessoa vê um Reels que quer usar de
   referência, aperta Compartilhar → CRIA, e pronto. Antes o manifest só aceitava
   texto e link (method GET), então print e vídeo eram simplesmente descartados.

   Agora o Service Worker intercepta o POST do sistema operacional, guarda o
   arquivo e joga a pessoa em /app/ideias?compartilhado=1. Este componente lê o
   que chegou, mostra, e salva: a imagem vai pros Arquivos e o texto/link vira
   uma ideia no banco, já com o link nas notas.
   ═══════════════════════════════════════════════════════════════════════════ */

type Meta = { texto: string; arquivos: string[]; em: number };

export function SharedIntake() {
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [previews, setPreviews] = useState<{ url: string; tipo: string; blob: Blob }[]>([]);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { createIdea } = useIdeas();
  const { uploadFile } = useFiles();

  const veioDoShare = params.get("compartilhado") === "1";

  useEffect(() => {
    if (!veioDoShare) return;
    let vivo = true;

    (async () => {
      try {
        const res = await fetch("/__share/meta");
        const m = (await res.json()) as Meta;
        if (!vivo || !m?.em) return;
        // Compartilhamento velho (a pessoa recarregou a página dias depois): ignora.
        if (Date.now() - m.em > 1000 * 60 * 10) return;

        setMeta(m);
        setTitulo((m.texto || "").slice(0, 120));

        const bls: { url: string; tipo: string; blob: Blob }[] = [];
        for (const caminho of m.arquivos ?? []) {
          const r = await fetch(caminho);
          const b = await r.blob();
          bls.push({ url: URL.createObjectURL(b), tipo: b.type, blob: b });
        }
        if (vivo) setPreviews(bls);
      } catch {
        /* sem compartilhamento: segue a vida */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [veioDoShare]);

  const fechar = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setMeta(null);
    setPreviews([]);
    const p = new URLSearchParams(params);
    p.delete("compartilhado");
    setParams(p, { replace: true });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      // 1. Os arquivos vão pros Arquivos (biblioteca), marcados como referência.
      for (let i = 0; i < previews.length; i++) {
        const p = previews[i];
        const ext = (p.tipo.split("/")[1] || "bin").split(";")[0];
        const arquivo = new File([p.blob], `referencia-${Date.now()}-${i}.${ext}`, { type: p.tipo });
        await uploadFile.mutateAsync({ file: arquivo, category: "referencia", source: "compartilhado" });
      }

      // 2. O texto/link vira ideia.
      const t = titulo.trim() || "Referência compartilhada";
      await createIdea.mutateAsync({
        title: t,
        notes: meta?.texto && meta.texto !== t ? meta.texto : null,
        origin: "compartilhado",
        idea_status: "nova",
      });

      toast.success(
        previews.length > 0
          ? "Salvo! A ideia está no banco e a mídia nos seus Arquivos."
          : "Ideia salva!",
      );
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar o que você compartilhou.");
    } finally {
      setSalvando(false);
    }
  };

  if (!meta) return null;

  return (
    <div className="mb-5 rounded-3xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Share2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-foreground">Você compartilhou isto com o CRIA</p>
          <p className="text-[12px] font-body text-muted-foreground mt-0.5">
            Dê um nome e salve. A ideia entra no banco e a mídia vai pros seus Arquivos.
          </p>
        </div>
        <button onClick={fechar} aria-label="Descartar" className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      {previews.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
          {previews.map((p) => (
            <div key={p.url} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
              {p.tipo.startsWith("video") ? (
                <video src={p.url} className="h-full w-full object-cover" muted playsInline />
              ) : (
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Do que é essa referência?"
          className="rounded-xl bg-background"
        />
        <Button onClick={salvar} disabled={salvando} className="shrink-0">
          {salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
