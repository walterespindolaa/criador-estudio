import {
  Clapperboard,
  Briefcase, Camera, GraduationCap, Newspaper, Store, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import type { DadosBloco, EstiloBio, TipoBloco } from "@/lib/bioBlocks";
import { blocosDoNicho, nichoPorId, type Nicho } from "@/lib/bioEspecialista";

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

/* ── A APARÊNCIA DO MODELO ──
   Modelo que só monta a estrutura não é layout: a pessoa aplica, vê a mesma
   página branca de sempre e pensa que não funcionou. Cada modelo carrega
   também cor, fonte, formato de botão e fundo. */
export type AparenciaModelo = {
  bgType: "color" | "gradient";
  bgColor: string;
  bgGradient: string | null;
  buttonColor: string;
  buttonTextColor: string;
  buttonStyle: "rounded" | "pill" | "square" | "outline";
  cardColor: string;
  cardTextColor: string;
  fontFamily: string;
};

export type ModeloBio = {
  id: string;
  nome: string;
  /** Pra quem serve. É por aqui que a pessoa escolhe, não pelo nome. */
  paraQuem: string;
  Icone: LucideIcon;
  estilo: EstiloBio;
  aparencia: AparenciaModelo;
  blocos: BlocoDoModelo[];
  /** Foto da capa só na prévia do modelo. Nunca vai pra página de ninguém. */
  fotoExemplo?: string;
};

export const FOTO_EXEMPLO_LOJA = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=70";

const CONSENT = "Ao enviar, você autoriza o uso dos seus dados para contato e para fins de marketing.";

export const MODELOS: ModeloBio[] = [
  /* ── CLÁSSICO ── */
  {
    id: "servico-local",
    nome: "Negócio com endereço",
    paraQuem: "Restaurante, clínica, salão, loja de bairro. Quem precisa ser encontrado e receber gente.",
    Icone: Store,
    estilo: "classico",
    aparencia: {
      bgType: "color", bgColor: "#FFF7ED", bgGradient: null,
      buttonColor: "#C2410C", buttonTextColor: "#FFFFFF", buttonStyle: "rounded",
      cardColor: "#FFFFFF", cardTextColor: "#1C1917", fontFamily: "Outfit",
    },
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
    aparencia: {
      bgType: "color", bgColor: "#F5F7FA", bgGradient: null,
      buttonColor: "#0F3D5C", buttonTextColor: "#FFFFFF", buttonStyle: "rounded",
      cardColor: "#FFFFFF", cardTextColor: "#0F172A", fontFamily: "Sora",
    },
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
    aparencia: {
      bgType: "gradient", bgColor: "#1A1030", bgGradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
      buttonColor: "#FFFFFF", buttonTextColor: "#1A1030", buttonStyle: "pill",
      cardColor: "#FFFFFF", cardTextColor: "#1A1030", fontFamily: "Bricolage Grotesque",
    },
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
    aparencia: {
      bgType: "color", bgColor: "#0F0F17", bgGradient: null,
      buttonColor: "#FACC15", buttonTextColor: "#0F0F17", buttonStyle: "square",
      cardColor: "#1B1B26", cardTextColor: "#F5F3E7", fontFamily: "Space Grotesk",
    },
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
    aparencia: {
      bgType: "color", bgColor: "#FFFFFF", bgGradient: null,
      buttonColor: "#14532D", buttonTextColor: "#FFFFFF", buttonStyle: "pill",
      cardColor: "#FFFFFF", cardTextColor: "#0F172A", fontFamily: "DM Serif Display",
    },
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
    paraQuem: "Padaria, doceria, restaurante, loja de bairro: mostra o que vende, recebe pedido no WhatsApp e diz se está aberto agora.",
    Icone: UtensilsCrossed,
    estilo: "site",
    fotoExemplo: FOTO_EXEMPLO_LOJA,
    aparencia: {
      bgType: "color", bgColor: "#FBF6EE", bgGradient: null,
      buttonColor: "#B45309", buttonTextColor: "#FFFFFF", buttonStyle: "rounded",
      cardColor: "#FFFFFF", cardTextColor: "#1C1917", fontFamily: "Nunito",
    },
    /* Loja (22/10/2026): capa de foto cheia com o "Aberto agora", três
       vantagens, o cardápio com sacola, o destaque da semana, horários,
       avaliações, onde fica e contato. O pedido vai pro WhatsApp do bloco
       Contato; sem número, o cardápio fica de vitrine. */
    blocos: [
      { kind: "capa", data: {
        layout: "foto_cheia",
        titulo: "O nome da loja e o que ela faz de melhor",
        frase: "Uma frase que dá vontade de passar aí hoje.",
        imagem: "", botao1: "Ver o cardápio", url1: "#cardapio", botao2: "Como chegar", url2: "#atendimento",
      } },
      { kind: "vantagens", data: { itens: [
        { titulo: "Entrega no bairro", sub: "Até 3 km" },
        { titulo: "Encomendas", sub: "Com 2 dias" },
        { titulo: "Pix e cartão", sub: "Na entrega ou retirada" },
      ] } },
      { kind: "cardapio", data: {
        titulo: "Cardápio", pedidos: true, telefone: "",
        categorias: ["Mais pedidos", "Doces", "Bebidas"],
        itens: [
          { id: "exemplo-1", nome: "Seu produto mais vendido", desc: "Uma linha que dá água na boca", detalhe: "", preco: 24, cat: "Mais pedidos", foto: "", ativo: true },
          { id: "exemplo-2", nome: "Segundo produto", desc: "Tamanho, sabor ou rendimento", detalhe: "", preco: 12.5, cat: "Mais pedidos", foto: "", ativo: true },
          { id: "exemplo-3", nome: "Um doce da casa", desc: "O que ele tem de especial", detalhe: "", preco: 9, cat: "Doces", foto: "", ativo: true },
          { id: "exemplo-4", nome: "Uma bebida", desc: "", detalhe: "", preco: 7, cat: "Bebidas", foto: "", ativo: true },
        ],
      } },
      { kind: "destaque", data: {
        etiqueta: "Só essa semana", titulo: "A novidade ou promoção da semana",
        texto: "Quantas unidades, até quando, como reservar.", imagem: "",
        botao: "Reservar o meu", destino: "whatsapp", telefone: "", mensagem: "", url: "",
      } },
      { kind: "horarios", data: { titulo: "Horários", observacao: "", dias: [
        { aberto: false, abre: "08:00", fecha: "18:00" },
        { aberto: true, abre: "07:00", fecha: "19:00" }, { aberto: true, abre: "07:00", fecha: "19:00" },
        { aberto: true, abre: "07:00", fecha: "19:00" }, { aberto: true, abre: "07:00", fecha: "19:00" },
        { aberto: true, abre: "07:00", fecha: "19:00" }, { aberto: true, abre: "07:30", fecha: "13:00" },
      ] } },
      { kind: "depoimentos", data: { rotulo: "Quem já provou", titulo: "Avaliações", fundo: "claro", itens: [
        { texto: "Cole aqui uma avaliação de verdade, do Google ou do Instagram.", autor: "Nome do cliente" },
        { texto: "Uma segunda avaliação, de preferência falando de um produto.", autor: "Nome do cliente" },
      ] } },
      { kind: "atendimento", data: {
        titulo: "Onde fica", formas: { presencial: true, entrega: true },
        locais: [{ nome: "", endereco: "", cidade: "", horario: "" }], regiao: "", entrega_texto: "", retirada: "",
      } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
    ],
  },
  {
    id: "site-autoridade",
    nome: "Autoridade e conteúdo",
    paraQuem: "Quem quer ser achado no Google pelo assunto, e não só pelo nome.",
    Icone: Newspaper,
    estilo: "site",
    aparencia: {
      bgType: "color", bgColor: "#FFFFFF", bgGradient: null,
      buttonColor: "#1E293B", buttonTextColor: "#FFFFFF", buttonStyle: "square",
      cardColor: "#FFFFFF", cardTextColor: "#0F172A", fontFamily: "Sora",
    },
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
  {
    /* Página de especialista (21/10/2026): a pessoa em vídeo ou foto de tela
       cheia, o nome em assinatura, os números logo abaixo e o botão de agendar
       preso no pé. Serve pra quem É a marca, de qualquer nicho: os números e o
       botão se ajustam pelo "Começar pelo nicho" dentro de cada bloco. */
    id: "site-especialista",
    nome: "Especialista com vídeo e assinatura",
    paraQuem: "Quem é a própria marca: saúde, estética, advocacia, personal, beleza, corretor, mentor.",
    Icone: Clapperboard,
    estilo: "site",
    aparencia: {
      bgType: "color", bgColor: "#111312", bgGradient: null,
      // Cor do botão fixo e dos botões da página: forte o bastante pra ler em
      // cima da capa escura E das seções claras. Creme sumia nas claras.
      buttonColor: "#B4532A", buttonTextColor: "#FFFFFF", buttonStyle: "rounded",
      cardColor: "#FFFFFF", cardTextColor: "#111312", fontFamily: "Sora",
    },
    // O nicho é escolhido na hora de aplicar (EditorBlocos); saúde é só o padrão.
    blocos: blocosDoNicho(nichoPorId("saude")!) as BlocoDoModelo[],
  },
];

/** Aparência do modelo de especialista no nicho escolhido: a cor do botão é a
 *  do ramo (verde na saúde, vinho na beleza) e o fundo acompanha o tema. */
export function aparenciaDoNicho(n: Nicho): AparenciaModelo {
  return {
    bgType: "color", bgColor: n.tema === "claro" ? "#F7F3EE" : "#111312", bgGradient: null,
    buttonColor: n.cor, buttonTextColor: n.corTexto, buttonStyle: "rounded",
    cardColor: "#FFFFFF", cardTextColor: "#111312", fontFamily: "Sora",
  };
}

export const modelosDoEstilo = (e: EstiloBio) => MODELOS.filter((m) => m.estilo === e);
