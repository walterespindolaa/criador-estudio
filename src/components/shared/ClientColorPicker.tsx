import { BRAND_COLOR_FAMILIES } from "@/lib/brand-palette";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// SELETOR ÚNICO DE COR DO CLIENTE
//
// Existiam TRÊS paletas diferentes pro MESMO campo: 7 bolinhas na ficha do
// CRM, 16 no cliente do Cria Post e a paleta grande por família no cockpit e
// no cadastro. A pessoa escolhia a cor num lugar, ia no outro e não achava a
// cor que tinha escolhido, porque simplesmente não estava na lista. Agora é
// UM componente só, com UMA paleta (a por família, do arquivo brand-palette),
// usado em todos os lugares que pintam cliente.
//
// Mobile: as bolinhas são maiores no celular (28px, alvo de toque decente) e
// menores no desktop; a lista rola dentro de uma altura máxima em vez de
// empurrar o formulário inteiro pra baixo.
// ═══════════════════════════════════════════════════════════════════════
export function ClientColorPicker({ value, onChange, onClear, rotulo = "cor do cliente", className }: {
  value: string | null;
  onChange: (hex: string) => void;
  /** Quando passado, mostra o "Remover cor" (só aparece se já existe cor). */
  onClear?: () => void;
  /** Usado nos rótulos de acessibilidade (ex.: "cor da marca"). */
  rotulo?: string;
  className?: string;
}) {
  const atual = (value ?? "").trim().toLowerCase();
  return (
    <div className={cn("space-y-2", className)}>
      <div className="max-h-[44vh] space-y-1.5 overflow-y-auto pr-1">
        {BRAND_COLOR_FAMILIES.map((fam) => (
          <div key={fam.nome} className="flex items-center gap-2">
            <span className="w-[64px] shrink-0 text-[9.5px] font-body uppercase tracking-wide text-muted-foreground">{fam.nome}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {fam.tons.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  aria-label={`Escolher ${rotulo} ${c}`}
                  aria-pressed={atual === c.toLowerCase()}
                  className={cn("h-7 w-7 rounded-full transition-transform md:h-6 md:w-6",
                    atual === c.toLowerCase() ? "scale-110 ring-2 ring-foreground ring-offset-2" : "hover:scale-105")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {onClear && !!value && (
        <button type="button" onClick={onClear}
          className="text-[11px] font-body text-muted-foreground hover:text-foreground">
          Remover cor
        </button>
      )}
    </div>
  );
}
