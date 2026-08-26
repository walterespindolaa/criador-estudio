import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, Copy, ExternalLink, MessageSquare, Palette, Pencil, ShoppingBag,
  Target, UserRound, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CrmClient } from "@/hooks/useCrm";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O BRANDBOOK QUE A SOCIAL MÍDIA PREENCHEU

   Cliente que usa o Cria tem o brandbook na conta dele, e a gente puxa de lá.
   Cliente que NÃO usa (a maioria) tem o brandbook preenchido na mão pela
   social mídia, na ficha do CRM. Até aqui o cockpit não mostrava esse segundo
   caso: dizia "este cliente não usa o Cria" e mandava a pessoa procurar em
   outra tela. Quem monta post não vai atrás: escreve sem a direção da marca.

   Aqui é LEITURA, organizada pra consulta rápida na hora de escrever. Editar
   continua na ficha completa, que é onde os campos vivem.
   ═══════════════════════════════════════════════════════════════════════════ */

type Campo = { chave: string; rotulo: string };
type Grupo = { titulo: string; explica: string; Icone: LucideIcon; campos: Campo[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Estratégia",
    explica: "O norte. Se o post não serve a isso, ele não deveria existir.",
    Icone: Target,
    campos: [
      { chave: "mainGoal", rotulo: "Meta principal" },
      { chave: "bigIdea", rotulo: "A Big Idea" },
      { chave: "promise", rotulo: "Promessa" },
      { chave: "perception6m", rotulo: "Como quer ser percebida em 6 a 12 meses" },
      { chave: "successMetric", rotulo: "Como o cliente sabe que funcionou" },
    ],
  },
  {
    titulo: "O que vende e pra quem",
    explica: "O que entra no conteúdo e quem precisa ouvir.",
    Icone: ShoppingBag,
    campos: [
      { chave: "offer", rotulo: "O que a marca vende" },
      { chave: "mainProducts", rotulo: "Produtos e serviços" },
      { chave: "valueProp", rotulo: "Proposta de valor" },
      { chave: "specialty", rotulo: "Especialidade técnica" },
      { chave: "audience", rotulo: "Público" },
      { chave: "contentThemes", rotulo: "Pilares de conteúdo" },
      { chave: "coreMessage", rotulo: "Mensagem central" },
    ],
  },
  {
    titulo: "Como falar",
    explica: "O jeito de escrever de todo post daqui pra frente.",
    Icone: MessageSquare,
    campos: [
      { chave: "toneOfVoice", rotulo: "Tom de voz" },
      { chave: "archetype", rotulo: "Arquétipo" },
      { chave: "personality", rotulo: "Personalidade" },
      { chave: "communicationStyle", rotulo: "Estilo de comunicação" },
      { chave: "avoid", rotulo: "O que evitar" },
    ],
  },
  {
    titulo: "Visual",
    explica: "Cores, fontes e direção de arte.",
    Icone: Palette,
    campos: [
      { chave: "colorPalette", rotulo: "Paleta" },
      { chave: "typography", rotulo: "Tipografia" },
      { chave: "visualExpression", rotulo: "Expressão visual" },
    ],
  },
  {
    titulo: "História",
    explica: "É daqui que sai o conteúdo que ninguém copia.",
    Icone: BookOpen,
    campos: [
      { chave: "history", rotulo: "Como a empresa nasceu" },
      { chave: "brandValues", rotulo: "Valores" },
      { chave: "impact", rotulo: "Transformação que quer gerar" },
      { chave: "vision", rotulo: "Visão" },
      { chave: "marketSince", rotulo: "Tempo de mercado" },
      { chave: "admiredBrands", rotulo: "Marcas que admira" },
    ],
  },
];

const PERSONA: Campo[] = [
  { chave: "pains", rotulo: "Dores" },
  { chave: "desires", rotulo: "Desejos" },
  { chave: "doubts", rotulo: "Dúvidas antes de fechar" },
  { chave: "objections", rotulo: "Objeções" },
  { chave: "seeks", rotulo: "O que procura" },
  { chave: "valuesWhat", rotulo: "O que valoriza" },
  { chave: "buying", rotulo: "Como compra" },
  { chave: "lifestyle", rotulo: "Estilo de vida" },
];

/** Cores em HEX dentro de um texto livre viram amostras clicáveis. */
function Paleta({ texto }: { texto: string }) {
  const cores = (texto.match(/#[0-9a-fA-F]{3,8}/g) ?? []).slice(0, 12);
  if (cores.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {cores.map((c) => (
        <button key={c} type="button"
          onClick={() => { void navigator.clipboard.writeText(c); toast.success(`${c} copiado`); }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card pl-1 pr-2 py-1 text-[11px] font-mono">
          <span className="w-4 h-4 rounded-md border border-border" style={{ backgroundColor: c }} />
          {c.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-body font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="text-[13.5px] font-body text-foreground leading-relaxed whitespace-pre-line mt-0.5">{valor}</p>
      {/color|paleta|hex/i.test(rotulo) && <Paleta texto={valor} />}
    </div>
  );
}

export function BrandbookDoCrm({ client }: { client: CrmClient }) {
  const bc = (client.brand_core ?? {}) as Record<string, string>;

  // A persona pode ser objeto (formato antigo) ou lista (formato novo).
  const personas = useMemo(() => {
    const p = client.persona as unknown;
    if (Array.isArray(p)) return p as Record<string, string>[];
    if (p && typeof p === "object") return [p as Record<string, string>];
    return [];
  }, [client.persona]);

  const gruposCheios = GRUPOS
    .map((g) => ({ ...g, campos: g.campos.filter((c) => (bc[c.chave] ?? "").trim()) }))
    .filter((g) => g.campos.length > 0);

  const personasCheias = personas
    .map((p) => PERSONA.filter((c) => (p[c.chave] ?? "").trim()).map((c) => ({ ...c, valor: p[c.chave] })))
    .filter((l) => l.length > 0);

  const nada = gruposCheios.length === 0 && personasCheias.length === 0;

  /** Tudo em texto, pronto pra colar num chat de IA na hora de escrever. */
  const copiarTudo = async () => {
    const linhas: string[] = [`Brandbook de ${client.display_name || client.name}`, ""];
    for (const g of gruposCheios) {
      linhas.push(`## ${g.titulo}`);
      for (const c of g.campos) linhas.push(`${c.rotulo}: ${bc[c.chave]}`);
      linhas.push("");
    }
    personasCheias.forEach((p, i) => {
      linhas.push(`## Persona ${personasCheias.length > 1 ? i + 1 : ""}`.trim());
      for (const c of p) linhas.push(`${c.rotulo}: ${c.valor}`);
      linhas.push("");
    });
    await navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Brandbook copiado. Cole no ChatGPT ou no Claude.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-semibold text-foreground">
            Brandbook preenchido por você
          </p>
          <p className="text-xs font-body text-muted-foreground mt-0.5">
            Este cliente não tem conta no Cria, então a direção da marca vem da ficha do CRM. É a mesma que a IA usa
            quando você gera ideia e legenda pra ele.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!nada && (
            <Button variant="outline" size="sm" onClick={copiarTudo}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar tudo
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to={`/socialmidia/criacrm/${client.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      {nada ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body font-medium text-foreground">O brandbook deste cliente está vazio</p>
          <p className="text-xs font-body text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
            Sem ele, a IA escreve genérico e cada post sai com um tom diferente. Dá pra preencher na mão, subir o
            briefing em PDF, ou mandar o link de perguntas pro próprio cliente responder.
          </p>
          <Button variant="outline" asChild>
            <Link to={`/socialmidia/criacrm/${client.id}`}>
              <ExternalLink className="h-4 w-4 mr-1.5" /> Preencher agora
            </Link>
          </Button>
        </div>
      ) : (
        // columns: os cards têm alturas bem diferentes (Estratégia é curto,
        // História é longo). Em grade, um card curto deixa um buraco enorme do
        // lado; em colunas de alvenaria eles se encaixam.
        <div className="gap-3 [column-fill:_balance] sm:columns-2 xl:columns-3 [&>div]:mb-3 [&>div]:break-inside-avoid">
          {gruposCheios.map((g) => (
            <div key={g.titulo} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                  <g.Icone className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-display font-bold text-foreground">{g.titulo}</p>
              </div>
              <p className="text-[11.5px] font-body text-muted-foreground mb-3">{g.explica}</p>
              <div className="space-y-3">
                {g.campos.map((c) => <Item key={c.chave} rotulo={c.rotulo} valor={bc[c.chave]} />)}
              </div>
            </div>
          ))}

          {personasCheias.map((p, i) => (
            <div key={i} className={cn("rounded-2xl border border-primary/25 bg-primary/[0.03] p-4",
              )}>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-xl bg-primary/15 grid place-items-center shrink-0">
                  <UserRound className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-display font-bold text-foreground">
                  Persona{personasCheias.length > 1 ? ` ${i + 1}` : ""}
                </p>
              </div>
              <p className="text-[11.5px] font-body text-muted-foreground mb-3">
                Pra quem cada post está falando. É o que separa conteúdo que conversa de conteúdo que anuncia.
              </p>
              <div className="space-y-3">
                {p.map((c) => <Item key={c.chave} rotulo={c.rotulo} valor={c.valor} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
