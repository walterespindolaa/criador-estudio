import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Search } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { getStatusClasses } from "@/lib/statusColors";
import type { Post } from "@/hooks/usePosts";
import type { StatusFilter } from "./FeedSidebar";

/* ═══════════════════════════════════════════════════════════════════════════
   MEU FEED (mobile) — ADICIONAR POSTS VIA BOTTOM SHEET
   Substitui o drawer lateral no celular (mockup aprovado pelo Walter:
   CRIA/mockup-feed-bottom-sheet.html). Grade 3 colunas com a cara do feed,
   seleção múltipla com anel + check, botão que conta os selecionados.
   A ORDEM do toque é a ordem de entrada no feed. Desktop segue no painel
   lateral com drag, este componente nem monta lá.
   ═══════════════════════════════════════════════════════════════════════════ */

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "editando", label: "Editando" },
  { key: "agendado", label: "Agendado" },
  { key: "publicado", label: "Publicado" },
];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  posts: Post[];
  thumbnails: Record<string, string | null>;
  onAddMany: (postIds: string[]) => void;
};

export function FeedAddSheet({ open, onOpenChange, posts, thumbnails, onAddMany }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [search, setSearch] = useState("");
  /* array (não Set): a ordem da seleção é a ordem de entrada no feed */
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, statusFilter, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const close = (o: boolean) => {
    if (!o) setSelected([]);
    onOpenChange(o);
  };

  const confirm = () => {
    if (selected.length) onAddMany(selected);
    setSelected([]);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="font-display text-lg">Adicionar ao feed</DrawerTitle>
          <DrawerDescription className="font-body text-[12.5px]">
            Toque pra selecionar. Eles entram na ordem que você escolher.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar posts..."
              className="pl-8 h-10 rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-body font-semibold border whitespace-nowrap transition-colors",
                  statusFilter === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[200px]">
          {filtered.length === 0 ? (
            <p className="text-center text-xs font-body text-muted-foreground py-10">
              Nenhum post disponível com esses filtros.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((post) => {
                const thumb = thumbnails[post.id] ?? null;
                const idx = selected.indexOf(post.id);
                const isSel = idx >= 0;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => toggle(post.id)}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden bg-muted text-left border-2 transition-all active:scale-95",
                      isSel ? "border-primary ring-2 ring-primary/25" : "border-transparent",
                    )}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={post.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </span>
                    )}
                    {post.status && (
                      <span
                        className={cn(
                          "absolute left-1.5 top-1.5 text-[8.5px] font-body font-bold px-1.5 py-0.5 rounded-full capitalize border",
                          getStatusClasses(post.status),
                        )}
                      >
                        {post.status}
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[9.5px] font-body font-semibold leading-tight text-white line-clamp-2">
                      {post.title}
                      <span className="block font-normal text-white/75">{FORMAT_LABELS[post.format] || post.format}</span>
                    </span>
                    <span
                      className={cn(
                        "absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors",
                        isSel
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-black/25 border-white/90 text-transparent",
                      )}
                    >
                      {isSel ? (selected.length > 1 ? idx + 1 : <Check className="h-3.5 w-3.5" />) : <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-border px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))]">
          <Button variant="outline" className="shrink-0" onClick={() => close(false)}>Fechar</Button>
          <Button className="flex-1" disabled={!selected.length} onClick={confirm}>
            {selected.length ? `Adicionar (${selected.length})` : "Adicionar"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
