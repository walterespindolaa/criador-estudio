import { useRef, type ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Type } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTO COM FORMA

   O que existia antes só sabia deixar em negrito, itálico e sublinhado dentro
   de uma linha. Pra um "Sobre" de dez linhas ou um post de blog isso não
   basta: o texto vira um paredão que ninguém lê.

   Aqui o texto ganha ESTRUTURA. A pessoa escreve num campo comum, com marcas
   simples que ela já viu no WhatsApp:

     ## Um subtítulo
     - item de lista
     1. item numerado
     > uma citação em destaque
     **negrito**  _itálico_  __sublinhado__
     [texto do link](https://endereco)

   Linha em branco separa parágrafo.

   POR QUE NÃO UM EDITOR VISUAL DE VERDADE: guardar HTML de editor visual
   significa ter que limpar HTML de terceiro antes de mostrar numa página
   pública, e é assim que nasce buraco de segurança. Aqui o que sai do banco é
   texto puro, e quem monta os elementos é o React, que escapa tudo sozinho.
   ═══════════════════════════════════════════════════════════════════════════ */

type TagLinha = "b" | "i" | "u";

const MARCAS: { re: RegExp; tag: TagLinha }[] = [
  { re: /\*\*([\s\S]+?)\*\*/, tag: "b" },
  { re: /__([\s\S]+?)__/, tag: "u" },
  { re: /_([\s\S]+?)_/, tag: "i" },
];

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;

function pedacos(texto: string, chave: string): ReactNode[] {
  const nos: ReactNode[] = [];
  let resto = texto;
  let i = 0;
  let guarda = 0;

  while (resto.length > 0 && guarda < 5000) {
    guarda += 1;

    // O link é procurado junto com as marcas, e vence quem aparecer primeiro.
    const mLink = resto.match(LINK);
    let melhor: { pos: number; m: RegExpMatchArray; tag: TagLinha | "a" } | null =
      mLink && mLink.index !== undefined ? { pos: mLink.index, m: mLink, tag: "a" } : null;

    for (const x of MARCAS) {
      const m = resto.match(x.re);
      if (m && m.index !== undefined && (!melhor || m.index < melhor.pos)) {
        melhor = { pos: m.index, m, tag: x.tag };
      }
    }

    if (!melhor) { nos.push(resto); break; }
    if (melhor.pos > 0) nos.push(resto.slice(0, melhor.pos));

    const k = `${chave}-${i}`; i += 1;
    if (melhor.tag === "a") {
      nos.push(
        <a key={k} href={melhor.m[2]} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium">{melhor.m[1]}</a>,
      );
    } else {
      const Tag = melhor.tag;
      nos.push(<Tag key={k}>{pedacos(melhor.m[1], k)}</Tag>);
    }
    resto = resto.slice(melhor.pos + melhor.m[0].length);
  }
  return nos;
}

type Bloco =
  | { t: "titulo"; texto: string }
  | { t: "paragrafo"; texto: string }
  | { t: "citacao"; texto: string }
  | { t: "lista"; itens: string[]; numerada: boolean };

function separar(entrada: string): Bloco[] {
  const linhas = (entrada || "").replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({ t: "paragrafo", texto: paragrafo.join("\n") });
      paragrafo = [];
    }
  };

  for (const linha of linhas) {
    const l = linha.trimEnd();

    if (!l.trim()) { fecharParagrafo(); continue; }

    if (/^#{1,3}\s+/.test(l)) {
      fecharParagrafo();
      blocos.push({ t: "titulo", texto: l.replace(/^#{1,3}\s+/, "") });
      continue;
    }
    if (/^>\s?/.test(l)) {
      fecharParagrafo();
      const anterior = blocos[blocos.length - 1];
      const txt = l.replace(/^>\s?/, "");
      // Citação de várias linhas seguidas vira uma citação só.
      if (anterior && anterior.t === "citacao") anterior.texto += `\n${txt}`;
      else blocos.push({ t: "citacao", texto: txt });
      continue;
    }
    const mLista = l.match(/^\s*[-•*]\s+(.*)$/);
    const mNum = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (mLista || mNum) {
      fecharParagrafo();
      const numerada = !!mNum;
      const item = (mLista ? mLista[1] : mNum![1]).trim();
      const anterior = blocos[blocos.length - 1];
      if (anterior && anterior.t === "lista" && anterior.numerada === numerada) anterior.itens.push(item);
      else blocos.push({ t: "lista", itens: [item], numerada });
      continue;
    }
    paragrafo.push(l);
  }
  fecharParagrafo();
  return blocos;
}

/** Devolve o texto já com forma. Seguro: nada de HTML vindo do banco. */
export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  const blocos = separar(texto);
  if (blocos.length === 0) return null;
  return (
    <div className={cn("space-y-3", className)}>
      {blocos.map((b, i) => {
        if (b.t === "titulo") {
          return <h3 key={i} className="font-display font-bold text-[1.05em] leading-snug pt-1">{pedacos(b.texto, `t${i}`)}</h3>;
        }
        if (b.t === "citacao") {
          return (
            <blockquote key={i} className="border-l-[3px] border-current/25 pl-3.5 italic opacity-90 whitespace-pre-line">
              {pedacos(b.texto, `c${i}`)}
            </blockquote>
          );
        }
        if (b.t === "lista") {
          const Tag = b.numerada ? "ol" : "ul";
          return (
            <Tag key={i} className={cn("space-y-1.5 pl-5", b.numerada ? "list-decimal" : "list-disc")}>
              {b.itens.map((it, n) => <li key={n} className="pl-0.5">{pedacos(it, `l${i}-${n}`)}</li>)}
            </Tag>
          );
        }
        return <p key={i} className="whitespace-pre-line">{pedacos(b.texto, `p${i}`)}</p>;
      })}
    </div>
  );
}

/* ── O CAMPO COM BARRA DE FORMATAÇÃO ── */

const BOTOES: { rotulo: string; icone: typeof Bold; volta: string; envolve?: boolean; prefixo?: string }[] = [
  { rotulo: "Negrito", icone: Bold, volta: "**", envolve: true },
  { rotulo: "Itálico", icone: Italic, volta: "_", envolve: true },
  { rotulo: "Subtítulo", icone: Type, volta: "", prefixo: "## " },
  { rotulo: "Lista", icone: List, volta: "", prefixo: "- " },
  { rotulo: "Lista numerada", icone: ListOrdered, volta: "", prefixo: "1. " },
  { rotulo: "Citação", icone: Quote, volta: "", prefixo: "> " },
];

export function CampoTextoRico({
  valor, onChange, rows = 6, placeholder, className,
}: {
  valor: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const aplicar = (b: (typeof BOTOES)[number]) => {
    const ta = ref.current;
    if (!ta) return;
    const ini = ta.selectionStart ?? valor.length;
    const fim = ta.selectionEnd ?? valor.length;

    if (b.envolve) {
      const sel = valor.slice(ini, fim) || "texto";
      const novo = `${valor.slice(0, ini)}${b.volta}${sel}${b.volta}${valor.slice(fim)}`;
      onChange(novo);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(ini + b.volta.length, ini + b.volta.length + sel.length);
      });
      return;
    }

    // Prefixo de linha: acha o começo da linha onde o cursor está e o coloca lá.
    const comecoLinha = valor.lastIndexOf("\n", ini - 1) + 1;
    const jaTem = valor.slice(comecoLinha).startsWith(b.prefixo ?? "");
    const novo = jaTem
      ? valor.slice(0, comecoLinha) + valor.slice(comecoLinha + (b.prefixo ?? "").length)
      : valor.slice(0, comecoLinha) + (b.prefixo ?? "") + valor.slice(comecoLinha);
    onChange(novo);
    requestAnimationFrame(() => {
      ta.focus();
      const desloca = jaTem ? -(b.prefixo ?? "").length : (b.prefixo ?? "").length;
      ta.setSelectionRange(ini + desloca, fim + desloca);
    });
  };

  const inserirLink = () => {
    const ta = ref.current;
    if (!ta) return;
    const ini = ta.selectionStart ?? valor.length;
    const fim = ta.selectionEnd ?? valor.length;
    const sel = valor.slice(ini, fim) || "clique aqui";
    const novo = `${valor.slice(0, ini)}[${sel}](https://)${valor.slice(fim)}`;
    onChange(novo);
    requestAnimationFrame(() => {
      ta.focus();
      // Deixa o cursor no endereço, que é o que falta preencher.
      const pos = ini + sel.length + 3;
      ta.setSelectionRange(pos + 8, pos + 8);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {BOTOES.map((b) => (
          <button key={b.rotulo} type="button" title={b.rotulo} aria-label={b.rotulo}
            onClick={() => aplicar(b)}
            className="w-9 h-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            <b.icone className="h-3.5 w-3.5" />
          </button>
        ))}
        <button type="button" title="Link" aria-label="Link" onClick={inserirLink}
          className="w-9 h-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <Textarea ref={ref} rows={rows} value={valor} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className={cn("rounded-xl", className)} />
      <p className="text-[11px] font-body text-muted-foreground">
        Selecione o texto e clique no botão. Linha em branco separa parágrafo.
      </p>
    </div>
  );
}
