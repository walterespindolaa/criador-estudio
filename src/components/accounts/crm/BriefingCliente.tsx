import { useRef, useState } from "react";
import { ClipboardList, MessageSquare, Sparkles, ChevronDown, Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O BRIEFING DO CLIENTE

   Briefing bom não é formulário: é conversa. O que a social mídia precisa na
   reunião é o ROTEIRO DE PERGUNTAS na mão, não 40 campos em branco pedindo
   resposta. Por isso este bloco separa duas coisas que antes eram uma só:

   · O ROTEIRO (aqui): as perguntas inteiras, agrupadas por assunto, pra ler,
     copiar e mandar pro cliente. Ninguém precisa preencher nada disto.
   · OS CAMPOS (o brandbook abaixo): o resumo do que saiu da conversa, que é o
     que a IA e o time leem depois.

   Nem toda pergunta do roteiro vira campo, e tudo bem: pergunta de aquecimento
   serve pra fazer o cliente falar, não pra virar linha de banco de dados. As
   que TÊM campo carregam a `chave`, e é por elas que o texto pra IA volta
   preenchendo o brandbook.

   E o documento do briefing (o Word/PDF que ela já usa com o cliente) fica
   anexado aqui, no cliente: é o lugar onde alguém vai procurar seis meses
   depois, não a pasta de downloads.
   ═══════════════════════════════════════════════════════════════════════════ */

/** `chave` só existe quando a resposta tem um campo no brandbook/persona. */
export type PerguntaBrief = { label: string; chave?: string; ajuda?: string; persona?: boolean };
export type BlocoBrief = { titulo: string; perguntas: PerguntaBrief[] };

export const ROTEIRO_BRIEFING: BlocoBrief[] = [
  {
    titulo: "1. Identidade da empresa: origem e valores",
    perguntas: [
      { label: "Como e por que a empresa foi criada?", chave: "history" },
      { label: "Quem são os fundadores e qual é a história por trás do nascimento da marca? Algo motivou o início do negócio?" },
      { label: "Quais valores são inegociáveis para a empresa?", chave: "brandValues" },
      { label: "Qual impacto a marca deseja gerar no mercado e na vida dos clientes?", chave: "impact" },
      { label: "O que incomoda vocês no cenário atual do setor em que atuam?" },
    ],
  },
  {
    titulo: "2. O negócio: produtos e serviços",
    perguntas: [
      { label: "O que a empresa oferece atualmente? Quais são os principais produtos e serviços?", chave: "mainProducts" },
      { label: "O que cada produto busca resolver para o cliente? Tem algum que precisa de destaque na comunicação?", chave: "offer" },
      { label: "Existe algum produto ou serviço que vocês querem fortalecer ou vender mais?" },
      { label: "Como funciona o modelo de negócio da empresa?" },
      { label: "Como acontece a venda: loja física, online, atendimento, comercial, representantes?" },
      { label: "Qual é a faixa de preço ou ticket médio?" },
      { label: "Existe algum diferencial no produto, no serviço ou na forma como ele é entregue?" },
    ],
  },
  {
    titulo: "3. Propósito e visão de futuro",
    perguntas: [
      { label: "Qual problema a empresa busca resolver?" },
      { label: "Onde vocês querem chegar nos próximos anos?", chave: "vision" },
      { label: "O que guia as decisões estratégicas da marca hoje?" },
      { label: "Que tipo de legado a empresa quer construir?" },
      { label: "Qual é a meta principal desta estratégia de conteúdo?", chave: "mainGoal" },
      { label: "Qual é a Big Idea do conteúdo?", chave: "bigIdea", ajuda: "A ideia master que norteia toda a produção: original, intrigante e contraintuitiva." },
      { label: "Qual é a promessa?", chave: "promise", ajuda: "A experiência ou transformação que o cliente vive com o produto ou serviço." },
    ],
  },
  {
    titulo: "4. Diferencial e posicionamento",
    perguntas: [
      { label: "Qual é a principal especialidade ou domínio da empresa?", chave: "specialty" },
      { label: "O que a empresa faz melhor do que a concorrência?", chave: "valueProp" },
      { label: "Qual é o diferencial que o cliente percebe ao escolher vocês?" },
      { label: "Existe algum diferencial que vocês têm, mas sentem que ainda não é percebido?" },
      { label: "Existe um nicho, setor ou tipo de cliente que vocês atendem com mais excelência?" },
      { label: "Em que tipo de solução vocês são referência, ou querem ser?" },
      { label: "Como vocês querem ser reconhecidos no mercado?" },
    ],
  },
  {
    titulo: "5. História e trajetória",
    perguntas: [
      { label: "Quais foram os principais marcos da jornada da empresa?" },
      { label: "Quais desafios ou erros moldaram o negócio atual?" },
      { label: "Houve alguma grande mudança de posicionamento, produto ou modelo de negócio?" },
      { label: "Existe alguma história simbólica que represente o espírito da empresa?" },
      { label: "Há quanto tempo a empresa está no mercado?", chave: "marketSince" },
    ],
  },
  {
    titulo: "6. Público: cliente ideal",
    perguntas: [
      { label: "Quem é o cliente ideal da empresa hoje? Para quem a empresa existe?", chave: "audience" },
      { label: "Quando o cliente chega até vocês, o que ele procura resolver?", chave: "seeks", persona: true },
      { label: "O que ele valoriza em uma empresa como a sua?", chave: "valuesWhat", persona: true },
      { label: "O que influencia a decisão de compra dele?", chave: "buying", persona: true },
      { label: "Quais são as principais dores dele?", chave: "pains", persona: true, ajuda: "Uma por linha." },
      { label: "Quais são os principais desejos dele?", chave: "desires", persona: true, ajuda: "Uma por linha." },
      { label: "Quais objeções ele traz antes de fechar?", chave: "objections", persona: true, ajuda: "Uma por linha: cada uma vira argumento." },
      { label: "Que tipo de comunicação e linguagem ressoam com ele?" },
    ],
  },
  {
    titulo: "7. Tom de voz, identidade e comunicação",
    perguntas: [
      { label: "Como a empresa deseja ser percebida no mercado?", chave: "archetype", ajuda: "Autoridade, proximidade, inovação..." },
      { label: "Qual é o tom de voz preferencial?", chave: "toneOfVoice", ajuda: "Formal, acolhedor, inspirador, técnico, provocador..." },
      { label: "Quais marcas vocês admiram em termos de comunicação? Por quê?", chave: "admiredBrands" },
      { label: "Quais estilos ou abordagens a marca prefere evitar?", chave: "avoid" },
      { label: "Existem palavras, expressões ou mensagens que representam a empresa?", chave: "communicationStyle" },
      { label: "O que a empresa nunca gostaria de transmitir na comunicação?" },
      { label: "Que tipo de imagem combina com a marca?", chave: "visualExpression", ajuda: "Luz, enquadramento, clima." },
    ],
  },
  {
    titulo: "8. Conteúdo e relacionamento com a audiência",
    perguntas: [
      { label: "Que tipo de conteúdo a empresa já produz ou gostaria de produzir?", chave: "contentThemes" },
      { label: "Quais produtos, serviços ou diferenciais precisam aparecer mais na comunicação?" },
      { label: "A marca tem facilidade ou resistência com vídeos, bastidores, opiniões e aparições?" },
      { label: "Quais dúvidas os clientes mais fazem?", chave: "doubts", persona: true, ajuda: "Uma por linha: cada uma vira pauta." },
      { label: "Qual feedback vocês mais recebem da audiência ou dos clientes?" },
      { label: "O que vocês gostariam que o público entendesse melhor sobre a empresa?", chave: "coreMessage" },
    ],
  },
];

const vazio = "(ainda sem resposta)";
const todas = () => ROTEIRO_BRIEFING.flatMap((b) => b.perguntas);

/** Só as perguntas, numeradas: é o que vai pro WhatsApp ou pro e-mail. */
export function textoDasPerguntas(cliente: string): string {
  const linhas: string[] = [`BRIEFING DE CONTEÚDO · ${cliente}`, ""];
  let n = 1;
  for (const b of ROTEIRO_BRIEFING) {
    linhas.push(b.titulo.toUpperCase());
    for (const p of b.perguntas) {
      linhas.push(`${n}. ${p.label}${p.ajuda ? ` (${p.ajuda})` : ""}`);
      n += 1;
    }
    linhas.push("");
  }
  linhas.push("Pode responder no seu tempo, por texto ou por áudio.");
  return linhas.join("\n");
}

/** Perguntas + o que já existe + instrução pra IA devolver o resto pronto. */
export function textoParaIA(bc: Record<string, string>, pe: Record<string, string>, cliente: string): string {
  const resposta = (p: PerguntaBrief) =>
    p.chave ? ((p.persona ? pe[p.chave] : bc[p.chave]) || "").trim() || vazio : vazio;

  const linhas: string[] = [
    `Você é estrategista de conteúdo. Abaixo está o roteiro de briefing da marca "${cliente}" e o que já foi respondido.`,
    "",
    "Sua tarefa: responder o que ainda está em branco e melhorar o que está raso, usando o material que eu vou colar em seguida (transcrição da reunião, site, textos e posts da marca).",
    "",
    "Regras:",
    "1. Responda em português do Brasil.",
    "2. Devolva no formato exato: a pergunta numa linha, e a resposta na linha seguinte começando com uma seta. Sem introdução, sem conclusão, sem comentário.",
    "3. Não invente fato sobre a empresa. Quando não houver base no material, escreva PRECISA CONFIRMAR seguido da pergunta que eu devo fazer ao cliente.",
    "4. Onde eu escrever (uma por linha), devolva uma por linha mesmo.",
    "",
  ];
  for (const b of ROTEIRO_BRIEFING) {
    linhas.push(b.titulo.toUpperCase());
    for (const p of b.perguntas) linhas.push(`${p.label}\n→ ${resposta(p)}`);
    linhas.push("");
  }
  return linhas.join("\n");
}

type Props = {
  cliente: string;
  bc: Record<string, string>;
  pe: Record<string, string>;
  /** Documento do briefing anexado (URL e nome), guardado no brand_core. */
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
  onAnexar?: (file: File) => void | Promise<void>;
  onRemoverAnexo?: () => void;
  anexando?: boolean;
};

export function BriefingCliente({
  cliente, bc, pe, arquivoUrl, arquivoNome, onAnexar, onRemoverAnexo, anexando,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const perguntas = textoDasPerguntas(cliente);
  const paraIA = textoParaIA(bc, pe, cliente);

  const comCampo = todas().filter((p) => p.chave);
  const respondidas = comCampo.filter((p) => ((p.persona ? pe[p.chave!] : bc[p.chave!]) || "").trim()).length;

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-2.5 flex-wrap">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-display font-bold text-foreground">Briefing com o cliente</p>
          <p className="text-[11.5px] font-body text-muted-foreground mt-0.5">
            {todas().length} perguntas pra conduzir a reunião. Você não precisa preencher tudo aqui embaixo:
            preencha o que virar decisão de conteúdo ({respondidas} de {comCampo.length} campos prontos).
          </p>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)}
          className="shrink-0 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label={aberto ? "Fechar o roteiro" : "Ver o roteiro"}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={aberto ? "secondary" : "default"} className="rounded-xl h-8"
          onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar o roteiro" : "Ver o roteiro do briefing"}
        </Button>
        <CopyButton text={perguntas} label="Copiar as perguntas" />
        <CopyButton text={paraIA} label="Copiar pro ChatGPT ou Claude" />
        {onAnexar && (
          <>
            <Button size="sm" variant="outline" className="rounded-xl h-8"
              onClick={() => fileRef.current?.click()} disabled={anexando}>
              {anexando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {arquivoUrl ? "Trocar o documento" : "Anexar o briefing preenchido"}
            </Button>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.txt,.rtf,.odt,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onAnexar(f); }} />
          </>
        )}
      </div>

      {/* O documento fica no cliente, não na pasta de downloads de alguém. */}
      {arquivoUrl && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <a href={arquivoUrl} target="_blank" rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-[12.5px] font-body font-semibold text-foreground hover:text-primary hover:underline">
            {arquivoNome || "briefing do cliente"}
          </a>
          {onRemoverAnexo && (
            <button type="button" onClick={onRemoverAnexo} aria-label="Tirar o anexo"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {aberto && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              <MessageSquare className="h-3 w-3" /> Roteiro da reunião
            </p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {ROTEIRO_BRIEFING.map((b) => (
                <div key={b.titulo}>
                  <p className="text-[12px] font-display font-bold text-primary mb-1">{b.titulo}</p>
                  <ul className="space-y-1">
                    {b.perguntas.map((p) => (
                      <li key={p.label} className="text-[12.5px] font-body text-foreground leading-relaxed flex gap-1.5">
                        <span className="text-muted-foreground/50 shrink-0">·</span>
                        <span>
                          {p.label}
                          {p.ajuda && <span className="text-muted-foreground"> {p.ajuda}</span>}
                          {p.chave && <span className="ml-1 text-[10px] font-semibold text-primary/70">(vira campo)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <Sparkles className="h-3 w-3" /> Pra IA organizar
            </p>
            <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed">
              Copie o texto pro ChatGPT ou pro Claude, cole junto a transcrição da reunião e traga as respostas de volta
              pros campos daqui. Ele foi instruído a escrever PRECISA CONFIRMAR em vez de inventar fato sobre a empresa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
