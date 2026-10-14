import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* CIDADE PADRONIZADA (Walter, 14/10/2026): "senão um escreve itaja-sc, o
   outro itajai, o outro itajoca". A pessoa digita e escolhe da lista oficial
   de municípios do IBGE (public/cidades-br.json, 5.571 nomes, carregada só
   quando o campo é usado). O valor salvo é sempre "Itajaí - SC"; o banco
   recusa outro formato. Busca ignora acento e maiúscula. */

let cache: Promise<string[]> | null = null;
function carregarCidades(): Promise<string[]> {
  cache ??= fetch("/cidades-br.json").then((r) => r.json() as Promise<string[]>).catch(() => { cache = null; return []; });
  return cache;
}
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
  /** Visual mais enxuto (dentro da barra de busca). */
  compacto?: boolean;
};

export function CidadeInput({ value, onChange, placeholder = "Digite sua cidade", className, compacto = false }: Props) {
  const [lista, setLista] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const achados = useMemo(() => {
    const q = sem(texto); // aceita "itajai sc", "itajai - sc", "itajaí"
    if (q.length < 2) return [];
    const partes = q.replace(/[-,/]/g, " ").split(/\s+/).filter(Boolean);
    const comeca: string[] = []; const contem: string[] = [];
    for (const c of lista) {
      const n = sem(c).replace(" - ", " ");
      if (!partes.every((p) => n.includes(p))) continue;
      (n.startsWith(partes[0]) ? comeca : contem).push(c);
      if (comeca.length >= 8) break;
    }
    return [...comeca, ...contem].slice(0, 8);
  }, [texto, lista]);

  const escolher = (c: string) => { onChange(c); setTexto(""); setAberto(false); };

  if (value) {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-xl border border-border bg-card px-3", compacto ? "h-9 text-[13px]" : "h-10 text-sm", className)}>
        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-semibold">{value}</span>
        <button type="button" aria-label="Trocar cidade" className="text-muted-foreground hover:text-foreground" onClick={() => { onChange(null); setAberto(true); }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={caixa} className={cn("relative", className)}>
      <div className={cn("flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20", compacto ? "h-9" : "h-10")}>
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60", compacto ? "text-[13px]" : "text-sm")}
          placeholder={placeholder} value={texto} autoComplete="off"
          onFocus={() => { void carregarCidades().then(setLista); setAberto(true); }}
          onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberto(true); }}
          onKeyDown={(e) => {
            if (!achados.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); escolher(achados[ativo]); }
            else if (e.key === "Escape") setAberto(false);
          }}
        />
      </div>
      {aberto && texto.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {achados.length === 0
            ? <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground">{lista.length ? "Nenhuma cidade com esse nome." : "Carregando cidades…"}</p>
            : achados.map((c, i) => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(c)} onMouseEnter={() => setAtivo(i)}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]", i === ativo ? "bg-muted" : "")}>
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{c}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
