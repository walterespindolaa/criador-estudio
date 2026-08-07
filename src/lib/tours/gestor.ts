/**
 * Tours da área do gestor / social media (/socialmidia/*).
 *
 * ATENÇÃO (bug que existia aqui): todos estes tours tinham `steps: []`.
 * Resultado: o botão "?" abria o card de apresentação e ACABAVA. A pessoa lia
 * um texto bonito e não via NADA sendo apontado na tela. Era exatamente o
 * "só traz o escrito, não mostra onde é". Agora cada tela tem passos reais,
 * cada um ancorado num data-tour que existe no DOM.
 */
import type { TourConfig } from "./registry";

export const TOURS_GESTOR: TourConfig[] = [
  {
    id: "gestor-dashboard",
    route: "/socialmidia/dashboard",
    title: "O QG da sua operação",
    valueProp:
      "Aqui você enxerga a operação inteira: clientes, aprovações pendentes, o que está travado e o dinheiro entrando. É a visão de dono, não de operador.",
    benefits: [
      "Status de todos os clientes num olhar",
      "Aprovações e entregas pendentes em destaque",
      "Do caos operacional pra visão de negócio",
    ],
    steps: [
      {
        target: '[data-tour="gh-numeros"]',
        title: "Os 4 números do seu dia",
        body: "Clientes ativos, quanto entra por mês na carteira, quantos posts estão parados esperando o cliente e a sua semana. Cada card leva direto pro módulo, e a cor é a cor do módulo: rosa é Gestão, azul é Caixa, laranja é Post. O olhinho no canto some com todos os valores de uma vez, pra você abrir o painel do lado do cliente ou gravar a tela sem expor o seu faturamento.",
        mobileBody: "Clientes ativos, quanto entra por mês, posts parados esperando o cliente e a sua semana. Cada card leva pro módulo, na cor dele. O olhinho some com todos os valores de uma vez.",
        placement: "bottom",
      },
      {
        target: '[data-tour="gh-modulos"]',
        title: "Seus módulos",
        body: "Cria Post (aprovação por link), Cria Gestão (CRM) e Cria Caixa (financeiro). Módulo ativo abre na hora; módulo que você ainda não tem abre a vitrine mostrando o que ele resolve.",
        placement: "bottom",
      },
      {
        target: '[data-tour="gh-mes"]',
        title: "Visão geral do mês",
        body: "A produção de todos os clientes em número: quantos posts estão em produção, aguardando o cliente, em ajuste, aprovados e postados. As setas voltam meses pra você comparar, e embaixo aparece quantos posts você criou nos últimos 7 e 30 dias. É o termômetro de saber se a semana está entregando ou só empilhando.",
        mobileBody: "A produção de todos os clientes em número: em produção, aguardando o cliente, em ajuste, aprovados e postados. As setas voltam meses, e embaixo aparece o que você criou em 7 e 30 dias.",
        placement: "top",
      },
      {
        target: '[data-tour="gh-aprovacoes"]',
        title: "O que está travado",
        body: "As aprovações mais recentes, com há quanto tempo cada uma espera. É o seu radar de cobrança: se um cliente está sentado num post há 5 dias, você vê aqui antes de ele reclamar.",
        placement: "top",
      },
      {
        target: '[data-tour="gh-clientes"]',
        title: "Seus clientes",
        body: "Atalho pros clientes que você mais mexe. Clicou, você cai na ficha dele: brandbook, posts, cronograma, contrato e financeiro no mesmo lugar. A bolinha ao lado do nome é a saúde do cliente: verde é tudo em dia, amarelo pede atenção, vermelho é urgente, e o motivo vem escrito logo abaixo. Lá em cima, o botão “Continuar de onde parou” te devolve pro último cliente que você abriu.",
        mobileBody: "Atalho pros clientes que você mais mexe. A bolinha é a saúde dele: verde em dia, amarelo pede atenção, vermelho é urgente, com o motivo logo abaixo. Tocou, você cai na ficha completa.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-clientes",
    route: "/socialmidia/clientes",
    title: "Seus clientes",
    valueProp:
      "Cada cliente tem seu hub: brandbook, conteúdo, aprovações, contratos e financeiro. Troque de contexto em 1 clique sem se perder.",
    benefits: [
      "Tudo de cada cliente num lugar só",
      "Brandbook por cliente = IA no tom certo",
      "Histórico completo da relação",
    ],
    steps: [
      {
        target: '[data-tour="cli-novo"]',
        title: "Criar um cliente",
        body: "Nome e @ já bastam pra começar. A partir daí ele ganha ficha, posts, cronograma, contrato e financeiro. Se o cliente também usa o CRIA, a conta dele se conecta a essa ficha automaticamente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-filtros"]',
        title: "Dois tipos de cliente",
        body: "“Usa o Cria” é o cliente com conta própria (você vê o conteúdo dele e ele aprova de dentro do sistema). “Aprova por link” é o cliente que só recebe um link, sem cadastro. Você também filtra por ativos e inativos.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-grid"]',
        title: "O card já entrega o recado",
        body: "Cada card mostra quantos posts estão aguardando aprovação daquele cliente. O botão de link copia a página de aprovação dele na hora, pronta pra mandar no WhatsApp.",
        placement: "top",
      },
    ],
  },
  {
    // COCKPIT DO CLIENTE (/socialmidia/clientes/:id[/:tab]).
    // A rota tem :id, então não dá pra casar por rota exata nem por routePrefix.
    // Por isso `routePattern`: o registry compara segmento a segmento e aceita a
    // sub-página no fim, que é a mesma tela. Ver casaPadrao em registry.ts.
    id: "gestor-cliente-hub",
    route: "/socialmidia/clientes/:id",
    routePattern: true,
    title: "O cockpit do cliente",
    valueProp:
      "Tudo de um cliente num lugar só: quem é a marca, o que vai postar, o que ele já aprovou, quanto ele paga e o que o concorrente dele anda fazendo. Você atende uma pessoa sem pular de tela.",
    benefits: [
      "Os módulos do Cria dentro da ficha dele",
      "Do que postar até o relatório, na ordem certa",
      "Kanban, materiais e Drive no mesmo cockpit",
    ],
    steps: [
      {
        target: '[data-tour="cli-hero"]',
        title: "Quem é este cliente",
        body: "Foto, @ e os selos que contam o estado da relação: se o link de aprovação está ativo e quantos posts estão parados esperando ele. Clicar no selo amarelo te joga direto na Produção. O botão Cor define a cor única deste cliente, a mesma que pinta os cards dele na lista, na agenda e no calendário. E se ele usa o Cria, “Entrar no Cria dele” abre a conta dele sem passar pelo seletor lá em cima.",
        mobileBody: "Foto, @ e os selos do estado da relação: link de aprovação ativo e posts parados esperando ele. Tocar no selo amarelo leva pra Produção. O botão Cor define a cor única do cliente (a mesma da agenda e do calendário), e Entrar no Cria dele abre a conta dele direto.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-status"]',
        title: "Ativo, pausado ou encerrado",
        body: "Mudou aqui, muda na lista de clientes e no Caixa na hora. Ao escolher Inativo, o sistema pede a DATA do encerramento: a mensalidade conta até o mês dessa data e para de contar dali pra frente. Encerramento com data futura vira o selo “Encerra em DD/MM · cancelar” no topo, e cancelar o agendamento é um clique nele.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-destaques"]',
        openFirst: '[data-tour="cli-nav-visao"]',
        title: "O bate-olho do cliente",
        body: "Os Destaques resumem cada Cria com número de verdade: o que está esperando você no Post, a saúde do mês no Caixa (a receber, custo, rentabilidade) e as próximas datas do nicho dele. Os campos acima são editáveis no lugar: toca, digita, salva sozinho. O dia de pagamento é o que faz a mensalidade nascer no Caixa.",
        mobileBody: "Os Destaques resumem cada Cria com número: o que espera no Post, a saúde do mês no Caixa e as próximas datas do nicho. Os campos acima salvam sozinho, e o dia de pagamento cria a mensalidade.",
        placement: "top",
      },
      {
        target: '[data-tour="cli-hashtags"]',
        openFirst: '[data-tour="cli-nav-visao"]',
        title: "O banco de hashtags dele",
        body: "As hashtags deste cliente moram aqui: cole o bloco inteiro uma vez e nunca mais cace hashtag em post antigo. O “Copiar todas” copia o bloco pronto, e dentro do editor de post o botão “Colar hashtags” cola tudo no fim da legenda.",
        mobileBody: "As hashtags deste cliente moram aqui: cole o bloco uma vez e pronto. O Copiar todas copia tudo, e no editor de post o botão Colar hashtags cola o bloco no fim da legenda.",
        placement: "top",
      },
      {
        target: '[data-tour="cli-nav"]',
        title: "Cada aba é um Cria",
        body: "A cor não é enfeite: laranja é o Cria Post, rosa é o Cria Gestão (o brandbook da marca), azul é o Cria Caixa e lilás é o Cria Radar. É assim que você enxerga quais módulos estão trabalhando por este cliente. Aba com cadeado é módulo que ainda não está no seu plano.",
        mobileBody: "A cor não é enfeite: laranja é o Cria Post, rosa é o Cria Gestão, azul é o Cria Caixa e lilás é o Cria Radar. Arraste a tira pro lado pra ver todas. Aba com cadeado é módulo que ainda não está no seu plano.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-subnav"]',
        openFirst: '[data-tour="cli-nav-post"]',
        title: "A ordem do trabalho",
        body: "Dentro de cada Cria abrem as sub-páginas. No Cria Post o caminho é sempre o mesmo: as Ideias viram o Cronograma do mês, o Cronograma vira Posts prontos pro cliente aprovar por link, e o Relatório mostra o resultado do que foi publicado. Materiais é a demanda que não é post, e Portal é o que o cliente enxerga no link.",
        mobileBody: "Dentro de cada Cria abrem as sub-páginas. No Cria Post o caminho é sempre o mesmo: Ideias viram Cronograma, o Cronograma vira Posts pro cliente aprovar, e o Relatório mostra o resultado.",
        placement: "bottom",
      },
      {
        // O card "Kanban do cliente" é CONDICIONAL duas vezes: só existe na landing
        // do Cria Post (a grade de cards) e só pra cliente com conta Cria vinculada.
        // Por isso o openFirst clica no Cria Post antes de procurar: se a pessoa já
        // estava numa sub-página (Produção, Cronograma...), a grade não está montada
        // e o passo cairia no modo "sem alvo". Pra cliente sem conta Cria o card não
        // existe mesmo, e o texto abaixo continua fazendo sentido nesse caso.
        // Card duplamente condicional: só na landing do Cria Post e só pra cliente
        // com conta Cria. Sem o alvo, o passo sai do tour em vez de virar card solto.
        skipIfMissing: true,
        target: '[data-tour="cli-kanban"]',
        openFirst: '[data-tour="cli-nav-post"]',
        title: "O quadro dele, ao vivo",
        body: "Quando o cliente tem conta no Cria, aparece aqui o card Kanban do cliente, que abre o quadro REAL dele dentro do seu painel. Editar um post ou arrastar de coluna mexe no Cria dele na hora, não é cópia nem espelho. Serve pra você adiantar o trabalho sem pedir login e sem trocar de conta. Cliente que só aprova por link não tem esse card.",
        mobileBody: "Cliente com conta no Cria ganha o card Kanban do cliente, que abre o quadro REAL dele aqui dentro. Mexeu aqui, mexeu no Cria dele. Cliente que só aprova por link não tem esse card.",
        placement: "bottom",
      },
      {
        // Os passos da PRODUÇÃO só existem com Cria Post ativo pro cliente: o
        // openFirst clica no card/pílula "Produção" e, sem o quadro montado
        // (módulo travado ou Cria Post desativado), o passo sai do tour.
        skipIfMissing: true,
        target: '[data-tour="prod-ferramentas"]',
        openFirst: '[data-tour="cli-sub-posts"]',
        title: "Kanban ou Calendário",
        body: "A Produção tem duas visões que conversam: o kanban por status e o Calendário do mês, com cada formato na própria cor. Logo abaixo, o alternador “Ordem manual | Por data” reordena cada coluna pela data agendada. E o Novo post nasce aqui, já em Produção, sem ir pro cliente antes da hora.",
        mobileBody: "A Produção tem duas visões que conversam: o kanban por status e o Calendário do mês, com cada formato na própria cor. O alternador Ordem manual | Por data reordena as colunas pela data agendada.",
        placement: "bottom",
      },
      {
        // Quadro só existe com posts na fila (fila vazia mostra o convite de criar).
        skipIfMissing: true,
        target: '[data-tour="prod-quadro"]',
        openFirst: '[data-tour="cli-sub-posts"]',
        title: "Da produção à publicação",
        body: "Cinco colunas contam a vida do post: Em produção, Aguardando cliente, Ajuste, Aprovado e Postado. Arraste o card pra mudar o status e troque a data direto no card, sem abrir. Dentro do post cabem vários links de Ideia/Referência, e as etiquetas internas do topo são só suas: o cliente nunca vê, e elas viram filtro aqui na fila.",
        mobileBody: "Cinco colunas contam a vida do post: Em produção, Aguardando cliente, Ajuste, Aprovado e Postado. Arraste o card pra mudar o status e troque a data direto no card. As etiquetas internas são só suas: o cliente nunca vê.",
        placement: "top",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="mat-quadro"]',
        openFirst: '[data-tour="cli-sub-materiais"]',
        title: "Materiais: a demanda que não é post",
        body: "Flyer, apresentação, arte avulsa: o que o cliente pede pelo portal cai em Solicitado, e você arrasta pelo ⠿ até Finalizado. Material com prazo aparece na Agenda junto com o resto da semana, então nada fica esquecido no caminho.",
        mobileBody: "Flyer, apresentação, arte avulsa: o que o cliente pede pelo portal cai em Solicitado, e você arrasta pelo ⠿ até Finalizado. Material com prazo aparece na Agenda junto com o resto da semana.",
        placement: "top",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="rel-card"]',
        openFirst: '[data-tour="cli-sub-relatorio"]',
        title: "O relatório que fecha o mês",
        body: "Daqui sai o relatório do cliente: o funil completo da produção com os Publicados como número principal, a comparação contra o período anterior e o destaque do período. Vira um PDF com análise da IA, pronto pra enviar e provar o seu trabalho.",
        mobileBody: "Daqui sai o relatório do cliente: o funil da produção com os Publicados como número principal, comparação contra o período anterior e o destaque do período. Vira um PDF pronto pra enviar.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="portal-config"]',
        openFirst: '[data-tour="cli-sub-portal"]',
        title: "O que o cliente enxerga",
        body: "O Portal é a página que o cliente abre pelo link: logo, cor e quais abas ele vê, tudo se ajusta aqui. E se a parceria acabar de vez, o “Excluir do Cria Post (mantém o CRM)” apaga o portal e os posts, mas a ficha e o histórico do cliente continuam com você.",
        mobileBody: "O Portal é a página que o cliente abre pelo link: logo, cor e quais abas ele vê. O Excluir do Cria Post apaga o portal, mas mantém a ficha e o histórico no CRM.",
        placement: "top",
      },
      {
        // O banco de ideias mora no Cria Radar. Este passo abre a landing do
        // Radar (o card Ideias existe sempre; é a Pesquisa que depende do HUB).
        target: '[data-tour="cli-sub-ideias"]',
        openFirst: '[data-tour="cli-nav-radar"]',
        title: "O banco de ideias dele",
        body: "Tudo que inspira este cliente num lugar só: o que você anota, o que ele escreveu na conta dele, o que ele salvou e o que a IA tirou dos concorrentes.",
        placement: "bottom",
      },
      {
        // A captura só está montada dentro da sub-página Ideias; o openFirst
        // clica no card que o passo anterior deixou na tela. Se algo mudar de
        // lugar, o passo sai do tour em vez de virar card solto.
        skipIfMissing: true,
        target: '[data-tour="cli-ideias-captura"]',
        openFirst: '[data-tour="cli-sub-ideias"]',
        title: "Anote agora, converta depois",
        body: "Veio uma ideia no meio do dia? Escreve e aperta Enter. Quando for a hora, o “Virar post” cria o rascunho na Produção e o “Cronograma” manda direto pro calendário do mês. A ideia aproveitada não some: fica no histórico apontando pra onde foi.",
        mobileBody: "Veio uma ideia? Escreve e toca no +. Depois, “Virar post” cria o rascunho na Produção e “Cronograma” manda pro calendário do mês. A aproveitada fica no histórico apontando pra onde foi.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-links"]',
        title: "Links úteis e as pastas do Drive",
        body: "Este botão abre os links salvos do cliente de qualquer aba: Drive, captação, materiais. Na aba Links úteis lá em cima você cadastra rótulo e URL, e o conteúdo de cada pasta do Google Drive aparece listado logo abaixo. Pra listar, a pasta precisa estar compartilhada como “qualquer pessoa com o link pode ver”.",
        mobileBody: "Este botão abre os links salvos do cliente de qualquer aba. Na aba Links úteis você cadastra rótulo e URL, e o conteúdo de cada pasta do Drive aparece listado (a pasta precisa ser pública por link).",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-agenda",
    route: "/socialmidia/agenda",
    title: "Agenda de criação",
    valueProp:
      "O calendário de todos os clientes junto: o que sai hoje, o que grava amanhã, o que falta aprovar. Sua semana de produção sem sobreposição.",
    benefits: [
      "Visão multi-cliente do calendário",
      "Nunca mais dois clientes esperando no mesmo dia",
      "Planejamento de produção realista",
    ],
    steps: [
      {
        target: '[data-tour="ag-quadro"]',
        title: "A semana inteira, todos os clientes",
        body: "Cada coluna é um dia. Os posts de todos os clientes aparecem juntos, com a cor do cliente. Pra mover, pegue o card pelo ⠿ (o punho no canto esquerdo) e solte no outro dia: a data muda de verdade, no post. Clicar no card abre, arrastar é só pelo ⠿. E clicar num espaço vazio e puxar pro lado rola a semana inteira.",
        mobileBody: "Cada coluna é um dia e você arrasta a tira pro lado pra ver a semana. Os posts de todos os clientes aparecem juntos, com a cor de cada um. Pra mover, segure o ⠿ do card (não o card inteiro) e solte no outro dia: a data muda de verdade.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-filtros"]',
        title: "Sete tipos, um quadro só",
        body: "A agenda junta tudo que tem data: Criações (o cronograma), Tarefas, Captações, Posts (o Cria Post, que você edita aqui), Cria do cliente (o que ele montou na conta dele, só leitura), Materiais com prazo e Aniversários. Cada tipo tem a própria cor, e desligar um chip limpa o quadro na hora.",
        mobileBody: "A agenda junta tudo que tem data: Criações, Tarefas, Captações, Posts, Cria do cliente (só leitura), Materiais com prazo e Aniversários. Cada tipo tem a própria cor, e desligar um chip limpa o quadro na hora.",
        placement: "bottom",
      },
      {
        // A faixa só existe quando há cliente com Cria Post ativo.
        skipIfMissing: true,
        target: '[data-tour="ag-cliente-filtro"]',
        title: "Só um cliente na tela",
        body: "Semana cheia demais? Abra esta faixa e escolha um ou mais clientes: a agenda esconde o resto. É o jeito de revisar a semana de UM cliente antes da reunião com ele.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-navegacao"]',
        title: "Semana ou mês",
        body: "Semana é pra executar (o que grava, o que sai). Mês é pra planejar (a distribuição do conteúdo). O botão Hoje traz você de volta pro presente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-periodos"]',
        title: "Manhã, tarde e noite",
        body: "Ligue o alternador Períodos e cada dia se divide em três faixas: manhã, tarde e noite. Arrastar um card de uma faixa pra outra muda o período dele de verdade. Só existe na visão Semana; o Mês não tem faixas.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-relatorio"]',
        title: "Quanto você produziu",
        body: "O Relatório fecha a conta da semana ou do mês: posts, criações, tarefas, captações e materiais, com comparação contra o período anterior e o ranking de qual cliente consumiu mais produção. É o número que diz se a operação está entregando ou só empilhando.",
        mobileBody: "O Relatório fecha a conta da semana ou do mês, com comparação contra o período anterior e o ranking de qual cliente consumiu mais produção. É o número que diz se a operação está entregando.",
        placement: "bottom",
      },
      {
        // A faixa só existe quando há post sem data esperando pra ser agendado.
        skipIfMissing: true,
        target: '[data-tour="ag-producao"]',
        title: "Em produção, sem data",
        body: "Post que ainda não tem dia fica nesta faixa em cima, em vez de sumir do calendário. Pegue pelo ⠿ e solte num dia pra agendar; arraste de volta pra cá e a data sai (o status continua o mesmo). A setinha recolhe a faixa quando ela estiver cheia demais.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-captacoes"]',
        title: "Captações",
        body: "O dia de gravação: data, hora, local, equipe e qual cliente. É o que evita marcar duas captações no mesmo dia e descobrir na véspera.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-aprovacoes",
    route: "/socialmidia/aprovacoes",
    title: "Central de aprovações",
    valueProp:
      "Tudo que está parado na mão dos clientes, de TODOS eles, numa fila só. Você para de abrir cliente por cliente pra descobrir quem não respondeu.",
    benefits: [
      "As quatro filas de pendência num lugar",
      "Cada linha leva direto pra onde se resolve",
      "O que está parado há mais tempo fica à vista",
    ],
    steps: [
      {
        target: '[data-tour="aprov-cards"]',
        title: "Quatro tipos de pendência",
        body: "Cria Post é o que o cliente aprova pelo link. Cronogramas são os planejamentos que você mandou e ele ainda não respondeu. Conteúdo de clientes é o post que quem tem conta no Cria montou e está esperando a sua revisão. Materiais são pedidos que o cliente fez pra você. O número é quanta coisa está parada em cada fila, e clicar no card filtra a lista de baixo só naquele tipo.",
        mobileBody: "Cria Post é o que o cliente aprova por link. Cronogramas são os planejamentos sem resposta. Conteúdo de clientes espera a sua revisão. Materiais são pedidos pra você. Tocar no card filtra a lista.",
        placement: "bottom",
      },
      {
        target: '[data-tour="aprov-filtros"]',
        title: "Uma fila de cada vez",
        body: "As pílulas fazem o mesmo filtro dos cards. Servem pra quando você senta pra resolver UMA coisa só, tipo cobrar todos os cronogramas parados de uma vez, em vez de ficar pulando de assunto a cada linha.",
        placement: "bottom",
      },
      {
        target: '[data-tour="aprov-lista"]',
        title: "A fila, do mais novo pro mais velho",
        body: "Aqui só aparece o que ainda está pendente: aprovou, some da lista. Cada linha mostra o cliente e o tipo, e clicar leva direto pra tela onde você resolve. A etiqueta laranja Ajuste é o post que voltou com pedido de mudança, ou seja, a bola está com VOCÊ, não com o cliente. E como a ordem é do mais recente pro mais antigo, o fim da lista é o que está parado há mais tempo: é ali que mora a cobrança que você precisa fazer hoje.",
        mobileBody: "Aqui só fica o que está pendente: aprovou, some. Cada linha leva pra tela onde você resolve. A etiqueta laranja Ajuste é bola com VOCÊ. O fim da lista é o que espera há mais tempo.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-hubcria",
    route: "/socialmidia/hubcria",
    title: "Cria Radar",
    valueProp:
      "Análise de concorrentes por cliente + ideias sugeridas pro nicho dele. Você chega na reunião de pauta com inteligência, não com achismo.",
    benefits: [
      "Acompanhe os concorrentes de cada cliente",
      "Ideias baseadas no que funciona no nicho",
      "Pauta pronta sem stalkear manualmente",
    ],
    steps: [
      {
        target: '[data-tour="hub-clientes"]',
        title: "Quem precisa de atenção",
        body: "O HUB puxa pra cima o cliente que precisa de você: sem concorrente no radar, análise esfriando ou pautas prontas que ninguém abriu. Clicou no card, você cai na pesquisa daquele cliente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hub-avulsa"]',
        title: "Espiar quem não é cliente",
        body: "Uma prospecção, uma referência de outro nicho? Rode a análise avulsa aqui. Ela fica guardada no HUB, sem entrar na ficha de ninguém.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-criapost",
    route: "/socialmidia/criapost",
    routePrefix: true,
    title: "Cria Post, aprovação por link",
    valueProp:
      "O cliente recebe um link, vê o post como vai ficar, aprova ou comenta. Com histórico. Cabou áudio de 4 minutos e print riscado no WhatsApp.",
    benefits: [
      "Cliente aprova sem precisar de conta",
      "Comentários no lugar certo, com registro",
      "Você sabe quem aprovou o quê, e quando",
    ],
    steps: [
      {
        target: '[data-tour="hero-tabs"]',
        title: "As duas seções do Cria Post",
        body: "Aprovações mostra tudo que está na mão dos clientes: o que está esperando, o que voltou com ajuste, o que já foi aprovado. Calendário geral junta os posts de todos os clientes num mês só, cada formato com a própria cor.",
        mobileBody: "Aprovações mostra tudo que está na mão dos clientes: o que espera, o que voltou com ajuste, o que foi aprovado. Calendário geral junta os posts de todos os clientes num mês só, cada formato com a própria cor.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero-actions"]',
        title: "Os posts moram no cliente",
        body: "Pra criar ou editar post, você entra no cliente. Este botão te leva pra lá. Lá dentro sai o link de aprovação: público, sem senha, o cliente abre no celular, vê a arte e a legenda, e aprova ou pede ajuste, e você é avisado na hora.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-criacrm",
    route: "/socialmidia/criacrm",
    routePrefix: true,
    title: "Cria Gestão, seu CRM",
    valueProp:
      "Do lead ao contrato assinado: pipeline de prospecção, ficha do cliente, propostas e contratos. Sua operação comercial sai do improviso.",
    benefits: [
      "Pipeline visual: prospect → proposta → fechado",
      "Propostas enviadas direto da negociação",
      "Contratos organizados com vencimento à vista",
    ],
    steps: [
      {
        target: '[data-tour="hero-tabs"]',
        title: "As seções do Cria Gestão",
        body: "Clientes é a carteira. Pipeline é a venda: o lead avança arrastando o card de coluna em coluna, e o quadro rola pro lado. Tarefas é o que fazer por cliente, em Kanban ou Calendário (o alternador fica no topo da aba). Calendário junta tudo na semana, e Contratos guarda o que foi assinado, com vencimento.",
        mobileBody: "Arraste essa tira pro lado pra ver todas as seções. Clientes é a carteira. Pipeline é a venda, arrastando o card. Tarefas é o que fazer por cliente, em Kanban ou Calendário. Contratos guarda o assinado, com vencimento.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero"]',
        title: "Tudo pendura na ficha do cliente",
        body: "Tarefa, proposta, contrato, brandbook e financeiro nascem colados no cliente. Por isso vale cadastrar direito uma vez: depois é só ir pendurando, e a ficha vira o histórico inteiro da relação.",
        placement: "bottom",
      },
    ],
  },
  {
    // FICHA DO CLIENTE NO CRM (/socialmidia/criacrm/:id).
    // Tela DIFERENTE do cockpit (/clientes/:id): aqui mora o dossiê comercial e
    // estratégico da marca. Ela continua em uso: o card da carteira, o Cria Caixa
    // e o próprio cockpit ("Ficha completa (CRM)") mandam pra cá.
    // Usa `routePattern` porque a rota tem :id. O curinga do registry só aceita
    // segmento que pareça id, então /criacrm/tarefas e /criacrm/pipeline continuam
    // caindo no tour do módulo, e não neste.
    id: "gestor-crm-cliente",
    route: "/socialmidia/criacrm/:id",
    routePattern: true,
    title: "A ficha do cliente",
    valueProp:
      "O dossiê da marca: contrato, contato, brandbook, persona, diagnóstico e concorrência. É daqui que sai o contexto pra IA escrever no tom desse cliente e pra sua equipe não inventar.",
    benefits: [
      "Contrato, valores e contato num lugar só",
      "Brandbook e persona alimentam a IA do cliente",
      "Salva sozinho, você só digita",
    ],
    steps: [
      {
        target: '[data-tour="crm-cli-hero"]',
        title: "Quem é e quanto vale",
        body: "Foto, nome, @ e a régua de baixo com o valor mensal, desde quando ele é cliente, a renovação e a nota do diagnóstico. Não existe botão obrigatório de salvar: tudo aqui salva sozinho pouco depois que você para de digitar, e o aviso do topo mostra Salvando e Salvo. Se esse cliente também usa o Cria, o botão Abrir no cria entra na conta dele sem passar pelo seletor de contas.",
        mobileBody: "Foto, nome, @ e a régua com valor mensal, início, renovação e nota do diagnóstico. Não tem botão de salvar: tudo salva sozinho, e o aviso do topo mostra Salvando e Salvo.",
        placement: "bottom",
      },
      {
        target: '[data-tour="crm-cli-status"]',
        title: "Ativo, pausado ou inativo",
        body: "Ao marcar Inativo, o sistema pede a DATA do encerramento. Não é burocracia: a mensalidade dele conta no Cria Caixa até o mês dessa data e para de contar dali pra frente. É o que evita cliente que já saiu continuar inflando o seu faturamento.",
        placement: "bottom",
      },
      {
        target: '[data-tour="crm-cli-abas"]',
        title: "As seis seções da ficha",
        body: "Resumo tem empresa, contato e comercial. Tarefas é o que fazer por esse cliente. Brandbook é a marca dele. Persona é pra quem ele fala (até 3). Diagnóstico é a nota do perfil hoje, pra você mostrar evolução depois. Concorrência guarda quem você acompanha e as análises que o Cria Radar já rodou.",
        mobileBody: "Arraste a tira pro lado pra ver todas. Resumo tem empresa, contato e comercial. Tarefas é o que fazer por ele. Brandbook é a marca. Persona é pra quem ele fala. Diagnóstico é a nota do perfil hoje.",
        placement: "bottom",
      },
      {
        target: '[data-tour="crm-cli-brand"]',
        openFirst: '[data-tour="crm-cli-tab-brand"]',
        title: "O brandbook é o que faz a IA acertar",
        body: "Esta é a aba que mais muda o resultado: ideia, legenda, roteiro e prompt de arte desse cliente nascem daqui. Se você já tem o moodboard dele em PDF, não digite nada: sobe o arquivo, o Cria lê cores, fontes, tom de voz e direção de arte, e você só confere antes de salvar. Se o cliente usa o Cria, o brandbook vem sincronizado da conta dele. E nos campos de texto o ícone de microfone existe pra você ditar em vez de escrever.",
        mobileBody: "É a aba que mais muda o resultado: ideia, legenda, roteiro e arte desse cliente nascem daqui. Tem o moodboard em PDF? Sobe que o Cria lê sozinho. Nos campos de texto dá pra ditar pelo microfone.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-criacaixa",
    route: "/socialmidia/criacaixa",
    routePrefix: true,
    title: "Cria Caixa, seu financeiro",
    valueProp:
      "Cachês, mensalidades, MRR e inadimplência num painel. Você sabe quanto entra, quando entra e quem está atrasado, sem abrir planilha.",
    benefits: [
      "MRR e previsão de faturamento",
      "Alerta de cobrança e reajuste esquecidos",
      "O dinheiro fecha o ciclo da operação",
    ],
    steps: [
      {
        target: '[data-tour="hero"]',
        title: "Empresa e Pessoal, separados",
        body: "Aqui em cima você troca entre o dinheiro da EMPRESA (o que os clientes pagam, os custos, o imposto) e o seu dinheiro PESSOAL (contas fixas, gastos, reserva). Nunca mais misturar os dois é metade do trabalho.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero-tabs"]',
        title: "As seções do Caixa",
        body: "Visão geral é o resumo do mês: o que já entrou, o que falta entrar e quanto separar de imposto. Clientes mostra receita, custo e margem de cada um. Calendário mostra o que vence em cada dia. Mensalidades traz as cobranças da carteira, e é lá dentro, na sub-aba Lançamentos, que você registra entrada e despesa. Relatórios fecha o período. Cliente que saiu você inativa com a data de encerramento: a mensalidade dele para de contar a partir dali.",
        mobileBody: "Arraste a tira pro lado pra ver todas. Visão geral é o resumo do mês. Clientes mostra a margem de cada um. Calendário mostra o que vence no dia. Mensalidades traz as cobranças, com Lançamentos dentro.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-equipe",
    route: "/socialmidia/equipe",
    title: "Equipe",
    valueProp:
      "Convide colaboradores, defina o que cada um acessa e distribua a operação sem perder o controle do todo.",
    benefits: [
      "Acessos por colaborador",
      "Cada um vê só o que precisa",
      "A operação escala sem virar bagunça",
    ],
    steps: [
      {
        target: '[data-tour="eq-assentos"]',
        title: "Assentos",
        body: "O 1º colaborador é grátis. A partir do 2º, cada assento é R$ 29,90/mês. Você compra e libera quando quiser, sem falar com ninguém.",
        placement: "bottom",
      },
      {
        target: '[data-tour="eq-convidar"]',
        title: "Convidar com o acesso certo",
        body: "No convite você escolhe QUAIS MÓDULOS e QUAIS CLIENTES a pessoa acessa. O designer vê só os posts dos clientes dele; ninguém esbarra no seu financeiro.",
        placement: "bottom",
      },
    ],
  },
  // ── BACK-OFFICE ──────────────────────────────────────────────────────────
  // Telas de bastidor (não é operação de cliente): programa de indicação e as
  // contas que o seu plano paga. Ficam de fora do TRAINING_SEQUENCES pra não
  // esticar o tour completo com assunto que não é o dia a dia.
  // Comissões não tem tour próprio: quem não é parceira é redirecionada pra
  // Parceria, e a tela em si é só a lista de indicações, explicada no passo 2 aqui.
  {
    id: "gestor-parceria",
    route: "/socialmidia/parceria",
    title: "Parceria: indique e ganhe",
    valueProp:
      "Você já recomenda o Cria pros seus clientes. Com o cupom de parceira, essa indicação vira comissão recorrente em vez de favor.",
    benefits: [
      "Um cupom só seu pra compartilhar",
      "Comissão todo mês, enquanto o indicado for assinante",
      "Acompanhamento de cada indicação e do que já liberou",
    ],
    steps: [
      {
        target: '[data-tour="parceria-programa"]',
        title: "Como funciona",
        body: "Você ganha um código próprio. Quem assina com ele entra pela sua mão, e você recebe comissão TODO mês enquanto essa pessoa continuar assinante, não só na primeira venda. Dependendo do cupom, o cliente ainda entra com desconto, e aí a conversa fica bem mais fácil.",
        mobileBody: "Você ganha um código próprio. Quem assina com ele te dá comissão TODO mês enquanto continuar assinante, não só na primeira venda. Dependendo do cupom, o cliente ainda entra com desconto.",
        placement: "bottom",
      },
      {
        target: '[data-tour="parceria-acao"]',
        title: "Do cadastro ao cupom na mão",
        body: "O cadastro passa por uma aprovação nossa, e enquanto isso a tela mostra Em análise. Aprovada, o seu cupom aparece aqui com o botão de copiar, pronto pra colar no WhatsApp. Depois é na tela Comissões que você acompanha cada indicação e o valor: a comissão libera quando o cliente paga a 2ª fatura, que é a trava contra indicação que cancela na semana seguinte.",
        mobileBody: "O cadastro passa por aprovação nossa e mostra Em análise. Aprovada, o cupom aparece aqui com botão de copiar. Em Comissões você acompanha cada indicação, que libera na 2ª fatura paga.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-contas",
    route: "/socialmidia/contas",
    title: "Suas contas de cliente",
    valueProp:
      "Aqui você paga assentos pra dar o Cria pro seu cliente. Ele usa a conta completa sem pagar nada, e você trabalha por dentro dela.",
    benefits: [
      "Assento é uma conta de cliente, cobrada por mês",
      "O cliente entra sem pagar e sem burocracia",
      "Você acompanha e entra na conta dele quando precisa",
    ],
    steps: [
      {
        target: '[data-tour="contas-assentos"]',
        title: "Assento é uma conta de cliente",
        body: "A barra mostra quantos assentos você tem e quantos já estão ocupados. Adicionar cliente cria a conta na hora: ele recebe um e-mail pra escolher a senha e ganha um Studio completo por sua conta. Se acabarem os assentos, Expandir compra mais, e a cobrança é por assento, todo mês. Cliente que saiu você pausa, e o assento dele volta pra fila em vez de você pagar por conta parada.",
        mobileBody: "A barra mostra quantos assentos você tem e quantos estão ocupados. Adicionar cliente cria a conta na hora e ele ganha um Studio por sua conta. Cliente que saiu você pausa e o assento volta pra fila.",
        placement: "bottom",
      },
      {
        target: '[data-tour="contas-clientes"]',
        title: "As contas que você gerencia",
        body: "Cada cliente aqui é uma conta de verdade, com kanban, brandbook e calendário próprios, e você entra nela pra adiantar o trabalho sem pedir login. Logo abaixo, o bloco Assinar pra mim é pra você ter a SUA conta de criadora: tem que ser num e-mail diferente do de gestora, senão o Cria não consegue separar as duas.",
        mobileBody: "Cada cliente aqui é uma conta de verdade, com kanban e brandbook próprios, e você entra nela sem pedir login. O bloco Assinar pra mim exige um e-mail diferente do de gestora.",
        placement: "top",
      },
    ],
  },
  {
    // LIXEIRA DO GESTOR (/socialmidia/lixeira). Mesma tela do criador (o
    // componente é compartilhado, com os mesmos data-tour), mas a rota é outra
    // e o findTourByRoute não cruza as áreas: sem este config, o "?" da lixeira
    // do gestor dizia "tutorial em breve". Fica fora do TRAINING_SEQUENCES,
    // igual à do criador: é rede de segurança, não operação do dia a dia.
    id: "gestor-lixeira",
    route: "/socialmidia/lixeira",
    title: "Lixeira",
    valueProp:
      "Excluiu um post ou um cliente sem querer? Respira. Tudo que você apaga fica aqui por 30 dias antes de sumir de vez.",
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
        // A lista só existe quando há item excluído; lixeira vazia pula o passo.
        skipIfMissing: true,
        target: '[data-tour="lixeira-itens"]',
        title: "Restaurar ou apagar",
        body: "Cada item mostra quantos dias faltam. Restaurar devolve pro lugar de origem. O X apaga de vez, e só depois de você confirmar.",
        placement: "bottom",
      },
    ],
  },
];
