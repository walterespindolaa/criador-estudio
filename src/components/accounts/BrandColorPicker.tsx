import { BRAND_COLOR_FAMILIES } from "@/lib/brand-palette";

// Seletor da cor da marca do cliente: bolinhas redondas selecionáveis, agrupadas
// por família (mesmo estilo visual usado no resto do app). O valor é sempre hex.
// value/onChange controlam a seleção; a família fica com um rótulo discreto.
export function BrandColorPicker({ value, onChange }: {
  value: string | null;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {BRAND_COLOR_FAMILIES.map((fam) => (
        <div key={fam.nome} className="flex items-center gap-2">
          <span className="w-[68px] shrink-0 text-[9.5px] font-body uppercase tracking-wide text-muted-foreground">{fam.nome}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {fam.tons.map((c) => (
              <button key={c} type="button" onClick={() => onChange(c)}
                className={`h-6 w-6 rounded-full transition-transform ${value?.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                style={{ backgroundColor: c }} aria-label={`Cor da marca ${c}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
