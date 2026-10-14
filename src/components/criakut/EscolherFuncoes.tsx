import { toast } from "sonner";
import { FUNCOES, type FuncaoCriakut } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* MAIS DE UMA FUNÇÃO (Walter, 14/10/2026: "a pessoa pode ser designer e editora
   de vídeo, ali só dá pra fazer 1 função"). Até 4 marcadas: a primeira é a
   principal (aparece primeiro e decide o lado nas comunidades), as outras
   também contam na busca. Criadora de conteúdo fica sozinha porque a página
   de quem contrata é outra (Instagram e o que procura, sem tabela de preço). */

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
  const chip = tamanho === "sm" ? "px-3 py-1 text-[12px]" : "px-3 py-1 text-[12.5px]";
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FUNCOES.map((x) => {
          const on = marcadas.includes(x.valor);
          return (
            <button key={x.valor} type="button" aria-pressed={on} onClick={() => clicar(x.valor)}
              className={cn("rounded-full border font-semibold", chip, on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              {x.nome}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {principal === "criadora"
          ? "Criadora de conteúdo é marcada sozinha: sua página mostra seu Instagram e o que você procura."
          : "Pode marcar mais de uma (até 4). Você aparece na busca de todas."}
      </p>
      {marcadas.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-muted-foreground">Aparece primeiro:</span>
          {marcadas.map((m) => (
            <button key={m} type="button" onClick={() => onChange(m, marcadas.filter((x) => x !== m))}
              className={cn("rounded-full border px-2.5 py-0.5 font-semibold", m === principal ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
              {FUNCOES.find((x) => x.valor === m)?.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
