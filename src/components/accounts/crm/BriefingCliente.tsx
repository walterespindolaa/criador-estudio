import { useState } from "react";
import { ClipboardList, MessageSquare, Sparkles, ChevronDown } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O BRIEFING DO CLIENTE

   O brandbook do CRM é um formulário grande, e formulário grande em branco
   ninguém preenche. Na prática a social mídia marca uma reunião, pergunta tudo
   na mão e depois digita. Este bloco existe pra encurtar esse caminho de duas
   formas, sem inventar campo novo:

   · MANDAR AS PERGUNTAS: copia o roteiro do briefing em texto limpo pra colar
     no WhatsApp do cliente. Ele responde quando puder, no tempo dele.
   · PEDIR PRA IA ORGANIZAR: copia as MESMAS perguntas com as respostas que já
     existem, mais a instrução de devolver campo a campo. A pessoa cola no
     ChatGPT ou no Claude dela, joga a transcrição da reunião junto, e volta com
     tudo escrito no formato que este brandbook espera.

   As perguntas são as mesmas que estão nos campos: uma fonte só, senão o
   roteiro do briefing e o formulário divergem na primeira alteração.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PerguntaBrief = { chave: string; label: string; ajuda?: string };
export type BlocoBrief = { titulo: string; perguntas: PerguntaBrief[] };

/** O roteiro completo: o mesmo texto dos campos do brandbook e da persona. */
export const ROTEIRO_BRIEFING: BlocoBrief[] = [
  {
    titulo: "A empresa",
    perguntas: [
      { chave: "mainProducts", label: "Quais produtos ou serviços a empresa oferece?" },
      { chave: "marketSince", label: "Há quanto tempo a empresa está no mercado?" },
      { chave: "history", label: "Como e por que a empresa nasceu?" },
      { chave: "brandValues", label: "Quais são os valores da marca?", ajuda: "No que ela acredita e não abre mão." },
      { chave: "impact", label: "Que impacto ou transformação a marca quer gerar?" },
      { chave: "vision", label: "Onde a marca quer chegar nos próximos anos?" },
      { chave: "admiredBrands", label: "Quais marcas você admira e por quê?" },
    ],
  },
  {
    titulo: "Estratégia",
    perguntas: [
      { chave: "mainGoal", label: "Qual é a meta principal desta estratégia de conteúdo?" },
      { chave: "bigIdea", label: "Qual é a Big Idea do conteúdo?", ajuda: "A ideia master que norteia tudo: original, intrigante e contraintuitiva." },
      { chave: "promise", label: "Qual é a promessa?", ajuda: "A experiência ou transformação que o cliente tem com o produto ou serviço." },
    ],
  },
  {
    titulo: "Mensagem",
    perguntas: [
      { chave: "offer", label: "O que a marca vende?" },
      { chave: "valueProp", label: "Por que escolher essa marca e não outra?" },
      { chave: "audience", label: "Para quem é? Descreva o público." },
      { chave: "contentThemes", label: "Sobre quais temas a marca deve falar?" },
      { chave: "avoid", label: "O que a marca nunca deve falar ou fazer?" },
      { chave: "specialty", label: "No que a empresa é tecnicamente mais forte?" },
      { chave: "coreMessage", label: "Qual é a mensagem central que todo conteúdo deve passar?" },
    ],
  },
  {
    titulo: "Voz e visual",
    perguntas: [
      { chave: "archetype", label: "Se a marca fosse uma pessoa, como ela seria?", ajuda: "Arquétipo." },
      { chave: "toneOfVoice", label: "Qual é o tom de voz?", ajuda: "Formal ou informal, emocional ou racional, otimista ou sério e objetivo." },
      { chave: "personality", label: "Como você descreveria a personalidade da marca?" },
      { chave: "communicationStyle", label: "Como a marca fala com o público no dia a dia?" },
      { chave: "typography", label: "Quais fontes a marca usa?" },
      { chave: "colorPalette", label: "Quais são as cores da marca?" },
      { chave: "visualExpression", label: "Que tipo de imagem combina com a marca?", ajuda: "Luz, enquadramento, clima." },
    ],
  },
];

/** Persona: as perguntas do público, separadas porque valem por persona. */
export const ROTEIRO_PERSONA: BlocoBrief = {
  titulo: "A persona (quem a gente quer alcançar)",
  perguntas: [
    { chave: "name", label: "Dê um nome e descreva essa pessoa em uma frase." },
    { chave: "ageRange", label: "Qual a faixa de idade?" },
    { chave: "gender", label: "Gênero?" },
    { chave: "region", label: "Onde mora?" },
    { chave: "spend", label: "Quanto costuma gastar com esse tipo de serviço?" },
    { chave: "lifestyle", label: "Como é o dia a dia dessa pessoa?" },
    { chave: "valuesWhat", label: "O que ela mais valoriza?" },
    { chave: "habits", label: "Que hábitos ela tem?" },
    { chave: "buying", label: "Como ela decide uma compra?" },
    { chave: "pains", label: "Quais são as dores dela?", ajuda: "Uma por linha." },
    { chave: "desires", label: "Quais são os desejos dela?", ajuda: "Uma por linha." },
    { chave: "doubts", label: "Que dúvidas ela sempre traz antes de comprar?", ajuda: "Uma por linha: cada uma vira pauta." },
    { chave: "objections", label: "O que a impede de comprar?", ajuda: "Uma por linha: cada objeção vira argumento." },
    { chave: "seeks", label: "O que ela busca ao escolher uma empresa assim?" },
    { chave: "loyalty", label: "O que faria ela virar cliente fiel?" },
    { chave: "howWeServe", label: "Como a empresa atende essa pessoa hoje?" },
  ],
};

const vazio = "(ainda sem resposta)";

/** Só as perguntas, numeradas: é o que vai pro WhatsApp do cliente. */
function textoDasPerguntas(): string {
  const linhas: string[] = ["BRIEFING DE CONTEÚDO", ""];
  let n = 1;
  for (const b of [...ROTEIRO_BRIEFING, ROTEIRO_PERSONA]) {
    linhas.push(`── ${b.titulo.toUpperCase()} ──`);
    for (const p of b.perguntas) {
      linhas.push(`${n}. ${p.label}${p.ajuda ? ` (${p.ajuda})` : ""}`);
      n += 1;
    }
    linhas.push("");
  }
  linhas.push("Responda no seu tempo, pode ser por áudio.");
  return linhas.join("\n");
}

/** Perguntas + o que já está preenchido + instrução pra IA devolver o resto. */
function textoParaIA(bc: Record<string, string>, pe: Record<string, string>, cliente: string): string {
  const linhas: string[] = [
    `Você é estrategista de conteúdo. Abaixo está o briefing da marca "${cliente}", com perguntas e o que já foi respondido.`,
    "",
    "Sua tarefa: completar o que está sem resposta e melhorar o que está raso, usando o material que eu colar depois desta mensagem (transcrição da reunião, site, textos da marca).",
    "",
    "Regras: responda em português do Brasil, no formato exato PERGUNTA seguida de seta e resposta, uma por linha, sem introdução e sem comentários. Não invente fato sobre a empresa: quando não houver base, escreva PRECISA CONFIRMAR e a pergunta que eu devo fazer ao cliente.",
    "",
  ];
  for (const b of ROTEIRO_BRIEFING) {
    linhas.push(`── ${b.titulo.toUpperCase()} ──`);
    for (const p of b.perguntas) linhas.push(`${p.label}\n→ ${(bc[p.chave] || "").trim() || vazio}`);
    linhas.push("");
  }
  linhas.push(`── ${ROTEIRO_PERSONA.titulo.toUpperCase()} ──`);
  for (const p of ROTEIRO_PERSONA.perguntas) linhas.push(`${p.label}\n→ ${(pe[p.chave] || "").trim() || vazio}`);
  return linhas.join("\n");
}

export function BriefingCliente({
  cliente, bc, pe,
}: { cliente: string; bc: Record<string, string>; pe: Record<string, string> }) {
  const [aberto, setAberto] = useState(false);
  const perguntas = textoDasPerguntas();
  const paraIA = textoParaIA(bc, pe, cliente);

  const total = [...ROTEIRO_BRIEFING.flatMap((b) => b.perguntas).map((p) => bc[p.chave]),
                 ...ROTEIRO_PERSONA.perguntas.map((p) => pe[p.chave])];
  const respondidas = total.filter((v) => (v || "").trim()).length;

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-2.5 flex-wrap">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-display font-bold text-foreground">Briefing com o cliente</p>
          <p className="text-[11.5px] font-body text-muted-foreground mt-0.5">
            {respondidas} de {total.length} respostas preenchidas. Mande as perguntas pro cliente ou peça pra IA organizar o que você já anotou.
          </p>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)}
          className="shrink-0 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label={aberto ? "Recolher" : "Abrir"}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <CopyButton text={perguntas} label="Copiar as perguntas" />
        <CopyButton text={paraIA} label="Copiar pro ChatGPT ou Claude" />
      </div>

      {aberto && (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <MessageSquare className="h-3 w-3" /> Pro cliente
            </p>
            <pre className="text-[11.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{perguntas}</pre>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <Sparkles className="h-3 w-3" /> Pra IA
            </p>
            <p className="text-[11.5px] font-body text-muted-foreground mb-2 leading-relaxed">
              Cole no ChatGPT ou no Claude, mande junto a transcrição da reunião, e traga as respostas de volta pra cá.
            </p>
            <pre className="text-[11.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{paraIA}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/** Botão só de copiar, pra usar solto (ex.: no topo da aba de persona). */
export function BotaoCopiarBriefing(props: { cliente: string; bc: Record<string, string>; pe: Record<string, string> }) {
  return <CopyButton text={textoParaIA(props.bc, props.pe, props.cliente)} label="Copiar pro ChatGPT ou Claude" />;
}
