import {
  Briefcase, Camera, GraduationCap, Newspaper, Store, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import type { DadosBloco, EstiloBio, TipoBloco } from "@/lib/bioBlocks";

/* ═══════════════════════════════════════════════════════════════════════════
   MODELOS PRONTOS

   Página em branco é onde a montagem morre. A pessoa abre o editor, vê
   "adicionar bloco" e não sabe se começa pelo WhatsApp, pelo cardápio ou pela
   foto. Escolher um modelo resolve isso: a página já nasce montada na ordem
   que costuma funcionar pra aquele tipo de negócio, com o texto de exemplo
   escrito. Aí o trabalho vira TROCAR, que é muito mais fácil que CRIAR.

   Dois cuidados:
   · o modelo nunca apaga o que já existe, ele acrescenta no fim;
   · tudo nasce DESLIGADO. Ninguém quer "Escreva aqui sobre você" no ar
     enquanto ainda está preenchendo.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BlocoDoModelo = { kind: TipoBloco; data: DadosBloco };

export type ModeloBio = {
  id: string;
  nome: string;
  /** Pra quem serve. É por aqui que a pessoa escolhe, não pelo nome. */
  paraQuem: string;
  Icone: LucideIcon;
  estilo: EstiloBio;
  blocos: BlocoDoModelo[];
};

const CONSENT = "Ao enviar, você autoriza o uso dos seus dados para contato e para fins de marketing.";

export const MODELOS: ModeloBio[] = [
  /* ── CLÁSSICO ── */
  {
    id: "servico-local",
    nome: "Negócio com endereço",
    paraQuem: "Restaurante, clínica, salão, loja de bairro. Quem precisa ser encontrado e receber gente.",
    Icone: Store,
    estilo: "classico",
    blocos: [
      { kind: "whatsapp", data: { titulo: "Chamar no WhatsApp", telefone: "", mensagem: "Oi! Vim pelo link da bio." } },
      { kind: "link", data: { titulo: "Ver o cardápio", url: "", icone: "", capa: "" } },
      { kind: "mapa", data: { titulo: "Onde estamos", endereco: "", horario: "Seg a sex, 9h às 18h\nSáb, 9h às 13h", mostrarMapa: true } },
      { kind: "faq", data: {
        titulo: "Perguntas frequentes",
        itens: [
          { p: "Precisa marcar antes?", r: "" },
          { p: "Quais formas de pagamento?", r: "" },
          { p: "Tem estacionamento?", r: "" },
        ],
      } },
      { kind: "captura", data: {
        titulo: "Quer receber as novidades?", subtitulo: "Deixe seu contato.",
        campos: "telefone", botao: "Quero receber", consentimento: CONSENT, paraPipeline: false,
      } },
    ],
  },
  {
    id: "profissional",
    nome: "Profissional que atende",
    paraQuem: "Nutricionista, advogado, personal, consultor. Quem vende hora e precisa encher a agenda.",
    Icone: Briefcase,
    estilo: "classico",
    blocos: [
      { kind: "texto", data: { titulo: "", texto: "Escreva em uma frase o que você resolve e pra quem.\n\nEx.: ajudo mulheres acima dos 40 a recuperar energia sem dieta restritiva." } },
      { kind: "whatsapp", data: { titulo: "Agendar uma conversa", telefone: "", mensagem: "Oi! Quero agendar uma conversa." } },
      { kind: "link", data: { titulo: "Ver os planos de acompanhamento", url: "" } },
      { kind: "faq", data: {
        titulo: "Antes de fechar, as dúvidas de sempre",
        itens: [
          { p: "Como funciona o atendimento?", r: "" },
          { p: "Atende online?", r: "" },
          { p: "Quanto tempo até ver resultado?", r: "" },
        ],
      } },
      { kind: "captura", data: {
        titulo: "Deixe seu contato e eu te chamo", subtitulo: "Respondo no mesmo dia.",
        campos: "ambos", botao: "Enviar", consentimento: CONSENT, paraPipeline: true,
      } },
    ],
  },
  {
    id: "criador",
    nome: "Criador de conteúdo",
    paraQuem: "Quem vive de audiência: divulga conteúdo novo, produto próprio e parcerias.",
    Icone: Camera,
    estilo: "classico",
    blocos: [
      { kind: "titulo", data: { titulo: "Novidade da semana" } },
      { kind: "link", data: { titulo: "Escreva aqui o que está em destaque", url: "", capa: "" } },
      { kind: "video", data: { titulo: "Meu último vídeo", url: "" } },
      { kind: "titulo", data: { titulo: "Sempre por aqui" } },
      { kind: "link", data: { titulo: "Meus produtos", url: "" } },
      { kind: "link", data: { titulo: "Fechar parceria", url: "" } },
      { kind: "captura", data: {
        titulo: "Entre pra lista", subtitulo: "Aviso antes de todo mundo.",
        campos: "email", botao: "Quero entrar", consentimento: CONSENT, paraPipeline: false,
      } },
    ],
  },
  {
    id: "lancamento",
    nome: "Lançamento com prazo",
    paraQuem: "Turma, promoção, evento. Quem tem data pra acabar e precisa criar pressa.",
    Icone: GraduationCap,
    estilo: "classico",
    blocos: [
      { kind: "contagem", data: { titulo: "As inscrições fecham em", ate: "" } },
      { kind: "link", data: { titulo: "Garantir minha vaga", url: "", capa: "" } },
      { kind: "texto", data: { titulo: "O que você leva", texto: "- Primeiro benefício\n- Segundo benefício\n- Terceiro benefício" } },
      { kind: "faq", data: {
        titulo: "Dúvidas antes de entrar",
        itens: [
          { p: "Pra quem é?", r: "" },
          { p: "E se eu não puder acompanhar ao vivo?", r: "" },
          { p: "Tem garantia?", r: "" },
        ],
      } },
      { kind: "whatsapp", data: { titulo: "Ainda com dúvida? Chama aqui", telefone: "", mensagem: "Oi! Tenho uma dúvida sobre a turma." } },
    ],
  },

  /* ── SITE ── */
  {
    id: "site-consultoria",
    nome: "Consultoria e serviços",
    paraQuem: "Quem vende serviço com preço e precisa explicar cada um com calma.",
    Icone: Briefcase,
    estilo: "site",
    blocos: [
      { kind: "capa", data: {
        titulo: "A promessa da marca em uma linha",
        frase: "Pra quem é, o que resolve e onde atende.",
        imagem: "", botao1: "Quero uma conversa", url1: "", botao2: "Ver serviços", url2: "#servicos",
      } },
      { kind: "sobre", data: {
        rotulo: "Quem sou", titulo: "A frase que estabelece autoridade",
        texto: "Conte a história em dois ou três parágrafos.\n\nComece pelo começo: como entrou nessa, o que aprendeu no caminho, e o que você enxerga que os outros não enxergam.\n\nTermine dizendo onde atende.",
        imagem: "", fundo: "claro",
      } },
      { kind: "produtos", data: { rotulo: "O que eu faço", titulo: "Serviços", subtitulo: "", fundo: "creme" } },
      { kind: "depoimentos", data: {
        rotulo: "Quem já passou por aqui", titulo: "Depoimentos", fundo: "claro",
        itens: [{ texto: "", autor: "" }, { texto: "", autor: "" }],
      } },
      { kind: "captura", data: {
        titulo: "Me conta do seu negócio", subtitulo: "Respondo pessoalmente.",
        campos: "ambos", botao: "Enviar", consentimento: CONSENT, paraPipeline: true, fundo: "claro",
      } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
    ],
  },
  {
    id: "site-loja",
    nome: "Loja e negócio local",
    paraQuem: "Quem tem ponto físico e produtos: precisa mostrar o que vende e onde fica.",
    Icone: UtensilsCrossed,
    estilo: "site",
    blocos: [
      { kind: "capa", data: {
        titulo: "O que o negócio faz, sem enrolar",
        frase: "A frase que faz a pessoa querer conhecer.",
        imagem: "", botao1: "Chamar no WhatsApp", url1: "", botao2: "Ver produtos", url2: "#servicos",
      } },
      { kind: "produtos", data: { rotulo: "O que temos", titulo: "Produtos", subtitulo: "", fundo: "creme" } },
      { kind: "sobre", data: {
        rotulo: "Nossa história", titulo: "Como tudo começou",
        texto: "A origem do negócio, o que move ele hoje e o que ele faz diferente.", imagem: "", fundo: "claro",
      } },
      { kind: "mapa", data: { titulo: "Onde estamos", endereco: "", horario: "Seg a sáb, 10h às 19h", mostrarMapa: true, fundo: "creme" } },
      { kind: "depoimentos", data: { rotulo: "O que falam", titulo: "Depoimentos", fundo: "claro", itens: [{ texto: "", autor: "" }] } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
    ],
  },
  {
    id: "site-autoridade",
    nome: "Autoridade e conteúdo",
    paraQuem: "Quem quer ser achado no Google pelo assunto, e não só pelo nome.",
    Icone: Newspaper,
    estilo: "site",
    blocos: [
      { kind: "capa", data: {
        titulo: "A tese que você defende",
        frase: "Uma frase que já divide opinião e faz querer ler mais.",
        imagem: "", botao1: "Ler os textos", url1: "#blog", botao2: "Falar comigo", url2: "",
      } },
      { kind: "blog", data: { rotulo: "Escrevo por aqui", titulo: "Blog", quantos: 6, fundo: "claro" } },
      { kind: "sobre", data: {
        rotulo: "Quem escreve", titulo: "Sobre mim",
        texto: "Quem é você, por que fala disso, e o que te dá autoridade no assunto.", imagem: "", fundo: "creme",
      } },
      { kind: "produtos", data: { rotulo: "Trabalhe comigo", titulo: "Serviços", subtitulo: "", fundo: "claro" } },
      { kind: "captura", data: {
        titulo: "Receba os textos novos", subtitulo: "Sem spam, só quando sai coisa boa.",
        campos: "email", botao: "Quero receber", consentimento: CONSENT, paraPipeline: false, fundo: "escuro",
      } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
    ],
  },
];

export const modelosDoEstilo = (e: EstiloBio) => MODELOS.filter((m) => m.estilo === e);
