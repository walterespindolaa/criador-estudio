import { ClientColorPicker } from "@/components/shared/ClientColorPicker";

// Seletor da cor da MARCA do cliente (portal público de aprovação).
// A grade de bolinhas em si virou o ClientColorPicker compartilhado, pra a cor da
// marca e a cor do cliente usarem exatamente a mesma paleta, em vez de cada tela
// inventar a sua. Este wrapper existe só pelo rótulo de acessibilidade e pra não
// quebrar os imports antigos.
export function BrandColorPicker({ value, onChange }: {
  value: string | null;
  onChange: (hex: string) => void;
}) {
  return <ClientColorPicker value={value} onChange={onChange} rotulo="cor da marca" />;
}
