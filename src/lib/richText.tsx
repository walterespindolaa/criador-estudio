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

/* ═══════════════════════════════════════════════════════════════════════════
   O EDITOR (Walter, 20/09/2026: "quando eu boto negrito ele fica assim ** ao
   invés de ficar negrito")

   O texto é guardado como marcador, e isso é decisão, não descuido: a página
   pública monta o negrito com <b> de verdade, sem nunca injetar HTML de
   usuário na tela. Trocar isso por um editor que guarda HTML abriria a porta
   que a gente fechou de propósito.

   O que estava faltando não era o negrito, era a RESPOSTA: quem clica em B
   quer ver o resultado, e via dois asteriscos. Então entrou a prévia embaixo
   do campo, que mostra o texto do jeito que ele vai aparecer, ao vivo.

   E o botão virou INTERRUPTOR. Antes ele só empilhava marcador: clicar duas
   vezes na mesma seleção dava ****texto****, que a página renderiza errado e
   ninguém consegue desfazer sem apagar na mão.
   ═══════════════════════════════════════════════════════════════════════════ */
export function RichTextInput({ value, onChange, placeholder, rows = 3 }: RichTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const alternar = (marker: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const selecionado = value.slice(start, end);
    const antes = value.slice(0, start);
    const depois = value.slice(end);
    const n = marker.length;

    // Já marcado POR DENTRO ("**texto**" inteiro dentro da seleção)?
    const porDentro = selecionado.length > 2 * n
      && selecionado.startsWith(marker) && selecionado.endsWith(marker);
    // Já marcado POR FORA (a pessoa selecionou só o miolo)?
    const porFora = antes.endsWith(marker) && depois.startsWith(marker);

    let novoTexto: string;
    let novoInicio: number;
    let novoFim: number;

    if (porDentro) {
      const miolo = selecionado.slice(n, -n);
      novoTexto = `${antes}${miolo}${depois}`;
      novoInicio = start;
      novoFim = start + miolo.length;
    } else if (porFora) {
      novoTexto = `${antes.slice(0, -n)}${selecionado}${depois.slice(n)}`;
      novoInicio = start - n;
      novoFim = novoInicio + selecionado.length;
    } else {
      novoTexto = `${antes}${marker}${selecionado}${marker}${depois}`;
      novoInicio = start + n;
      novoFim = novoInicio + selecionado.length;
    }

    onChange(novoTexto);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(novoInicio, novoFim);
    });
  };

  /* Cmd+B / Ctrl+B e companhia: quem escreve texto o dia inteiro usa o atalho
     antes de procurar o botão. */
  const atalhos = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); alternar("**"); }
    else if (k === "i") { e.preventDefault(); alternar("_"); }
    else if (k === "u") { e.preventDefault(); alternar("__"); }
  };

  const temMarcador = /\*\*[\s\S]+?\*\*|__[\s\S]+?__|_[\s\S]+?_/.test(value);

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <button
          type="button"
          onClick={() => alternar("**")}
          aria-label="Negrito"
          title="Negrito (Ctrl+B)"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm font-bold flex items-center justify-center hover:bg-muted transition-colors"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => alternar("_")}
          aria-label="Itálico"
          title="Itálico (Ctrl+I)"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm italic flex items-center justify-center hover:bg-muted transition-colors"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => alternar("__")}
          aria-label="Sublinhado"
          title="Sublinhado (Ctrl+U)"
          className="w-7 h-7 rounded-md border border-border bg-background text-sm underline flex items-center justify-center hover:bg-muted transition-colors"
        >
          U
        </button>
        <span className="ml-auto text-[10.5px] font-body text-muted-foreground hidden sm:inline">
          selecione o texto e clique
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={atalhos}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-background px-3 py-2 text-sm resize-y outline-none"
      />
      {/* A PRÉVIA. Só aparece quando existe marcador: campo sem formatação
          nenhuma não precisa de uma cópia de si mesmo embaixo. */}
      {temMarcador && (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
            Fica assim
          </p>
          <p className="text-sm font-body text-foreground whitespace-pre-wrap break-words">
            {renderRichText(value)}
          </p>
        </div>
      )}
    </div>
  );
}
