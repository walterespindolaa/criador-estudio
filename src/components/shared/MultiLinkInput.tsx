import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Campo de link que aceita VÁRIOS: cada linha tem um input, um botão de remover
// e o botão "+" (na última linha) que abre mais uma. Os botões têm 40px de lado
// pra dar área de toque decente no celular. Link vazio não é salvo (quem salva
// usa serializeRefLinks). Visual igual aos outros campos do mesmo modal.
export function MultiLinkInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  maxLinks = 10,
  addLabel = "Adicionar outro link",
}: {
  value: string[];
  onChange: (links: string[]) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  maxLinks?: number;
  addLabel?: string;
}) {
  // Lista vazia mostra uma linha em branco (o campo nunca some da tela).
  const rows = value.length ? value : [""];

  const setRow = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  };
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const addRow = () => { if (rows.length < maxLinks) onChange([...rows, ""]); };

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((link, i) => {
        const last = i === rows.length - 1;
        return (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={link}
              onChange={(e) => setRow(i, e.target.value)}
              placeholder={placeholder}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={cn("rounded-xl flex-1 min-w-0", inputClassName)}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remover este link"
                title="Remover este link"
                className="shrink-0 grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {last && rows.length < maxLinks && (
              <button
                type="button"
                onClick={addRow}
                aria-label={addLabel}
                title={addLabel}
                className="shrink-0 grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MultiLinkInput;
