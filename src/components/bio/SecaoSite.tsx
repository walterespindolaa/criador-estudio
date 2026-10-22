import { cn } from "@/lib/utils";

/* Peças comuns das seções do Modo Site: o fundo de cada seção, o rótulo
   pequeno em cima do título e a caixa da seção. Ficam fora do SiteBio pra os
   arquivos de cada modelo (Loja, Consultoria, Criadora) usarem as mesmas. */

export type MarcaSite = {
  nome: string;
  logo?: string | null;
  /** Cor de destaque da marca. Vem do brandbook do cliente. */
  cor: string;
  corTexto: string;
};

export function Rotulo({ children, cor, herda }: { children: React.ReactNode; cor: string; herda?: boolean }) {
  if (!children) return null;
  // Em fundo escuro ou da marca, a cor de destaque some. Aí o rótulo usa a
  // própria cor do texto da seção, só um pouco mais apagada.
  return (
    <p className={cn("text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1.5", herda && "opacity-70")}
      style={herda ? undefined : { color: cor }}>{children}</p>
  );
}

/* ── O FUNDO DE CADA SEÇÃO ──
   Uma página inteira branca cansa e some: tudo vira a mesma coisa e ninguém
   percebe onde um assunto acaba e o outro começa. Aqui cada seção escolhe o
   seu fundo, e a alternância é o que dá ritmo à rolagem.

   Fundo escuro troca a cor do texto junto, senão a seção some. */
export type FundoSecao = "claro" | "creme" | "escuro" | "marca";

export function estiloDoFundo(fundo: string, marca: MarcaSite): { classe: string; estilo?: React.CSSProperties; escuro: boolean } {
  switch (fundo) {
    case "creme": return { classe: "bg-[#F7F5EF] text-gray-900", escuro: false };
    case "escuro": return { classe: "bg-[#101014] text-[#F5F3E7]", escuro: true };
    case "marca": return {
      classe: "",
      estilo: { backgroundColor: marca.cor, color: marca.corTexto },
      escuro: marca.corTexto.toLowerCase() !== "#1a1626",
    };
    default: return { classe: "bg-white text-gray-900", escuro: false };
  }
}

export function Secao({ id, fundo, marca, className, children }: {
  id?: string; fundo?: string; marca: MarcaSite; className?: string; children: React.ReactNode;
}) {
  // Filho nulo não vira faixa vazia. Sem isso, um bloco que decide não se
  // desenhar (contagem vencida, FAQ sem pergunta) deixava 150px de branco no
  // meio da página, que parece defeito de montagem.
  if (children === null || children === undefined || children === false) return null;
  const f = estiloDoFundo(fundo ?? "claro", marca);
  return (
    <section id={id} style={f.estilo}
      className={cn("px-5 py-9 cq-md:py-16 scroll-mt-[52px]", f.classe, className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

