/**
 * Tours da área do criador (/app/*).
 * Regra pedagógica: contexto, benefício, passos curtos, gancho de IA.
 * Texto em PT-BR centralizado aqui (i18n-ready: basta trocar por chaves depois).
 */
import type { TourConfig } from "./registry";

export const TOURS_CRIADOR: TourConfig[] = [
  {
    id: "dashboard",
    route: "/app",
    title: "Seu dia começa aqui",
    valueProp:
      "O Dashboard é o seu quartel-general: em 10 segundos você sabe o que tem pra hoje, o que tá travado e qual o próximo passo. Sem abrir 6 abas.",
    benefits: [
      "Veja tudo que importa do seu conteúdo num lugar só",
      "Saiba sempre qual é a próxima melhor ação",
      "Capture ideias em 2 segundos antes que elas fujam",
    ],
    steps: [
      {
        target: '[data-tour="dash-primeiros-passos"]',
        title: "Primeiros passos",
        body: "Esse checklist te guia pela configuração inicial. Cada item concluído destrava mais valor do CRIA. Vale completar os 6!",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-acao"]',
        title: "Sua próxima melhor ação",
        body: "O CRIA analisa seu fluxo e te diz o que fazer AGORA pra manter a constância. Bateu dúvida do que fazer? Olha aqui primeiro.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-tiles"]',
        title: "Seu conteúdo em números",
        body: "Ideias, posts em criação, publicados, agendados, tarefas e hábitos. Cada card é clicável e te leva direto pra área correspondente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-posts"]',
        title: "Próximos posts",
        body: "O que vem pela frente, em ordem. Post atrasado ou sem data aparece aqui antes de virar problema.",
        placement: "top",
      },
      {
        target: '[data-tour="dash-captura"]',
        title: "Captura Rápida",
        body: "Ideia boa não espera. Digitou, capturou: ela vai direto pro seu banco de ideias, e você organiza depois.",
        placement: "top",
        aiPrompt:
          "Me sugira 5 ideias de post no tom da minha marca, usando meu brandbook como referência.",
      },
    ],
  },
  {
    id: "ideias",
    route: "/app/ideias",
    title: "Banco de Ideias",
    valueProp:
      "Chega de ideia morrendo em print perdido. Aqui vive o seu estoque criativo: temas, ganchos, referências, links e rascunhos. Tudo que você pensar fica guardado, organizado por pilar e pronto pra virar post.",
    benefits: [
      "Nunca mais comece um post do zero",
      "Guarde tema, gancho, referência e link numa ideia só",
      "A Cria IA sugere ideias e desdobra as suas em pautas",
      "Da ideia pro kanban de criação em 1 clique",
    ],
    steps: [
      {
        target: '[data-tour="ideias-nova"]',
        title: "Criar uma ideia",
        body: "Clique aqui pra registrar qualquer faísca: um tema (\"3 erros de quem começa\"), um gancho que você ouviu, um formato que quer testar. Dá pra escolher o pilar de conteúdo, anotar detalhes e anexar referência. Quanto mais contexto, mais fácil produzir depois.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ideias-visualizacao"]',
        title: "Lista ou Galeria",
        body: "Alterne como enxerga seu banco: Lista pra varrer rápido título por título, Galeria pra bater o olho em tudo como um mural de inspiração.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ideias-salvos"]',
        title: "Aba Salvos",
        body: "Viu um post inspirador no Instagram ou TikTok? Cole o link aqui e ele fica guardado como referência, junto das suas ideias. Seu \"salvos\" espalhado em 3 apps vira um lugar só.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ideias-nova"]',
        title: "O atalho da IA",
        body: "Em cada card de ideia existe um botão de faísca (✦): a Cria IA desdobra a ideia em ganchos, ângulos e formatos usando o seu brandbook. E quando a ideia estiver madura, o botão de promover manda ela direto pro kanban Criando.",
        placement: "bottom",
        aiPrompt: "Me sugira 5 ideias de post novas no tom da minha marca, baseadas nos meus pilares de conteúdo.",
      },
    ],
  },
  {
    id: "criando",
    route: "/app/criando",
    title: "Kanban Criando: o coração do CRIA",
    valueProp:
      "É aqui que ideia vira post publicado. Cada conteúdo é um card que atravessa 6 etapas, e você bate o olho e sabe exatamente onde cada post parou. Este é o fluxo que acaba com o \"postava quando dava\".",
    benefits: [
      "Nada se perde entre a ideia e o post no ar",
      "6 etapas claras: da faísca à publicação",
      "Board, Tabela ou Calendário: você escolhe como ver",
      "Estrutura pronta por formato (Reels, carrossel, story...)",
    ],
    steps: [
      {
        target: '[data-tour="criando-board"]',
        mobileTarget: '[data-tour="criando-board-m"]',
        title: "As 6 etapas do seu conteúdo",
        body: "Ideia: o que você quer criar. Planejamento: escreva gancho, roteiro e legenda. Produzindo: gravação e criação da mídia. Pronto: gravado, em finalização. Agendado: com data e hora marcadas. Publicado: no ar! Arraste os cards entre as colunas conforme avança.",
        mobileBody: "Ideia: o que você quer criar. Planejamento: gancho, roteiro e legenda. Produzindo: gravação da mídia. Pronto: em finalização. Agendado: com data marcada. Publicado: no ar! Deslize pro lado pra ver as colunas e toque num card pra abrir o post.",
        placement: "top",
      },
      {
        target: '[data-tour="criando-novo"]',
        title: "Novo Post",
        body: "Clique aqui e escolha o formato (Reels, carrossel, foto, story...). O CRIA já monta a estrutura certa daquele formato: gancho, cenas, legenda e CTA. Você só preenche.",
        mobileBody: "Toque aqui e escolha o formato (Reels, carrossel, foto, story...). O CRIA monta a estrutura certa daquele formato: gancho, cenas, legenda e CTA. Você só preenche.",
        placement: "bottom",
      },
      {
        target: '[data-tour="criando-filtros"]',
        mobileTarget: '[data-tour="criando-filtros-m"]',
        title: "Busca e filtros",
        body: "Busque por título e filtre por período, plataforma, pilar, semana ou formato. Com muitos posts no pipeline, os filtros te mostram só o que interessa agora.",
        mobileBody: "Busque por título aqui, e toque em Filtros pra abrir a gaveta com período, plataforma, pilar, semana e formato. Os filtros ativos aparecem como chips logo abaixo.",
        placement: "bottom",
      },
      {
        target: '[data-tour="criando-views"]',
        title: "Board, Tabela e Calendário",
        body: "O mesmo conteúdo, três visões: Board pra gerenciar o fluxo, Tabela pra editar em massa e ordenar, Calendário pra enxergar a semana como ela vai ao ar. Experimenta as três!",
        skipOnMobile: true,
      },
    ],
  },
  {
    id: "post-editor",
    route: "/app/criando#editor",
    title: "Anatomia de um post",
    valueProp:
      "Este é o editor onde o post nasce. Tudo que um conteúdo precisa mora aqui dentro: legenda, roteiro, mídia, tarefas, agendamento e a IA do seu lado o tempo todo.",
    benefits: [
      "Estrutura guiada: é só preencher os campos",
      "Melhor horário de postagem sugerido pra você",
      "Content Assistant escreve e avalia com o seu tom",
    ],
    steps: [
      {
        target: '[data-tour="editor-plataforma"]',
        mobileOpenFirst: '[data-tour="editor-tab-config"]',
        title: "Plataforma e formato",
        body: "Comece dizendo ONDE esse post vai viver (Instagram, TikTok, YouTube) e em que formato (Reels, carrossel, foto...). O CRIA adapta a estrutura do editor pra esse formato: um Reels ganha cenas, um carrossel ganha lâminas.",
        mobileBody: "Na aba Config do editor você define ONDE esse post vai viver (Instagram, TikTok, YouTube) e em que formato (Reels, carrossel, foto...). O CRIA adapta a estrutura pra esse formato: um Reels ganha cenas, um carrossel ganha lâminas.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-status"]',
        mobileOpenFirst: '[data-tour="editor-tab-config"]',
        title: "Status: onde esse post está no fluxo",
        body: "Esses chips são as mesmas colunas do kanban. Mudou o status aqui, o card anda lá no board. Ideia é a faísca; Planejamento é escrever; Produzindo é gravar; Pronto é finalizado; Agendado tem data; Publicado está no ar.",
        mobileBody: "Os chips de Status (na aba Config) são as mesmas colunas do kanban: mudou aqui, o card anda lá no board. Ideia é a faísca; Planejamento é escrever; Produzindo é gravar; Pronto é finalizado; Agendado tem data; Publicado está no ar.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-agendamento"]',
        mobileOpenFirst: '[data-tour="editor-tab-config"]',
        title: "Agendamento e melhor horário",
        body: "Defina data e hora, e repare na sugestão de melhores horários: ela é baseada no seu nicho e na plataforma (e fica mais precisa com o Instagram conectado). Post com data aparece no calendário e no Dashboard.",
        mobileBody: "Em Agendamento (aba Config), defina data e hora e repare na sugestão de melhores horários: é baseada no seu nicho e na plataforma, e fica mais precisa com o Instagram conectado. Post com data aparece no calendário e no Dashboard.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-abas"]',
        mobileOpenFirst: '[data-tour="editor-tab-criar"]',
        title: "As abas do post",
        body: "Legenda: o texto que vai no post. Roteiro: cena a cena do vídeo. Arte: o prompt da imagem, na sua marca. Tarefas: o que falta fazer pra esse post sair. Notas: anotações livres. Refs: referências e links de inspiração. Um post completo mora nessas abas.",
        mobileBody: "Na área de conteúdo do post você encontra as abas. Legenda: o texto do post. Roteiro: cena a cena. Arte: o prompt da imagem, na sua marca. Tarefas: o que falta pra esse post sair. Notas: anotações livres. Refs: referências e inspiração.",
        placement: "bottom",
      },
      // ── CRIA ESTÚDIO ───────────────────────────────────────────────────
      // Estes 3 passos existem porque este é o recurso mais fácil de ser mal
      // entendido do sistema: a pessoa pode achar que o CRIA vai GERAR a
      // imagem (não vai — ele entrega o prompt), e pode achar que o resultado
      // ruim é culpa da IA (quase sempre é o Brandbook vazio).
      {
        target: '[data-tour="estudio-base"]',
        // Sem isto o passo aponta pro vazio: a aba Arte está FECHADA quando o
        // tour chega aqui. O openFirst clica nela antes de apontar.
        openFirst: '[data-tour="editor-tab-arte"]',
        mobileOpenFirst: '[data-tour="editor-tab-arte"]',
        title: "Arte: o prompt, não a imagem",
        body: "O CRIA não gera a imagem — ele escreve o PROMPT dela, com as suas cores e a sua fonte, pra você colar no gerador que já usa (Midjourney, Canva, ChatGPT). Repare nesta linha: ela diz de onde o prompt vai nascer. Se você já escreveu o texto das páginas, ele usa o SEU texto. Se não escreveu, ele parte só do título — e aí sai mais genérico.",
        placement: "bottom",
      },
      {
        target: '[data-tour="estudio-tempo"]',
        title: "Atemporal ou em cima do que está quente",
        body: "Atemporal serve o ano inteiro: você reposta em janeiro sem parecer velho. Amarrado ao que está quente conversa com o assunto do momento, mas envelhece em algumas semanas. Não existe certo — existe o que você quer daquele post.",
        placement: "bottom",
      },
      {
        target: '[data-tour="estudio-gerar"]',
        title: "Um prompt por página, todos no mesmo estilo",
        body: "Num carrossel, cada página vira um prompt — mas todos carregam o MESMO bloco de estilo, senão você recebe 5 imagens de 5 mundos diferentes. Sai em português pra você conferir, e o botão copia em inglês, que é o que os geradores entendem melhor. Custa 1 geração da sua cota de IA.",
        placement: "top",
      },
      {
        target: '[data-tour="editor-ia"]',
        mobileOpenFirst: '[data-tour="editor-tab-config"]',
        title: "Content Assistant",
        body: "Escolha o tom (descontraído, profissional, provocativo...) e a IA escreve legenda e roteiro no estilo da sua marca, ou avalia o gancho que você escreveu. É o seu copywriter de plantão. E o botão ? aqui em cima reabre este tutorial quando quiser.",
        mobileBody: "No Content Assistant (aba Config), escolha o tom (descontraído, profissional, provocativo...) e a IA escreve legenda e roteiro no estilo da sua marca, ou avalia seu gancho. O botão ? no topo do editor reabre este tutorial quando quiser.",
        placement: "right",
        aiPrompt: "Escreva uma legenda pra este post no tom da minha marca, com gancho forte e CTA.",
      },
    ],
  },
  {
    id: "tarefas",
    route: "/app/tarefas",
    title: "Tarefas",
    valueProp:
      "Gravar, editar, responder comentário, entregar collab: a vida de criador é cheia de micro-tarefas. Aqui elas ganham prazo e param de morar na sua cabeça (e de escapar).",
    benefits: [
      "Tudo que precisa ser feito, com data e status",
      "Tarefas ligadas aos seus posts e collabs",
      "O resumo diário te lembra do que vence hoje",
    ],
    steps: [
      {
        target: '[data-tour="tarefas-nova"]',
        title: "Criar uma tarefa",
        body: "Clique aqui e registre qualquer pendência: gravar o Reels de quinta, responder a marca da collab, editar o vídeo. Defina prazo e pronto: ela aparece no Dashboard no dia certo, e você esvazia a cabeça.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "metas",
    route: "/app/metas",
    title: "Cria Plano: suas metas",
    valueProp:
      "Constância sem meta é sorte. Aqui você define quantos posts quer publicar por semana ou mês, e o CRIA acompanha: te avisa quando está atrasado e comemora quando você bate a meta.",
    benefits: [
      "Meta de publicação clara, do seu tamanho",
      "O Dashboard te cobra a meta com carinho",
      "Progresso visível: quanto falta pra fechar a semana",
    ],
    steps: [],
  },
  {
    id: "stories",
    route: "/app/stories",
    title: "Cria Stories",
    valueProp:
      "O plano semanal de stories pronto pra você nunca mais abrir o Instagram sem saber o que postar. O CRIA gera a pauta da semana inteira alinhada ao seu nicho: enquetes, bastidores, conexão e venda, dia a dia.",
    benefits: [
      "Semana inteira de stories gerada de uma vez",
      "Mistura certa: conexão, autoridade e venda",
      "Marque como feito e acompanhe a constância",
    ],
    steps: [],
  },
  {
    id: "tendencias",
    route: "/app/tendencias",
    title: "Tendências",
    valueProp:
      "O que está bombando agora no seu nicho: formatos, sons e assuntos em alta. Surfe a onda enquanto ela está de pé, adaptando pro seu tom em vez de copiar.",
    benefits: [
      "Tendências filtradas pro seu universo",
      "Ideia em alta + seu brandbook = post com cara sua",
      "Menos tempo caçando referência, mais tempo criando",
    ],
    steps: [],
  },
  {
    id: "feed",
    route: "/app/feed",
    title: "Meu Feed",
    valueProp:
      "Veja como seu feed vai ficar ANTES de postar. Organize a ordem visual dos próximos posts, teste combinações e garanta aquele perfil bonito de rolar.",
    benefits: [
      "Prévia real do seu grid do Instagram",
      "Arraste e reordene antes de publicar",
      "Harmonia visual sem app de terceiro",
    ],
    steps: [],
  },
  {
    id: "aprovacao",
    route: "/app/aprovacao",
    title: "Aprovações",
    valueProp:
      "Quando um post precisa do OK de alguém (marca, agência, sócio), ele passa por aqui. Você envia por link, a pessoa aprova ou comenta, e tudo fica registrado.",
    benefits: [
      "Aprovação por link, sem prints no WhatsApp",
      "Comentários no lugar certo, com histórico",
      "Você sabe o que está aprovado e o que travou",
    ],
    steps: [],
  },
  {
    id: "brandbook",
    route: "/app/brandbook",
    title: "Brandbook e Moodboard",
    valueProp:
      "Aqui mora a alma da sua marca: nicho, tom de voz, público e o moodboard com as imagens que definem sua estética. É daqui que a Cria IA aprende a escrever COMO VOCÊ. Preencheu bem, toda legenda e roteiro saem com a sua cara.",
    benefits: [
      "A IA escreve no seu tom, não no tom de robô",
      "Moodboard: sua estética visual num mural de referências",
      "Base pra tudo: legendas, roteiros, stories e ideias",
      "Decisões de conteúdo mais rápidas e coerentes",
    ],
    steps: [
      {
        target: '[data-tour="brandbook-abas"]',
        title: "As áreas da sua marca",
        body: "Navegue pelas abas e preencha cada uma: quem você é, seu nicho, tom de voz, público e o Moodboard, que é o mural visual da sua estética (cores, referências, vibe). Reserve 15 minutos pra isso: é o investimento com maior retorno do CRIA, porque TUDO que a IA gerar daqui pra frente usa essas respostas.",
        placement: "bottom",
        aiPrompt: "Me ajude a definir meu tom de voz e público ideal com base no meu nicho.",
      },
    ],
  },
  {
    id: "linkinbio",
    route: "/app/linkinbio",
    title: "Link in bio",
    valueProp:
      "Sua vitrine oficial: uma página com seus links, produtos e destaques pra colocar na bio. Feita no CRIA, com a sua identidade, sem pagar mais uma assinatura de Linktree.",
    benefits: [
      "Página de links com a cara da sua marca",
      "Atualize na hora, sem depender de ninguém",
      "Capture contatos e direcione seu público",
    ],
    steps: [],
  },
  {
    id: "media-kit",
    route: "/app/media-kit",
    title: "Media Kit",
    valueProp:
      "Seu cartão de visitas pra fechar publi: números, nichos, formatos e cases numa página profissional pra mandar pra marcas. Quem apresenta media kit bonito negocia cachê melhor.",
    benefits: [
      "Media kit profissional sem designer",
      "Seus números sempre atualizados",
      "Link pronto pra enviar em qualquer negociação",
    ],
    steps: [],
  },
  {
    id: "biblioteca",
    route: "/app/biblioteca",
    title: "Biblioteca",
    valueProp:
      "Seu acervo de mídia num lugar só: vídeos, fotos e artes que você usa nos posts. Suba uma vez, reaproveite sempre, sem caçar arquivo na galeria ou no Drive.",
    benefits: [
      "Assets organizados e fáceis de achar",
      "Reaproveite mídia entre posts",
      "Integração com Google Drive pra arquivos pesados",
    ],
    steps: [
      {
        target: '[data-tour="biblioteca-abas"]',
        title: "Os acervos da Biblioteca",
        body: "Explore as abas: cada uma é um tipo de recurso pro seu conteúdo, de hooks prontos pra capturar atenção a materiais seus. Quando estiver criando um post e travar, é aqui que você abastece.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "estudio",
    route: "/app/estudio",
    title: "Cria Estúdio",
    valueProp:
      "Crie imagens com IA no estilo da sua marca, direto no CRIA. Nunca mais trave um post por falta de arte: descreva a cena e o Estúdio gera a imagem pra você.",
    benefits: [
      "Imagens únicas sem banco de imagem genérico",
      "Estilo consistente com a sua estética",
      "Da ideia à arte publicável em minutos",
    ],
    steps: [],
  },
  {
    id: "collabs",
    route: "/app/collabs",
    title: "Collabs",
    valueProp:
      "Publis e parcerias organizadas: briefing, combinados, entregas, prazos e cachê de cada collab registrados. A marca elogia sua organização e você nunca esquece uma entrega (nem um pagamento).",
    benefits: [
      "Cada collab com prazo, briefing e valor",
      "Entregas conectadas ao seu kanban",
      "Histórico pra renegociar com base em resultado",
    ],
    steps: [
      {
        target: '[data-tour="collabs-abas"]',
        title: "Pipeline e Lista",
        body: "Pipeline mostra suas parcerias como um funil: da conversa inicial ao contrato fechado e entregue. Lista é a visão corrida de tudo. Cada collab guarda briefing, prazo e cachê, então nada se perde entre o DM e a entrega.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "historico",
    route: "/app/historico",
    title: "Histórico",
    valueProp:
      "Tudo que você já publicou, em ordem. É o seu acervo: revisite o que funcionou, encontre posts antigos pra reciclar e acompanhe a evolução da sua produção.",
    benefits: [
      "Linha do tempo de tudo que foi ao ar",
      "Recicle conteúdo que já deu certo",
      "Prova concreta da sua constância",
    ],
    steps: [],
  },
  {
    id: "insights",
    route: "/app/insights",
    title: "Insights do Instagram",
    valueProp:
      "Dados reais do seu perfil, sem achismo: alcance, engajamento, crescimento e o desempenho de cada post, dentro do CRIA. Feche o ciclo: analise, aprenda o que funciona e comece a próxima semana na frente.",
    benefits: [
      "Métricas reais conectadas do seu Instagram",
      "Veja quais posts performaram e por quê",
      "Decida o próximo conteúdo com base em dados",
      "Melhores horários cada vez mais precisos",
    ],
    steps: [],
  },
  {
    id: "configuracoes",
    route: "/app/configuracoes",
    title: "Configurações",
    valueProp:
      "Deixe o CRIA com a sua cara e do seu jeito: tema e cores, fonte, fundo decorativo, conexão com o Instagram, notificações, pilares de conteúdo e seu plano. Vale visitar cada aba uma vez.",
    benefits: [
      "Visual: tema CRIA, cores, fontes e fundos",
      "Conecte o Instagram pra liberar os Insights",
      "Pilares de conteúdo alimentam sua linha editorial",
      "Notificações e resumo diário do seu jeito",
    ],
    steps: [],
  },
];
