import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  useTendencias, serveProNicho, NOME_TIPO_TENDENCIA, COR_TIPO_TENDENCIA, type Tendencia,
} from "@/hooks/useTendencias";

/* ═══════════════════════════════════════════════════════════════════════════
   POPUP "USAR UMA TENDÊNCIA" (28/10/2026, mockup aprovado)

   A pessoa marca até N tendências e elas viram a base do que a Cria IA
   escreve. Usado no Novo story, no "Montar a semana" do Cria Stories e no
   Cria Plano. `preferir` só muda a ordem (stories primeiro, ou posts).
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo?: string;
  subtitulo?: string;
  botao?: string;
  max?: number;
  preferir?: "story" | "conteudo";
  iniciais?: string[];
  onConfirmar: (lista: Tendencia[]) => void;
};

export function TrendPickerDialog({
  open, onOpenChange, titulo = "Tendências", subtitulo, botao = "Usar essas", max = 3, preferir = "story", iniciais = [], onConfirmar,
}: Props) {
  const { profile } = useActiveProfile();
  const { data: todas, isLoading } = useTendencias();
  const [soNicho, setSoNicho] = useState(true);
  const [sel, setSel] = useState<string[]>(iniciais);
  const [abertoEm, setAbertoEm] = useState(false);
  if (open && !abertoEm) { setAbertoEm(true); setSel(iniciais); }
  if (!open && abertoEm) setAbertoEm(false);

  const lista = useMemo(() => {
    const base = soNicho ? todas.filter((t) => serveProNicho(t, profile?.niche)) : todas;
    return [...base].sort((a, b) => (a.fonte === b.fonte ? 0 : (a.fonte === preferir ? -1 : 1)));
  }, [todas, soNicho, profile?.niche, preferir]);

  const alternar = (c: string) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length >= max ? s : [...s, c]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">{titulo}</DialogTitle>
          <p className="text-sm font-body text-muted-foreground">{subtitulo ?? `Marque até ${max}. A Cria IA usa elas como base.`}</p>
        </DialogHeader>
        <div className="flex gap-1.5 flex-wrap">
          <Chip on={soNicho} onClick={() => setSoNicho(true)}>Pro seu nicho</Chip>
          <Chip on={!soNicho} onClick={() => setSoNicho(false)}>Todas</Chip>
        </div>
        <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
          ) : lista.length === 0 ? (
            <p className="text-sm font-body text-muted-foreground py-6 text-center">A curadoria ainda não trouxe tendências. Volte na segunda.</p>
          ) : lista.map((t) => {
            const on = sel.includes(t.chave);
            const cheio = !on && sel.length >= max;
            return (
              <button key={t.chave} type="button" onClick={() => alternar(t.chave)} disabled={cheio}
                aria-pressed={on}
                className={cn("grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 text-left rounded-2xl border-[1.5px] px-3 py-2.5 transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40", cheio && "opacity-50")}>
                <span className={cn("mt-0.5 h-[22px] w-[22px] rounded-md border-2 grid place-items-center", on ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className={cn("inline-block text-[11px] font-body font-bold rounded-full px-2 py-0.5 mb-1", COR_TIPO_TENDENCIA[t.tipo])}>
                    {t.fonte === "story" ? `Story · ${t.formatoStory ?? ""}` : NOME_TIPO_TENDENCIA[t.tipo]}
                  </span>
                  <b className="block text-[13.5px] font-body text-foreground leading-snug">{t.titulo}</b>
                  {(t.exemplo || t.descricao) && <small className="block text-[12px] font-body text-muted-foreground leading-snug mt-0.5 line-clamp-2">{t.exemplo || t.descricao}</small>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end pt-1">
          <span className="flex-1 min-w-[140px] text-xs font-body text-muted-foreground">
            {sel.length === 0 ? "Nenhuma marcada" : `${sel.length} de ${max} marcada${sel.length > 1 ? "s" : ""}`}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={sel.length === 0} onClick={() => { onConfirmar(todas.filter((t) => sel.includes(t.chave))); onOpenChange(false); }}>{botao}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn("rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-body font-semibold transition-colors",
        on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/40", className)}>
      {children}
    </button>
  );
}
