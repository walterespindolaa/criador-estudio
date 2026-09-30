exec(open('/home/claude/msm/post/_base.py').read())
MAN = 'Manual Cria Post · Social Mídia'

def cel(nome, cap):
    return f'<div><figure class="print" style="border-radius:5mm"><img src="{nome}.jpg" alt=""></figure><p class="cap">{cap}</p></div>'

# ── 1. Capa ─────────────────────────────────────────────────────────────
pagina('''
  <div class="topo" style="background:#D8401A">
    <div class="b1" style="background:#EE6A3C"></div><div class="b2" style="background:var(--amarelo);bottom:-56mm;left:-30mm"></div><div class="b3" style="background:#FF77B9"></div>
    <img class="logo" src="logo-cria-white.png" alt="Cria">
    <img class="criatura" src="criatura-lampada.png" alt="">
    <div class="titulo">
      <div class="sobre">CRIA SOCIAL CLUB · MANUAL DA SOCIAL MÍDIA</div>
      <h1>Cria Post</h1>
      <p>Da ideia ao post aprovado, sem print no WhatsApp. Monte o post, mande o link e o cliente aprova do celular, sem criar conta.</p>
    </div>
  </div>
  <div class="baixo">
    <div class="txt">
      <h3>Pra quem aprova conteúdo com vários clientes</h3>
      <p class="muted">Chega de "viu o post que te mandei?", de aprovação perdida no meio da conversa e de legenda antiga indo pro ar. Cada post tem uma casa, um status e um histórico.</p>
      <div class="pilulas">
        <span style="background:var(--laranja)">Produção</span>
        <span style="background:var(--azul)">Link de aprovação</span>
        <span style="background:var(--verde)">Calendário</span>
        <span style="background:#E9559A">Relatório</span>
      </div>
      <p class="small muted" style="margin-top:6mm">Versão 1.0 · 30 de setembro de 2026 · app.criasocialclub.com.br<br>Manual do módulo. O que é da conta toda (Início, Clientes, Agenda, Equipe) está no Manual Geral.</p>
    </div>
    <img class="selo" src="selo-da-ideia-ao-post-rosa.png" alt="">
  </div>''', 'capa')

# ── 2. Em 1 minuto ──────────────────────────────────────────────────────
pagina(abre('laranja', 'COMECE AQUI', 'O Cria Post em 1 minuto',
  'O post nasce dentro da ficha do cliente, anda por etapas e o cliente aprova por um link. Você nunca mais pergunta "e aí, aprovou?".') + '''
  <h3>O caminho de todo post</h3>
  <div class="fluxo" style="margin-bottom:6mm">
    <div class="et"><span class="chip novo">Ideia</span><div class="t">Anota</div><div class="d">Banco de ideias do cliente</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip fazendo">Em produção</span><div class="t">Monta</div><div class="d">Arte, legenda, data</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip amar">Aguardando</span><div class="t">Envia</div><div class="d">O link vai pro cliente</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip entregue">Aprovado</span><div class="t">Publica</div><div class="d">Ou volta com ajuste</div></div>
    <div class="seta">›</div>
    <div class="et"><span class="chip ajuste">Postado</span><div class="t">Mostra</div><div class="d">Entra no relatório</div></div>
  </div>
  <h3>Por que vale a pena</h3>
  <div class="duo" style="margin-bottom:5mm">
    <div class="card"><h4>O cliente não precisa de conta</h4><p class="small">Ele abre um link, vê o post como vai sair no feed e toca em Aprovar ou Ajuste. Sem senha, sem cadastro, do celular.</p></div>
    <div class="card"><h4>Tudo fica registrado</h4><p class="small">Quem aprovou, quando, o que pediu de ajuste e em que versão. Acabou a discussão de "eu não aprovei isso".</p></div>
    <div class="card"><h4>Um quadro por cliente, um painel de todos</h4><p class="small">Dentro do cliente você produz. No painel do Cria Post você vê o que está parado em todos de uma vez.</p></div>
    <div class="card"><h4>Conversa com o resto do Cria</h4><p class="small">A data vai pra Agenda, a aprovação pro Início, a peça pro parceiro na Equipe e o resultado pro relatório.</p></div>
  </div>
  <h3>O que tem neste manual</h3>
  <div class="indice">
    <div class="it"><span class="n bg-laranja">1</span><div><b>Onde fica</b><span>as abas do Cria Post no cliente</span></div></div>
    <div class="it"><span class="n bg-laranja">2</span><div><b>Produção</b><span>o quadro e o post por dentro</span></div></div>
    <div class="it"><span class="n bg-azul">3</span><div><b>Aprovação por link</b><span>o que você manda e o que ele vê</span></div></div>
    <div class="it"><span class="n bg-verde">4</span><div><b>Planejamento</b><span>ideias, cronograma e kanban do cliente</span></div></div>
    <div class="it"><span class="n bg-rosa">5</span><div><b>Relatório e materiais</b><span>prova de trabalho e pedidos avulsos</span></div></div>
    <div class="it"><span class="n bg-lilas">6</span><div><b>Painel e sincronia</b><span>todos os clientes e pra onde vai cada dado</span></div></div>
  </div>
  <p class="small muted" style="margin-top:4mm">Os nomes, fotos, contatos e valores das telas deste manual são fictícios. As telas são do sistema de verdade.</p>
''')

# ── 3. Onde fica ────────────────────────────────────────────────────────
crop('o-land', 'p01-landing', (0.085, 0.215, 0.985, 0.935))
pagina(abre('laranja', '1 · ONDE FICA', 'O Cria Post mora no cliente',
  'Abra o cliente em Clientes e toque na aba Cria Post. Cada cartão leva pra uma parte do trabalho daquele cliente.') +
  fig('o-land', [(0.335, 0.316), (0.24, 0.366), (0.212, 0.481), (0.628, 0.481), (0.222, 0.606), (0.703, 0.606), (0.208, 0.731), (0.638, 0.731), (0.19, 0.856), (0.868, 0.253)]) +
  leg(['<b>Link de aprovação ativo</b> e quantos posts estão pendentes com o cliente.',
       '<b>Aba Cria Post</b> dentro da ficha do cliente.',
       '<b>Produção:</b> o quadro dos posts desse cliente.',
       '<b>Ideias:</b> o banco de ideias pra virar post.',
       '<b>Cronograma:</b> o mês do cliente com link público.',
       '<b>Kanban do cliente:</b> o quadro do Cria dele, pra quem usa o Cria.',
       '<b>Relatório:</b> o resultado do mês em PDF, com a sua marca.',
       '<b>Materiais:</b> pedidos fora dos posts (flyer, apresentação, logo).',
       '<b>Portal:</b> como o link aparece pro cliente.',
       '<b>Entrar no Cria dele:</b> só pra quem usa o Cria.']) +
  dica('<b>Cliente que aprova por link ou cliente que usa o Cria?</b> Quem aprova por link não tem conta: você faz tudo e ele só aprova. Quem usa o Cria tem o próprio quadro, e a aba Kanban do cliente te deixa mexer nele daqui.'))

# ── 4. Produção: o quadro ───────────────────────────────────────────────
crop('o-prod', 'p02-producao', (0.085, 0.385, 0.985, 0.8))
pagina(abre('laranja', '2 · PRODUÇÃO', 'O quadro de posts do cliente',
  'Cada coluna é uma etapa. O card anda sozinho quando o cliente responde; o resto você arrasta.') +
  fig('o-prod', [(0.205, 0.405), (0.583, 0.405), (0.727, 0.405), (0.94, 0.39), (0.357, 0.443), (0.37, 0.476), (0.245, 0.51), (0.398, 0.546), (0.222, 0.625), (0.262, 0.646), (0.962, 0.546)]) +
  leg(['<b>Kanban ou Calendário:</b> o mesmo conteúdo em colunas ou no mês.',
       '<b>Link de aprovação:</b> copia o link do cliente (tudo ou só um período).',
       '<b>Importar do kanban:</b> traz posts prontos do Cria do cliente.',
       '<b>Novo post</b> em branco.',
       '<b>Período e ordem:</b> manual (arrastando) ou por data.',
       '<b>Filtro por formato:</b> estático, carrossel, reels.',
       '<b>Etiquetas</b> suas, pra organizar (série, campanha, gravar).',
       '<b>As etapas:</b> em produção, aguardando cliente, ajuste, aprovado.',
       '<b>Parceiro no card:</b> quem está fazendo a arte e em que pé está.',
       '<b>Data de publicação</b> direto no card, sem abrir o post.',
       '<b>Postado:</b> o que já foi ao ar.']) +
  '<div class="tabela" style="margin-top:3mm"><table><tr><th>Etapa</th><th>Quem move</th></tr>'
  '<tr><td><b>Em produção</b></td><td>Você, enquanto monta. O cliente ainda não vê.</td></tr>'
  '<tr><td><b>Aguardando cliente</b></td><td>Você, quando está pronto pra ele ver. Aparece no link.</td></tr>'
  '<tr><td><b>Ajuste solicitado</b> e <b>Aprovado</b></td><td>O cliente, pelo link. O card muda de coluna sozinho e você é avisado.</td></tr>'
  '<tr><td><b>Postado</b></td><td>Você, depois que publicar. É o que conta como entregue no relatório.</td></tr></table></div>')

# ── 5. O post por dentro ────────────────────────────────────────────────
crop('o-edit', 'p03-editor', (0.14, 0.012, 0.86, 0.68))
pagina('<h2 style="margin-bottom:1.5mm">O post por dentro</h2><p class="muted" style="margin-bottom:4mm">Toque no lápis do card (ou em Novo post). Tudo que o post precisa fica num lugar só.</p>' +
  fig('o-edit', [(0.2275, 0.0746), (0.5525, 0.067), (0.1975, 0.112), (0.3525, 0.276), (0.2475, 0.3677), (0.2235, 0.4396), (0.2635, 0.519), (0.249, 0.583), (0.2065, 0.65), (0.562, 0.112), (0.74, 0.112), (0.805, 0.2415)]) +
  leg(['<b>Etiqueta:</b> marca o post (série, campanha, "gravar").',
       '<b>Com Amanda:</b> manda a peça pro parceiro. O nome é de quem está com ela.',
       '<b>Título, plataforma e formato.</b>',
       '<b>Observações:</b> só quem produz lê. O cliente nunca vê.',
       '<b>Tipo de aprovação:</b> simplificada (1 clique) ou detalhada (4 etapas).',
       '<b>Data e horário</b> de publicação. Vão pro calendário e pra Agenda.',
       '<b>Referências:</b> links de inspiração, quantos quiser.',
       '<b>Pasta do Drive</b> com o material bruto.',
       '<b>Legenda,</b> com botão de copiar na hora de postar.',
       '<b>Mídia:</b> imagem, vídeo, arquivo do Drive ou link (até 20).',
       '<b>Briefing de arte:</b> monta o recado pro designer com a marca do cliente.',
       '<b>Prévia</b> de como sai no feed, igual o cliente vai ver.']) +
  dica('<b>Aprovação detalhada</b> separa o post em Tema, Conteúdo, Mídia e Legenda. O cliente aprova cada parte e pede ajuste só no que precisa. Use em cliente exigente ou em post de campanha; no dia a dia, a simplificada resolve.'))

# ── 6. Aprovação por link ───────────────────────────────────────────────
crop('o-link', 'p04-link', (0.3, 0.25, 0.7, 0.75))
pagina(abre('azul', '3 · APROVAÇÃO POR LINK', 'Um link por cliente, pra sempre',
  'O link é fixo. Você manda uma vez, ele salva, e todo post que você colocar em Aguardando cliente aparece lá.') +
  '<div class="lado" style="gap:6mm;align-items:flex-start">' + fig('o-link', style='width:78mm;flex:none') +
  '<div><h4 style="margin-top:0">Dois jeitos de mandar</h4>'
  '<p class="small"><b>Todos os posts:</b> o cliente vê tudo que está na fila de aprovação. É o link do dia a dia.</p>'
  '<p class="small"><b>Só um período:</b> escolha início e fim e o link mostra só os posts agendados nesse intervalo. Bom pra aprovar "a semana que vem" ou o mês fechado.</p>'
  '<h4>O que acontece depois</h4>'
  '<p class="small">Quando ele aprova ou pede ajuste, o card muda de coluna sozinho, chega aviso no sino (e no celular, se estiver instalado) e aparece em <b>Aprovações recentes</b> no Início.</p>'
  '<p class="small">Se ele não abre, o Início te avisa com <b>Aprovação parada</b>. No card em Aguardando cliente aparece <b>Visto pelo cliente</b>, com quando ele abriu o link.</p></div></div>' +
  '<h3 style="margin-top:5mm">Aprovação simplificada x detalhada</h3>'
  '<div class="tabela"><table><tr><th></th><th>Simplificada</th><th>Detalhada</th></tr>'
  '<tr><td><b>O cliente vê</b></td><td>O post inteiro</td><td>O post dividido em Tema, Conteúdo, Mídia e Legenda</td></tr>'
  '<tr><td><b>Ele responde</b></td><td>Aprovar ou Ajuste, um clique</td><td>Aprova ou pede ajuste em cada parte</td></tr>'
  '<tr><td><b>Use quando</b></td><td>Rotina, cliente que confia</td><td>Campanha, cliente detalhista, post caro</td></tr>'
  '<tr><td><b>Ambas</b></td><td colspan="2">O cliente escolhe como prefere responder.</td></tr></table></div>' +
  dica('<b>Mande o link no grupo do cliente e fixe a mensagem.</b> Como ele não muda, o cliente sempre sabe onde aprovar, e você para de mandar print.'))

# ── 7. O que o cliente vê ───────────────────────────────────────────────
crop('c-lista', 'p14-portal-cel-lista', (0, 0, 1, 0.625), maxw=780)
crop('c-ajuste', 'p15-portal-cel-ajuste', (0, 0.49, 1, 0.8), maxw=780)
crop('c-cal', 'p16-portal-cel-cal', (0, 0, 1, 0.9), maxw=780)
pagina('<h2 style="margin-bottom:1.5mm">O que o cliente vê</h2><p class="muted" style="margin-bottom:4mm">A página que abre no celular dele. Sem senha, sem cadastro, com o nome e a cor da marca.</p>' +
  '<div class="grid3" style="align-items:start">' +
  cel('c-lista', '<b>Lista:</b> o post como sai no feed, a data, a legenda e os botões Aprovar e Ajuste. No topo, quantos já aprovou.') +
  cel('c-ajuste', '<b>Ajuste:</b> ele escreve o que mudar ou aponta direto na arte. O pedido chega no card.') +
  cel('c-cal', '<b>Calendário:</b> o mês com o que já foi aprovado e quando sai. Embaixo, ele pede material avulso.') +
  '</div>' +
  dica('<b>"Apontar na arte" corta ida e volta.</b> Em vez de "muda aquele negócio lá em cima", o cliente toca no ponto exato. Mostre isso pra ele na primeira aprovação.'))

# ── 8. Portal: personalizar ─────────────────────────────────────────────
crop('o-portal', 'p12-portal', (0.085, 0.253, 0.985, 0.925))
pagina('<h2 style="margin-bottom:1.5mm">Portal: a cara do link</h2><p class="muted" style="margin-bottom:4mm">Na aba Portal do cliente você decide o que ele vê e organiza o que só você vê.</p>' +
  fig('o-portal', [(0.8, 0.276), (0.528, 0.37), (0.185, 0.427), (0.18, 0.524), (0.175, 0.568), (0.165, 0.829), (0.625, 0.358), (0.63, 0.624), (0.668, 0.694)]) +
  leg(['<b>Copiar link e Abrir:</b> o link do cliente e a página como ele vê.',
       '<b>Prévia</b> do topo da página dele.',
       '<b>Nome exibido e @</b> do Instagram.',
       '<b>Logo da marca</b> no topo do link.',
       '<b>Cor da marca:</b> pinta botões e destaques.',
       '<b>Abas do link:</b> liga o Calendário e o Relatório pra ele.',
       '<b>Cor do cliente:</b> só pra você, pinta o card na agenda e no calendário.',
       '<b>Ficha do cliente:</b> liga esta página à ficha do Cria Gestão.',
       '<b>Desativar ou excluir</b> o Cria Post do cliente.']) +
  dica('<b>Ligue a aba Relatório do link.</b> O cliente vê o que foi entregue no período, com a marca dele. Vira prova de trabalho sem você mandar nada.'))

# ── 9. Ideias ───────────────────────────────────────────────────────────
crop('o-ideias', 'p05-ideias', (0.085, 0.385, 0.55, 0.625))
pagina(abre('verde', '4 · PLANEJAMENTO', 'Ideias: tudo que inspira o cliente',
  'Anote na hora que a ideia vier. Marque as boas como Usar e elas viram post com um toque.') +
  fig('o-ideias', [(0.1, 0.415), (0.41, 0.415), (0.268, 0.601)]) +
  leg(['<b>As cinco fontes de ideia</b> do cliente, cada uma com a sua contagem.',
       '<b>Do HUB:</b> ideias que a IA tirou dos concorrentes dele no Cria Radar.',
       '<b>Usar, Usada ou Descartar.</b> O que você marca como Usar vira post.'], duas=False) +
  '<div class="tabela" style="margin-top:3mm"><table><tr><th>Fonte</th><th>De onde vem</th></tr>'
  '<tr><td><b>Suas ideias</b></td><td>O que você anotou (nota ou link de referência)</td></tr>'
  '<tr><td><b>Do cliente</b></td><td>O que ele mesmo anotou no Cria dele</td></tr>'
  '<tr><td><b>Salvos dele</b></td><td>Posts que ele guardou como referência no Cria dele. É o gosto dele, em imagem</td></tr>'
  '<tr><td><b>Do HUB</b></td><td>Pautas geradas pela IA a partir dos concorrentes (Cria Radar)</td></tr>'
  '<tr><td><b>Seus salvos</b></td><td>O que você guardou pensando nele</td></tr></table></div>')

# ── 10. Cronograma e kanban do cliente ──────────────────────────────────
crop('o-cron', 'p06-cronograma', (0.33, 0.28, 0.67, 0.72))
crop('o-kan', 'p07-kanban-cliente', (0.085, 0.36, 0.985, 0.86))
pagina('<h2 style="margin-bottom:1.5mm">Cronograma do mês</h2>'
  '<div class="lado" style="gap:6mm;align-items:flex-start;margin-bottom:5mm">' + fig('o-cron', style='width:68mm;flex:none') +
  '<div><p class="small">O cronograma é a visão do mês pro cliente: as datas comemorativas e o que vai sair, num link público. Crie um por mês em <b>Novo cronograma</b>.</p>'
  '<p class="small">O mês escolhido é o que faz a data comemorativa que você manda da Agenda cair no cronograma certo.</p>'
  '<p class="small muted">A aprovação post a post continua na Produção. O cronograma é pra ele enxergar o mês inteiro.</p></div></div>'
  '<h2 style="margin-bottom:1.5mm">Kanban do cliente</h2><p class="muted" style="margin-bottom:3mm">Só aparece pra cliente que usa o Cria. É o quadro dele de verdade: o que você muda aqui, muda lá, ao vivo.</p>' +
  fig('o-kan', [(0.66, 0.38), (0.87, 0.424), (0.4, 0.445), (0.68, 0.445), (0.293, 0.509), (0.19, 0.557)]) +
  leg(['<b>Aviso de quadro real.</b> Criar, editar ou arrastar muda os posts dele.',
       '<b>Novo Post</b> direto no Cria do cliente.',
       '<b>Período:</b> hoje, semana, quinzena, mês, ano.',
       '<b>Redes</b> e o contador de publicados e agendados.',
       '<b>Board, Tabela ou Calendário.</b>',
       '<b>As colunas dele:</b> ideia, planejamento, produzindo, pronto, agendado, publicado.']))

# ── 11. Relatório ───────────────────────────────────────────────────────
crop('o-rel', 'p09-relatorio-dlg', (0.1, 0.06, 0.9, 0.94))
pagina(abre('rosa', '5 · RELATÓRIO E MATERIAIS', 'O relatório que o cliente entende',
  'Produção, desempenho do Instagram e análise da IA, com a marca do cliente, pronto pra mandar em PDF.') +
  fig('o-rel', [(0.345, 0.183), (0.405, 0.43), (0.405, 0.693), (0.835, 0.175), (0.68, 0.859)]) +
  leg(['<b>Período:</b> 7 ou 30 dias, um mês fechado ou datas livres.',
       '<b>Recado da social mídia:</b> abre o relatório. Salva sozinho, por período.',
       '<b>Próximos passos:</b> vira a última página. Opcional.',
       '<b>Prévia:</b> cada folha é uma página do PDF. Clique na análise pra editar.',
       '<b>Baixar PDF</b> pronto pra enviar.']) +
  '<p class="small" style="margin-top:2mm">Rolando o painel da esquerda: <b>Métricas do Instagram</b> (suba o print do app, ótimo pra cliente sem Instagram conectado), <b>Gerar análise (IA)</b>, que usa a persona e o segmento do cliente, e <b>Compartilhar</b> por link, WhatsApp ou e-mail. Cada relatório fica no <b>Histórico</b> da aba.</p>')

# ── 12. Materiais ───────────────────────────────────────────────────────
crop('o-mat', 'p10-materiais', (0.085, 0.49, 0.985, 0.625))
crop('o-matn', 'p11-material-novo', (0.34, 0.06, 0.66, 0.94))
pagina('<h2 style="margin-bottom:1.5mm">Materiais: o que não é post</h2><p class="muted" style="margin-bottom:4mm">Apresentação, flyer, cartão de visita, logo, arte avulsa. O cliente pede pelo link, você organiza num quadro.</p>' +
  fig('o-mat', [(0.727, 0.524), (0.92, 0.497), (0.18, 0.575)]) +
  leg(['<b>Link de pedidos:</b> o cliente pede sem te chamar no WhatsApp.',
       '<b>Novo material,</b> quando o pedido chega por outro caminho.',
       '<b>As etapas:</b> solicitado, a fazer, em aprovação, ajuste, finalizado.'], duas=False) +
  '<div class="lado" style="gap:6mm;align-items:flex-start;margin-top:4mm">' +
  fig('o-matn', [(0.385, 0.247), (0.4, 0.363), (0.535, 0.591), (0.46, 0.682), (0.46, 0.821)], style='width:66mm;flex:none') +
  '<div>' + leg(['<b>Tipo</b> do material.', '<b>Briefing:</b> medidas, textos, cores, o que não pode faltar.', '<b>Prazo</b> pra ficar pronto (opcional).', '<b>Anexos:</b> arquivo ou link do Drive.', '<b>Enviar para</b> um parceiro da Equipe, ou ninguém (a equipe faz).'], duas=False) +
  '<p class="small" style="margin-top:3mm">O que o cliente pede pelo link cai em <b>Solicitado</b> e entra na Agenda na data que ele marcou.</p></div></div>')

# ── 13. Painel de todos os clientes ─────────────────────────────────────
crop('o-painel', 'p17-painel-aprovacoes', (0.085, 0.1, 0.985, 0.6))
pagina(abre('lilas', '6 · PAINEL E SINCRONIA', 'Todos os clientes numa tela',
  'O Cria Post do menu é o painel: as aprovações de todos os clientes juntas e o calendário geral. Pra criar e editar, abra o cliente.') +
  fig('o-painel', [(0.275, 0.187), (0.758, 0.133), (0.365, 0.248), (0.835, 0.276), (0.235, 0.33), (0.245, 0.377), (0.505, 0.412)]) +
  leg(['<b>Aprovações ou Calendário geral.</b>',
       '<b>Com parceiros e Ver clientes:</b> atalhos pra Equipe e pra carteira.',
       '<b>Relatório rápido:</b> escolhe o cliente e o período e gera, sem personalizar.',
       '<b>Gerar relatório</b> em um clique.',
       '<b>Todos os clientes</b> ou um só, com quantos estão aguardando.',
       '<b>Mais recentes</b> ou por data.',
       '<b>As etapas de todos</b> os clientes. Toque no post pra abrir no cliente.']) +
  dica('<b>Comece o dia pela coluna Aguardando cliente.</b> O que está lá há mais tempo mostra "Esperando há X dias". É a sua lista de quem cobrar.'))

# ── 14. Calendário geral ────────────────────────────────────────────────
crop('o-cal', 'p18-calendario-geral', (0.085, 0.205, 0.985, 0.8))
pagina('<h2 style="margin-bottom:1.5mm">Calendário geral</h2><p class="muted" style="margin-bottom:4mm">O mês de todos os clientes, cada um na sua cor. Bom pra ver dia lotado e semana vazia de uma vez.</p>' +
  fig('o-cal', [(0.66, 0.226), (0.94, 0.226), (0.195, 0.256), (0.48, 0.285), (0.19, 0.313), (0.2, 0.345), (0.35, 0.418)]) +
  leg(['<b>Mês ou semana.</b>',
       '<b>Troca o mês</b> e Hoje volta pro atual.',
       '<b>Clientes:</b> mostra todos ou só alguns.',
       '<b>Período</b> rápido.',
       '<b>Com parceiros:</b> só o que está com alguém da Equipe.',
       '<b>A agendar:</b> posts sem data. Dê data antes que fiquem pra trás.',
       '<b>Post na cor do cliente.</b> Toque pra abrir.']))

# ── 15. Sincronia ───────────────────────────────────────────────────────
pagina('<h2 style="margin-bottom:1.5mm">Pra onde vai cada coisa</h2><p class="muted" style="margin-bottom:4mm">Você mexe no post uma vez e o Cria leva a informação pro lugar certo. Nada de atualizar em dois lugares.</p>'
  '<div class="tabela"><table><tr><th>Quando você...</th><th>Aparece em...</th></tr>'
  '<tr><td><b>Dá data a um post</b></td><td>Calendário do cliente, Calendário geral e Agenda da semana. O aviso de "semana sem post" some do Início.</td></tr>'
  '<tr><td><b>Coloca em Aguardando cliente</b></td><td>No link do cliente, em Aprovações e no contador de posts esperando do Início.</td></tr>'
  '<tr><td><b>O cliente não responde</b></td><td>"Aprovação parada" em Sua operação hoje, no Início.</td></tr>'
  '<tr><td><b>O cliente aprova ou pede ajuste</b></td><td>O card muda de coluna, chega aviso no sino e no celular e entra em Aprovações recentes.</td></tr>'
  '<tr><td><b>Manda a peça pro parceiro</b></td><td>Equipe, aba Produção, e a fila do parceiro. O status dele aparece no card.</td></tr>'
  '<tr><td><b>O parceiro entrega</b></td><td>Os arquivos entram no post e a peça aparece em "Pra você revisar", na Equipe.</td></tr>'
  '<tr><td><b>Mexe no kanban de quem usa o Cria</b></td><td>No Cria do cliente, ao vivo.</td></tr>'
  '<tr><td><b>Marca como Postado</b></td><td>Relatório do cliente, na produção do período.</td></tr>'
  '<tr><td><b>O cliente pede material</b></td><td>Materiais, em Solicitado, e na Agenda na data que ele marcou.</td></tr></table></div>' +
  dica('<b>A mídia do post é de passagem.</b> O arquivo que você sobe serve pra aprovação e publicação; depois que o post sai, ele é apagado em alguns dias. O original fica no Drive do cliente, e o link da pasta vai no post.', alerta=True))

# ── 16. Tirar o máximo ──────────────────────────────────────────────────
pagina(abre('amarelo', 'PRA FECHAR', 'Tirando o máximo do Cria Post',
  'Uma rotina simples e as dúvidas que mais aparecem.', amarelo=True) + '''
  <ul class="check-lista">
    <li><span class="cx"></span><div><b>Uma vez por cliente:</b> ajuste o Portal (logo, cor, abas) e mande o link no grupo dele, fixado.</div></li>
    <li><span class="cx"></span><div><b>Todo dia:</b> painel do Cria Post, coluna Aguardando cliente. Quem está esperando há mais tempo, cobre.</div></li>
    <li><span class="cx"></span><div><b>Ao montar o mês:</b> Ideias do cliente, marque as boas como Usar, crie os posts e dê data a todos. Nada em "A agendar".</div></li>
    <li><span class="cx"></span><div><b>Ao delegar arte:</b> use o Briefing de arte e o "Com parceiro" do post. O designer recebe tudo junto.</div></li>
    <li><span class="cx"></span><div><b>Depois de publicar:</b> arraste pra Postado. É o que conta no relatório.</div></li>
    <li><span class="cx"></span><div><b>Fim do mês:</b> relatório de cada cliente, com recado e próximos passos.</div></li>
  </ul>
  <h3 style="margin-top:6mm">Perguntas rápidas</h3>
  <div class="faq card">
    <div class="q"><h4>O cliente perdeu o link.</h4><p class="small">Copie de novo em Link de aprovação, na Produção, ou em Copiar link, no Portal. É sempre o mesmo.</p></div>
    <div class="q"><h4>Quero que ele aprove só a semana que vem.</h4><p class="small">Em Link de aprovação, use "Só um período" com o início e o fim da semana.</p></div>
    <div class="q"><h4>O post não aparece pro cliente.</h4><p class="small">Ele só aparece em Aguardando cliente. Em produção é só seu.</p></div>
    <div class="q"><h4>O cliente pediu ajuste, e agora?</h4><p class="small">O pedido fica no card. Ajuste, e mande de novo pra Aguardando cliente. O histórico de ajustes fica salvo.</p></div>
  </div>''')

exec(open('/home/claude/msm/post/_monta.py').read().replace('Manual da Social Mídia · Cria', 'Manual Cria Post · Cria').replace('Manual-Social-Midia','x'))
