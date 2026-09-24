import type { ReactNode } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   LISTA POR DIA (celular) · pente fino 24/09/2026

   No celular a grade de calendário vira um monte de células apertadas com
   pontinhos: a pessoa toca no dia, abre modal, toca no post, abre outro
   modal, muda a data. Aqui a mesma informação vira uma lista rolável, um
   bloco por dia (dia da semana + número), cada item com o título inteiro e
   um "Mover" que abre o seletor de data nativo do celular. Dois toques pra
   remarcar; um pra abrir. Desktop continua com a grade e o arraste.

   Genérico: quem chama diz quais dias existem, o que tem em cada dia, como
   desenhar cada item e o que fazer ao mover. Não sabe o que é post.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type ItemDoDia = {
  id: string;
  titulo: string;
  /** Linha pequena embaixo do título (cliente, horário, status). */
  detalhe?: string | null;
  /** Cor da bolinha à esquerda. */
  cor?: string | null;
  /** Etiqueta pequena à direita (ex.: "Entrega"). */
  etiqueta?: string | null;
  /** Se false, o item não mostra "Mover" (ex.: marco de entrega). */
  movivel?: boolean;
};

export function ListaPorDia({ dias, itensDe, hoje, aoAbrir, aoMover, aoCriarEm, vazio, className, apenasComItens = true }: {
  /** Dias a listar, em "YYYY-MM-DD", na ordem. */
  dias: string[];
  itensDe: (dia: string) => ItemDoDia[];
  hoje: string;
  aoAbrir: (id: string) => void;
  /** Recebe o id e a data nova em "YYYY-MM-DD". */
  aoMover?: (id: string, dia: string) => void;
  aoCriarEm?: (dia: string) => void;
  vazio?: ReactNode;
  className?: string;
  /** Padrão: esconde dias sem nada (lista curta). false = mostra todos. */
  apenasComItens?: boolean;
}) {
  const blocos = dias
    .map((d) => ({ dia: d, itens: itensDe(d) }))
    .filter((b) => !apenasComItens || b.itens.length > 0 || b.dia === hoje);

  if (blocos.length === 0) {
    return <div className={cn("rounded-2xl border border-dashed border-border p-6 text-center text-sm font-body text-muted-foreground", className)}>{vazio ?? "Nada agendado neste período."}</div>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocos.map(({ dia, itens }) => {
        const d = new Date(`${dia}T00:00:00`);
        const ehHoje = dia === hoje;
        return (
          <section key={dia} className={cn("rounded-2xl border bg-card", ehHoje ? "border-primary/50" : "border-border")}>
            <header className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
              <span className={cn("text-lg font-display font-extrabold leading-none", ehHoje ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
              <span className="text-xs font-body text-muted-foreground">
                <span className="capitalize">{DIAS[d.getDay()]}</span> · {MESES[d.getMonth()]}
                {ehHoje && <span className="ml-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-px text-[10px] font-bold">hoje</span>}
              </span>
              {aoCriarEm && (
                <button type="button" onClick={() => aoCriarEm(dia)} aria-label={`Novo item em ${d.getDate()}/${d.getMonth() + 1}`}
                  className="ml-auto grid place-items-center h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted">
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </header>
            {itens.length === 0 ? (
              <p className="px-3 pb-3 text-xs font-body text-muted-foreground">Nada marcado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((it) => (
                  <li key={it.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: it.cor ?? "hsl(var(--primary))" }} />
                    <button type="button" onClick={() => aoAbrir(it.id)} className="min-w-0 flex-1 text-left min-h-[44px] flex flex-col justify-center">
                      <span className="block text-[13.5px] font-body font-semibold text-foreground leading-snug line-clamp-2">
                        {it.etiqueta && <span className="mr-1.5 rounded-full border border-border px-1.5 py-px text-[10px] font-bold uppercase text-muted-foreground">{it.etiqueta}</span>}
                        {it.titulo}
                      </span>
                      {it.detalhe && <span className="block text-[12px] font-body text-muted-foreground truncate">{it.detalhe}</span>}
                    </button>
                    {aoMover && it.movivel !== false && (
                      <label className="relative shrink-0 grid place-items-center h-10 w-10 rounded-lg border border-border text-muted-foreground active:bg-muted" aria-label="Mover para outro dia">
                        <CalendarDays className="h-4 w-4" />
                        {/* O input de data nativo fica invisível em cima do ícone: no
                            celular abre a rodinha de data do sistema, que é o melhor
                            seletor que existe ali. */}
                        {/* Controlado (value, não defaultValue): se a mudança
                            falhar e voltar, o seletor volta pro dia certo. */}
                        <input type="date" value={dia}
                          onChange={(e) => { const v = e.target.value; if (v && v !== dia) aoMover(it.id, v); }}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
