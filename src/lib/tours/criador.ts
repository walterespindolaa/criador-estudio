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
        // O checklist SOME quando você conclui os 6 itens ou dispensa. Sem isto o
        // passo continuava no tour falando de algo que não está mais na tela.
        skipIfMissing: true,
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
        target: '[data-tour="dash-instagram"]',
        title: "Seu conteúdo no Instagram",
        body: "Conecte sua conta business ou de criador e essa faixa deixa de ser convite pra virar número real: seguidores, alcance, engajamento e visitas ao perfil dos últimos 30 dias, sem abrir o app. A tarja verde cruza os seus posts e diz qual formato mais rende e qual o melhor dia pra postar. É esse mesmo dado que deixa a sugestão de horário do editor mais precisa. Sem conectar, o CRIA só consegue estimar pelo seu nicho.",
        mobileBody: "Conecte sua conta business ou de criador e essa faixa vira número real: seguidores, alcance e engajamento dos últimos 30 dias. A tarja verde diz qual formato mais rende e qual o melhor dia pra postar.",
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
        body: "Viu um post bom no Instagram ou TikTok? Cole o link aqui e o CRIA puxa a capa, a legenda e o @ sozinho. Você guarda em pastas (Ganchos, Edição, Referência de cliente), busca por autor ou palavra, e quando quiser usar, o salvo vira post no Criando em 1 clique, já com o link na anotação. Se alguma capa não veio, o botão \"Recuperar capas faltantes\" busca todas de uma vez.",
        mobileBody: "Cole o link de um post do Instagram ou TikTok e o CRIA puxa capa, legenda e @ sozinho. Guarde em pastas, busque por autor, e transforme o salvo em post no Criando com um toque.",
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
      // O "amarrar com o que está quente" MUDOU de casa: saiu da aba Arte e foi
      // pro escritor de roteiro (CarouselWriter). O passo antigo apontava pra um
      // data-tour="estudio-tempo" que não existe mais em lugar nenhum e caía no
      // card centralizado genérico. Agora o passo mostra o escritor de roteiro
      // (que só existe em formatos com páginas/cenas; num post de foto o card
      // aparece centralizado, e o texto continua fazendo sentido).
      {
        target: '[data-tour="roteiro-ia"]',
        openFirst: '[data-tour="editor-tab-roteiro"]',
        mobileOpenFirst: '[data-tour="editor-tab-roteiro"]',
        title: "Roteiro com IA (e o que está quente)",
        body: "Na aba Roteiro, a IA escreve as páginas ou cenas do post no tom da sua marca. E o botão de amarrar com o que está quente puxa o assunto do momento pro texto: o post fica atual, mas envelhece em algumas semanas. Sem ele, sai atemporal, que serve o ano inteiro.",
        placement: "bottom",
      },
      // ── CRIA ESTÚDIO ───────────────────────────────────────────────────
      // Estes passos existem porque este é o recurso mais fácil de ser mal
      // entendido do sistema: a pessoa pode achar que o CRIA vai GERAR a
      // imagem (não vai, ele entrega o prompt), e pode achar que o resultado
      // ruim é culpa da IA (quase sempre é o Brandbook vazio).
      {
        target: '[data-tour="estudio-base"]',
        // Sem isto o passo aponta pro vazio: a aba Arte está FECHADA quando o
        // tour chega aqui. O openFirst clica nela antes de apontar.
        openFirst: '[data-tour="editor-tab-arte"]',
        mobileOpenFirst: '[data-tour="editor-tab-arte"]',
        title: "Arte: o prompt, não a imagem",
        body: "O CRIA não gera a imagem: ele escreve o PROMPT dela, com as suas cores e a sua fonte, pra você colar no gerador que já usa (Midjourney, Canva, ChatGPT). Repare nesta linha: ela diz de onde o prompt vai nascer. Se você já escreveu o texto das páginas, ele usa o SEU texto. Se não escreveu, ele parte só do título, e aí sai mais genérico.",
        mobileBody: "O CRIA não gera a imagem: ele escreve o PROMPT dela, com as suas cores e fontes, pra colar no Midjourney, Canva ou ChatGPT. Esta linha diz de onde o prompt nasce: do seu texto ou só do título.",
        placement: "bottom",
      },
      {
        target: '[data-tour="estudio-gerar"]',
        title: "Um prompt por página, todos no mesmo estilo",
        body: "Num carrossel, cada página vira um prompt, mas todos carregam o MESMO bloco de estilo, senão você recebe 5 imagens de 5 mundos diferentes. Sai em português pra você conferir, e o botão copia em inglês, que é o que os geradores entendem melhor. Custa 1 geração da sua cota de IA.",
        placement: "top",
      },
      // A procedência só existe DEPOIS de gerar (é parte do resultado). Se o tour
      // passar por aqui num post que ainda não gerou nada, o card aparece
      // centralizado e o texto continua fazendo sentido.
      {
        target: '[data-tour="estudio-procedencia"]',
        openFirst: '[data-tour="editor-tab-arte"]',
        mobileOpenFirst: '[data-tour="editor-tab-arte"]',
        title: "De onde esse prompt saiu",
        body: "Assim que os prompts ficam prontos, essa faixa verde conta a procedência: se o texto veio das páginas que você escreveu ou só do título do post, e quais das suas cores e fontes entraram. Ela existe pra quando a arte sai com a cara errada: o conserto quase nunca é gerar de novo, é preencher o Brandbook, e o link dali te leva direto pra lá.",
        mobileBody: "Com os prompts prontos, essa faixa verde conta a procedência: se o texto veio das suas páginas ou só do título, e quais cores e fontes entraram. Arte com cara errada quase sempre é Brandbook vazio.",
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
    title: "Metas e marcos",
    valueProp:
      "Constância sem meta é sorte. Aqui você define objetivos claros (posts, seguidores, faturamento) e o CRIA acompanha: progresso visível, marcos por etapa e a reflexão do mês pra aprender com o que passou.",
    benefits: [
      "Metas claras, do seu tamanho",
      "Marcos quebram o objetivo em etapas",
      "Reflexão mensal pra evoluir de verdade",
    ],
    steps: [
      {
        target: '[data-tour="metas-nova"]',
        title: "Criar uma meta",
        body: "Defina um objetivo do seu tamanho: posts por semana, seguidores, faturamento de publi. Dentro da meta, adicione marcos pra dividir em etapas menores e ver o progresso andar.",
        placement: "bottom",
      },
      {
        target: '[data-tour="metas-reflexao"]',
        title: "Reflexão do mês",
        body: "No fim do mês, responda essas perguntas rápidas: o que funcionou, o que travou, qual foi o melhor conteúdo. É o hábito que separa quem evolui de quem só posta.",
        placement: "top",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="stories-abas"]',
        title: "Criar e Semana",
        body: "Criar é onde o plano nasce. Semana é o calendário dos seus stories, dia a dia: toque num story pra editar, marque como feito e arraste pra outro dia se mudar de ideia.",
        placement: "bottom",
      },
      {
        target: '[data-tour="stories-config"]',
        title: "Gere a semana de uma vez",
        body: "Escolha quantos stories por dia, o período e a data de início, e toque em Gerar plano. A IA monta a pauta inteira no seu nicho e joga tudo na aba Semana.",
        placement: "bottom",
      },
      {
        target: '[data-tour="stories-tendencias"]',
        title: "Stories em alta",
        body: "Formatos de story que estão funcionando agora, com exemplo pronto. Puxe os que combinam com você pra sua semana, ou peça pra Cria IA adaptar pro seu tom.",
        placement: "top",
        aiPrompt: "Me sugira 5 ideias de stories pra esta semana no meu nicho, misturando conexão, autoridade e venda.",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="tend-lista"]',
        title: "O que está em alta agora",
        body: "Formatos, temas quentes, ganchos e datas, atualizados pela curadoria do CRIA. Em cada card, o botão Gerar ideia pede pra Cria IA adaptar a tendência pro seu tom e nicho.",
        placement: "bottom",
        aiPrompt: "Me dê 3 ideias de post baseadas nas tendências atuais do meu nicho, no tom da minha marca.",
      },
      {
        target: '[data-tour="tend-plano"]',
        title: "Tendência vira cronograma",
        body: "O Cria Plano usa esse banco como contexto quando monta sua semana ou seu mês. Você surfa a onda sem esforço extra.",
        placement: "top",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="feed-grid"]',
        title: "Seu grid antes de postar",
        body: "É a prévia do seu perfil: os próximos posts na ordem em que vão aparecer. Arraste os cards pra reordenar e ache a combinação mais bonita antes de publicar.",
        mobileBody: "É a prévia do seu perfil: os próximos posts na ordem em que vão aparecer. Segure e arraste um card pra reordenar e testar combinações.",
        placement: "top",
      },
      {
        target: '[data-tour="feed-sidebar"]',
        mobileTarget: '[data-tour="feed-adicionar"]',
        title: "Posts disponíveis",
        body: "Aqui ficam os posts em edição, agendados e publicados que ainda não estão no grid. Arraste pro grid pra ver como fica no conjunto.",
        mobileBody: "Toque em Adicionar pra ver os posts em edição, agendados e publicados que ainda não estão no grid, e mande eles pra prévia.",
        placement: "right",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="aprovacao-filtros"]',
        title: "O status de cada post",
        body: "Pendentes ainda esperam o OK. Em ajuste voltaram com comentário. Aprovados estão prontos pra agendar. Filtre e saiba exatamente onde cada post parou.",
        placement: "bottom",
      },
      {
        target: '[data-tour="aprovacao-lista"]',
        title: "Revisar e aprovar",
        body: "Posts movidos pra Pronto no Criando aparecem aqui automaticamente. Toque num card pra ver a arte e a legenda, aprovar ou pedir ajuste com comentário.",
        placement: "top",
      },
    ],
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
        target: '[data-tour="brandbook-importar"]',
        title: "Não digite, sobe o PDF",
        body: "Preencher vinte campos na mão é o motivo de o brandbook viver vazio, e brandbook vazio faz TODA a IA do CRIA sair genérica. Se você já tem manual de marca, moodboard ou até um print da sua paleta, sobe aqui: o CRIA lê e espalha cada pedaço na seção certa, cores e fontes na Identidade, tom na aba Tom de Voz, temas na Linha Editorial e o público virando uma persona. Nada é salvo sem você olhar: a tela de revisão mostra o antes e o depois onde já havia texto seu, pra você não apagar sem querer o que ajustou na mão. Custa 1 geração da sua cota de IA.",
        mobileBody: "Já tem manual de marca, moodboard ou um print da sua paleta? Sobe aqui: o CRIA lê e espalha cores, fontes, tom e público nas seções certas. Você revisa antes de salvar. Custa 1 geração de IA.",
        placement: "bottom",
      },
      {
        target: '[data-tour="brandbook-hub"]',
        title: "As seis áreas da sua marca",
        body: "Identidade, Visual, Comunicação, Público-alvo, Valores e Tom de Voz. Cada card mostra quantos itens já estão preenchidos e leva direto pra aba correspondente. É o seu mapa do que ainda falta, sem precisar abrir aba por aba pra descobrir.",
        placement: "bottom",
      },
      {
        target: '[data-tour="brandbook-abas"]',
        title: "As áreas da sua marca",
        body: "Navegue pelas abas e preencha cada uma: quem você é, seu nicho, tom de voz, público e o Moodboard, que é o mural visual da sua estética (cores, referências, vibe). Reserve 15 minutos pra isso: é o investimento com maior retorno do CRIA, porque TUDO que a IA gerar daqui pra frente usa essas respostas.",
        mobileBody: "Passe pelas abas e preencha cada uma: quem você é, seu nicho, tom de voz, público e o Moodboard. São 15 minutos que mudam TUDO que a IA gerar daqui pra frente.",
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
    steps: [
      {
        target: '[data-tour="bio-estilo"]',
        title: "Escolha o estilo",
        body: "Clássico é a lista de links direta ao ponto. Vitrine mostra serviços e produtos como uma lojinha. Trocar de estilo não apaga nada: cada um guarda o próprio conteúdo. E é aqui que você salva.",
        placement: "bottom",
      },
      {
        target: '[data-tour="bio-link"]',
        title: "Seu endereço público",
        body: "Escolha seu nome no link e copie pra colar na bio do Instagram. Editou a página depois? O link continua o mesmo, sempre atualizado.",
        placement: "bottom",
      },
      {
        target: '[data-tour="bio-desempenho"]',
        title: "Visitas e cliques",
        body: "Quantas pessoas visitaram sua página e o que mais clicaram. É como você descobre qual link merece o topo.",
        placement: "top",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="mediakit-automatico"]',
        title: "Media kit automático",
        body: "Com o Instagram conectado, o CRIA monta seu media kit com seus números reais: audiência, melhores posts, nichos. Atualize, edite os dados e baixe em PDF pra mandar pra marca.",
        placement: "bottom",
      },
      {
        target: '[data-tour="mediakit-personalizado"]',
        title: "Ou use o seu PDF",
        body: "Fez o seu no Canva? Suba o PDF aqui, ou cole o link público (Canva, Notion, Drive). Fica guardado e pronto pra compartilhar em qualquer negociação.",
        placement: "top",
      },
    ],
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
  // O tour "estudio" (rota /app/estudio) foi REMOVIDO: a rota não existe mais.
  // O Cria Estúdio virou a aba Arte dentro do editor de post, e é coberto pelos
  // passos do tour "post-editor". Mantê-lo aqui fazia o tour completo navegar
  // pra uma tela 404.
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
    steps: [
      {
        target: '[data-tour="historico-stats"]',
        title: "Sua constância em números",
        body: "Total publicado, plataforma mais ativa, mês mais produtivo e média mensal. Prova concreta de que você está no jogo.",
        placement: "bottom",
      },
      {
        target: '[data-tour="historico-filtros"]',
        title: "Encontre qualquer post",
        body: "Filtre por plataforma, pilar e período. Perfeito pra achar aquele post que funcionou e reciclar. É aqui também que você preenche os resultados de cada post, o combustível dos Relatórios.",
        placement: "bottom",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="insights-conta"]',
        title: "Sua conta conectada",
        body: "Conecte seu Instagram (conta business ou de criador) e o CRIA puxa os dados reais. Já conectou? O botão Atualizar sincroniza as métricas mais recentes.",
        placement: "bottom",
      },
      {
        // Só existem depois de conectar o Instagram: antes disso a tela é só o convite
        // pra conectar, e falar de "os 4 números" ali não ajuda ninguém.
        skipIfMissing: true,
        target: '[data-tour="insights-kpis"]',
        title: "Os 4 números que importam",
        body: "Seguidores, alcance, interações e visitas ao perfil dos últimos 30 dias. Bateu o olho, entendeu a fase, sem abrir o app do Instagram.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="insights-posts"]',
        title: "Post por post",
        body: "O desempenho de cada publicação: alcance, curtidas, salvos. Vincule cada mídia ao post correspondente no CRIA pra fechar o ciclo entre planejar, publicar e aprender.",
        placement: "top",
      },
    ],
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
    steps: [
      {
        target: '[data-tour="config-abas"]',
        title: "Tudo em pílulas",
        body: "Perfil, Pilares & Hábitos, Marca & Visual, Assinatura, Conexões, Notificações, Equipe e Conta. Cada pílula é uma seção. Vale visitar todas uma vez.",
        mobileBody: "Perfil, Pilares & Hábitos, Marca & Visual, Assinatura, Conexões, Notificações, Equipe e Conta. Deslize a tira pro lado e toque na pílula pra trocar de seção.",
        placement: "bottom",
      },
      {
        target: '[data-tour="config-tab-visual"]',
        title: "Marca & Visual",
        body: "Tema, cores, fonte e fundo decorativo do app. Deixe o CRIA com a cara da sua marca: você passa horas aqui dentro, que seja bonito.",
        placement: "bottom",
      },
      {
        target: '[data-tour="config-tab-assinatura"]',
        title: "Assinatura",
        body: "Seu plano atual, o uso de IA do mês e o portal pra trocar de plano ou atualizar o cartão. Tudo de cobrança mora nessa pílula.",
        placement: "bottom",
      },
      {
        target: '[data-tour="config-tab-conta"]',
        title: "Conta",
        body: "Senha, sair do app e exclusão de dados. O lado sério das configurações, num lugar só.",
        placement: "bottom",
      },
    ],
  },
  // CRIA IA (painel global).
  // A Cria IA não tem rota: é um diálogo que abre por cima de qualquer tela do
  // /app. Por isso a `route` aqui é um marcador que NUNCA casa com um pathname
  // real (mesma solução do "post-editor"): o tour é acionado por id, pelo "?"
  // dentro do próprio painel. Também fica FORA do TRAINING_SEQUENCES, senão o
  // tour completo tentaria navegar pra uma rota que não existe.
  {
    id: "cria-ia",
    route: "/app#cria-ia",
    title: "Cria IA",
    valueProp:
      "A IA que já conhece a sua marca. Ela lê o seu brandbook antes de responder, então legenda, ideia e roteiro saem no SEU tom, não no tom de robô genérico.",
    benefits: [
      "Responde usando o tom do seu brandbook",
      "Atalhos prontos pro que você mais pede",
      "Cota mensal clara, sem susto no cartão",
    ],
    steps: [
      {
        target: '[data-tour="cria-ia-atalhos"]',
        title: "Ela começa pelo seu brandbook",
        body: "A linha de abertura te diz se ela já leu o seu brandbook. Se leu, tudo que sair daqui vem no seu tom, com as suas palavras e o seu público em mente. Se não leu, ela ainda ajuda, mas com ideia genérica de internet, e a diferença é gritante. Os botões coloridos são os pedidos do dia a dia já prontos: ideia de post, legenda, hashtags, análise da sua consistência, semana planejada e trends do momento.",
        mobileBody: "A linha de cima diz se ela já leu o seu brandbook: com ele, tudo sai no seu tom. Os botões coloridos são os pedidos prontos do dia a dia: ideia, legenda, hashtags, semana planejada e trends.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cria-ia-input"]',
        title: "A cota, sem susto",
        body: "Escreva à vontade aqui: Enter envia, Shift e Enter pulam linha. Cada resposta consome 1 geração da sua cota do mês, que é a MESMA cota do Cria Plano, dos prompts de arte e da leitura do brandbook em PDF. Quanto ainda resta aparece na barrinha de uso da IA, no menu lateral e no Dashboard, e a cota zera no dia 1º. É assinatura, não cartão aberto: quando acaba, acaba, e você decide entre subir de plano ou esperar virar o mês.",
        mobileBody: "Escreva à vontade aqui. Cada resposta gasta 1 geração da sua cota do mês, a mesma do Cria Plano e dos prompts de arte. O saldo aparece na barrinha de uso da IA e zera no dia 1º.",
        placement: "top",
      },
    ],
  },
  // ── TELAS NOVAS ──────────────────────────────────────────────────────────
  {
    id: "autopilot",
    route: "/app/autopilot",
    title: "Cria Plano",
    valueProp:
      "A IA monta sua semana ou seu mês de conteúdo de uma vez, usando seu brandbook, seus pilares e o que já performou. Você revisa, ajusta e manda tudo pro kanban.",
    benefits: [
      "Semana ou mês de pauta em um clique",
      "Posts já com data, hora e legenda",
      "Você aprova antes: nada entra sem seu OK",
    ],
    steps: [
      {
        target: '[data-tour="plano-config"]',
        title: "Configure o plano",
        body: "Período, quantidade de posts, plataforma e horários (dos seus dados ou recomendados pro nicho). Dá pra somar um foco, tipo vender ou engajar, e um contexto, tipo um lançamento.",
        placement: "right",
        mobileBody: "Período, quantidade de posts, plataforma e horários (dos seus dados ou recomendados pro nicho). Some um foco, tipo vender ou engajar, e um contexto, tipo um lançamento.",
      },
      {
        target: '[data-tour="plano-gerar"]',
        title: "Gerar cronograma",
        body: "Um clique e a IA monta a pauta inteira no seu tom. Preencheu o Brandbook? O resultado sobe de nível.",
        placement: "bottom",
      },
      {
        target: '[data-tour="plano-resultado"]',
        title: "Revise e envie",
        body: "Cada card é um post sugerido: edite título, legenda, data e hora ali mesmo. Desmarque o que não quiser e toque em Enviar. Tudo cai no seu kanban Criando, pronto pra produzir.",
        placement: "top",
      },
    ],
  },
  {
    id: "prompter",
    route: "/app/prompter",
    title: "Cria Prompter",
    valueProp:
      "Teleprompter pra gravar olhando pra câmera. Você cria ou cola o roteiro, aperta Gravar e o texto rola na tela enquanto você fala. O vídeo sai direto na sua galeria.",
    benefits: [
      "Roteiros criados aqui ou vindos do Criando",
      "Modo por voz: o texto acompanha a sua fala",
      "O vídeo gravado vai pra sua galeria",
    ],
    steps: [
      {
        target: '[data-tour="prompter-novo"]',
        title: "Crie ou cole o roteiro",
        body: "Escreva do zero ou cole um texto pronto. Seus posts na fase Produzindo e os roteiros do Cria Stories também chegam aqui com um toque, sempre na versão mais recente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="prompter-lista"]',
        title: "Toque em Gravar",
        body: "Cada roteiro abre o player de gravação em tela cheia. Lá você escolhe o modo: por voz, em que o texto segue a sua fala, ou rolagem automática com velocidade ajustável. Gravou? O vídeo sai na sua galeria.",
        placement: "top",
      },
      {
        target: '[data-tour="prompter-voz"]',
        title: "O modo por voz",
        body: "Leu, o texto anda. Improvisou, ele espera você voltar. No roteiro, use **trecho** pra destacar em amarelo e [pausa] pra marcar um respiro.",
        placement: "top",
      },
      {
        target: '[data-tour="prompter-pastas"]',
        title: "Organize em pastas",
        body: "A pasta se define ao salvar o roteiro, e aqui você filtra por ela. Bom pra separar por série, campanha ou cliente.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "relatorios",
    route: "/app/relatorios",
    title: "Seus Relatórios",
    valueProp:
      "Sua evolução como criador em números: quanto você produziu, quão constante foi e o desempenho real do que publicou. É a tela de olhar pra trás pra decidir o próximo passo.",
    benefits: [
      "Consistência medida contra a sua meta",
      "Descubra o formato que mais rende",
      "Decida o próximo mês com dados",
    ],
    steps: [
      {
        target: '[data-tour="rel-periodo"]',
        title: "Escolha o período",
        body: "Compare semanas, meses ou o ano. Todos os números da tela obedecem a esse filtro.",
        placement: "bottom",
      },
      {
        target: '[data-tour="rel-metricas"]',
        title: "Produção e consistência",
        body: "Publicados, em criação, ideias no banco e o percentual de semanas em que você bateu a meta. Constância é o que constrói audiência.",
        placement: "bottom",
      },
      {
        target: '[data-tour="rel-desempenho"]',
        title: "O que mais rende",
        body: "Preencha os resultados dos seus posts publicados (views, salvos, alcance) e esta seção revela o formato e o conteúdo que mais funcionam pra você.",
        placement: "top",
      },
    ],
  },
  {
    id: "lixeira",
    route: "/app/lixeira",
    title: "Lixeira",
    valueProp:
      "Excluiu sem querer? Respira. Tudo que você apaga fica aqui por 30 dias antes de sumir de vez.",
    benefits: [
      "30 dias pra se arrepender",
      "Restaurar leva um clique",
      "Apagar de vez só com confirmação",
    ],
    steps: [
      {
        target: '[data-tour="lixeira-header"]',
        title: "Sua rede de segurança",
        body: "Posts e clientes excluídos ficam aqui por 30 dias. Depois disso, somem de verdade.",
        placement: "bottom",
      },
      {
        target: '[data-tour="lixeira-itens"]',
        title: "Restaurar ou apagar",
        body: "Cada item mostra quantos dias faltam. Restaurar devolve pro lugar de origem. O X apaga de vez, e só depois de você confirmar.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "modulos",
    route: "/app/modulos",
    title: "Módulos",
    valueProp:
      "Ferramentas extras pra quem gerencia clientes. Cada módulo é uma assinatura separada: contrate só o que usar, cancele quando quiser.",
    benefits: [
      "Sem pacote fechado: você escolhe",
      "Ativa na hora, direto no cartão",
      "Gerencie ou cancele pelo portal",
    ],
    steps: [
      {
        target: '[data-tour="modulos-header"]',
        title: "Assinaturas independentes",
        body: "Cada módulo é cobrado por mês, separado do seu plano. Sem fidelidade: cancelou, parou de cobrar.",
        placement: "bottom",
      },
      {
        target: '[data-tour="modulos-grid"]',
        title: "Escolha os seus",
        body: "Cada card mostra o que o módulo resolve e quanto custa. Módulo ativo ganha selo verde e o botão Gerenciar abre o portal da assinatura. Contratar é um clique.",
        placement: "top",
      },
    ],
  },
];
