import {
  Clapperboard,
  Briefcase, Camera, GraduationCap, Store, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import type { DadosBloco, EstiloBio, TipoBloco } from "@/lib/bioBlocks";
import { blocosDoNicho, nichoPorId, type Nicho } from "@/lib/bioEspecialista";
import type { SocialPublico } from "@/lib/bioCriadora";

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
  /** Exemplo preenchido SÓ pra prévia (números, preços, Instagram de mentira).
   *  Aplicar o modelo leva `blocos`; isto aqui nunca sai do desenho. */
  previa?: PreviaDoModelo;
};

export type PreviaDoModelo = { blocos?: Record<number, DadosBloco>; social?: SocialPublico };

export const FOTO_EXEMPLO_CRIADORA = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=70";

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
    /* Consultoria (22/10/2026): capa editorial com dois números, "é pra você
       se", serviços com o que inclui, como funciona, um depoimento grande,
       perguntas e a chamada final, com o botão fixo levando até ela. */
    id: "site-consultoria",
    nome: "Consultoria e serviços",
    paraQuem: "Quem vende serviço e precisa explicar cada um com calma: consultoria, mentoria, agência, escritório.",
    Icone: Briefcase,
    estilo: "site",
    aparencia: {
      bgType: "color", bgColor: "#F6F3EE", bgGradient: null,
      buttonColor: "#1F4D3A", buttonTextColor: "#FFFFFF", buttonStyle: "pill",
      cardColor: "#FFFFFF", cardTextColor: "#1E2A24", fontFamily: "DM Serif Display",
    },
    blocos: [
      { kind: "capa", data: {
        layout: "editorial", fundo: "creme",
        etiqueta: "O que você faz · pra quem",
        titulo: "A promessa do seu trabalho em uma linha", destaque: "",
        frase: "Pra quem é, o que resolve e onde atende. Duas linhas no máximo.",
        imagem: "", botao1: "Agendar conversa", url1: "#agendar", botao2: "Ver serviços", url2: "#servicos",
        numeros: [{ valor: "", rotulo: "clientes atendidos" }, { valor: "", rotulo: "anos de experiência" }], selo: "",
      } },
      { kind: "praquem", data: { titulo: "É pra você se...", fundo: "creme", itens: [
        "Primeira situação em que seu cliente se reconhece",
        "Segunda situação, do jeito que ele fala",
        "Terceira situação: o que ele quer e ainda não tem",
      ] } },
      { kind: "servicos", data: {
        rotulo: "Serviços", titulo: "Jeitos de trabalhar comigo", botao: "Quero esse", telefone: "", fundo: "creme",
        itens: [
          { id: "exemplo-1", nome: "Diagnóstico", duracao: "", resumo: "O que a pessoa ganha com esse serviço, em uma frase.", inclui: "Primeira entrega\nSegunda entrega\nTerceira entrega", preco: "", destaque: false },
          { id: "exemplo-2", nome: "Acompanhamento", duracao: "", resumo: "O serviço completo, do começo ao fim.", inclui: "Tudo do Diagnóstico\nEncontros semanais\nMaterial no fim", preco: "", destaque: true },
          { id: "exemplo-3", nome: "Sessão avulsa", duracao: "", resumo: "Pra destravar um problema específico.", inclui: "Conversa por vídeo\nResumo com próximos passos", preco: "", destaque: false },
        ],
      } },
      { kind: "etapas", data: { rotulo: "Como funciona", titulo: "", fundo: "creme", itens: [
        { titulo: "Conversa inicial", texto: "A pessoa conta o momento dela e você diz se consegue ajudar." },
        { titulo: "Proposta sob medida", texto: "Escopo, prazo e valor por escrito." },
        { titulo: "Mão na massa", texto: "Começa pelo que mais trava, com entregas toda semana." },
      ] } },
      { kind: "depoimentos", data: { layout: "destaque", rotulo: "", titulo: "Depoimentos", itens: [{ texto: "", autor: "" }] } },
      { kind: "faq", data: { titulo: "Antes de marcar", fundo: "creme", itens: [
        { p: "Quanto tempo leva?", r: "" },
        { p: "Atende online?", r: "" },
        { p: "Como funciona o pagamento?", r: "" },
      ] } },
      { kind: "chamada", data: {
        titulo: "Vamos conversar sobre o seu momento?", texto: "Uma conversa curta pra entender o que você precisa e ver se faz sentido trabalharmos juntos.",
        botao: "Escolher um horário", destino: "whatsapp", telefone: "", mensagem: "Olá! Quero agendar uma conversa.", url: "", secao: "", nota: "", fundo: "creme",
      } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
      { kind: "acao_fixa", data: { texto: "Agendar conversa", icone: "lucide:agenda", destino: "secao", secao: "agendar", telefone: "", mensagem: "", url: "" } },
    ],
    previa: {
      blocos: {
        0: { numeros: [{ valor: "+120", rotulo: "clientes atendidos" }, { valor: "12 anos", rotulo: "de experiência" }], selo: "Online e presencial",
          titulo: "Sua empresa rodando sem depender de você em tudo.", destaque: "você", etiqueta: "Consultoria de processos · pequenas empresas" },
        2: { itens: [
          { id: "p1", nome: "Diagnóstico", duracao: "2 semanas", resumo: "Raio-x de como a empresa funciona hoje e o plano do que mudar primeiro.", inclui: "Entrevista com a equipe\nMapa dos processos\nPlano de 90 dias", preco: "1.800", destaque: false },
          { id: "p2", nome: "Acompanhamento", duracao: "3 meses", resumo: "A gente implanta junto, toda semana, até a rotina rodar sem você.", inclui: "Diagnóstico incluso\nEncontro semanal de 1h\nManual da operação", preco: "6.900", destaque: true },
        ] },
        4: { itens: [{ texto: "Em três meses eu tirei a primeira semana de férias em seis anos. A empresa nem percebeu.", autor: "Cliente de exemplo, Itajaí" }] },
        5: { itens: [
          { p: "Quanto tempo leva?", r: "O diagnóstico leva duas semanas; o acompanhamento, três meses." },
          { p: "Atende online?", r: "Sim, pra qualquer cidade. Presencial na região." },
        ] },
      },
    },
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
    /* Criadora (22/10/2026, no lugar de "Autoridade e conteúdo"): bio e
       mídia kit na mesma página. Seguidores, vídeos e público podem vir do
       Instagram conectado. O botão fixo leva até a proposta de parceria. */
    id: "site-criadora",
    nome: "Criadora de conteúdo",
    paraQuem: "Influenciadora e criadora: links, cupons e últimos vídeos pro seguidor, mídia kit e proposta pra marca.",
    Icone: Camera,
    estilo: "site",
    aparencia: {
      bgType: "color", bgColor: "#FFF4EF", bgGradient: null,
      buttonColor: "#E2471F", buttonTextColor: "#FFFFFF", buttonStyle: "rounded",
      cardColor: "#FFFFFF", cardTextColor: "#1A1A1A", fontFamily: "Bricolage Grotesque",
    },
    blocos: [
      { kind: "perfil_criadora", data: {
        foto: "", nome: "", frase: "Sobre o que você fala e pra quem, numa frase.", cidade: "", selo: "Aceito parcerias",
        redes: [{ rede: "instagram", numero: "", url: "", auto: true }, { rede: "tiktok", numero: "", url: "", auto: false }],
      } },
      { kind: "botoes", data: { itens: [
        { titulo: "Meus achadinhos", sub: "Tudo que eu uso, com link", url: "", cor: "marca", icone: "" },
        { titulo: "Material grátis", sub: "E-book, planilha ou guia", url: "", cor: "lilas", icone: "" },
      ] } },
      { kind: "videos", data: { titulo: "Últimos vídeos", fonte: "instagram", quantos: 6, itens: [], perfil: "" } },
      { kind: "cupons", data: { titulo: "Meus cupons", itens: [{ marca: "", desconto: "", codigo: "", url: "" }] } },
      { kind: "midiakit", data: {
        rotulo: "Pra marcas", titulo: "Quem me assiste", auto: true, publico: [], engajamento: "", alcance: "",
        formatos: [
          { nome: "Reels", inclui: "1 Reels no meu perfil\nRoteiro aprovado por você antes\nRelatório de resultado", preco: "" },
          { nome: "Stories", inclui: "Sequência de 3 a 5 stories\nLink ou cupom no sticker\nPrint das métricas", preco: "" },
          { nome: "Combo", inclui: "1 Reels + stories\nUso do vídeo nos seus anúncios\nRelatório completo", preco: "" },
        ],
        marcas: [], pdf: "", botaoPdf: "Baixar mídia kit em PDF",
      } },
      { kind: "parceria", data: {
        titulo: "Vamos criar juntos?", subtitulo: "Conta da sua marca e do que você tem em mente. Respondo em até 2 dias úteis.",
        pedirEmpresa: true, botao: "Enviar proposta",
        consentimento: "Ao enviar, você autoriza o uso dos seus dados para eu responder sua proposta.", paraPipeline: true, fundo: "claro",
      } },
      { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
      { kind: "acao_fixa", data: { texto: "Fechar uma parceria", icone: "lucide:email", destino: "secao", secao: "parceria", telefone: "", mensagem: "", url: "" } },
    ],
    previa: {
      blocos: {
        0: { foto: FOTO_EXEMPLO_CRIADORA, nome: "Bia Lemos", frase: "Rotina, café e receitas fáceis pra quem mora sozinha.", cidade: "Itajaí · SC",
          redes: [{ rede: "instagram", numero: "", auto: true }, { rede: "tiktok", numero: "9,1 mil" }, { rede: "youtube", numero: "2,4 mil" }] },
        1: { itens: [
          { titulo: "Meus achadinhos", sub: "Tudo que eu uso, com link", url: "https://exemplo.com", cor: "marca" },
          { titulo: "Receitas do mês", sub: "E-book grátis em PDF", url: "https://exemplo.com", cor: "lilas" },
        ] },
        3: { itens: [{ marca: "Marca de café", desconto: "10% off", codigo: "BIA10" }, { marca: "Loja de casa", desconto: "frete grátis", codigo: "BIAFRETE" }] },
        4: { formatos: [
          { nome: "Reels", inclui: "1 Reels de até 60s\nRoteiro aprovado antes\nRelatório em 7 dias", preco: "1.200" },
          { nome: "Stories", inclui: "3 a 5 stories\nCupom no sticker", preco: "600" },
        ], marcas: [{ nome: "Café Bom" }, { nome: "Casa+" }, { nome: "Feira Viva" }] },
      },
      social: {
        conectado: true, usuario: null, atualizado_em: null, seguidores: 18432,
        videos: [
          "photo-1495474472287-4d71bcdd2085", "photo-1555507036-ab1f4038808a", "photo-1504754524776-8f4f37790ca0",
          "photo-1517433670267-08bbd4be890f", "photo-1509440159596-0249088772ff", "photo-1484723091739-30a097e8f929",
        ].map((id, i) => ({ foto: `https://images.unsplash.com/${id}?w=360&q=60`, link: "https://www.instagram.com/", video: true, views: [12400, 8100, 31000, 5600, 9900, 14200][i] })),
        publico: [{ rotulo: "Mulheres", pct: 78 }, { rotulo: "25 a 34 anos", pct: 52 }, { rotulo: "Santa Catarina", pct: 40 }, { rotulo: "Itajaí", pct: 24 }],
        engajamento: 4.2, alcance_30d: 86000,
      },
    },
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
