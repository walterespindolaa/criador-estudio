import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { confirmar } from "@/components/shared/Confirm";
import { cn } from "@/lib/utils";
import { TAG_COLORS, TAG_COLOR_CLS } from "@/hooks/useCrm";
import {
  usePostTags, useCreatePostTag, useUpdatePostTag, useDeletePostTag,
  useSeedDefaultPostTags, DEFAULT_POST_TAGS, type PostTag,
} from "@/hooks/usePostTags";

// Seletor das ETIQUETAS INTERNAS do post (Cria Post).
//
// Mesmo desenho e mesma paleta do seletor de etiquetas do cadastro de cliente
// (TAG_COLORS/TAG_COLOR_CLS vêm de lá, fonte única das cores), mas com catálogo
// PRÓPRIO: etiqueta de cliente é relacionamento ("VIP", "Inadimplente"),
// etiqueta de post é produção ("Prioridade", "Gravar externa"). Um seletor só
// com os dois conjuntos misturados vira uma lista impossível de usar.
//
// Diferença técnica pro seletor de cliente: aqui o valor selecionado é o ID da
// etiqueta, não o nome. Assim renomear ou trocar a cor reflete em todos os
// posts sem tocar em nada. Id sem correspondência no catálogo é ignorado.
//
// Botões com 36-40px de área de toque: isto é usado no celular.
export function InternalTagPicker({ selected, onChange }: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: tags = [] } = usePostTags();
  const createTag = useCreatePostTag();
  const updTag = useUpdatePostTag();
  const delTag = useDeletePostTag();
  const seed = useSeedDefaultPostTags();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("violet");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  const doCreate = () => { if (newName.trim()) { createTag.mutate({ name: newName, color: newColor }); setNewName(""); } };

  const commitRename = (t: PostTag) => {
    const nome = editName.trim();
    setEditId(null);
    if (!nome || nome === t.name) return;
    updTag.mutate({ id: t.id, name: nome });
  };

  // Só mostra as escolhidas que ainda existem no catálogo.
  const escolhidas = selected
    .map((id) => tags.find((t) => t.id === id))
    .filter(Boolean) as PostTag[];

  const faltamPadrao = DEFAULT_POST_TAGS.some(
    (d) => !tags.some((t) => t.name.toLowerCase() === d.name.toLowerCase()),
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {escolhidas.map((t) => (
        <span key={t.id} className={cn("text-xs font-body font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1", TAG_COLOR_CLS[t.color] ?? TAG_COLOR_CLS.slate)}>
          {t.name}
          <button type="button" onClick={() => toggle(t.id)} className="opacity-60 hover:opacity-100 px-0.5" aria-label={`Remover ${t.name}`}>×</button>
        </span>
      ))}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}>
        <PopoverTrigger asChild>
          <button type="button" className="text-xs font-body font-semibold px-3 h-9 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
            + Etiqueta
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Etiquetas internas de post</p>
          <p className="text-[10.5px] font-body text-muted-foreground mb-2 leading-tight">Valem pra todos os clientes e só a sua equipe vê. Renomeie, troque a cor ou exclua à vontade.</p>

          <div className="max-h-52 overflow-y-auto space-y-1 mb-2">
            {tags.length === 0 && <p className="text-[11px] text-muted-foreground py-1">Nenhuma ainda.</p>}
            {tags.map((t) => {
              const on = selected.includes(t.id);
              if (editId === t.id) {
                return (
                  <div key={t.id} className="rounded-lg border border-primary/40 bg-primary/[0.03] p-2 space-y-2">
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm rounded-lg"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitRename(t); } if (e.key === "Escape") setEditId(null); }} />
                    <div className="flex items-center gap-1 flex-wrap">
                      {TAG_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => updTag.mutate({ id: t.id, color: c })}
                          className={cn("h-5 w-5 rounded-full border", TAG_COLOR_CLS[c], t.color === c && "ring-2 ring-primary ring-offset-1")} aria-label={c} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => commitRename(t)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}>Cancelar</Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={t.id} className="flex items-center gap-1 group">
                  <button type="button" onClick={() => toggle(t.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-md px-1 py-1.5 hover:bg-muted/50">
                    <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                      {on && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className={cn("text-[12px] font-body px-2 py-0.5 rounded-full border truncate", TAG_COLOR_CLS[t.color] ?? TAG_COLOR_CLS.slate)}>{t.name}</span>
                  </button>
                  <button type="button" onClick={() => { setEditId(t.id); setEditName(t.name); }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-primary shrink-0 p-1.5" aria-label="Editar etiqueta">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={async () => { if (await confirmar({ titulo: `Excluir a etiqueta "${t.name}"?`, descricao: "Ela sai de todos os posts que a tinham." })) delTag.mutate(t.id); }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 p-1.5" aria-label="Excluir etiqueta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Etiquetas padrão: ponto de partida pra não encarar tela em branco. */}
          {faltamPadrao && (
            <button type="button" onClick={() => seed.mutate(tags)} disabled={seed.isPending}
              className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] px-2 py-2 mb-2 text-left hover:bg-primary/[0.07] transition-colors">
              <p className="text-[12px] font-body font-semibold text-foreground">Usar as etiquetas padrão</p>
              <p className="text-[10.5px] font-body text-muted-foreground leading-tight">
                {DEFAULT_POST_TAGS.map((t) => t.name).join(", ")}, depois é só editar ou excluir.
              </p>
            </button>
          )}

          <div className="border-t border-border pt-2 space-y-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etiqueta…" className="h-9 text-sm rounded-lg"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doCreate(); } }} />
            <div className="flex items-center gap-1 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  className={cn("h-6 w-6 rounded-full border", TAG_COLOR_CLS[c], newColor === c && "ring-2 ring-primary ring-offset-1")} aria-label={c} />
              ))}
            </div>
            <Button size="sm" className="w-full h-9" disabled={!newName.trim() || createTag.isPending} onClick={doCreate}>Criar etiqueta</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default InternalTagPicker;
