/* ═══════════════════════════════════════════════════════════════════════════
   CRIAKUT: PORTFÓLIO COM AS PEÇAS ENTREGUES PELO CRIA + CONVITE DA HOME
   (Walter, 30/10/2026, mockup aprovado)

   O prestador escolhe peças que entregou pelo Cria pra mostrar na página dele.
   Nenhuma aparece por padrão: quem decide é o dono da marca.
     1. prestador pede (criakut_portfolio_pedir)
     2. a regra fixa na ficha do cliente decide sozinha, se existir
        (crm_clients.portfolio_regra: nunca | sem_marca | com_marca);
        senão vai pra agência, que recusa ou repassa pro cliente
     3. o cliente decide no link de aprovação: não mostrar, sem marca, com marca
        e pode mudar de ideia depois.
   Tabela sem policy nenhuma: tudo passa pelas funções abaixo.
   ═══════════════════════════════════════════════════════════════════════════ */

alter table public.crm_clients add column if not exists portfolio_regra text;
do $$ begin
  alter table public.crm_clients add constraint crm_clients_portfolio_regra_chk
    check (portfolio_regra is null or portfolio_regra in ('nunca','sem_marca','com_marca'));
exception when duplicate_object then null; end $$;

create table if not exists public.criakut_portfolio_cria (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  agencia_id uuid not null,
  status text not null default 'com_agencia'
    check (status in ('com_agencia','com_cliente','liberada','recusada')),
  com_marca boolean not null default false,
  decidido_por text check (decidido_por in ('agencia','cliente','ficha')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  unique (prestador_id, post_id)
);
create index if not exists criakut_portfolio_cria_post on public.criakut_portfolio_cria (post_id);
alter table public.criakut_portfolio_cria enable row level security;
revoke all on public.criakut_portfolio_cria from anon, authenticated;

/* A capa da peça: a versão entregue mais recente que é imagem. */
create or replace function public.criakut_capa_da_peca(_post uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url)
  from external_media_refs m
  where m.post_id = _post and m.entrega and not coalesce(m.substituida, false)
    and coalesce(m.file_type, '') like 'image/%'
    and coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url) like 'https://%'
  order by m.rodada desc nulls last, m.position asc nulls last, m.created_at asc
  limit 1;
$$;
revoke execute on function public.criakut_capa_da_peca(uuid) from public, anon, authenticated;

/* De quem é a marca da peça: ficha do CRM (via external_clients). */
create or replace function public.criakut_marca_da_peca(_post uuid)
returns table (crm_id uuid, marca text, segmento text, regra text)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(nullif(btrim(c.display_name), ''), nullif(btrim(c.name), ''), nullif(btrim(ec.name), '')),
         nullif(btrim(c.segment), ''),
         c.portfolio_regra
  from posts p
  left join external_clients ec on ec.id = p.external_client_id
  left join crm_clients c on c.id = ec.crm_client_id and c.deleted_at is null
  where p.id = _post;
$$;
revoke execute on function public.criakut_marca_da_peca(uuid) from public, anon, authenticated;

create or replace function public.criakut_rotulo_marca(_post uuid, _com_marca boolean)
returns text language sql stable security definer set search_path = public as $$
  select case
    when _com_marca and m.marca is not null then m.marca
    when m.segmento is not null then 'Marca de ' || lower(m.segmento)
    else 'Marca cliente do Cria' end
  from public.criakut_marca_da_peca(_post) m;
$$;
revoke execute on function public.criakut_rotulo_marca(uuid, boolean) from public, anon, authenticated;

/* ── PRESTADOR ─────────────────────────────────────────────────────────── */

-- Peças que ele entregou e que dá pra mostrar (têm imagem), com o andamento do pedido.
create or replace function public.criakut_minhas_pecas_cria()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _eu uuid := auth.uid();
begin
  if _eu is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'post_id', p.id, 'titulo', p.title, 'capa', x.capa,
      'segmento', (select segmento from public.criakut_marca_da_peca(p.id)),
      'status', pc.status, 'com_marca', pc.com_marca,
      'rotulo', case when pc.status = 'liberada' then public.criakut_rotulo_marca(p.id, pc.com_marca) end)
      order by p.updated_at desc)
    from posts p
    cross join lateral (select public.criakut_capa_da_peca(p.id) as capa) x
    left join criakut_portfolio_cria pc on pc.post_id = p.id and pc.prestador_id = _eu
    where p.assignee_id = _eu and p.producao_status = 'entregue' and x.capa is not null
  ), '[]'::jsonb);
end $$;
grant execute on function public.criakut_minhas_pecas_cria() to authenticated;

-- Pede autorização pras peças marcadas. Devolve quantas ficaram em cada estado.
create or replace function public.criakut_portfolio_pedir(_posts uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _eu uuid := auth.uid(); _p record; _m record; _ag uuid; _st text; _cm boolean; _por text;
  _nome text; _n_ag int;
begin
  if _eu is null then raise exception 'sem_login'; end if;
  if coalesce(array_length(_posts, 1), 0) = 0 then return jsonb_build_object('pedidos', 0); end if;
  select coalesce(nullif(btrim(name), ''), 'Seu parceiro') into _nome from profiles where id = _eu;
  for _p in
    select p.* from posts p
    where p.id = any(_posts) and p.assignee_id = _eu and p.producao_status = 'entregue'
      and public.criakut_capa_da_peca(p.id) is not null
      and not exists (select 1 from criakut_portfolio_cria c where c.post_id = p.id and c.prestador_id = _eu)
  loop
    _ag := coalesce(_p.agencia_id, _p.user_id);
    select * into _m from public.criakut_marca_da_peca(_p.id);
    _cm := false; _por := null;
    if _m.regra = 'nunca' then _st := 'recusada'; _por := 'ficha';
    elsif _m.regra = 'sem_marca' then _st := 'liberada'; _por := 'ficha';
    elsif _m.regra = 'com_marca' then _st := 'liberada'; _cm := true; _por := 'ficha';
    else _st := 'com_agencia';
    end if;
    insert into criakut_portfolio_cria (prestador_id, post_id, agencia_id, status, com_marca, decidido_por, decidido_em)
    values (_eu, _p.id, _ag, _st, _cm, _por, case when _por is not null then now() end);
    -- O aviso abre o card da peça, onde a agência decide.
    if _st = 'com_agencia' then
      insert into notifications (user_id, type, title, description, link)
      values (_ag, 'portfolio_pedido',
        '🖼️ ' || split_part(_nome, ' ', 1) || ' quer mostrar no portfólio: ' || coalesce(nullif(btrim(_p.title), ''), 'uma peça'),
        'Recuse ou peça a autorização do cliente, aqui no card.',
        public.link_da_peca(_p.id, _p.external_client_id, false));
    end if;
  end loop;

  select count(*) into _n_ag from criakut_portfolio_cria where prestador_id = _eu and post_id = any(_posts);
  return jsonb_build_object('pedidos', _n_ag);
end $$;
grant execute on function public.criakut_portfolio_pedir(uuid[]) to authenticated;

create or replace function public.criakut_portfolio_tirar(_post uuid)
returns void language sql security definer set search_path = public as $$
  delete from criakut_portfolio_cria where post_id = _post and prestador_id = auth.uid();
$$;
grant execute on function public.criakut_portfolio_tirar(uuid) to authenticated;

/* ── AGÊNCIA (dentro do card da peça) ──────────────────────────────────── */

create or replace function public.portfolio_pedido_do_card(_post uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'status', c.status, 'com_marca', c.com_marca,
      'prestador', coalesce(nullif(btrim(m.name), ''), nullif(btrim(pr.name), ''), 'Parceiro'),
      'regra_da_ficha', (select regra from public.criakut_marca_da_peca(c.post_id))))
    from criakut_portfolio_cria c
    left join profiles pr on pr.id = c.prestador_id
    left join manager_members m on m.member_id = c.prestador_id and m.manager_id = c.agencia_id
    where c.post_id = _post and public.acts_for(c.agencia_id)
  ), '[]'::jsonb);
end $$;
grant execute on function public.portfolio_pedido_do_card(uuid) to authenticated;

create or replace function public.portfolio_decidir_agencia(_id uuid, _acao text)
returns void language plpgsql security definer set search_path = public as $$
declare _c criakut_portfolio_cria;
begin
  select * into _c from criakut_portfolio_cria where id = _id;
  if not found or not public.acts_for(_c.agencia_id) then raise exception 'sem_acesso'; end if;
  if _acao = 'pedir_cliente' then
    update criakut_portfolio_cria set status = 'com_cliente', decidido_por = null, decidido_em = null where id = _id;
  elsif _acao = 'recusar' then
    update criakut_portfolio_cria set status = 'recusada', com_marca = false, decidido_por = 'agencia', decidido_em = now() where id = _id;
    insert into notifications (user_id, type, title, description, link)
    values (_c.prestador_id, 'portfolio_recusado', 'Uma peça não vai pro portfólio',
      'A agência preferiu não mostrar essa peça. As outras seguem normais.', public.criakut_base(_c.prestador_id));
  else raise exception 'acao_invalida';
  end if;
end $$;
grant execute on function public.portfolio_decidir_agencia(uuid, text) to authenticated;

/* ── CLIENTE (link de aprovação, sem login) ────────────────────────────── */

create or replace function public.portfolio_pedidos_by_token(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _ec uuid;
begin
  select external_client_id into _ec from approval_tokens
  where token = _token and active and (expires_at is null or expires_at > now());
  if _ec is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', p.title, 'capa', public.criakut_capa_da_peca(p.id),
      'prestador', split_part(coalesce(nullif(btrim(pr.name), ''), 'Parceiro'), ' ', 1),
      'escolha', case when c.status = 'com_cliente' then null
                      when c.status = 'recusada' then 'nao'
                      when c.com_marca then 'com_marca' else 'sem_marca' end,
      'rotulo_sem_marca', public.criakut_rotulo_marca(p.id, false))
      order by c.criado_em desc)
    from criakut_portfolio_cria c
    join posts p on p.id = c.post_id and p.external_client_id = _ec
    left join profiles pr on pr.id = c.prestador_id
    where c.status = 'com_cliente' or c.decidido_por = 'cliente'
  ), '[]'::jsonb);
end $$;
grant execute on function public.portfolio_pedidos_by_token(text) to anon, authenticated;

create or replace function public.portfolio_decidir_by_token(_token text, _id uuid, _escolha text)
returns void language plpgsql security definer set search_path = public as $$
declare _ec uuid; _c criakut_portfolio_cria;
begin
  if _escolha not in ('nao','sem_marca','com_marca') then raise exception 'escolha_invalida'; end if;
  select external_client_id into _ec from approval_tokens
  where token = _token and active and (expires_at is null or expires_at > now());
  if _ec is null then raise exception 'link_invalido'; end if;
  select c.* into _c from criakut_portfolio_cria c join posts p on p.id = c.post_id
  where c.id = _id and p.external_client_id = _ec and (c.status = 'com_cliente' or c.decidido_por = 'cliente');
  if not found then raise exception 'sem_acesso'; end if;
  update criakut_portfolio_cria
     set status = case when _escolha = 'nao' then 'recusada' else 'liberada' end,
         com_marca = (_escolha = 'com_marca'), decidido_por = 'cliente', decidido_em = now()
   where id = _id;
  if _c.status = 'com_cliente' then
    insert into notifications (user_id, type, title, description, link)
    values (_c.prestador_id,
      case when _escolha = 'nao' then 'portfolio_recusado' else 'portfolio_liberado' end,
      case when _escolha = 'nao' then 'O cliente preferiu não mostrar uma peça' else '🖼️ Peça liberada pro seu portfólio' end,
      case when _escolha = 'nao' then 'Ela continua só pra você ver.' when _escolha = 'com_marca' then 'Aparece com a marca do cliente.' else 'Aparece sem o nome da marca.' end,
      public.criakut_base(_c.prestador_id));
  end if;
end $$;
grant execute on function public.portfolio_decidir_by_token(text, uuid, text) to anon, authenticated;

/* ── PÁGINA PÚBLICA ────────────────────────────────────────────────────── */

-- Só as liberadas, com as mesmas regras de quem pode ver a página.
create or replace function public.criakut_portfolio_publico(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _p criakut_perfis; _eu uuid := auth.uid();
begin
  if _eu is null then return '[]'::jsonb; end if;
  select * into _p from criakut_perfis where slug = lower(_slug);
  if not found then return '[]'::jsonb; end if;
  if _p.user_id <> _eu and (not _p.publicado or not public.criakut_tem_acesso()) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('post_id', c.post_id, 'capa', x.capa,
      'rotulo', public.criakut_rotulo_marca(c.post_id, c.com_marca)) order by c.decidido_em desc)
    from criakut_portfolio_cria c
    cross join lateral (select public.criakut_capa_da_peca(c.post_id) as capa) x
    where c.prestador_id = _p.user_id and c.status = 'liberada' and x.capa is not null
  ), '[]'::jsonb);
end $$;
grant execute on function public.criakut_portfolio_publico(text) to authenticated;

/* ── CONVITE DA HOME ───────────────────────────────────────────────────── */

create or replace function public.criakut_meu_convite()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _eu uuid := auth.uid(); _p criakut_perfis; _papel text;
begin
  if _eu is null or not public.criakut_tem_acesso() then return null; end if;
  select * into _p from criakut_perfis where user_id = _eu;
  select m.role into _papel from manager_members m
   where m.member_id = _eu and m.status = 'ativo' and public.eh_papel_parceiro(m.role) limit 1;
  return jsonb_build_object(
    'base', public.criakut_base(_eu),
    'tem_pagina', _p.user_id is not null,
    'publicado', coalesce(_p.publicado, false),
    'slug', _p.slug, 'nome', _p.nome, 'foto_url', _p.foto_url, 'capa_url', _p.capa_url,
    'cidade', _p.cidade,
    'tem_capa', _p.user_id is not null and coalesce(_p.capa_tipo, 'cria-1') <> 'cria-1',
    'tem_busco', coalesce(array_length(_p.busco, 1), 0) > 0 or coalesce(btrim(_p.busco_texto), '') <> '',
    'servicos', (select count(*) from criakut_servicos where user_id = _eu),
    'preco_min_centavos', (select min(preco_centavos) from criakut_servicos where user_id = _eu and preco_centavos > 0),
    'portfolio', (select count(*) from criakut_portfolio where user_id = _eu)
                 + (select count(*) from criakut_portfolio_cria where prestador_id = _eu and status = 'liberada'),
    'portfolio_aguardando', (select count(*) from criakut_portfolio_cria where prestador_id = _eu and status in ('com_agencia','com_cliente')),
    'entregas_no_cria', (select count(*) from posts where assignee_id = _eu and producao_status = 'entregue'),
    'papel', _papel,
    'seguidores', (select max(followers_count) from social_connections where user_id = _eu and crm_client_id is null and provider = 'instagram'),
    'visitas_30d', (select count(distinct visitante_id) from criakut_visitas where visitado_id = _eu and dia > current_date - 30),
    'pedidos_30d', (select count(*) from criakut_propostas where contratado_id = _eu and criado_em > now() - interval '30 days'));
end $$;
grant execute on function public.criakut_meu_convite() to authenticated;
