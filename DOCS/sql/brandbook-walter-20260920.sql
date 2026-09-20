-- ═══════════════════════════════════════════════════════════════════════════
-- BRANDBOOK DO WALTER, PREENCHIDO A PARTIR DA ESTRATEGIA DA GABRIELA
-- 20/09/2026
--
-- Isto NAO e migracao de schema: e DADO de uma conta so. Por isso mora em
-- DOCS/sql e nao em supabase/migrations, que roda em todo ambiente.
--
-- O texto de cada resposta esta em DOCS/brandbook-walter-20260920.md. Leia la
-- antes de rodar aqui.
--
-- Rode bloco a bloco, na ordem. Os blocos 4 e 5 sao OPCIONAIS e sobrescrevem
-- coisa que ja existe: leia o aviso de cada um.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 0 · SO OLHAR. O que ja esta preenchido hoje.
-- ───────────────────────────────────────────────────────────────────────────
select
  m.section,
  m.question_key,
  case when coalesce(btrim(m.answer), '') = '' then '(vazio)' else left(m.answer, 80) end as resposta
from public.moodboard_entries m
join auth.users u on u.id = m.user_id
where lower(u.email) = 'walterjoose@gmail.com'
order by m.section, m.question_key;

select b.type, b.name from public.brand_items b
join auth.users u on u.id = b.user_id
where lower(u.email) = 'walterjoose@gmail.com' order by b.type, b.position;

select p.name, p.age_range from public.personas p
join auth.users u on u.id = p.user_id
where lower(u.email) = 'walterjoose@gmail.com';

select pl.position, pl.name, pl.descricao from public.pillars pl
join auth.users u on u.id = pl.user_id
where lower(u.email) = 'walterjoose@gmail.com' order by pl.position;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 1 · PREENCHE SO O QUE ESTA VAZIO.
-- Nao apaga nem sobrescreve resposta nenhuma que ja tenha texto.
-- ───────────────────────────────────────────────────────────────────────────
do $bloco1$
declare
  _uid uuid;
  _r record;
begin
  select id into _uid from auth.users where lower(email) = 'walterjoose@gmail.com';
  if _uid is null then
    raise exception 'usuario walterjoose@gmail.com nao encontrado';
  end if;

  for _r in
    select * from (values
      -- Identidade e sensacoes
      ('moodboard-identidade', 'sensacoes',
       'Solidez sem pose. Alguem que ja passou pelo lugar dificil, resolveu na pratica e mostra o caminho sem vender formula. A sensacao e de conversa com quem faz, nao de palestra de quem ensina.'),
      ('moodboard-identidade', 'palavras-chave',
       'Processo, construcao, risco calculado, relacao de longo prazo, eficiencia sem perder profundidade, documentacao, sistema.'),
      ('moodboard-identidade', 'se-fosse',
       'O empresario que mostra a tela em vez de mostrar o resultado. Fala com quem esta no meio do problema, nao com quem esta na plateia. Nao usa palavra dificil pra parecer inteligente, e nao simplifica ao ponto de virar frase de efeito.'),

      -- Contexto e proposito
      ('moodboard-contexto', 'por-que',
       'Pra fortalecer a minha historia e mostrar o que eu construo como empresario e desenvolvedor. Nao e pra captar cliente de assessoria: e pra que quem esta no ponto em que eu estive veja que da pra sair de la.'),
      ('moodboard-contexto', 'diferencial',
       'Eu construi a tecnologia a partir da minha propria dor operacional, nao a partir de uma tese sobre tecnologia. O Atlas nasceu porque um estudo pra cliente levava cinco horas e hoje leva quinze minutos. Quem comenta novidade de IA nao tem um sistema em producao com cliente real e metrica de antes e depois.'),
      ('moodboard-contexto', 'legado',
       'Que profissional tecnico preso ao modelo tradicional perceba que da pra montar a propria operacao sem ser suicidio profissional, e que empresario em consolidacao pare de comprar tecnologia pelo hype e comece a resolver problema.'),

      -- Visao de mundo
      ('visao-de-mundo', 'verdade-pouco-dita',
       'O maior gargalo da assessoria de investimentos nao e tecnico, e a ausencia de processo. A maioria age como analista quando deveria agir como assessor.'),
      ('visao-de-mundo', 'crenca-a-quebrar',
       'A de que IA substitui metodologia. Ela escala uma metodologia que ja existe na cabeca de quem usa. Sem metodologia antes, a ferramenta so acelera a bagunca.'),
      ('visao-de-mundo', 'incomodo-mercado',
       'A rotatividade virou habito: troca-se de assessor a cada seis meses e de gerente a cada tres. E o profissional cobra pela hora entregando servico simplista, em vez de gerar valor a ponto de o cliente entender quanto vale aquela hora.'),

      -- Sobre voce
      ('sobre-voce', 'comeco',
       'Querer usar a propria trajetoria como gatilho pra inspirar quem esta numa situacao parecida com a que eu vivi, e mostrar o dia a dia de quem e empresario e desenvolve o proprio sistema, nao so o resultado pronto.'),
      ('sobre-voce', 'conflito',
       'Entrei no mercado de trabalho pela porta mais dura: turno da noite numa fabrica de autopecas, ganhando pouco, vendo colegas de faculdade crescerem mais rapido. Decidi estudar mercado financeiro sem nenhuma experiencia na area e me mudei de cidade antes de saber se tinha passado na prova. Depois, ja em posicao de lideranca num escritorio de terceiros, a frustracao me fez abrir o meu proprio, com o risco real de os clientes nao migrarem junto e de eu nao saber empreender.'),
      ('sobre-voce', 'meta',
       'Curto prazo: reconhecimento e autoridade, com bio, destaques e fixados contando uma historia so. Medio prazo: audiencia qualificada de empresarios e profissionais experientes. Futuro, sem pressa: ter uma audiencia que ja entenda por que eu tenho repertorio, pro dia em que existir mentoria ou produto. Venda nao entra agora, por decisao minha.'),

      -- Linha editorial
      ('linha-editorial', 'ideia-central',
       'Eu encontro um problema, entendo o processo, penso numa solucao e construo uma forma melhor de fazer. Todo conteudo tem que caber nessa frase.'),
      ('linha-editorial', 'temas',
       'Empresario (decisao, risco, processo, gestao, gargalo). Inteligencia Artificial e Sistemas (tecnologia aplicada a um problema real). Assessor (o oficio, falando com pares, nunca captando cliente). Mercado Financeiro (cenario traduzido pra quem toca negocio, so quando ha gatilho). Vida Pessoal (respiro leve, sem obrigacao).'),
      ('linha-editorial', 'transformacao',
       'Tirar a pessoa do improviso operacional: do trabalho que sempre recomeca do zero pro processo documentado que outra pessoa, ou um sistema, consegue repetir.'),
      ('linha-editorial', 'tipos-conteudo',
       'Video espontaneo mostrando a tela e o sistema sendo construido, que e o formato ancora. Carrossel com raciocinio em etapas (problema, raciocinio, construcao, resultado). Stories de bastidor e antes e depois. Video produzido so pros fixados e pro conteudo manifesto. Estatico so quando a frase por si ja e o conteudo.'),
      ('linha-editorial', 'lema',
       'Gerar valor gastando o minimo de tempo possivel, sem perder profundidade.'),

      -- Persona
      ('persona-brand', 'quem-e',
       'O profissional em ponto de inflexao. Nao e iniciante: tem repertorio tecnico e alguns anos de operacao, e chegou num momento em que o modelo atual ja entregou o que tinha pra entregar. Vem em duas variacoes. A) o assessor ou profissional tecnico preso ao modelo tradicional, que entende a tecnica mas nao o proprio negocio. B) o empresario em consolidacao, com negocio rodando, que sente a operacao dependendo demais de gente e de retrabalho.'),
      ('persona-brand', 'dores',
       'Trabalha muito e sente que esta sempre recomecando do zero em tarefa que deveria ser repetivel. Nao sabe separar risco real de medo disfarcado de prudencia. Desconfia de IA porque ja viu gente vendendo solucao magica sem aplicacao. Nao sabe o que vale documentar e o que e perda de tempo.'),
      ('persona-brand', 'desejos',
       'Ser percebida como quem resolve, nao como quem discursa. Ter negocio ou carreira que nao dependa so do proprio tempo pra crescer. Ver, de forma concreta, alguem parecido que ja fez essa transicao.'),
      ('persona-brand', 'crencas',
       'Que o custo de errar na mudanca e maior que o custo de continuar estagnado. Que documentar e importante, mas nunca sobra tempo porque esta ocupada operando no improviso. Que usar tecnologia talvez signifique perder o que a diferencia como profissional.'),
      ('persona-brand', 'comportamento',
       'Consome conteudo tecnico e de negocio, desconfia de guru e de promessa facil, e para no conteudo que mostra processo real em vez de resultado. Salva mais do que comenta.'),

      -- Tom de voz
      ('tom-de-voz', 'estilo',
       'Registro, nao declaracao. Fiz isso, testei isso, cheguei aqui, em vez de eu acredito que empresas precisam de processo. Direto, sem jargao de marketing, no tom de quem explica pra um colega, inclusive quando a decisao deu errado.'),
      ('tom-de-voz', 'palavras',
       'Gargalo, processo, sistema, dor, escalar, retrabalho, documentar, risco calculado, dia a dia, na pratica, antes e depois, transformei a dor em solucao, segundo cerebro.'),
      ('tom-de-voz', 'evitar',
       'Discurso motivacional sem decisao real por tras. Dica generica de empreendedorismo. Noticia de IA sem aplicacao. Dica de investimento pra pessoa fisica. Tutorial de programacao. CTA de contrate minha assessoria ou abra sua conta comigo. Qualquer coisa que me posicione como especialista em IA. Vida pessoal expondo saude, familia ou vulnerabilidade pesada. Ostentacao.'),
      ('tom-de-voz', 'referencias',
       'Uso a estrutura de criadores como o Bruno Perini como referencia de formato e gancho, nunca de assunto ou de tom. Engenharia reversa de estrutura, nao copia de estilo.'),
      ('tom-de-voz', 'emocao',
       'Reconhecimento e possibilidade: esse cara viveu o que eu estou vivendo, e tem um caminho. Nao admiracao distante, nao urgencia de compra.'),

      -- Inspiracoes pessoais (deducao)
      ('moodboard-inspiracoes', 'criadores',
       'Bruno Perini, pela estrutura de gancho e pela clareza ao traduzir assunto denso.'),
      ('moodboard-inspiracoes', 'marcas',
       'Marcas que mostram o processo em vez de vender o resultado pronto, na mesma logica do build in public.'),
      ('moodboard-inspiracoes', 'conteudos',
       'Conteudo que mostra bastidor de construcao: tela, decisao, erro e correcao, em vez de caso de sucesso ja embrulhado.'),

      -- Visual e estilo (deducao, e o bloco com menos base nos documentos)
      ('moodboard-visual', 'cores',
       'Base escura e sobria com um acento unico. Nada de paleta colorida: o conteudo e raciocinio, e cor demais compete com o texto na tela.'),
      ('moodboard-visual', 'estetica',
       'Captacao real: tela, reuniao, rotina. Texto grande sobreposto, legenda dinamica, corte seco. Pouca producao, nenhuma estetica de video gerado por IA.'),
      ('moodboard-visual', 'referencias-visuais',
       'Gravacao de tela e bastidor de construcao, no padrao build in public, com aparencia de registro e nao de peca publicitaria.')
    ) as t(secao, chave, resposta)
  loop
    -- Existe a linha mas a resposta esta vazia? Preenche.
    update public.moodboard_entries
       set answer = _r.resposta, updated_at = now()
     where user_id = _uid
       and section = _r.secao
       and question_key = _r.chave
       and coalesce(btrim(answer), '') = '';

    -- Nao existe linha nenhuma pra essa pergunta? Cria.
    -- (Se existe COM texto, o update acima nao pegou e o exists abaixo barra:
    --  resposta antiga fica intacta, que e o combinado deste bloco.)
    if not exists (
      select 1 from public.moodboard_entries
       where user_id = _uid and section = _r.secao and question_key = _r.chave
    ) then
      insert into public.moodboard_entries (user_id, section, question_key, answer)
      values (_uid, _r.secao, _r.chave, _r.resposta);
    end if;
  end loop;
end
$bloco1$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 2 · TOM DE VOZ, EXPRESSOES E PALAVRAS QUE EVITO.
-- So insere o que ainda nao existe com o mesmo nome. Nao mexe em cor e fonte.
-- ───────────────────────────────────────────────────────────────────────────
do $bloco2$
declare
  _uid uuid;
  _r record;
  _pos int;
begin
  select id into _uid from auth.users where lower(email) = 'walterjoose@gmail.com';
  if _uid is null then
    raise exception 'usuario walterjoose@gmail.com nao encontrado';
  end if;

  for _r in
    select * from (values
      ('tom', 'Registro, nao declaracao'),
      ('tom', 'Direto e sem jargao de marketing'),
      ('tom', 'Mostra o erro junto com o acerto'),

      ('expressao', 'gargalo'),
      ('expressao', 'retrabalho'),
      ('expressao', 'documentar o processo'),
      ('expressao', 'transformar a dor em solucao'),
      ('expressao', 'segundo cerebro'),
      ('expressao', 'escalar sem escalar retrabalho'),
      ('expressao', 'na pratica'),

      ('evitar', 'guru'),
      ('evitar', 'formula'),
      ('evitar', 'solucao magica'),
      ('evitar', 'revolucionario'),
      ('evitar', 'especialista em IA'),
      ('evitar', 'invista comigo'),
      ('evitar', 'motivacional generico')
    ) as t(tipo, nome)
  loop
    if not exists (
      select 1 from public.brand_items
       where user_id = _uid and type = _r.tipo and lower(btrim(name)) = lower(btrim(_r.nome))
    ) then
      select coalesce(max(position), -1) + 1 into _pos
        from public.brand_items where user_id = _uid and type = _r.tipo;

      insert into public.brand_items (user_id, type, name, position)
      values (_uid, _r.tipo, _r.nome, _pos);
    end if;
  end loop;
end
$bloco2$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 3 · A PERSONA.
-- So cria se ainda nao existir uma persona com esse nome.
-- ───────────────────────────────────────────────────────────────────────────
do $bloco3$
declare
  _uid uuid;
begin
  select id into _uid from auth.users where lower(email) = 'walterjoose@gmail.com';
  if _uid is null then
    raise exception 'usuario walterjoose@gmail.com nao encontrado';
  end if;

  if exists (
    select 1 from public.personas
     where user_id = _uid and lower(btrim(name)) = lower('O Profissional em Ponto de Inflexao')
  ) then
    raise notice 'persona ja existe, nada foi criado';
    return;
  end if;

  insert into public.personas (
    user_id, name, age_range, gender, location,
    pain_points, desires, interests, objections, platforms,
    how_you_help, notes
  ) values (
    _uid,
    'O Profissional em Ponto de Inflexao',
    '30 a 45 anos',
    'Predominantemente masculino, sem exclusao',
    'Brasil, capitais e cidades medias',
    array[
      'Trabalha muito e sente que esta sempre recomecando do zero em tarefa que deveria ser repetivel',
      'Nao sabe separar risco real de medo disfarcado de prudencia',
      'Desconfia de IA porque ja viu gente vendendo solucao magica sem aplicacao nenhuma',
      'Nao sabe o que vale documentar e o que e perda de tempo',
      'A operacao depende demais de gente e de retrabalho pra crescer'
    ],
    array[
      'Ser percebido como quem resolve, nao como quem discursa',
      'Ter negocio ou carreira que nao dependa so do proprio tempo pra crescer',
      'Ver de forma concreta alguem parecido que ja fez essa transicao',
      'Sair do modelo tradicional sem que isso seja suicidio profissional'
    ],
    array[
      'Gestao e processo',
      'Tecnologia aplicada a negocio',
      'Automacao e sistemas proprios',
      'Mercado financeiro como cenario, nao como dica',
      'Bastidor de quem constroi'
    ],
    array[
      'Se eu mudar agora, perco o que ja construi',
      'IA e modinha, daqui a pouco passa',
      'Nao tenho tempo pra documentar, tenho que operar',
      'Isso funciona pra ele porque ele sabe programar'
    ],
    array['Instagram', 'YouTube', 'LinkedIn'],
    'Mostro no meu proprio dia a dia como se identifica um gargalo, se documenta o processo e se constroi uma solucao pra ele, com o antes e o depois medido. Nao vendo metodo: mostro decisao real, inclusive a que deu errado.',
    'Duas variacoes da mesma pessoa. A) assessor ou profissional tecnico preso ao modelo tradicional, entende a tecnica mas nao o proprio negocio. B) empresario em consolidacao, negocio ja rodando, quer eficiencia e menos dependencia de gente. Fonte: estrategia de marca escrita pela Gabriela em 16/09/2026.'
  );
end
$bloco3$;


-- ═══════════════════════════════════════════════════════════════════════════
-- DAQUI PRA BAIXO E OPCIONAL E SOBRESCREVE COISA. LEIA ANTES.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 4 (OPCIONAL) · SOBRESCREVE o que o posicionamento novo substituiu.
--
-- Rode SO se o bloco 0 mostrou resposta antiga em linha-editorial, tom-de-voz
-- ou persona-brand. Essas tres secoes sao exatamente as que a estrategia nova
-- redefiniu: manter a versao velha ao lado da nova faz a IA receber duas
-- direcoes diferentes, que e pior que nao ter nenhuma.
--
-- O bloco 1 ja deixou o texto novo pronto pras perguntas que estavam vazias.
-- Este aqui forca o texto novo TAMBEM por cima das que tinham resposta.
-- Salve o resultado do bloco 0 antes, se quiser poder voltar atras.
-- ───────────────────────────────────────────────────────────────────────────
update public.moodboard_entries m
   set answer = novo.resposta, updated_at = now()
  from (values
    ('linha-editorial', 'ideia-central',
     'Eu encontro um problema, entendo o processo, penso numa solucao e construo uma forma melhor de fazer. Todo conteudo tem que caber nessa frase.'),
    ('linha-editorial', 'temas',
     'Empresario (decisao, risco, processo, gestao, gargalo). Inteligencia Artificial e Sistemas (tecnologia aplicada a um problema real). Assessor (o oficio, falando com pares, nunca captando cliente). Mercado Financeiro (cenario traduzido pra quem toca negocio, so quando ha gatilho). Vida Pessoal (respiro leve, sem obrigacao).'),
    ('linha-editorial', 'transformacao',
     'Tirar a pessoa do improviso operacional: do trabalho que sempre recomeca do zero pro processo documentado que outra pessoa, ou um sistema, consegue repetir.'),
    ('linha-editorial', 'tipos-conteudo',
     'Video espontaneo mostrando a tela e o sistema sendo construido, que e o formato ancora. Carrossel com raciocinio em etapas (problema, raciocinio, construcao, resultado). Stories de bastidor e antes e depois. Video produzido so pros fixados e pro conteudo manifesto. Estatico so quando a frase por si ja e o conteudo.'),
    ('linha-editorial', 'lema',
     'Gerar valor gastando o minimo de tempo possivel, sem perder profundidade.'),

    ('persona-brand', 'quem-e',
     'O profissional em ponto de inflexao. Nao e iniciante: tem repertorio tecnico e alguns anos de operacao, e chegou num momento em que o modelo atual ja entregou o que tinha pra entregar. Vem em duas variacoes. A) o assessor ou profissional tecnico preso ao modelo tradicional, que entende a tecnica mas nao o proprio negocio. B) o empresario em consolidacao, com negocio rodando, que sente a operacao dependendo demais de gente e de retrabalho.'),
    ('persona-brand', 'dores',
     'Trabalha muito e sente que esta sempre recomecando do zero em tarefa que deveria ser repetivel. Nao sabe separar risco real de medo disfarcado de prudencia. Desconfia de IA porque ja viu gente vendendo solucao magica sem aplicacao. Nao sabe o que vale documentar e o que e perda de tempo.'),
    ('persona-brand', 'desejos',
     'Ser percebida como quem resolve, nao como quem discursa. Ter negocio ou carreira que nao dependa so do proprio tempo pra crescer. Ver, de forma concreta, alguem parecido que ja fez essa transicao.'),
    ('persona-brand', 'crencas',
     'Que o custo de errar na mudanca e maior que o custo de continuar estagnado. Que documentar e importante, mas nunca sobra tempo porque esta ocupada operando no improviso. Que usar tecnologia talvez signifique perder o que a diferencia como profissional.'),
    ('persona-brand', 'comportamento',
     'Consome conteudo tecnico e de negocio, desconfia de guru e de promessa facil, e para no conteudo que mostra processo real em vez de resultado. Salva mais do que comenta.'),

    ('tom-de-voz', 'estilo',
     'Registro, nao declaracao. Fiz isso, testei isso, cheguei aqui, em vez de eu acredito que empresas precisam de processo. Direto, sem jargao de marketing, no tom de quem explica pra um colega, inclusive quando a decisao deu errado.'),
    ('tom-de-voz', 'palavras',
     'Gargalo, processo, sistema, dor, escalar, retrabalho, documentar, risco calculado, dia a dia, na pratica, antes e depois, transformei a dor em solucao, segundo cerebro.'),
    ('tom-de-voz', 'evitar',
     'Discurso motivacional sem decisao real por tras. Dica generica de empreendedorismo. Noticia de IA sem aplicacao. Dica de investimento pra pessoa fisica. Tutorial de programacao. CTA de contrate minha assessoria ou abra sua conta comigo. Qualquer coisa que me posicione como especialista em IA. Vida pessoal expondo saude, familia ou vulnerabilidade pesada. Ostentacao.'),
    ('tom-de-voz', 'referencias',
     'Uso a estrutura de criadores como o Bruno Perini como referencia de formato e gancho, nunca de assunto ou de tom. Engenharia reversa de estrutura, nao copia de estilo.'),
    ('tom-de-voz', 'emocao',
     'Reconhecimento e possibilidade: esse cara viveu o que eu estou vivendo, e tem um caminho. Nao admiracao distante, nao urgencia de compra.')
  ) as novo(secao, chave, resposta)
 where m.user_id = (select id from auth.users where lower(email) = 'walterjoose@gmail.com')
   and m.section = novo.secao
   and m.question_key = novo.chave;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 5 (OPCIONAL) · OS CINCO PILARES.
--
-- ATENCAO: o limite do app e sete pilares, e post ja publicado guarda o pilar
-- que voce marcou nele. Este bloco ATUALIZA pelo nome quando encontra e INSERE
-- o que falta. Ele nao apaga nada, de proposito: apagar pilar aqui deixaria
-- post orfao sem voce ver. Se sobrar pilar antigo, apague na tela, um a um.
-- ───────────────────────────────────────────────────────────────────────────
do $bloco5$
declare
  _uid uuid;
  _r record;
  _quantos int;
begin
  select id into _uid from auth.users where lower(email) = 'walterjoose@gmail.com';
  if _uid is null then
    raise exception 'usuario walterjoose@gmail.com nao encontrado';
  end if;

  for _r in
    select * from (values
      (0, 'Empresario', '#C4622D',
       'Entra: decisao empresarial real, inclusive a errada; risco e primeira estrutura; identificacao de gargalo, documentacao de processo, delegacao, antes e depois de um fluxo; relacao de longo prazo com cliente. Nao entra: dica generica de empreendedorismo; discurso motivacional sem decisao por tras; conteudo institucional do Atlas. Peso sugerido: 42 por cento.'),
      (1, 'Inteligencia Artificial e Sistemas', '#2D6FC4',
       'Entra: como o Atlas foi construido (decisao tecnica, erro, teste); problema de negocio resolvido com automacao; por que desenvolver em vez de comprar pronto; ferramenta nova sempre a partir de um problema. Nao entra: noticia de lancamento sem aplicacao; tutorial de programacao; qualquer coisa que me posicione como especialista em IA. Peso sugerido: 28 por cento.'),
      (2, 'Assessor', '#3E8E6B',
       'Entra: como eu atuo (relacao de longo prazo, processo antes de venda); como virei assessor; o que e ser assessor de verdade e nao vendedor de produto financeiro; reflexao pra quem esta migrando, em tom de isso foi o que eu aprendi. Nao entra: dica de investimento pra captar cliente final; promessa de atendimento; CTA de contratar assessoria. Peso sugerido: 20 por cento.'),
      (3, 'Mercado Financeiro', '#8A6BC4',
       'Satelital, so com gatilho real. Entra: macroeconomia traduzida em impacto pratico pra quem empreende. Nao entra: obrigacao semanal de aula de macro; recomendacao pra pessoa fisica; o que qualquer analista de banco tambem postaria. Peso sugerido: 5 por cento.'),
      (4, 'Vida Pessoal', '#C49A2D',
       'Satelital, baixa frequencia, nunca obrigatorio. Entra: rotina fora do escritorio, humor sutil, marco pessoal sem ar institucional. Nao entra: saude, problema familiar, ostentacao, preenchimento sem conexao real. Peso sugerido: 5 por cento.')
    ) as t(pos, nome, cor, texto)
  loop
    update public.pillars
       set descricao = _r.texto
     where user_id = _uid and lower(btrim(name)) = lower(btrim(_r.nome));

    if not found then
      select count(*) into _quantos from public.pillars where user_id = _uid;
      if _quantos >= 7 then
        raise notice 'pilar % nao foi criado: ja existem 7 pilares', _r.nome;
      else
        insert into public.pillars (user_id, name, color, position, descricao)
        values (_uid, _r.nome, _r.cor, _r.pos, _r.texto);
      end if;
    end if;
  end loop;
end
$bloco5$;
