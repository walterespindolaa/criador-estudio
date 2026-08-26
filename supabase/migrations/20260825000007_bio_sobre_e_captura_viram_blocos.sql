-- ============================================================
-- "SOBRE MIM" E "CAPTURA DE LEAD" VIRAM BLOCOS
--
-- Esses dois nasceram como SEÇÕES: campos soltos dentro de bio_settings, com
-- um interruptor de liga/desliga numa lista fixa (banner, sobre, links,
-- captura). O motor de blocos tornou os dois redundantes: "Texto" faz o que o
-- Sobre mim fazia e "Captura de contato" faz o que a seção de lead fazia, com
-- a vantagem de poder ficar em qualquer posição da página, aparecer mais de
-- uma vez e ser agendado.
--
-- O editor já parou de mostrar os campos antigos. Se a página pública
-- continuasse lendo bio_settings, a pessoa ficaria com um formulário no ar que
-- ela não consegue mais editar; se parasse de ler sem converter, o formulário
-- sumiria do dia pra noite e a captação de leads pararia sem aviso. Nenhum dos
-- dois é aceitável, então este arquivo CONVERTE.
--
-- Idempotente: a origem fica marcada em data->>'de_bio_settings'. Rodar duas
-- vezes não duplica nada. bio_settings continua intocado fora do interruptor,
-- como rede de segurança: nenhum texto é apagado aqui.
--
-- POSIÇÃO: o Sobre mim entra ANTES do que já existe e a Captura entra DEPOIS,
-- que é a ordem padrão das seções antigas (sobre, links, captura). Quem tiver
-- reordenado é só arrastar.
--
-- TUDO OU NADA: begin/commit explícito. Se qualquer passo falhar no meio, as
-- posições empurradas voltam atrás junto. Sem isso, uma falha no passo 2
-- deixaria buraco de numeração sem o bloco que justificava o buraco.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────
-- Helper: lê o interruptor de uma seção com tolerância a lixo
--
-- `sections` já andou por três formatos e um deles gravava 'on' como texto.
-- Ler direto com (s->>'on')::boolean derruba a migration inteira por causa de
-- UMA linha estragada, e a subquery vive no WHERE, ou seja, é avaliada pra
-- toda linha da tabela e não só pras que vão ser convertidas.
-- ────────────────────────────────────────────────────────────
create or replace function public.bio_secao_ligada(_settings jsonb, _id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce((
    select s->>'on' in ('true', 't', '1', 'yes')
    from jsonb_array_elements(
           case when jsonb_typeof(_settings->'sections') = 'array'
                then _settings->'sections'
                else '[]'::jsonb end) s
    where s->>'id' = _id
    limit 1
  ), false);
$$;

-- ────────────────────────────────────────────────────────────
-- 1. Abre espaço no topo pra quem vai receber um bloco de Sobre mim
--
-- O filtro aceita texto OU imagem: a página pública desenhava o card com
-- qualquer um dos dois, então converter só quem tem texto deixaria o
-- Sobre-mim-só-de-foto sumir sem substituto.
-- ────────────────────────────────────────────────────────────
update public.bio_blocks b
set "position" = b."position" + 1
from public.profiles p
where b.user_id = p.id
  and b.page_id is null
  and b.estilo = 'classico'
  and (coalesce(trim(p.bio_settings->'about'->>'text'), '') <> ''
       or coalesce(trim(p.bio_settings->'about'->>'image'), '') <> '')
  and not exists (
    select 1 from public.bio_blocks x
    where x.user_id = p.id and x.page_id is null and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'about'
  );

-- bio_pages.manager_id não tem foreign key declarada, mas bio_blocks.user_id
-- tem. Uma página órfã (gestora cujo profile sumiu) faria o insert quebrar por
-- violação de chave e derrubaria o script inteiro. Melhor pular a órfã.
update public.bio_blocks b
set "position" = b."position" + 1
from public.bio_pages g
where b.page_id = g.id
  and b.estilo = 'classico'
  and (coalesce(trim(g.settings->'about'->>'text'), '') <> ''
       or coalesce(trim(g.settings->'about'->>'image'), '') <> '')
  and exists (select 1 from public.profiles pr where pr.id = g.manager_id)
  and not exists (
    select 1 from public.bio_blocks x
    where x.page_id = g.id and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'about'
  );

-- ────────────────────────────────────────────────────────────
-- 2. Sobre mim → bloco de Texto
--
-- Entra LIGADO se a seção estava ligada, desligado se não estava: a página
-- pública tem que continuar exatamente como o visitante viu ontem.
-- ────────────────────────────────────────────────────────────
insert into public.bio_blocks (user_id, page_id, estilo, kind, data, "position", is_active)
select
  p.id, null, 'classico', 'texto',
  jsonb_build_object(
    'titulo', coalesce(p.bio_settings->'about'->>'title', ''),
    'texto', coalesce(p.bio_settings->'about'->>'text', ''),
    'imagem', coalesce(p.bio_settings->'about'->>'image', ''),
    'de_bio_settings', 'about'
  ),
  0,
  public.bio_secao_ligada(p.bio_settings, 'about')
from public.profiles p
where (coalesce(trim(p.bio_settings->'about'->>'text'), '') <> ''
       or coalesce(trim(p.bio_settings->'about'->>'image'), '') <> '')
  and not exists (
    select 1 from public.bio_blocks x
    where x.user_id = p.id and x.page_id is null and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'about'
  );

insert into public.bio_blocks (user_id, page_id, estilo, kind, data, "position", is_active)
select
  g.manager_id, g.id, 'classico', 'texto',
  jsonb_build_object(
    'titulo', coalesce(g.settings->'about'->>'title', ''),
    'texto', coalesce(g.settings->'about'->>'text', ''),
    'imagem', coalesce(g.settings->'about'->>'image', ''),
    'de_bio_settings', 'about'
  ),
  0,
  public.bio_secao_ligada(g.settings, 'about')
from public.bio_pages g
where (coalesce(trim(g.settings->'about'->>'text'), '') <> ''
       or coalesce(trim(g.settings->'about'->>'image'), '') <> '')
  and exists (select 1 from public.profiles pr where pr.id = g.manager_id)
  and not exists (
    select 1 from public.bio_blocks x
    where x.page_id = g.id and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'about'
  );

-- ────────────────────────────────────────────────────────────
-- 3. Captura de lead → bloco de Captura de contato
--
-- Só converte quem tinha a seção LIGADA. Todo mundo tem o objeto `lead` no
-- bio_settings (ele nasce com valores padrão), então converter pelo objeto
-- criaria um formulário do nada em milhares de páginas que nunca pediram um.
--
-- Os padrões batem com os do front (parseSettings): quem tem a chave faltando
-- recebe o mesmo texto que já via na tela. Isso importa especialmente no
-- consentimento, que é a frase de LGPD embaixo do botão.
--
-- Vai pro fim da página, e o campo vira o mesmo que estava: 'both' virou
-- 'ambos', 'phone' virou 'telefone', qualquer outra coisa é 'email'.
-- ────────────────────────────────────────────────────────────
insert into public.bio_blocks (user_id, page_id, estilo, kind, data, "position", is_active)
select
  p.id, null, 'classico', 'captura',
  jsonb_build_object(
    'titulo', coalesce(p.bio_settings->'lead'->>'title', 'Receba novidades'),
    'subtitulo', coalesce(p.bio_settings->'lead'->>'subtitle', 'Deixe seu contato e eu te chamo.'),
    'campos', case p.bio_settings->'lead'->>'fields'
                when 'phone' then 'telefone'
                when 'both' then 'ambos'
                else 'email' end,
    'botao', coalesce(nullif(trim(coalesce(p.bio_settings->'lead'->>'buttonText', '')), ''), 'Enviar'),
    'consentimento', coalesce(p.bio_settings->'lead'->>'consentText',
                              'Ao enviar, você autoriza o uso dos seus dados para contato.'),
    'paraPipeline', false,
    'de_bio_settings', 'lead'
  ),
  coalesce((
    select max(b."position") + 1 from public.bio_blocks b
    where b.user_id = p.id and b.page_id is null and b.estilo = 'classico'
  ), 0),
  true
from public.profiles p
where public.bio_secao_ligada(p.bio_settings, 'lead')
  and not exists (
    select 1 from public.bio_blocks x
    where x.user_id = p.id and x.page_id is null and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'lead'
  );

insert into public.bio_blocks (user_id, page_id, estilo, kind, data, "position", is_active)
select
  g.manager_id, g.id, 'classico', 'captura',
  jsonb_build_object(
    'titulo', coalesce(g.settings->'lead'->>'title', 'Receba novidades'),
    'subtitulo', coalesce(g.settings->'lead'->>'subtitle', 'Deixe seu contato e eu te chamo.'),
    'campos', case g.settings->'lead'->>'fields'
                when 'phone' then 'telefone'
                when 'both' then 'ambos'
                else 'email' end,
    'botao', coalesce(nullif(trim(coalesce(g.settings->'lead'->>'buttonText', '')), ''), 'Enviar'),
    'consentimento', coalesce(g.settings->'lead'->>'consentText',
                              'Ao enviar, você autoriza o uso dos seus dados para contato.'),
    'paraPipeline', false,
    'de_bio_settings', 'lead'
  ),
  coalesce((
    select max(b."position") + 1 from public.bio_blocks b
    where b.page_id = g.id and b.estilo = 'classico'
  ), 0),
  true
from public.bio_pages g
where public.bio_secao_ligada(g.settings, 'lead')
  and exists (select 1 from public.profiles pr where pr.id = g.manager_id)
  and not exists (
    select 1 from public.bio_blocks x
    where x.page_id = g.id and x.estilo = 'classico'
      and x.data->>'de_bio_settings' = 'lead'
  );

-- ────────────────────────────────────────────────────────────
-- 4. Desliga as seções antigas de quem foi convertido
--
-- Não apaga o conteúdo: só baixa o interruptor, pra página pública não
-- desenhar o card duas vezes enquanto código antigo estiver em cache no
-- navegador de alguém.
--
-- Dois cuidados que parecem paranoia e não são:
--   · jsonb_agg de zero linhas devolve NULL, e jsonb_set é STRICT. Sem o
--     coalesce, um perfil com "sections": [] teria o bio_settings INTEIRO
--     (cores, fonte, fundo, header) sobrescrito por NULL, sem erro nenhum.
--   · with ordinality porque a ordem de `sections` é a ordem de render, e
--     jsonb_agg sem order by não garante ordem.
-- ────────────────────────────────────────────────────────────
update public.profiles p
set bio_settings = jsonb_set(
      p.bio_settings, '{sections}',
      coalesce((
        select jsonb_agg(
                 case when s.value->>'id' in ('about', 'lead')
                      then jsonb_set(s.value, '{on}', 'false'::jsonb)
                      else s.value end
                 order by s.ord)
        from jsonb_array_elements(p.bio_settings->'sections') with ordinality as s(value, ord)
      ), '[]'::jsonb)
    )
where jsonb_typeof(p.bio_settings->'sections') = 'array'
  and (public.bio_secao_ligada(p.bio_settings, 'about') or public.bio_secao_ligada(p.bio_settings, 'lead'));

update public.bio_pages g
set settings = jsonb_set(
      g.settings, '{sections}',
      coalesce((
        select jsonb_agg(
                 case when s.value->>'id' in ('about', 'lead')
                      then jsonb_set(s.value, '{on}', 'false'::jsonb)
                      else s.value end
                 order by s.ord)
        from jsonb_array_elements(g.settings->'sections') with ordinality as s(value, ord)
      ), '[]'::jsonb)
    )
where jsonb_typeof(g.settings->'sections') = 'array'
  and (public.bio_secao_ligada(g.settings, 'about') or public.bio_secao_ligada(g.settings, 'lead'));

commit;

-- ────────────────────────────────────────────────────────────
-- Conferência (rode depois, é só leitura)
-- ────────────────────────────────────────────────────────────
-- select
--   (select count(*) from public.bio_blocks where data->>'de_bio_settings' = 'about') as sobre_convertidos,
--   (select count(*) from public.bio_blocks where data->>'de_bio_settings' = 'lead')  as capturas_convertidas,
--   (select count(*) from public.bio_pages g
--     where not exists (select 1 from public.profiles pr where pr.id = g.manager_id)) as paginas_orfas_puladas;
