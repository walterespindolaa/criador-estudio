import { toast } from "sonner";
import { Star } from "lucide-react";
import { FUNCOES, type FuncaoCriakut } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* MAIS DE UMA FUNÇÃO (Walter, 14/10/2026: "a pessoa pode ser designer e editora
   de vídeo, ali só dá pra fazer 1 função"). Até 4 marcadas: a primeira é a
   principal (aparece primeiro e decide o lado nas comunidades), as outras
   também contam na busca. Criadora de conteúdo fica sozinha porque a página
   de quem contrata é outra (Instagram e o que procura, sem tabela de preço).

   15/10 ("Aparece primeiro" confuso): cada marcada mostra o número da ordem e a
   escolha da principal virou um quadro com estrela e o porquê, logo embaixo. */

export const MAX_FUNCOES = 4;

export function EscolherFuncoes({ principal, outras, onChange, tamanho = "md" }: {
  principal: FuncaoCriakut; outras: FuncaoCriakut[];
  onChange: (principal: FuncaoCriakut, outras: FuncaoCriakut[]) => void; tamanho?: "sm" | "md";
}) {
  const marcadas = [principal, ...outras.filter((x) => x !== principal)];
  const clicar = (f: FuncaoCriakut) => {
    if (marcadas.includes(f)) {
      if (marcadas.length === 1) return;
      const resto = marcadas.filter((x) => x !== f);
      onChange(resto[0], resto.slice(1));
      return;
    }
    if (f === "criadora" || principal === "criadora") { onChange(f, []); return; }
    if (marcadas.length >= MAX_FUNCOES) { toast.error(`Até ${MAX_FUNCOES} funções.`); return; }
    onChange(principal, [...outras, f]);
  };
  const chip = tamanho === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-3.5 py-1.5 text-[13px]";
  const nome = (v: FuncaoCriakut) => FUNCOES.find((x) => x.valor === v)?.nome;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FUNCOES.map((x) => {
          const ordem = marcadas.indexOf(x.valor);
          const on = ordem >= 0;
          return (
            <button key={x.valor} type="button" aria-pressed={on} onClick={() => clicar(x.valor)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors", chip,
                on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              {on && marcadas.length > 1 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">{ordem + 1}</span>
              )}
              {x.nome}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {principal === "criadora"
          ? "Criadora de conteúdo é marcada sozinha: sua página mostra seu Instagram e o que você procura."
          : `Marque até ${MAX_FUNCOES}. Você aparece na busca de todas. Toque de novo pra desmarcar.`}
      </p>
      {marcadas.length > 1 && (
        <div className="mt-2.5 rounded-2xl border border-dashed border-border bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Qual aparece primeiro na sua página?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {marcadas.map((m) => (
              <button key={m} type="button" aria-pressed={m === principal} onClick={() => onChange(m, marcadas.filter((x) => x !== m))}
                className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-semibold",
                  m === principal ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                {m === principal && <Star className="h-3 w-3 fill-current" />}{nome(m)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">É ela que vai no seu título e decide em que lado das comunidades você entra.</p>
        </div>
      )}
    </div>
  );
}
