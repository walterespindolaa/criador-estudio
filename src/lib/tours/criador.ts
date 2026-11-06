/**
 * Tours da área do criador (/app/*).
 * Regra pedagógica: contexto, benefício, passos curtos, gancho de IA.
 * Texto em PT-BR centralizado aqui (i18n-ready: basta trocar por chaves depois).
 */
import type { TourConfig } from "./registry";
import { TOUR_CRIAKUT } from "./criakut";

export const TOURS_CRIADOR: TourConfig[] = [
  {
    id: "dashboard",
    route: "/app",
    title: "Seu dia começa aqui",
    valueProp:
      "O Início responde uma pergunta: o que eu faço agora. O que sai hoje, o que está travado, a semana e as tarefas do dia, sem abrir outra tela.",
    benefits: [
      "Veja o que trava a produção antes de virar atraso",
      "A semana com a linha editorial e os posts marcados num bloco só",
      "Tarefas do dia e hábitos com um toque",
    ],
    steps: [
      {
        // O checklist SOME quando você conclui os 7 itens ou dispensa.
        skipIfMissing: true,
        target: '[data-tour="dash-primeiros-passos"]',
        title: "Primeiros passos",
        body: "Esse checklist te guia pela configuração inicial. O selo 001 você já ganhou com a primeira ideia; publicar o 1º post e montar o link na bio rendem o 002 e o 003. Completar o Brandbook faz a Cria IA escrever com a sua cara.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-acao"]',
        title: "O que sai hoje e o que trava",
        body: "Quantos posts saem hoje e três atalhos: Nova ideia, Gravar no Prompter e Pedir pra Cria IA. Embaixo, o que trava: posts atrasados, esperando aprovação ou sem mídia. Toque num deles pra abrir o Criando.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-hoje"]',
        title: "Hoje",
        body: "As tarefas de hoje, as sem prazo e as que ficaram pra trás. Marque com um toque e crie uma nova escrevendo na última linha e apertando Enter. Os hábitos do dia ficam embaixo, em pílulas.",
        placement: "left",
        mobileBody: "As tarefas de hoje. Marque com um toque e crie uma nova escrevendo na última linha. Os hábitos ficam embaixo.",
      },
      {
        target: '[data-tour="dash-posts"]',
        title: "Sai esta semana",
        body: "Os próximos 7 dias com o pilar da sua linha editorial e os posts marcados, com a prévia da mídia. Contorno laranja é post travado. Dia sem nada mostra o atalho pra uma ideia do pilar.",
        mobileBody: "Os próximos 7 dias com o pilar do dia e os posts marcados. Arraste pro lado. Contorno laranja é post travado.",
        placement: "top",
      },
      {
        target: '[data-tour="dash-instagram"]',
        title: "Seu Instagram",
        body: "Seguidores, alcance, engajamento e visitas dos últimos 30 dias, comparados com os 30 anteriores. Embaixo, o post que mais funcionou no período, com o Reaproveitar. Sem o Instagram conectado, este bloco vira o convite pra conectar.",
        placement: "top",
      },
      {
        target: '[data-tour="dash-gancho"]',
        title: "Gancho do dia",
        body: "Um gancho por dia pra destravar. Copie ou toque em Usar no post pra criar um rascunho no Criando já com ele. Embaixo, quanto da Cria IA você usou no mês.",
        placement: "left",
      },
      {
        target: '[data-tour="dash-quem"]',
        title: "Quem é você, num relance",
        body: "O resumo do seu Brandbook: nicho, tom, pilares e pra quem você fala. É o que a Cria IA lê antes de escrever qualquer coisa. Achou algo errado aqui? Toque em Editar: todo texto da IA melhora junto.",
        placement: "top",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="dash-criakut"]',
        title: "Sua página no Criakut",
        body: "O Criakut é onde social mídia, designer e editor se encontram com quem cria. Sua página sai pronta em 2 minutos com o que o Cria já sabe de você: nicho, tom e números do Instagram. Depois de publicada, este cartão mostra quem visitou e os pedidos de orçamento.",
        placement: "top",
      },
    ],
  },
  {
    id: "ideias",
    route: "/app/ideias",
    title: "Banco de Ideias",
    valueProp:
      "Chega de ideia morrendo em print perdido. Cada ideia vira uma folha: você escreve por tópicos, grifa o que importa e a Cria IA tira posts dali. Tudo que saiu de uma folha fica guardado nela.",
    benefits: [
      "Nunca mais comece um post do zero",
      "Escreva por tópicos e grife o que mais importa",
      "A Cria IA lê a folha e sugere carrossel, reels e mais",
      "Da ideia pro kanban de criação em 1 clique",
    ],
    steps: [
      {
        target: '[data-tour="ideias-nova"]',
        title: "Uma ideia nova",
        body: "Dê um título e, se quiser, o pilar e a pasta. Na visão Folhas, a folha abre na hora pra você escrever.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ideias-visualizacao"]',
        title: "Folhas ou Lista",
        body: "Folhas mostra cada ideia como uma folha de caderno, com o começo do texto e quantas ideias já saíram dela. Lista é pra varrer rápido, título por título. A escolha fica salva.",
        mobileBody: "Os dois ícones trocam entre Folhas (cada ideia como uma folha de caderno) e Lista (título por título). A escolha fica salva.",
        placement: "bottom",
      },
      {
        // As folhas só existem na visão Folhas e com pelo menos uma ideia.
        skipIfMissing: true,
        target: '[data-tour="ideias-folhas"]',
        title: "Dentro da folha",
        body: "Abra uma folha e escreva. A barra de cima tem negrito, tópico, título, checklist e quatro cores de grifo (e o sem grifo). Tudo salva sozinho. Ao lado, Tirar ideias desta folha: escolha o formato (Estático, Carrossel, Reels, Story ou YouTube) e toque em Gerar 3 ideias desta folha. A Cria IA lê a folha inteira e o seu brandbook, e o que você grifou pesa mais.",
        mobileBody: "Toque numa folha e escreva por tópicos: negrito, tópico, título, checklist e grifo em quatro cores. Salva sozinho. Embaixo, escolha o formato e toque em Gerar 3 ideias desta folha. O que você grifou pesa mais.",
        placement: "top",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="ideias-folhas"]',
        title: "Já saiu desta folha",
        body: "Tudo que a Cria IA gerou fica guardado na própria folha, com data e formato. Em cada uma: Virar post manda pro kanban Criando, Guardar no banco vira uma ideia nova, Descartar tira da vista. Se você escrever mais na folha depois, o Cria avisa que ela mudou pra você gerar de novo.",
        mobileBody: "O que a Cria IA gerou fica guardado na folha. Em cada sugestão: Virar post, Guardar no banco ou Descartar. Escreveu mais? O Cria avisa pra gerar de novo.",
        placement: "top",
      },
      {
        target: '[data-tour="ideias-salvos"]',
        title: "Aba Salvos",
        body: "Viu um post bom no Instagram ou TikTok? Cole o link aqui e o CRIA puxa a capa, a legenda e o @ sozinho. Você guarda em pastas (Ganchos, Edição, Referência de cliente), busca por autor ou palavra, e quando quiser usar, o salvo vira post no Criando em 1 clique, já com o link na anotação. Se alguma capa não veio, o botão \"Recuperar capas faltantes\" busca todas de uma vez.",
        mobileBody: "Cole o link de um post do Instagram ou TikTok e o CRIA puxa capa, legenda e @ sozinho. Guarde em pastas, busque por autor, e transforme o salvo em post no Criando com um toque.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ideias-visualizacao"]',
        title: "O atalho da Cria IA na Lista",
        body: "Na Lista, cada ideia tem o botão CrIA: escolha o formato e a Cria IA devolve sugestões com gancho, estrutura e CTA, no tom do seu brandbook. Quando a ideia estiver madura, Virar post manda ela direto pro kanban Criando.",
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
      "Quadro, Tabela ou Calendário: você escolhe como ver",
      "O que trava aparece em cima: atrasado, esperando aprovação, sem mídia",
      "Estrutura pronta por formato (Reels, carrossel, story...)",
    ],
    steps: [
      {
        target: '[data-tour="criando-board"]',
        mobileTarget: '[data-tour="criando-board-m"]',
        title: "As 6 etapas do seu conteúdo",
        body: "Ideia: o que você quer criar. Planejamento: escreva gancho, roteiro e legenda. Produzindo: gravação e criação da mídia. Pronto: gravado, em finalização. Agendado: com data e hora marcadas. Publicado: no ar! Arraste os cartões entre as colunas conforme avança, ou use o botão de mover no canto do cartão. Em cima, a faixa mostra o que trava; toque num item pra destacar só esses posts. O botão Mídia mostra ou esconde a prévia no cartão.",
        mobileBody: "Ideia: o que você quer criar. Planejamento: gancho, roteiro e legenda. Produzindo: gravação da mídia. Pronto: em finalização. Agendado: com data marcada. Publicado: no ar! Deslize pro lado pra ver as colunas e toque num cartão pra abrir o post. Segure o cartão pra ver os atalhos, e o botão de visão geral do menu de baixo mostra o quadro todo.",
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
        title: "Quadro, Tabela e Calendário",
        body: "O mesmo conteúdo, três visões: Quadro pra gerenciar o fluxo, Tabela pra editar em massa e ordenar, Calendário pra enxergar a semana como ela vai ao ar. Experimenta as três!",
        skipOnMobile: true,
      },
    ],
  },
  {
    id: "post-editor",
    route: "/app/criando#editor",
    title: "Anatomia de um post",
    valueProp:
      "Este é o editor onde o post nasce. Tudo que um conteúdo precisa mora aqui dentro: legenda, roteiro, mídia, tarefas, agendamento e a Cria IA do seu lado o tempo todo.",
    benefits: [
      "Estrutura guiada: é só preencher os campos",
      "Melhor horário de postagem sugerido pra você",
      "Content Assistant escreve e avalia com o seu tom",
    ],
    steps: [
      {
        target: '[data-tour="editor-plataforma"]',
        title: "Plataforma e formato",
        body: "Comece dizendo ONDE esse post vai viver (Instagram, TikTok, YouTube) e em que formato (Reels, carrossel, foto...). O CRIA adapta a estrutura do editor pra esse formato: um Reels ganha cenas, um carrossel ganha lâminas.",
        mobileBody: "Na aba Config do editor você define ONDE esse post vai viver (Instagram, TikTok, YouTube) e em que formato (Reels, carrossel, foto...). O CRIA adapta a estrutura pra esse formato: um Reels ganha cenas, um carrossel ganha lâminas.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-status"]',
        title: "Status: onde esse post está no fluxo",
        body: "Esses chips são as mesmas colunas do kanban. Mudou o status aqui, o card anda lá no board. Ideia é a faísca; Planejamento é escrever; Produzindo é gravar; Pronto é finalizado; Agendado tem data; Publicado está no ar.",
        mobileBody: "Os chips de Status (na aba Config) são as mesmas colunas do kanban: mudou aqui, o card anda lá no board. Ideia é a faísca; Planejamento é escrever; Produzindo é gravar; Pronto é finalizado; Agendado tem data; Publicado está no ar.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-agendamento"]',
        title: "Agendamento e melhor horário",
        body: "Defina data e hora, e repare na sugestão de melhores horários: ela é baseada no seu nicho e na plataforma (e fica mais precisa com o Instagram conectado). Post com data aparece no calendário e no Dashboard.",
        mobileBody: "Em Agendamento (aba Config), defina data e hora e repare na sugestão de melhores horários: é baseada no seu nicho e na plataforma, e fica mais precisa com o Instagram conectado. Post com data aparece no calendário e no Dashboard.",
        placement: "right",
      },
      {
        // Só existe com o Instagram conectado e formato que o Instagram aceita.
        skipIfMissing: true,
        target: '[data-tour="editor-instagram"]',
        title: "Agendar ou publicar no Instagram",
        body: "O botão principal AGENDA o post pra data e hora dele: sai sozinho, na hora certa. Publicar agora é o secundário e pede confirmação, porque sai na hora, não na data do post. Agendado, o card ganha o selo azul no Kanban e na agenda. Apagou no Instagram depois de publicar? Use \"Apagou no Instagram? Publicar ou agendar de novo\": o Cria confere se saiu mesmo e devolve o post pra Pronto pra sair, com a mesma mídia e legenda.",
        mobileBody: "O botão principal AGENDA pra data e hora do post. Publicar agora sai na hora e pede confirmação. Apagou no Instagram? \"Publicar ou agendar de novo\" devolve o post pra Pronto pra sair.",
        placement: "top",
      },
      {
        target: '[data-tour="editor-midia"]',
        title: "Mídia: a arte abre o post",
        body: "Aqui entra a imagem ou o vídeo do post: toque pra expandir, suba do Google Drive ou da galeria, e no carrossel a ordem das imagens é a ordem das lâminas. O campo de link aceita tanto o arquivo final quanto a pasta do Drive/Canva. O que você subir aparece na prévia à direita, do jeito que o seguidor vai ver.",
        mobileBody: "Aqui entra a imagem ou o vídeo do post: suba do Google Drive ou da galeria. O campo de link aceita o arquivo final ou a pasta do Drive/Canva.",
        placement: "left",
      },
      // O "amarrar com o que está quente" MUDOU de casa: saiu da aba Arte e foi
      // pro escritor de roteiro (CarouselWriter). O passo antigo apontava pra um
      // data-tour="estudio-tempo" que não existe mais em lugar nenhum e caía no
      // card centralizado genérico. Agora o passo mostra o escritor de roteiro
      // (que só existe em formatos com páginas/cenas; num post de foto o card
      // aparece centralizado, e o texto continua fazendo sentido).
      {
        target: '[data-tour="roteiro-ia"]',
        // Post de foto/estático não tem escritor de roteiro: o passo é pulado em
        // vez de segurar a tela com o destaque do passo anterior (Walter, 04/09).
        skipIfMissing: true,
        title: "Roteiro com a Cria IA (e o que está quente)",
        body: "Na aba Roteiro, a Cria IA escreve as páginas ou cenas do post no tom da sua marca. E o botão de amarrar com o que está quente puxa o assunto do momento pro texto: o post fica atual, mas envelhece em algumas semanas. Sem ele, sai atemporal, que serve o ano inteiro.",
        placement: "bottom",
      },
      // ── CRIA ESTÚDIO ───────────────────────────────────────────────────
      // Estes passos existem porque este é o recurso mais fácil de ser mal
      // entendido do sistema: a pessoa pode achar que o CRIA vai GERAR a
      // imagem (não vai, ele entrega o prompt), e pode achar que o resultado
      // ruim é culpa da IA (quase sempre é o Brandbook vazio).
      {
        target: '[data-tour="estudio-base"]',
        // O estúdio fica recolhido atrás do "Preciso de ajuda com a imagem";
        // o openFirst clica nele antes de apontar.
        openFirst: '[data-tour="editor-ajuda-arte"]',
        mobileOpenFirst: '[data-tour="editor-ajuda-arte"]',
        title: "Arte: o prompt, não a imagem",
        body: "O CRIA não gera a imagem: ele escreve o PROMPT dela, com as suas cores e a sua fonte, pra você colar no gerador que já usa (Midjourney, Canva, ChatGPT). Repare nesta linha: ela diz de onde o prompt vai nascer. Se você já escreveu o texto das páginas, ele usa o SEU texto. Se não escreveu, ele parte só do título, e aí sai mais genérico.",
        mobileBody: "O CRIA não gera a imagem: ele escreve o PROMPT dela, com as suas cores e fontes, pra colar no Midjourney, Canva ou ChatGPT. Esta linha diz de onde o prompt nasce: do seu texto ou só do título.",
        placement: "bottom",
      },
      {
        target: '[data-tour="estudio-gerar"]',
        title: "Um prompt por página, todos no mesmo estilo",
        body: "Num carrossel, cada página vira um prompt, mas todos carregam o MESMO bloco de estilo, senão você recebe 5 imagens de 5 mundos diferentes. Sai em português pra você conferir, e o botão copia em inglês, que é o que os geradores entendem melhor. Custa 1 geração da sua cota da Cria IA.",
        placement: "top",
      },
      // A procedência só existe DEPOIS de gerar (é parte do resultado). Se o tour
      // passar por aqui num post que ainda não gerou nada, o card aparece
      // centralizado e o texto continua fazendo sentido.
      {
        target: '[data-tour="estudio-procedencia"]',
        openFirst: '[data-tour="editor-ajuda-arte"]',
        mobileOpenFirst: '[data-tour="editor-ajuda-arte"]',
        title: "De onde esse prompt saiu",
        body: "Assim que os prompts ficam prontos, essa faixa verde conta a procedência: se o texto veio das páginas que você escreveu ou só do título do post, e quais das suas cores e fontes entraram. Ela existe pra quando a arte sai com a cara errada: o conserto quase nunca é gerar de novo, é preencher o Brandbook, e o link dali te leva direto pra lá.",
        mobileBody: "Com os prompts prontos, essa faixa verde conta a procedência: se o texto veio das suas páginas ou só do título, e quais cores e fontes entraram. Arte com cara errada quase sempre é Brandbook vazio.",
        placement: "top",
      },
      {
        target: '[data-tour="editor-ia"]',
        openFirst: '[data-tour="editor-legenda-abrir"]',
        mobileOpenFirst: '[data-tour="editor-legenda-abrir"]',
        title: "Content Assistant",
        body: "Escolha o tom (descontraído, profissional, provocativo...) e a Cria IA escreve legenda e roteiro no estilo da sua marca, ou avalia o gancho que você escreveu. É o seu copywriter de plantão. E o botão ? no canto direito do topo reabre este tutorial quando quiser.",
        mobileBody: "No Content Assistant, escolha o tom (descontraído, profissional, provocativo...) e a Cria IA escreve legenda e roteiro no estilo da sua marca, ou avalia seu gancho. O botão ? no topo reabre este tutorial.",
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
        body: "Defina um objetivo do seu tamanho: posts, seguidores, faturamento de publi. Cada meta mostra quanto falta, o ritmo e, com prazo, quanto precisa por mês. A de seguidores se atualiza sozinha com o Instagram. Toque na meta pra ver os marcos.",
        placement: "bottom",
      },
      {
        target: '[data-tour="metas-reflexao"]',
        title: "Reflexão do mês",
        body: "Seis perguntas rápidas: toque numa, escreva e ela salva sozinha ao sair do campo. Em Páginas anteriores você relê os outros meses.",
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
        title: "A semana é a tela",
        body: "Em cima, o resumo da semana: quantos stories faltam gravar, quais saem pelo celular, quais esperam mídia e quais já saíram. Troque a semana nas setas.",
        placement: "bottom",
      },
      {
        target: '[data-tour="stories-config"]',
        title: "Montar a semana com a CrIA",
        body: "Escolha os dias, quantos stories por dia, o objetivo e as tendências que servem de base. A Cria IA escreve tudo e mostra a prévia antes de entrar no plano.",
        placement: "bottom",
      },
      {
        target: '[data-tour="stories-tendencias"]',
        title: "Cada story diz o próximo passo",
        body: "Falado vai pro Prompter, com figurinha sai pelo celular com lembrete, foto ou texto pede a mídia. Toque no título pra editar, arraste pra outro dia, ou use + Novo story.",
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
        body: "Formatos, temas, ganchos, datas e formatos de story, atualizados pela curadoria do CRIA. Marque as que servem pra você: a barra de baixo leva de uma vez pra Cria IA, pros stories ou pro Cria Plano.",
        placement: "bottom",
        aiPrompt: "Me dê 3 ideias de post baseadas nas tendências atuais do meu nicho, no tom da minha marca.",
      },
      {
        target: '[data-tour="tend-plano"]',
        title: "Filtre pro que importa",
        body: "Filtre por tipo, só pro seu nicho ou só stories. Em cima ficam a mais usada no Cria, a próxima data comercial e o gancho em alta.",
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
        body: "Seu perfil como aparece no Instagram do iPhone. O que tem selo com data ainda vai sair; o resto já está no perfil. Arraste pra reordenar, e use Esconder sem mídia pra ver só o que vai aparecer de fato.",
        mobileBody: "Seu perfil como aparece no Instagram. O selo com data ainda vai sair. Segure e arraste pra reordenar; toque numa foto pra ver o título ou tirar da grade.",
        placement: "top",
      },
      {
        target: '[data-tour="feed-sidebar"]',
        mobileTarget: '[data-tour="feed-adicionar"]',
        title: "Pra montar o feed",
        body: "Os posts que ainda não estão na grade, com filtro de com e sem mídia. Arraste pra grade ou toque no + pra pôr no fim.",
        mobileBody: "Toque na gaveta embaixo pra escolher posts. A ordem em que você toca é a ordem em que eles entram na grade.",
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
        title: "Onde cada post parou",
        body: "Esperando ainda não teve resposta. Em ajuste voltou com comentário. Aprovados estão prontos pra agendar. Ao lado, a busca pelo título.",
        placement: "bottom",
      },
      {
        target: '[data-tour="aprovacao-lista"]',
        title: "O que está parado sobe",
        body: "Em cima ficam os parados há mais tempo (a data passou ou espera há mais de 7 dias), embaixo os próximos a sair. Toque em Abrir pra ver a arte e a legenda, aprovar ou pedir ajuste com comentário.",
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
      "A Cria IA escreve no seu tom, não no tom de robô",
      "Moodboard: sua estética visual num mural de referências",
      "Base pra tudo: legendas, roteiros, stories e ideias",
      "Decisões de conteúdo mais rápidas e coerentes",
    ],
    steps: [
      {
        target: '[data-tour="brandbook-importar"]',
        title: "Não digite, sobe o PDF",
        body: "Preencher vinte campos na mão é o motivo de o brandbook viver vazio, e brandbook vazio faz TODA a Cria IA sair genérica. Se você já tem manual de marca, moodboard ou até um print da sua paleta, sobe aqui: o CRIA lê e espalha cada pedaço na seção certa, cores e fontes na Identidade, tom na aba Tom de Voz, temas na Linha Editorial e o público virando uma persona. Nada é salvo sem você olhar: a tela de revisão mostra o antes e o depois onde já havia texto seu, pra você não apagar sem querer o que ajustou na mão. Custa 1 geração da sua cota da Cria IA.",
        mobileBody: "Já tem manual de marca, moodboard ou um print da sua paleta? Sobe aqui: o CRIA lê e espalha cores, fontes, tom e público nas seções certas. Você revisa antes de salvar. Custa 1 geração da Cria IA.",
        placement: "bottom",
      },
      {
        target: '[data-tour="brandbook-hub"]',
        title: "Quantas respostas faltam",
        body: "O contador mostra quantas das perguntas do brandbook você já respondeu. Cada resposta grava sozinha quando você sai do campo, e o \"Salvo\" aparece aqui do lado. Enquanto faltar alguma, o botão \"Continuar de onde parou\" logo abaixo leva direto pra próxima em branco.",
        placement: "bottom",
      },
      {
        target: '[data-tour="brandbook-abas"]',
        title: "As áreas da sua marca",
        body: "Cinco abas, na ordem em que uma marca se constrói: quem você é, identidade, linha editorial, persona e tom de voz. O número ao lado de cada uma diz quantas perguntas faltam ali. Reserve 15 minutos pra isso: é o investimento com maior retorno do CRIA, porque TUDO que a Cria IA gerar daqui pra frente usa essas respostas.",
        mobileBody: "Cinco abas: quem você é, identidade, linha editorial, persona e tom de voz. O número ao lado diz o que falta em cada uma. São 15 minutos que mudam TUDO que a Cria IA gerar daqui pra frente.",
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
      "Sua página oficial: links, produtos e destaques num endereço só pra colocar na bio. Feita no CRIA, com a sua identidade, sem pagar mais uma assinatura de Linktree.",
    benefits: [
      "Página de links com a cara da sua marca",
      "Atualize na hora, sem depender de ninguém",
      "Capture contatos e direcione seu público",
    ],
    steps: [
      {
        target: '[data-tour="bio-estilo"]',
        title: "Passo 1: o estilo",
        body: "Clássico é a lista de links direta ao ponto. Site é uma página de apresentação, com seções, produtos e blog. Trocar não apaga nada: cada um guarda o próprio conteúdo. E é aqui que você salva.",
        placement: "bottom",
      },
      {
        target: '[data-tour="bio-conteudo"]',
        title: "Passo 2: o conteúdo",
        body: "Cada pedaço da página é um bloco: link, texto, vídeo, galeria, mapa, formulário de contato. No vídeo, cole o link do YouTube, Reels, TikTok ou Vimeo, ou envie o arquivo do celular (até 90 segundos): ele toca enquadrado, com o play no meio. A galeria escolhe o formato das fotos (quadrada ou retangular em pé), e uma foto sozinha ocupa a largura toda. Escolha um modelo pronto pra começar, ou vá adicionando bloco a bloco e arrastando pra ordenar.",
        placement: "top",
      },
      {
        target: '[data-tour="bio-aparencia"]',
        title: "Passo 3: a sua cara",
        body: "Foto, nome, cores, fonte e fundo. O que você ajusta aqui vale nos dois estilos, então não precisa configurar duas vezes.",
        placement: "top",
      },
      {
        target: '[data-tour="bio-link"]',
        title: "Passo 4: seu endereço público",
        body: "Escolha seu nome no link e copie pra colar na bio do Instagram. Editou a página depois? O link continua o mesmo, sempre atualizado.",
        placement: "bottom",
      },
      {
        target: '[data-tour="bio-desempenho"]',
        title: "Passo 5: visitas e cliques",
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
      "Seu fichário de ganchos, formatos, prompts e templates. Travou no começo do post? Busca aqui pelo que você quer causar e leva pronto pro post.",
    benefits: [
      "Busca em tudo de uma vez, por palavra ou por objetivo",
      "Exemplo pronto em cada ficha",
      "Usar no post manda o gancho direto pro rascunho",
    ],
    steps: [
      {
        target: '[data-tour="biblioteca-abas"]',
        title: "As divisórias do fichário",
        body: "Hooks, Formatos, Prompts, Templates e Favoritos, com quantos tem em cada. Os seus e os do Cria ficam juntos, os seus com o selo Meu. Toque na estrela pra guardar nos Favoritos e em Usar no post pra levar o gancho pro rascunho.",
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
      "Suas publis do lead ao Pix. Cada parceria é uma pasta com cachê, prazo, entregáveis e orçamento, e o que está atrasado ou esperando pagamento aparece escrito na própria pasta.",
    benefits: [
      "Arraste a pasta pela coluna do funil",
      "Entregáveis ligados aos posts do Criando",
      "Orçamento com link pra marca e cachê lançado no Caixa",
    ],
    steps: [
      {
        target: '[data-tour="collabs-abas"]',
        title: "Funil, Lista e Histórico",
        body: "No Funil cada collab é uma pasta: arraste de Lead até Pago. Tocar na pasta abre o contrato ao lado, com os entregáveis, o orçamento e o cachê. Lista mostra tudo corrido e Histórico guarda as arquivadas.",
        mobileBody: "No Funil cada collab é uma pasta e as colunas deslizam pro lado. Toque na pasta pra abrir o contrato e mudar de coluna. Lista mostra tudo corrido e Histórico guarda as arquivadas.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "historico",
    route: "/app/historico",
    title: "Histórico",
    valueProp:
      "O que você publicou e o que deu resultado. Alcance, salvamentos, compartilhamentos e seguidores por post, pra repetir o que funciona.",
    benefits: [
      "Comparação com o período anterior",
      "O que mais funcionou, por formato, pilar e horário",
      "Reaproveite o post que já deu certo",
    ],
    steps: [
      {
        target: '[data-tour="historico-filtros"]',
        title: "Escolha o período",
        body: "90 dias, este mês, este ano ou tudo. Formato, pilar e rede aparecem quando você tem mais de um. Tudo embaixo muda junto.",
        placement: "bottom",
      },
      {
        target: '[data-tour="historico-stats"]',
        title: "O resultado, não só a quantidade",
        body: "Alcance somado, alcance médio, salvamentos e seguidores ganhos, cada um comparado com o período anterior. Mais embaixo: o pódio, onde está o seu resultado e a tabela de todos os posts.",
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
      "Tudo da sua conta numa tela: o resumo mostra como está cada coisa (Instagram, tema, plano, avisos) e um toque leva pra mudar.",
    benefits: [
      "Resumo com o estado de cada seção",
      "Busca por palavra: senha, pix, tema",
      "Conecte o Instagram pra liberar os Insights",
      "Plano, uso da Cria IA e espaço no mesmo lugar",
    ],
    steps: [
      {
        target: '[data-tour="config-abas"]',
        title: "Três grupos e uma busca",
        body: "Você (perfil, visual e hábitos), Ligações (Instagram, Drive, notificações e equipe) e Dinheiro e dados (plano e segurança). Ao lado de cada item aparece como ele está. A busca no topo acha a seção por palavra.",
        mobileBody: "Uma lista em três grupos, cada linha com o estado ao lado. Toque numa linha pra abrir a seção; o voltar no topo traz de volta pra lista. A busca acha por palavra, como senha ou pix.",
        placement: "right",
      },
      {
        target: '[data-tour="config-tab-visual"]',
        title: "Marca e visual",
        body: "Tema, cores, fonte e faixa do topo. Deixe o Cria com a cara da sua marca: você passa horas aqui dentro, que seja bonito.",
        placement: "right",
      },
      {
        target: '[data-tour="config-tab-assinatura"]',
        title: "Plano e espaço",
        body: "Seu plano, o uso da Cria IA do mês, o espaço dos arquivos e o portal pra trocar de plano ou atualizar o cartão.",
        placement: "right",
      },
      {
        target: '[data-tour="config-tab-conta"]',
        title: "Segurança",
        body: "Senha, cópia dos seus dados e exclusão da conta. Sair da conta fica separado, no fim do menu.",
        placement: "right",
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
      "A Cria IA que já conhece a sua marca. Ela lê o seu brandbook antes de responder, então legenda, ideia e roteiro saem no SEU tom, não no tom de robô genérico.",
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
        body: "Escreva à vontade aqui: Enter envia, Shift e Enter pulam linha. Cada resposta consome 1 geração da sua cota do mês, que é a MESMA cota do Cria Plano, dos prompts de arte e da leitura do brandbook em PDF. Quanto ainda resta aparece na barrinha de uso da Cria IA, no menu lateral e no Dashboard, e a cota zera no dia 1º. É assinatura, não cartão aberto: quando acaba, acaba, e você decide entre subir de plano ou esperar virar o mês.",
        mobileBody: "Escreva à vontade aqui. Cada resposta gasta 1 geração da sua cota do mês, a mesma do Cria Plano e dos prompts de arte. O saldo aparece na barrinha de uso da Cria IA e zera no dia 1º.",
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
      "A Cria IA propõe conceitos a partir das tendências e da sua marca, e monta o mês em cima do conceito que você escolher. Você revisa post por post e manda pro Criando.",
    benefits: [
      "Semana ou mês de pauta em um clique",
      "Posts já com data, hora e legenda",
      "Você aprova antes: nada entra sem seu OK",
    ],
    steps: [
      {
        target: '[data-tour="plano-config"]',
        title: "Escolha o conceito",
        body: "A Cria IA leu as tendências marcadas e a sua marca e propôs 4 conceitos, cada um com o porquê de agora e exemplos de post. Escolha um, misture dois ou escreva o seu.",
        placement: "bottom",
      },
      {
        target: '[data-tour="plano-gerar"]',
        title: "Ritmo e montar",
        body: "Período, posts por semana, onde e horário. Toque em Montar o plano: a Cria IA escreve a pauta inteira no seu tom. Preencheu o Brandbook? O resultado sobe de nível.",
        placement: "bottom",
      },
      {
        target: '[data-tour="plano-resultado"]',
        title: "Revise e envie",
        body: "Semana a semana, cada post vem com gancho e porquê. Trocar ideia refaz um post sem mexer no resto, Editar ajusta texto e data, e o quadrado tira do plano. O botão de baixo manda pro Criando.",
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
        skipIfMissing: true,
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
        target: '[data-tour="prompter-abas"]',
        title: "Três abas",
        body: "Pra gravar junta o roteiro novo que você cria aqui e os posts da fase Produzindo, o mais urgente primeiro. Gravou? Toque em Já gravei: o post anda pra Pronto e o roteiro vai pra Já gravados. Meus roteiros é a biblioteca inteira, por pasta.",
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
  // ── CRIAKUT da criadora (30/10/2026).
  { ...TOUR_CRIAKUT("criakut", "/app/criakut") },
];
