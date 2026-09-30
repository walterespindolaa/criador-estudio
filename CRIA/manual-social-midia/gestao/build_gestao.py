exec(open('/home/claude/msm/gestao/_base.py').read())
MAN = 'Manual Cria Gestão · Social Mídia'

# ── 1. Capa ─────────────────────────────────────────────────────────────
pagina('''
  <div class="topo" style="background:#C22A73">
    <div class="b1" style="background:#E0559A"></div><div class="b2" style="background:var(--amarelo);bottom:-56mm;left:-30mm"></div><div class="b3" style="background:var(--laranja)"></div>
    <img class="logo" src="logo-cria-white.png" alt="Cria">
    <img class="criatura" src="criatura-lampada.png" alt="">
    <div class="titulo">
      <div class="sobre">CRIA SOCIAL CLUB · MANUAL DA SOCIAL MÍDIA</div>
      <h1>Cria Gestão</h1>
      <p>O CRM de quem vive de social mídia: carteira, ficha completa do cliente, tarefas, pipeline de novos clientes, contratos e link na bio.</p>
    </div>
  </div>
  <div class="baixo">
    <div class="txt">
      <h3>Pra quem quer tratar a operação como empresa</h3>
      <p class="muted">Saber quanto entra por mês, quem está pra fechar, o que falta fazer por cliente e ter a marca de cada um documentada. Sem planilha, sem caderno, sem depender da memória.</p>
      <div class="pilulas">
        <span style="background:#E9559A">Carteira</span>
        <span style="background:var(--laranja)">Brandbook</span>
        <span style="background:var(--azul)">Pipeline</span>
        <span style="background:var(--verde)">Contratos</span>
      </div>
      <p class="small muted" style="margin-top:6mm">Versão 1.0 · 30 de setembro de 2026 · app.criasocialclub.com.br<br>Manual do módulo. O que é da conta toda (Início, Clientes, Agenda, Equipe) está no Manual Geral.</p>
    </div>
    <img class="selo" src="selo-social-club-verde.png" alt="">
  </div>''', 'capa')

# ── 2. Em 1 minuto ──────────────────────────────────────────────────────
pagina(abre('rosa', 'COMECE AQUI', 'O Cria Gestão em 1 minuto',
  'Todo cliente começa como lead, vira cliente com contrato e ganha uma ficha com a marca documentada. O resto do Cria lê dessa ficha.') + '''
  <h3>O caminho de todo cliente</h3>
  <div class="fluxo" style="margin-bottom:6mm">
    <div class="et"><span class="chip novo">Lead</span><div class="t">Prospecta</div><div class="d">No pipeline</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip fazendo">Fechado</span><div class="t">Fecha</div><div class="d">Vira cliente e contrato</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip amar">Ficha</span><div class="t">Documenta</div><div class="d">Brandbook e persona</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip entregue">Rotina</span><div class="t">Organiza</div><div class="d">Tarefas e calendário</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip ajuste">Bio</span><div class="t">Capta</div><div class="d">Link na bio com leads</div></div>
  </div>
  <h3>Por que vale a pena</h3>
  <div class="duo" style="margin-bottom:5mm">
    <div class="card"><h4>A ficha alimenta o resto</h4><p class="small">O brandbook e a persona que você preenche aqui são o que a IA do Cria usa pra escrever pelo cliente e o que vai no briefing de arte pro designer.</p></div>
    <div class="card"><h4>Fechou, já está tudo pronto</h4><p class="small">Arrastou o lead pra Fechado: ele vira cliente na carteira e ganha contrato, e a mensalidade passa a contar no Caixa.</p></div>
    <div class="card"><h4>O cliente preenche por você</h4><p class="small">Mande um link e ele mesmo completa CNPJ, endereço, responsável e conta do negócio. Você só confere.</p></div>
    <div class="card"><h4>Contrato em minutos</h4><p class="small">Um modelo de prestação de serviços de social mídia que se preenche com os dados do cliente e sai em PDF.</p></div>
  </div>
  <h3>O que tem neste manual</h3>
  <div class="indice">
    <div class="it"><span class="n bg-rosa">1</span><div><b>Carteira e ficha</b><span>seus clientes e tudo sobre cada um</span></div></div>
    <div class="it"><span class="n bg-laranja">2</span><div><b>Brandbook e persona</b><span>a marca documentada</span></div></div>
    <div class="it"><span class="n bg-azul">3</span><div><b>Tarefas e calendário</b><span>o que falta fazer, por cliente</span></div></div>
    <div class="it"><span class="n bg-verde">4</span><div><b>Pipeline, metas e contratos</b><span>crescer a carteira</span></div></div>
    <div class="it"><span class="n bg-lilas">5</span><div><b>Link na bio</b><span>a página de cada cliente</span></div></div>
    <div class="it"><span class="n bg-rosa">6</span><div><b>Sincronia e rotina</b><span>pra onde vai cada dado</span></div></div>
  </div>
  <p class="small muted" style="margin-top:4mm">Os nomes, fotos, contatos e valores das telas deste manual são fictícios. As telas são do sistema de verdade.</p>
''')

# ── 3. Carteira ─────────────────────────────────────────────────────────
crop('g-cart', 'm01-clientes', (0.085, 0.115, 0.985, 0.75))
pagina(abre('rosa', '1 · CARTEIRA E FICHA', 'A carteira de clientes',
  'No menu, Cria Gestão. A primeira aba é a sua carteira: cada cliente com o valor mensal e como ele trabalha com você.') +
  fig('g-cart', [(0.522, 0.215), (0.76, 0.261), (0.93, 0.24), (0.2, 0.301), (0.745, 0.301), (0.895, 0.285), (0.895, 0.349), (0.245, 0.365), (0.26, 0.434)]) +
  leg(['<b>As abas do módulo:</b> clientes, tarefas, calendário, pipeline, metas, contratos e link na bio.',
       '<b>Importar do Cria:</b> traz um cliente que já usa o Cria.',
       '<b>Novo cliente</b> na mão.',
       '<b>Busca</b> por nome.',
       '<b>Ativos, todos ou inativos.</b>',
       '<b>Filtro</b> por segmento e situação.',
       '<b>Valor mensal</b> do cliente.',
       '<b>Selo "cria":</b> esse cliente tem conta no Cria.',
       '<b>Abrir no Cria:</b> entra na conta dele.']) +
  dica('<b>Clique no card pra abrir a ficha.</b> É nela que mora tudo sobre o cliente: dados, valor, brandbook, persona, diagnóstico e as tarefas dele.'))

# ── 4. Ficha ────────────────────────────────────────────────────────────
crop('g-ficha', 'm09-ficha', (0.085, 0.11, 0.985, 0.93))
pagina('<h2 style="margin-bottom:1.5mm">A ficha do cliente</h2><p class="muted" style="margin-bottom:4mm">Salva sozinha enquanto você digita. O botão Salvar é só pra confirmar na hora.</p>' +
  fig('g-ficha', [(0.353, 0.24), (0.755, 0.178), (0.19, 0.292), (0.522, 0.39), (0.27, 0.587), (0.265, 0.655), (0.245, 0.727)]) +
  leg(['<b>Situação, segmento e etiquetas.</b> Inativar tira o cliente da receita.',
       '<b>Salva automático.</b>',
       '<b>Valor mensal, cliente desde, renovação e diagnóstico</b> num olhar.',
       '<b>As abas da ficha:</b> resumo, tarefas, brandbook, persona, diagnóstico e concorrência.',
       '<b>Peça os dados pro cliente:</b> gera um link pra ele preencher.',
       '<b>Link na bio</b> desse cliente, a um clique.',
       '<b>Informações gerais:</b> razão social, CNPJ, responsável, contato, endereço.']) +
  '<p class="small" style="margin-top:2mm">Descendo: aniversário (vira lembrete no calendário), cor do cliente (pinta o card na agenda), contato, <b>valor mensal, dia e forma de pagamento</b> e as datas do contrato.</p>' +
  dica('<b>O link de dados é seguro pra mandar.</b> O cliente vê só os campos do cadastro. Valor, vencimento e multa não aparecem. O que ele responde só entra nos campos que estão vazios; pra trocar o que você já tinha, existe o botão de sobrescrever.'))

# ── 5. Brandbook e persona ──────────────────────────────────────────────
crop('g-bb', 'm10-brandbook', (0.085, 0.415, 0.985, 0.82))
crop('g-per', 'm11-persona', (0.085, 0.415, 0.985, 0.8))
pagina(abre('laranja', '2 · BRANDBOOK E PERSONA', 'A marca do cliente, documentada',
  'O que você escreve aqui é o que a IA usa pra falar como o cliente e o que vai pro designer. Quanto mais completo, menos retrabalho.') +
  fig('g-bb', [(0.865, 0.451), (0.31, 0.51), (0.54, 0.571), (0.255, 0.656), (0.955, 0.686)]) +
  leg(['<b>Baixar PDF:</b> o brandbook no padrão do Cria, pra mandar pro cliente.',
       '<b>Preencher a partir de um arquivo:</b> suba o PDF que ele já tem e o Cria preenche.',
       '<b>As quatro partes</b> (essência, estratégia, mensagem, voz e visual) com o quanto já foi preenchido.',
       '<b>Os campos,</b> um por pergunta.',
       '<b>Microfone:</b> fale em vez de digitar.']) +
  '<h3 style="margin-top:4mm">Persona</h3>' +
  fig('g-per', [(0.2, 0.449), (0.855, 0.449), (0.39, 0.487), (0.33, 0.569)]) +
  leg(['<b>Até três personas</b> por cliente.', '<b>Nova persona.</b>', '<b>Toque no card</b> pra editar aquela persona.', '<b>O perfil:</b> idade, região, gasto, rotina, o que valoriza e como compra.']))

# ── 6. Diagnóstico e concorrência ───────────────────────────────────────
crop('g-diag', 'm12-diagnostico', (0.085, 0.415, 0.985, 0.8))
crop('g-conc', 'm13-concorrencia', (0.085, 0.415, 0.985, 0.8))
pagina('<h2 style="margin-bottom:1.5mm">Diagnóstico do perfil</h2><p class="muted" style="margin-bottom:3mm">A primeira coisa a fazer com cliente novo: o perfil dele transmite clareza?</p>' +
  fig('g-diag', [(0.345, 0.452), (0.88, 0.503), (0.275, 0.747)]) +
  leg(['<b>Arrumando a casa:</b> sete perguntas de sim ou não sobre bio, feed, fixados, destaques e contato.', '<b>Sim ou Não</b> em cada item.', '<b>Primeiros ajustes:</b> bio, nome do perfil, destaques e fixados sugeridos.'], duas=False) +
  '<h2 style="margin:5mm 0 1.5mm">Concorrência</h2><p class="muted" style="margin-bottom:3mm">As análises que o Cria Radar fez pra esse cliente, guardadas na ficha dele.</p>' +
  fig('g-conc', [(0.255, 0.449), (0.815, 0.449), (0.745, 0.613), (0.262, 0.738)]) +
  leg(['<b>Análises do Cria Radar</b> desse cliente.', '<b>Nova análise</b> vai pro Radar.', '<b>Reels lidos, média de curtidas e de views.</b>', '<b>Cada roteiro</b> com gancho, estrutura e como usar no cliente.']))

# ── 7. Tarefas ──────────────────────────────────────────────────────────
crop('g-tar', 'm02-tarefas', (0.085, 0.225, 0.985, 0.66))
pagina(abre('azul', '3 · TAREFAS E CALENDÁRIO', 'O que falta fazer, cliente por cliente',
  'Cada tarefa é de um cliente (ou de um lead). Você vê tudo junto ou filtra por um só.') +
  fig('g-tar', [(0.765, 0.261), (0.935, 0.243), (0.412, 0.297), (0.62, 0.282), (0.235, 0.328), (0.185, 0.41), (0.245, 0.468), (0.272, 0.626), (0.87, 0.448)]) +
  leg(['<b>Kanban ou Calendário.</b>',
       '<b>Nova tarefa.</b>',
       '<b>Todas, atrasadas, hoje, semana, concluídas,</b> com a contagem.',
       '<b>Cliente e período.</b>',
       '<b>Materiais pendentes</b> que vieram do Cria Post, com o atraso.',
       '<b>Pendentes, em andamento e concluídas.</b> Arraste entre as colunas.',
       '<b>Prioridade e cliente</b> em cada tarefa.',
       '<b>Tarefa de lead:</b> reunião, orçamento, apresentação.',
       '<b>Concluída</b> fica riscada, pra você ver o que já entregou.']) +
  dica('<b>As tarefas com data aparecem na sua Agenda</b> e no calendário do Cria Gestão. Tarefa sem data é a que some da cabeça: dê data a todas.'))

# ── 8. Calendário ───────────────────────────────────────────────────────
crop('g-cal', 'm03-calendario', (0.085, 0.23, 0.985, 0.75))
pagina('<h2 style="margin-bottom:1.5mm">Calendário da gestão</h2><p class="muted" style="margin-bottom:4mm">O mês da sua operação: tarefas, leads, renovações de contrato e aniversários dos clientes.</p>' +
  fig('g-cal', [(0.585, 0.26), (0.755, 0.26), (0.33, 0.36), (0.598, 0.685)]) +
  leg(['<b>Legenda:</b> tarefa, lead, renovação e aniversário, cada item na cor do cliente.', '<b>Hoje e troca de mês.</b>', '<b>Concluída</b> aparece riscada.', '<b>O dia de hoje</b> destacado.'], duas=False) +
  '<div class="tabela" style="margin-top:4mm"><table><tr><th>Aparece no calendário</th><th>De onde vem</th></tr>'
  '<tr><td><b>Tarefa</b></td><td>Tarefas com data, de cliente ou suas</td></tr>'
  '<tr><td><b>Lead</b></td><td>Tarefas dos leads do pipeline</td></tr>'
  '<tr><td><b>Renovação</b></td><td>A data de renovação na ficha do cliente</td></tr>'
  '<tr><td><b>Aniversário</b></td><td>O aniversário na ficha. Bom dia pra um post ou um mimo.</td></tr></table></div>')

# ── 9. Pipeline ─────────────────────────────────────────────────────────
crop('g-pipe', 'm04-pipeline', (0.085, 0.24, 0.985, 0.62))
pagina(abre('verde', '4 · PIPELINE, METAS E CONTRATOS', 'Pipeline: os próximos clientes',
  'Cada lead é um card. Você arrasta de etapa em etapa até fechar. Fechou, ele vira cliente sozinho.') +
  fig('g-pipe', [(0.185, 0.265), (0.415, 0.265), (0.575, 0.265), (0.855, 0.265), (0.88, 0.342), (0.135, 0.384), (0.875, 0.453)]) +
  leg(['<b>Pipeline ativo:</b> quanto vale tudo que está em aberto.',
       '<b>Em negociação.</b>',
       '<b>Fechados.</b>',
       '<b>Receita mensal:</b> a mesma conta do Caixa.',
       '<b>Novo lead.</b>',
       '<b>As etapas:</b> lead, contato, reunião, proposta, negociação, fechado e perdido.',
       '<b>O card:</b> nome, segmento e valor mensal proposto.']) +
  '<div class="tabela" style="margin-top:3mm"><table><tr><th>Quando você...</th><th>O Cria faz</th></tr>'
  '<tr><td><b>Arrasta pra Fechado</b></td><td>Cria o cliente na carteira (com nome, contato, segmento e valor) e um contrato fechado. A mensalidade passa a contar na receita e no Caixa.</td></tr>'
  '<tr><td><b>Tira de Fechado</b></td><td>Pergunta antes. O cliente deixa de contar na receita e fica inativo, sem apagar o histórico.</td></tr>'
  '<tr><td><b>Arrasta pra Perdido</b></td><td>Guarda o lead fora do pipeline ativo, pra você ver depois o que não fechou.</td></tr></table></div>')

# ── 10. Metas e contratos ───────────────────────────────────────────────
crop('g-meta', 'm05-metas', (0.34, 0.025, 0.66, 0.62))
crop('g-cont', 'm06-contratos', (0.085, 0.315, 0.985, 0.96))
pagina('<h2 style="margin-bottom:1.5mm">Metas do seu negócio</h2>'
  '<div class="lado" style="gap:6mm;align-items:flex-start;margin-bottom:5mm">' +
  fig('g-meta', [(0.495, 0.128), (0.4, 0.219), (0.41, 0.331)], style='width:62mm;flex:none') +
  '<div>' + leg(['<b>O que você quer alcançar.</b> Ex.: chegar a 10 clientes ativos.', '<b>Categoria:</b> clientes, receita, entregas, seguidores, engajamento, vendas.', '<b>Valor alvo, onde você está e prazo.</b> Você acompanha o progresso.'], duas=False) +
  '<p class="small muted">Metas são suas, não do cliente. Ficam com data de criação e de conclusão, pra você ver o quanto cresceu.</p></div></div>'
  '<h2 style="margin-bottom:1.5mm">Contratos</h2>' +
  fig('g-cont', [(0.76, 0.356), (0.93, 0.33), (0.1, 0.395), (0.77, 0.513), (0.9065, 0.495), (0.962, 0.513)]) +
  leg(['<b>Gerar contrato</b> a partir do modelo.', '<b>Novo contrato</b> pra registrar um que você já tem.', '<b>Aviso:</b> é modelo de apoio, revise com advogado.', '<b>Valor mensal</b> do contrato.', '<b>Situação:</b> fechado, em negociação.', '<b>Editar ou excluir.</b>']))

# ── 11. Gerar contrato ──────────────────────────────────────────────────
crop('g-gc1', 'm07-gerar-contrato', (0.225, 0.005, 0.765, 0.41))
crop('g-gc2', 'm07-gerar-contrato', (0.225, 0.72, 0.765, 0.99))
pagina('<h2 style="margin-bottom:1.5mm">Gerar contrato</h2><p class="muted" style="margin-bottom:4mm">Um modelo de gerenciamento de redes sociais que se monta com o que você preenche.</p>'
  '<div class="duo">' +
  fig('g-gc1', [(0.735, 0.056), (0.41, 0.09), (0.37, 0.255), (0.462, 0.396)]) +
  '<div>' + fig('g-gc2', [(0.365, 0.735), (0.505, 0.967)]) +
  leg(['<b>Dados da sua empresa:</b> vêm de Configurações. Preencha uma vez.', '<b>Escolha o cliente da carteira</b> e os dados dele entram sozinhos.', '<b>Escopo:</b> rede, publicações, carrosséis, vídeos, gravação, reuniões, atendimento.', '<b>Extras:</b> edição de reels e relatório de métricas.', '<b>Prévia</b> do contrato, atualizando enquanto você preenche.', '<b>Baixar contrato</b> em PDF.'], duas=False) + '</div></div>' +
  '<p class="small" style="margin-top:3mm">No meio do formulário ficam <b>preço e prazo</b> (valor, vencimento, multa de rescisão, duração, início e renovação automática), o <b>representante</b> do cliente e o <b>foro, assinatura e testemunhas</b>.</p>' +
  dica('<b>Os contratos são modelos de apoio.</b> Não substituem orientação jurídica. Revise com um advogado antes de mandar pro cliente, principalmente multa e foro.', alerta=True))

# ── 12. Link na bio ─────────────────────────────────────────────────────
crop('g-bio', 'm08-linkbio', (0.085, 0.265, 0.69, 0.66))
pagina(abre('lilas', '5 · LINK NA BIO', 'A página de links de cada cliente',
  'Uma página pra colocar na bio do Instagram, com os botões, o formulário de contato e o endereço. Você monta e ela fica no ar no link do Cria.') +
  fig('g-bio', [(0.195, 0.289), (0.25, 0.36), (0.2, 0.384), (0.515, 0.379), (0.372, 0.41), (0.275, 0.635)]) +
  leg(['<b>Busca</b> por cliente.',
       '<b>O endereço</b> da página.',
       '<b>Visitas e leads</b> que a página trouxe.',
       '<b>Na conta dele:</b> o cliente usa o Cria e a página é da conta dele.',
       '<b>Editar, copiar o link e abrir.</b>',
       '<b>Montar:</b> cria a página de quem ainda não tem.']))

# ── 13. Editor de link na bio ───────────────────────────────────────────
crop('g-bioed', 'm14-linkbio-editor', (0.085, 0.26, 0.985, 0.82))
pagina('<h2 style="margin-bottom:1.5mm">Montando a página</h2><p class="muted" style="margin-bottom:4mm">Abre dentro da ficha do cliente, em Cria Gestão, Link na bio. Tudo salva sozinho e aparece na prévia do celular.</p>' +
  fig('g-bioed', [(0.3, 0.279), (0.62, 0.314), (0.235, 0.427), (0.455, 0.427), (0.375, 0.461), (0.572, 0.395), (0.79, 0.393), (0.245, 0.63)]) +
  leg(['<b>Brandbook e Link na bio</b> do cliente, lado a lado.',
       '<b>Aviso:</b> se o cliente usa o Cria, você edita a página da conta dele.',
       '<b>Clássico ou Site:</b> coluna de botões ou página completa. Trocar não apaga nada.',
       '<b>O link</b> pra colocar na bio, com copiar e abrir.',
       '<b>Conteúdo, Visual, Publicar e Resultados.</b>',
       '<b>Tudo salvo.</b>',
       '<b>Prévia</b> no celular, ao vivo.',
       '<b>O topo:</b> banner, foto, nome, bio e redes. Depois vêm os blocos.']) +
  dica('<b>Os blocos:</b> link, texto, vídeo, formulário, perguntas frequentes e endereço com mapa. Arraste pra ordenar; o interruptor tira do ar sem apagar. Em Resultados você acompanha visitas e leads da página.'))

# ── 14. Sincronia ───────────────────────────────────────────────────────
pagina(abre('rosa', '6 · SINCRONIA E ROTINA', 'Pra onde vai cada coisa',
  'A ficha do Cria Gestão é a fonte. Você preenche uma vez e o resto do Cria usa.') +
  '<div class="tabela"><table><tr><th>O que você preenche</th><th>Onde aparece</th></tr>'
  '<tr><td><b>Valor mensal e dia de pagamento</b></td><td>A mensalidade nasce no Cria Caixa. O previsto do mês e a mensalidade vencida aparecem no Início.</td></tr>'
  '<tr><td><b>Brandbook e persona</b></td><td>A IA do Cria (legendas, roteiros, ideias) e o Briefing de arte do Cria Post, que vai pro designer.</td></tr>'
  '<tr><td><b>Cor do cliente</b></td><td>Pinta o card na Agenda, no Calendário geral do Cria Post e nas listas.</td></tr>'
  '<tr><td><b>Aniversário e renovação</b></td><td>Calendário do Cria Gestão.</td></tr>'
  '<tr><td><b>Tarefas com data</b></td><td>Agenda e calendário do Cria Gestão.</td></tr>'
  '<tr><td><b>Lead em Fechado</b></td><td>Cliente novo na carteira, contrato e receita mensal.</td></tr>'
  '<tr><td><b>Segmento e persona</b></td><td>A análise da IA no relatório do cliente (Cria Post).</td></tr>'
  '<tr><td><b>Dados da sua empresa</b> (Configurações)</td><td>A parte CONTRATADA dos contratos.</td></tr></table></div>' +
  dica('<b>Ficha vazia faz a IA inventar.</b> Sem brandbook, o Briefing de arte avisa que não tem como montar, e a IA escreve genérico. Preencha pelo menos a Essência e a Voz antes de pedir conteúdo.'))

# ── 15. Rotina e perguntas ──────────────────────────────────────────────
pagina(abre('amarelo', 'PRA FECHAR', 'Tirando o máximo do Cria Gestão',
  'Uma rotina simples e as dúvidas que mais aparecem.', amarelo=True) + '''
  <ul class="check-lista">
    <li><span class="cx"></span><div><b>Uma vez:</b> preencha os Dados da minha empresa em Configurações. É o que vai nos contratos.</div></li>
    <li><span class="cx"></span><div><b>Cliente novo:</b> mande o link de dados, faça o diagnóstico do perfil e preencha brandbook e persona na primeira semana.</div></li>
    <li><span class="cx"></span><div><b>Toda segunda:</b> Tarefas, filtro "Esta semana". O que não tem data, dê data.</div></li>
    <li><span class="cx"></span><div><b>Depois de cada conversa com possível cliente:</b> atualize o pipeline. É ele que diz quanto você pode faturar.</div></li>
    <li><span class="cx"></span><div><b>Fim do mês:</b> metas e renovações do mês seguinte no calendário.</div></li>
  </ul>
  <h3 style="margin-top:6mm">Perguntas rápidas</h3>
  <div class="faq card">
    <div class="q"><h4>Qual a diferença entre Clientes (menu) e a carteira do Cria Gestão?</h4><p class="small">São os mesmos clientes. Clientes é o cockpit do dia a dia; a carteira do Cria Gestão é a visão do negócio, com valor e dados de cadastro.</p></div>
    <div class="q"><h4>Arrastei pra Fechado sem querer.</h4><p class="small">Volte o card pra etapa certa. O Cria pergunta antes e o cliente fica inativo, sem contar na receita.</p></div>
    <div class="q"><h4>O cliente já tem brandbook em PDF.</h4><p class="small">Use "Preencher a partir de um arquivo" na aba Brandbook e confira o que entrou.</p></div>
    <div class="q"><h4>O cliente usa o Cria. Quem edita o link na bio?</h4><p class="small">Os dois. A página é da conta dele, e o que você muda ele vê quando entra.</p></div>
  </div>''')

exec(open('/home/claude/msm/gestao/_monta.py').read().replace('Manual da Social Mídia · Cria', 'Manual Cria Gestão · Cria'))
