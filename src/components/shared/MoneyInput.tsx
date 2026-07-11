import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseBRL, formatBRLInput } from "@/lib/money";

/**
 * Campo de dinheiro pt-BR.
 * - Vazio é vazio (não fica com "0" preso irritando o usuário).
 * - Aceita vírgula e milhar: "1197", "1.197", "1.197,50", "1197,5".
 * - Guarda SEMPRE número em reais. Formata ao sair do campo.
 */
export function MoneyInput({
  value, onChange, placeholder = "0,00", className, id,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [text, setText] = useState<string>(formatBRLInput(value));
  const [focused, setFocused] = useState(false);

  // Sincroniza quando o valor vem de fora (ex.: carregou do banco) e não estou digitando.
  useEffect(() => {
    if (!focused) setText(formatBRLInput(value));
  }, [value, focused]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          // Só permite dígitos, ponto e vírgula enquanto digita.
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setText(raw);
          onChange(parseBRL(raw));
        }}
        onBlur={() => {
          setFocused(false);
          const n = parseBRL(text);
          onChange(n);
          setText(formatBRLInput(n)); // normaliza pra 1.197,00
        }}
        className={cn("rounded-xl pl-9", className)}
      />
    </div>
  );
}

export default MoneyInput;
