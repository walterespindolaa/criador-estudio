import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { Button } from "@/components/ui/button";
import { parseHex, personasDaFicha } from "@/components/accounts/crm/BrandbookEditor";
import { usePdfExport, LARGURA_A4 } from "@/hooks/usePdfExport";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import type { CrmClient } from "@/hooks/useCrm";

/* ═══════════════════════════════════════════════════════════════════════════
   O BRANDBOOK DO CLIENTE EM PDF

   O brandbook do cliente do CRM só existia dentro do app: pra mandar a direção
   da marca pro próprio cliente (ou arquivar a versão do mês) a social mídia
   tirava print de aba em aba. Aqui ele vira documento: capa, um capítulo por
   grupo de perguntas e uma página por persona.

   Duas decisões que dão a cara do Cria e não podem se perder:

   1. CAMPO VAZIO NÃO APARECE. Um PDF cheio de "não preenchido" denuncia o que
      falta em vez de entregar o que existe, e ninguém manda isso pro cliente.
   2. O TEXTO SAI COMO FOI ESCRITO (white-space: pre-line). Dores, desejos e
      objeções são listas de um item por linha: coladas num parágrafo só elas
      viram uma parede de texto que ninguém lê.

   Regras de exportação (usePdfExport):
   - Cada folha é um data-pdf-block e, a partir da segunda, um data-pdf-break:
     o corte cai SEMPRE no topo de uma folha, então cabeçalho e rodapé nascem
     onde deviam nascer.
   - Cada bloco de pergunta também é data-pdf-block. Se a estimativa de altura
     errar pra menos e a folha crescer, o corte cai entre duas perguntas em vez
     de partir um texto no meio.
   - Cores em HEX fixo: o html2canvas não resolve var() em oklch.
   ═══════════════════════════════════════════════════════════════════════════ */

// Paleta oficial do Cria (a mesma do brandbook do criador e do relatório).
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  creme: "#F6F2E8", cremeCard: "#FBF9F2",
  laranja: "#EA4918", verde: "#01A652", azul: "#0061EE",
  rosa: "#FF77B9", amarelo: "#FFCF03", lilas: "#7C90F0",
};

/* A folha nasce um tico MENOR que a A4 de verdade (1123px a 794 de largura).
   O usePdfExport corta no fim do bloco mais 8px de respiro; com a altura exata
   esse respiro estourava a página e a folha seguinte começava com uma tira da
   anterior grudada no topo. */
const A4_LARGURA = 794;
const A4_ALTURA = 1108;

/* Quanto conteúdo cabe numa folha, em pixels, descontando cabeçalho, rodapé,
   respiro e o título do capítulo. É estimativa, não medição: por isso a folha
   pode crescer, e por isso os blocos internos são marcados pro corte. */
const ORCAMENTO = 920;
const ALTURA_LINHA = 20;
const CHARS_LINHA = 92;

/* ─── OS CAMPOS, NA MESMA ORDEM E COM OS MESMOS RÓTULOS DO EDITOR ─────────────
   Espelha BrandbookEditor. Se uma pergunta nova nascer lá, acrescente aqui pra
   ela sair no PDF: é o mesmo contrato que o brandbook do criador usa. */
const GRUPOS: Array<{ titulo: string; cor: string; campos: Array<[string, string]> }> = [
  {
    titulo: "Essência", cor: C.laranja,
    campos: [
      ["history", "Como e por que a empresa nasceu"],
      ["brandValues", "Valores da marca"],
      ["impact", "Impacto / transformação que quer gerar"],
      ["vision", "Onde a marca quer chegar (visão)"],
      ["admiredBrands", "Marcas que admira (referências)"],
    ],
  },
  {
    titulo: "Estratégia", cor: C.verde,
    campos: [
      ["mainGoal", "Meta principal"],
      ["bigIdea", "A Big Idea"],
      ["promise", "Promessa"],
      ["perception6m", "Como a marca quer ser percebida em 6 a 12 meses"],
      ["successMetric", "Como o cliente vai saber que o conteúdo funcionou"],
    ],
  },
  {
    titulo: "Mensagem", cor: C.azul,
    campos: [
      ["offer", "O que a marca vende (produto/serviço)"],
      ["valueProp", "Proposta de valor / diferencial"],
      ["audience", "Público-alvo"],
      ["contentThemes", "Temas / pilares de conteúdo"],
      ["avoid", "O que evitar"],
      ["products", "Principais produtos / serviços (categorias)"],
      ["specialty", "Especialidade / domínio técnico"],
      ["coreMessage", "Mensagem central do conteúdo"],
      ["criaBrandbook", "Brandbook sincronizado do Cria"],
    ],
  },
  {
    titulo: "Voz e visual", cor: C.rosa,
    campos: [
      ["archetype", "Arquétipo da marca"],
      ["toneOfVoice", "Tom de voz"],
      ["personality", "Personalidade"],
      ["communicationStyle", "Estilo de comunicação"],
      ["typography", "Tipografia"],
      ["typographyFileName", "Arquivo da fonte"],
      ["visualExpression", "Expressão visual"],
    ],
  },
];

/* A ficha de identificação da persona: campos curtos, que ficam melhor como
   cartõezinhos lado a lado do que como pergunta e resposta. */
const PERSONA_FICHA: Array<[string, string]> = [
  ["ageRange", "Faixa etária"],
  ["gender", "Gênero predominante"],
  ["region", "Cidade / região"],
  ["spend", "Faixa de gasto médio"],
  ["consciousness", "Estado de consciência"],
];

const PERSONA_CAMPOS: Array<[string, string]> = [
  ["lifestyle", "Quem é essa pessoa (estilo de vida)"],
  ["valuesWhat", "O que ela valoriza"],
  ["habits", "Interesses e hábitos"],
  ["buying", "Como costuma comprar"],
  ["pains", "Dores"],
  ["desires", "Desejos"],
  ["doubts", "Dúvidas"],
  ["objections", "Objeções"],
  ["seeks", "O que busca ao escolher uma empresa assim"],
  ["loyalty", "O que faria virar cliente fiel"],
  ["howWeServe", "Como a empresa atende essa persona"],
  ["objectives", "Objetivos"],
  ["promises", "Promessas"],
  ["triggers", "Gatilhos"],
  ["contentStrategy", "Estratégia de conteúdo"],
];

const CHAVES_BRAND = GRUPOS.flatMap((g) => g.campos.map(([k]) => k)).concat("colorPalette");
/* De propósito SEM o `name`: persona que só tem apelido e nada mais é uma linha
   em branco com título. Ela não conta como conteúdo nem ganha página. */
const CHAVES_PERSONA = [...PERSONA_FICHA, ...PERSONA_CAMPOS].map(([k]) => k);

const limpo = (v?: string) => (v ?? "").trim();

/** Tem alguma coisa pra exportar? Sem isso o botão gera um PDF de capa só. */
export function brandbookTemConteudo(form: CrmClient): boolean {
  const bc = form.brand_core ?? {};
  if (CHAVES_BRAND.some((k) => limpo(bc[k]))) return true;
  return personasDaFicha(form).some((p) => CHAVES_PERSONA.some((k) => limpo(p[k])));
}

/* Quantas linhas VISUAIS um texto ocupa. Conta as quebras que a pessoa digitou
   (as listas de dor vêm uma por linha) e estima o resto pela largura da coluna. */
const linhasDe = (t: string) =>
  t.split("\n").reduce((soma, l) => soma + Math.max(1, Math.ceil(l.trim().length / CHARS_LINHA)), 0);

/* Um parágrafo gigante SEM quebra nenhuma (texto colado de outro lugar) não tem
   onde ser dividido, e sozinho estouraria a folha. Aqui ele é fatiado por
   palavra, que é o único corte que não parte uma no meio. */
function fatiarLinha(linha: string, maxChars: number): string[] {
  if (linha.length <= maxChars) return [linha];
  const partes: string[] = [];
  let atual = "";
  for (const palavra of linha.split(" ")) {
    if (atual && (atual + " " + palavra).length > maxChars) { partes.push(atual); atual = palavra; continue; }
    atual = atual ? `${atual} ${palavra}` : palavra;
  }
  if (atual) partes.push(atual);
  return partes;
}

/* Resposta comprida vira várias partes, uma por folha, em vez de sumir cortada
   no rodapé. A continuação leva o rótulo de volta pra quem virou a página saber
   do que ainda estamos falando. */
function quebrarValor(valor: string, maxLinhas: number): string[] {
  const linhas = valor.split("\n").flatMap((l) => fatiarLinha(l, maxLinhas * CHARS_LINHA));
  const partes: string[] = [];
  let atual: string[] = [];
  let soma = 0;
  for (const l of linhas) {
    const custo = Math.max(1, Math.ceil(l.trim().length / CHARS_LINHA));
    if (atual.length && soma + custo > maxLinhas) { partes.push(atual.join("\n")); atual = []; soma = 0; }
    atual.push(l);
    soma += custo;
  }
  if (atual.length) partes.push(atual.join("\n"));
  return partes;
}

type Peca = { chave: string; custo: number; node: ReactNode };
type Folha = { titulo: string; cor: string; pecas: Peca[] };

/** Agrupa as peças em folhas respeitando o orçamento de altura de cada uma. */
function empacotar(pecas: Peca[], orcamento: number): Peca[][] {
  const folhas: Peca[][] = [];
  let atual: Peca[] = [];
  let soma = 0;
  for (const p of pecas) {
    if (atual.length && soma + p.custo > orcamento) { folhas.push(atual); atual = []; soma = 0; }
    atual.push(p);
    soma += p.custo;
  }
  if (atual.length) folhas.push(atual);
  return folhas;
}

// Bloco de pergunta e resposta. O pre-line é o que preserva os parágrafos e as
// listas do jeito que a pessoa escreveu.
function blocoQA(chave: string, rotulo: string, valor: string, cor: string): ReactNode {
  return (
    <div key={chave} data-pdf-block style={{ marginBottom: 15 }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: cor, margin: "0 0 4px" }}>{rotulo}</p>
      <p style={{ fontSize: 12.5, color: C.ink, margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{valor}</p>
    </div>
  );
}

/** Campos preenchidos viram peças, já quebrando as respostas longas demais. */
function pecasDosCampos(fonte: Record<string, string>, campos: Array<[string, string]>, cor: string, prefixo: string): Peca[] {
  const out: Peca[] = [];
  const maxLinhas = Math.floor((ORCAMENTO - 60) / ALTURA_LINHA);
  for (const [chave, rotulo] of campos) {
    const valor = limpo(fonte[chave]);
    if (!valor) continue;
    const partes = linhasDe(valor) > maxLinhas ? quebrarValor(valor, maxLinhas) : [valor];
    partes.forEach((parte, i) => {
      const label = i === 0 ? rotulo : `${rotulo} (continuação)`;
      out.push({
        chave: `${prefixo}-${chave}-${i}`,
        custo: 35 + linhasDe(parte) * ALTURA_LINHA,
        node: blocoQA(`${prefixo}-${chave}-${i}`, label, parte, cor),
      });
    });
  }
  return out;
}

interface Props {
  nome: string;
  instagram?: string | null;
  logo?: string | null;
  brandCore: Record<string, string>;
  personas: Record<string, string>[];
}

export const BrandbookClientePdfTemplate = forwardRef<HTMLDivElement, Props>(
  ({ nome, instagram, logo, brandCore, personas }, ref) => {
    const hoje = parseDateOnly(hojeBR());
    const dataLonga = hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const dataCurta = hoje.toLocaleDateString("pt-BR");
    const arroba = limpo(instagram).replace(/^@/, "");
    // O campo logo guarda ou uma URL de imagem ou uma inicial digitada à mão.
    const logoUrl = /^https?:\/\//.test(limpo(logo)) ? limpo(logo) : null;
    const inicial = (nome.trim().charAt(0) || "?").toUpperCase();
    const swatches = parseHex(brandCore.colorPalette);

    // ── Peças de layout ──
    /* A inicial é centralizada por line-height, não por flex. Centralizar texto
       com flex é exatamente o que o html2canvas erra ao fotografar o DOM: na
       tela fica no meio, no PDF a letra desce e encosta na borda de baixo do
       círculo. line-height igual à altura resolve porque não depende do cálculo
       de alinhamento, só da caixa da linha.

       O fundo também mudou: cinza claro com letra laranja dava um contraste
       fraco que, reduzido a 30px no cabeçalho, virava uma bolinha suja. Agora é
       laranja cheio com a letra branca, que lê bem em qualquer tamanho. */
    const marcaRedonda = (tamanho: number, fonte: number) => (
      <div style={{
        width: tamanho, height: tamanho, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
        background: logoUrl ? C.soft : C.laranja,
      }}>
        {logoUrl
          ? <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : (
            <span style={{
              display: "block", width: "100%", height: tamanho, lineHeight: `${tamanho}px`,
              textAlign: "center", fontWeight: 800, fontSize: fonte, color: "#fff",
            }}>{inicial}</span>
          )}
      </div>
    );

    const cabecalho = (capitulo: string) => (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "20px 44px 12px",
        borderBottom: `2px solid ${C.laranja}`, background: C.creme, flexShrink: 0,
      }}>
        {marcaRedonda(30, 13)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>{nome}</div>
          <div style={{ fontSize: 9.5, color: C.sub }}>Brandbook · {capitulo}</div>
        </div>
        {arroba && <span style={{ fontSize: 9.5, color: C.sub, flexShrink: 0 }}>@{arroba}</span>}
      </div>
    );

    const rodape = (numero: number, total: number) => (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 44px 16px",
        borderTop: `1px solid ${C.line}`, background: C.cremeCard, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9.5, color: C.sub }}>{dataCurta}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, color: C.sub }}>
          Feito com <img src="/logo-cria.png" alt="Cria Social Club" style={{ height: 12, width: "auto", display: "block", opacity: 0.9 }} />
        </span>
        <span style={{ fontSize: 9.5, color: C.sub }}>Página {numero} de {total}</span>
      </div>
    );

    const tituloCapitulo = (texto: string, cor: string) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
        <span style={{ width: 26, height: 6, borderRadius: 99, background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: C.ink }}>{texto}</span>
      </div>
    );

    // ── Montagem das folhas de conteúdo ──
    const folhas: Folha[] = [];

    for (const grupo of GRUPOS) {
      const pecas = pecasDosCampos(brandCore, grupo.campos, grupo.cor, grupo.titulo);
      /* A paleta é o único bloco do brandbook que não é texto: ela precisa sair
         desenhada, com a amostra da cor e o HEX embaixo, igual o editor mostra.
         Quem recebe o PDF vai usar esses códigos na arte. */
      if (grupo.titulo === "Voz e visual" && swatches.length > 0) {
        pecas.push({
          chave: "paleta",
          custo: 120,
          node: (
            <div key="paleta" data-pdf-block style={{ marginBottom: 15 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: grupo.cor, margin: "0 0 8px" }}>Paleta de cores</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {swatches.map((hex, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ width: 62, height: 62, borderRadius: 14, background: hex, border: `1px solid ${C.line}` }} />
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.sub, margin: "6px 0 0", textTransform: "uppercase" }}>{hex}</p>
                  </div>
                ))}
              </div>
            </div>
          ),
        });
      }
      if (pecas.length === 0) continue;
      for (const grupoDePecas of empacotar(pecas, ORCAMENTO)) {
        folhas.push({ titulo: grupo.titulo, cor: grupo.cor, pecas: grupoDePecas });
      }
    }

    /* PERSONA: cada uma começa numa folha nova. Elas são leituras diferentes do
       mesmo público, e misturadas na mesma página viram uma coisa só. */
    const personasCheias = personas.filter((p) => CHAVES_PERSONA.some((k) => limpo(p[k])));
    personasCheias.forEach((persona, pi) => {
      const nomePersona = limpo(persona.name) || `Persona ${pi + 1}`;
      const titulo = personasCheias.length > 1 ? `Persona ${pi + 1} de ${personasCheias.length}` : "Persona";
      const ficha = PERSONA_FICHA.filter(([k]) => limpo(persona[k]));
      const pecas: Peca[] = [];
      pecas.push({
        chave: `persona-${pi}-nome`,
        custo: ficha.length > 0 ? 100 : 34,
        node: (
          <div key={`persona-${pi}-nome`} data-pdf-block style={{ marginBottom: 15 }}>
            <p style={{ fontWeight: 800, fontSize: 16, color: C.ink, margin: "0 0 10px" }}>{nomePersona}</p>
            {ficha.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ficha.map(([k, rotulo]) => (
                  <div key={k} style={{ background: C.cremeCard, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}` }}>
                    <p style={{ fontSize: 9.5, color: C.sub, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{rotulo}</p>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0 }}>{limpo(persona[k])}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      });
      pecas.push(...pecasDosCampos(persona, PERSONA_CAMPOS, C.lilas, `persona-${pi}`));
      for (const grupoDePecas of empacotar(pecas, ORCAMENTO)) {
        folhas.push({ titulo, cor: C.lilas, pecas: grupoDePecas });
      }
    });

    // Capa e contracapa também são folhas, e por isso entram na contagem.
    const total = folhas.length + 2;

    return (
      <div ref={ref} style={{ width: A4_LARGURA, fontFamily: "Inter, system-ui, sans-serif", background: "#fff", color: C.ink }}>

        {/* ── CAPA: uma folha inteira só dela ── */}
        <div data-pdf-block style={{
          width: A4_LARGURA, height: A4_ALTURA, position: "relative", overflow: "hidden",
          background: C.creme, boxSizing: "border-box", padding: "96px 56px 40px",
          display: "flex", flexDirection: "column",
        }}>
          {/* As bolhas da linguagem visual do Cria: é o que separa um documento
              da marca de um relatório de sistema. */}
          <span style={{ position: "absolute", right: -80, top: -80, width: 260, height: 260, borderRadius: 999, background: C.amarelo, opacity: 0.5 }} />
          <span style={{ position: "absolute", right: 140, top: 130, width: 78, height: 78, borderRadius: 999, background: C.rosa, opacity: 0.55 }} />
          <span style={{ position: "absolute", left: -70, bottom: 140, width: 210, height: 210, borderRadius: 999, background: C.lilas, opacity: 0.32 }} />

          <div style={{ position: "relative", flex: 1 }}>
            {marcaRedonda(96, 40)}
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: C.laranja, fontWeight: 800, margin: "28px 0 10px" }}>
              Brandbook
            </p>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: C.ink, margin: 0, lineHeight: 1.08 }}>{nome}</h1>
            {arroba && <p style={{ fontSize: 15, color: C.sub, margin: "10px 0 0" }}>@{arroba}</p>}
            <div style={{ width: 64, height: 6, borderRadius: 99, background: C.laranja, margin: "26px 0 0" }} />
            <p style={{ fontSize: 13, color: C.sub, margin: "26px 0 0", lineHeight: 1.6, maxWidth: 460 }}>
              A direção da marca que guia todo o conteúdo: o que ela é, o que promete, como fala e pra quem.
            </p>
            <p style={{ fontSize: 12, color: C.sub, margin: "10px 0 0" }}>Gerado em {dataLonga}</p>
          </div>

          <div style={{ position: "relative" }}>
            <AssinaturaCria variante="rodape" tom="claro" altura={24} style={{ width: "auto", alignItems: "flex-start" }} />
          </div>
        </div>

        {/* ── FOLHAS DE CONTEÚDO ──
            Toda folha de conteúdo leva data-pdf-break (a capa não, ela é a
            primeira): o corte de página cai no topo de cada uma, e é isso que
            faz o cabeçalho e o rodapé desenhados aqui nascerem mesmo no alto e
            no pé da página do PDF, em vez de flutuarem no meio do texto. */}
        {folhas.map((folha, i) => (
          /* O fundo da folha é a cor do RODAPÉ, não branco. A página do PDF é
             um pouco mais alta que a folha (a altura daqui é menor de
             propósito, senão o corte estoura e a folha seguinte nasce com uma
             tira da anterior no topo). Essa diferença aparecia como uma
             listrinha branca logo abaixo do rodapé creme, e num documento que
             vai pro cliente isso lê como defeito de impressão. Pintando a folha
             da cor do rodapé, a sobra continua o rodapé. */
          <div key={`${folha.titulo}-${i}`} data-pdf-block data-pdf-break="" style={{
            width: A4_LARGURA, minHeight: A4_ALTURA, background: C.cremeCard, boxSizing: "border-box",
            display: "flex", flexDirection: "column",
          }}>
            {cabecalho(folha.titulo)}
            <div style={{ flex: 1, padding: "20px 44px 10px", background: "#fff" }}>
              {tituloCapitulo(folha.titulo, folha.cor)}
              {folha.pecas.map((p) => p.node)}
            </div>
            {rodape(i + 2, total)}
          </div>
        ))}

        {/* ── CONTRACAPA ──
            Documento que termina no meio da última resposta parece que acabou a
            tinta. A contracapa fecha: retoma pra que aquilo serve, diz que é um
            documento vivo (brandbook que ninguém revisita envelhece e volta a
            gerar conteúdo genérico) e assina. É a página que fica aberta na
            tela do cliente depois que ele terminou de ler. */}
        <div data-pdf-block data-pdf-break="" style={{
          width: A4_LARGURA, height: A4_ALTURA, position: "relative", overflow: "hidden",
          background: C.creme, boxSizing: "border-box", padding: "96px 56px 40px",
          display: "flex", flexDirection: "column",
        }}>
          <span style={{ position: "absolute", left: -90, top: -70, width: 240, height: 240, borderRadius: 999, background: C.lilas, opacity: 0.28 }} />
          <span style={{ position: "absolute", right: -60, bottom: -60, width: 240, height: 240, borderRadius: 999, background: C.amarelo, opacity: 0.45 }} />
          <span style={{ position: "absolute", right: 130, bottom: 190, width: 70, height: 70, borderRadius: 999, background: C.rosa, opacity: 0.5 }} />

          <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520 }}>
            <div style={{ width: 64, height: 6, borderRadius: 99, background: C.laranja, margin: "0 0 26px" }} />
            <h2 style={{ fontSize: 30, fontWeight: 800, color: C.ink, margin: 0, lineHeight: 1.15 }}>
              Isto aqui é um documento vivo
            </h2>
            <p style={{ fontSize: 13.5, color: C.sub, margin: "18px 0 0", lineHeight: 1.7 }}>
              Marca não fica parada, e brandbook que ninguém revisita envelhece calado: seis meses depois o conteúdo
              volta a sair genérico sem ninguém entender por quê. Sempre que a oferta mudar, o público mudar ou uma
              resposta aqui deixar de ser verdade, é hora de atualizar.
            </p>
            <p style={{ fontSize: 13.5, color: C.sub, margin: "14px 0 0", lineHeight: 1.7 }}>
              Enquanto ele estiver de pé, é daqui que sai o tom de cada legenda, o ângulo de cada ideia e a direção
              de cada arte.
            </p>

            <div style={{ marginTop: 34, padding: "16px 18px", borderRadius: 14, background: "#fff", border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: C.laranja, margin: 0 }}>
                Brandbook de
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: "5px 0 0" }}>{nome}</p>
              {arroba && <p style={{ fontSize: 12.5, color: C.sub, margin: "3px 0 0" }}>@{arroba}</p>}
              <p style={{ fontSize: 11.5, color: C.sub, margin: "9px 0 0" }}>Gerado em {dataLonga}</p>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <AssinaturaCria variante="rodape" tom="claro" altura={24} style={{ width: "auto", alignItems: "flex-start" }} />
          </div>
        </div>
      </div>
    );
  },
);
BrandbookClientePdfTemplate.displayName = "BrandbookClientePdfTemplate";

// Nome do arquivo: sem acento e sem espaço, senão o download vira "%C3%A7" na
// pasta de quem baixou. A faixa é a das marcas de acento que o NFD separa.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");
const slugDe = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(ACENTOS, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Botão "Baixar PDF" do brandbook do cliente. Mora aqui, junto do template, pra
 * as duas telas que o usam (cockpit do cliente e ficha do CRM) terem o MESMO
 * documento: um botão em cada lugar, um layout só.
 */
export function BotaoBrandbookPdf({ form, nome, className }: { form: CrmClient; nome?: string; className?: string }) {
  const alvo = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);
  const { exportPdf } = usePdfExport();
  const nomeCliente = (nome || form.name || "Cliente").trim();

  /* O template só é montado enquanto o PDF está sendo gerado. Ele são dez
     folhas de DOM: montado o tempo todo, ele seria re-renderizado a cada tecla
     digitada no editor (que salva sozinho e muda o form a cada letra).
     Gerar no efeito, e não no clique, garante que o React já commitou essas
     folhas antes do html2canvas ir fotografá-las. */
  useEffect(() => {
    if (!gerando) return;
    let vivo = true;
    (async () => {
      try {
        await exportPdf(alvo, `brandbook-${slugDe(nomeCliente) || "cliente"}`, { larguraFixa: LARGURA_A4 });
        if (vivo) toast.success("Brandbook em PDF baixado.");
      } catch {
        if (vivo) toast.error("Não consegui gerar o PDF. Tente de novo.");
      } finally {
        if (vivo) setGerando(false);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gerando]);

  const baixar = () => {
    // Brandbook vazio virava um PDF de capa e nada mais, e a pessoa só
    // descobria depois de abrir o arquivo.
    if (!brandbookTemConteudo(form)) {
      toast.error("O brandbook deste cliente ainda está vazio. Preencha alguma coisa antes de exportar.");
      return;
    }
    setGerando(true);
  };

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={baixar} disabled={gerando}>
        {gerando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
        {gerando ? "Gerando…" : "Baixar PDF"}
      </Button>
      {gerando && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }} aria-hidden="true">
          <BrandbookClientePdfTemplate
            ref={alvo}
            nome={nomeCliente}
            instagram={form.instagram}
            logo={form.logo}
            brandCore={form.brand_core ?? {}}
            personas={personasDaFicha(form)}
          />
        </div>
      )}
    </>
  );
}
