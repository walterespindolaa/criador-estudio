import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateCrmClient } from "@/hooks/useCrm";

/* Saiu de dentro do ClienteHub (28/09/2026) pra ser o MESMO editor na ficha do
   cliente e no Canal da marca da Equipe: dois editores do mesmo jsonb acabariam
   gravando formatos diferentes. */
export type LinkUtil = { label: string; url: string };

// Links úteis do cliente (pastas do Drive, materiais…). Grava o array inteiro no jsonb useful_links.
export function LinksUteis({ clientId, links }: { clientId: string; links: LinkUtil[] | null }) {
  const update = useUpdateCrmClient();
  const [rows, setRows] = useState<LinkUtil[]>(links ?? []);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoUrl, setNovoUrl] = useState("");

  // Adota o servidor quando os links mudam de fora (não pisa em edição: só salvamos no blur).
  useEffect(() => { setRows(links ?? []); }, [links]);

  const salvar = (next: LinkUtil[]) => {
    setRows(next);
    update.mutate({ id: clientId, useful_links: next } as never);
  };

  const adicionar = () => {
    const url = novoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    salvar([...rows, { label: novoLabel.trim() || "Link", url }]);
    setNovoLabel(""); setNovoUrl("");
  };

  const remover = (i: number) => salvar(rows.filter((_, idx) => idx !== i));
  const editar = (i: number, campo: keyof LinkUtil, valor: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));

  const salvarEdicao = () => {
    const bad = rows.find((r) => r.url && !/^https?:\/\//i.test(r.url));
    if (bad) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    salvar(rows);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-body text-muted-foreground">Links úteis (Drive, pastas, materiais…)</p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 mb-3">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {/* Mobile: o rótulo ocupa a linha inteira e a URL cai pra a linha de
                  baixo com largura de sobra (antes espremia a URL em ~100px). */}
              <Input value={r.label} onChange={(e) => editar(i, "label", e.target.value)} onBlur={salvarEdicao}
                placeholder="Rótulo (ex.: Drive - Fotos)" className="rounded-xl h-9 text-sm w-full sm:w-40 sm:shrink-0" />
              <Input value={r.url} onChange={(e) => editar(i, "url", e.target.value)} onBlur={salvarEdicao}
                placeholder="https://…" className="rounded-xl h-9 text-sm flex-1 min-w-[140px]" />
              <a href={r.url} target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-primary shrink-0"><ExternalLink className="h-4 w-4" /></a>
              <button onClick={() => remover(i)} title="Remover" aria-label="Remover" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)} placeholder="Rótulo (ex.: Drive - Aprovados)" className="rounded-xl h-9 text-sm w-full sm:w-40" />
        <Input value={novoUrl} onChange={(e) => setNovoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="https://drive.google.com/…" className="rounded-xl h-9 text-sm flex-1 min-w-[140px]" />
        <Button onClick={adicionar} disabled={!novoUrl.trim()} className="rounded-xl h-9 gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
    </div>
  );
}
