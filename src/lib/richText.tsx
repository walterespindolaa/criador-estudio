import { useRef, type ReactNode } from "react";

// Rich text markdown-lite: **negrito**, _itálico_, __sublinhado__.
// Guardado como texto puro; renderizado com segurança na página pública
// (nunca usamos dangerouslySetInnerHTML, então o React escapa o conteúdo).

type InlineTag = "b" | "i" | "u";

// Ordem importa: checa __ (sublinhado) antes de _ (itálico).
const MARKERS: { re: RegExp; tag: InlineTag }[] = [
  { re: /\*\*([\s\S]+?)\*\*/, tag: "b" },
  { re: /__([\s\S]+?)__/, tag: "u" },
  { re: /_([\s\S]+?)_/, tag: "i" },
];

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let idx = 0;
  // Guarda contra loops patológicos em entradas muito grandes.
  let guard = 0;
  while (rest.length > 0 && guard < 5000) {
    guard += 1;
    let best: { index: number; match: RegExpMatchArray; tag: InlineTag } | null = null;
    for (const m of MARKERS) {
      const match = rest.match(m.re);
      if (match && match.index !== undefined) {
        if (!best || match.index < best.index) {
          best = { index: match.index, match, tag: m.tag };
        }
      }
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) {
      nodes.push(rest.slice(0, best.index));
    }
    const inner = best.match[1];
    const Tag = best.tag;
    const key = `${keyPrefix}-${idx}`;
    idx += 1;
    nodes.push(<Tag key={key}>{parseInline(inner, key)}</Tag>);
    rest = rest.slice(best.index + best.match[0].length);
  }
  return nodes;
}

// SEGURO para a página pública: recebe texto do usuário e devolve ReactNode.
// O React escapa qualquer HTML dentro das strings automaticamente.
export function renderRichText(input: string): ReactNode {
  if (!input) return null;
  return parseInline(input, "rt");
}

type RichTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

// Editor: textarea com barrinha de B / I / U que envolve a seleção atual
// com os marcadores markdown-lite.
export function RichTextInput({ value, onChange, placeholder, rows = 3 }: RichTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (marker: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}${marker}${selected}${marker}${after}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + marker.length;
      ta.setSelectionRange(pos, pos + selected.length);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <button
          type="button"
          onClick={() => wrap("**")}
          aria-label="Negrito"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm font-bold flex items-center justify-center hover:bg-muted transition-colors"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => wrap("_")}
          aria-label="Itálico"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm italic flex items-center justify-center hover:bg-muted transition-colors"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => wrap("__")}
          aria-label="Sublinhado"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm underline flex items-center justify-center hover:bg-muted transition-colors"
        >
          U
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-background px-3 py-2 text-sm resize-y outline-none"
      />
    </div>
  );
}
