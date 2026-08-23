import { useState } from "react";
import { Link2, Plus, X, Play, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseRefLinks, serializeRefLinks, isRefLink } from "@/lib/refLinks";
import { type PreviaLink } from "@/lib/refPreview";
import { useLinkPreviews, comCapa } from "@/hooks/useLinkPreviews";

/* ═══════════════════════════════════════════════════════════════════════════
   REFERÊNCIAS DO ROTEIRO

   "Grava tipo aquele reel" é como o roteiro nasce na vida real, e quase nunca
   é UMA referência só: uma pro corte, outra pra luz, outra pro áudio. O campo
   guarda vários links (um por linha, mesmo formato do Cria Post), e todo mundo
   que exibe o roteiro mostra a mesma prévia: capa quando dá, plataforma, e o
   link clicável pra abrir no aplicativo.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Capa do link. Instagram nem sempre libera, então cai no ícone sem quebrar. */
export function CapaReferencia({ p, tamanho = 52 }: { p: PreviaLink; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  const mostrarImg = !!p.thumb && !falhou;
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted"
      style={{ width: tamanho, height: tamanho }}>
      {mostrarImg ? (
        <img src={p.thumb!} alt="" referrerPolicy="no-referrer" loading="lazy"
          onError={() => setFalhou(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Play className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

/** Lista só de leitura: usada no card do roteiro e onde o espaço é curto. */
export function ListaReferencias({
  valor, compacto, className,
}: { valor?: string | null; compacto?: boolean; className?: string }) {
  const links = parseRefLinks(valor).filter(isRefLink);
  const capas = useLinkPreviews(links);
  if (links.length === 0) return null;

  if (compacto) {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
        {links.map((l, i) => {
          const p = comCapa(l, capas);
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              title={p.url}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-body font-semibold text-primary hover:underline">
              <Link2 className="h-2.5 w-2.5" /> {p.nome.toLowerCase()}
            </a>
          );
        })}
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {links.map((l, i) => {
        const p = comCapa(l, capas);
        return (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 hover:border-primary/50 transition-colors">
            <CapaReferencia p={p} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-body font-semibold text-foreground">{p.nome}</span>
              <span className="block truncate text-[11px] font-body text-muted-foreground">{p.label}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}

/** Campo de edição: vários links, com prévia embaixo de cada um. */
export function CampoReferencias({
  valor, onChange,
}: { valor: string; onChange: (v: string) => void }) {
  const links = parseRefLinks(valor);
  const linhas = links.length ? links : [""];
  const capas = useLinkPreviews(links.filter(isRefLink));

  const mudar = (i: number, v: string) => {
    const novo = [...linhas];
    novo[i] = v;
    onChange(serializeRefLinks(novo) ?? "");
  };
  const somar = () => onChange(serializeRefLinks([...linhas, ""]) ?? "");
  const tirar = (i: number) => onChange(serializeRefLinks(linhas.filter((_, x) => x !== i)) ?? "");

  return (
    <div className="space-y-2">
      {linhas.map((l, i) => {
        const p = isRefLink(l) ? comCapa(l, capas) : null;
        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input value={l} onChange={(e) => mudar(i, e.target.value)}
                placeholder="https://instagram.com/reel/..." className="h-10" />
              {linhas.length > 1 && (
                <button type="button" onClick={() => tirar(i)} aria-label="Tirar esta referência"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {p && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-2 hover:border-primary/50 transition-colors">
                <CapaReferencia p={p} tamanho={52} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-body font-semibold text-foreground">{p.nome}</span>
                  <span className="block truncate text-[11px] font-body text-muted-foreground">{p.label}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            )}
          </div>
        );
      })}
      <button type="button" onClick={somar}
        className="inline-flex items-center gap-1 text-[11.5px] font-body font-semibold text-primary hover:underline">
        <Plus className="h-3 w-3" /> outra referência
      </button>
    </div>
  );
}
