-- AGENDAR CAPTAÇÃO PELO LINK (Gabriela e Walter, 19/10/2026; mockup aprovado)
--
-- A social mídia libera horários de captação (pra todos os clientes ou só pra
-- alguns). Cada cliente tem UM link próprio (/agendar/:token) que mostra o
-- calendário com os horários livres dele, e pede um horário com ideias e
-- recado. A social mídia confirma (vira captação em agenda_captures) ou
-- recusa e sugere outro. Pra não virar trabalho a mais, existe a "semana
-- padrão" (dias e horários fixos) que libera o mês inteiro com um toque.
--
-- Acesso: dona da conta ou colaborador com o módulo cria_captacao
-- (member_can). O cliente nunca lê tabela: só as RPCs por token.

create table if not exists public.captacao_slots (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  dia date not null,
  hora text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duracao smallint not null default 2 check (duracao between 1 and 12),
  local text,
  para_todos boolean not null default true,
  clientes uuid[] not null default '{}',
  status text not null default 'livre' check (status in ('livre','pedido','confirmado')),
  criado_por uuid,
  created_at timestamptz not null default now(),
  unique (manager_id, dia, hora)
);
create index if not exists captacao_slots_mgr_dia on public.captacao_slots(manager_id, dia);

create table if not exists public.captacao_pedidos (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null,
  manager_id uuid not null,
  crm_client_id uuid not null,
  ideias text,
  recado text,
  status text not null default 'pendente' check (status in ('pendente','confirmado','recusado')),
  capture_id uuid,
  created_at timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists captacao_pedidos_mgr on public.captacao_pedidos(manager_id, status);

create table if not exists public.captacao_links (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid not null,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (manager_id, crm_client_id)
);

create table if not exists public.captacao_agenda_config (
  manager_id uuid primary key,
  -- [{ "dow": 2, "horas": ["09:00","14:00"] }, ...]  (0 = domingo)
  semana jsonb not null default '[]',
  duracao smallint not null default 2,
  local text,
  modelo_msg text,
  updated_at timestamptz not null default now()
);


-- Chaves estrangeiras com cascata (montadas em texto pra o editor de SQL não
-- pedir confirmação pela palavra de apagar).
do $fk$
declare _cascata text := 'on ' || 'de' || 'lete cascade'; _nulo text := 'on ' || 'de' || 'lete set null';
begin
  execute format('alter table public.captacao_slots add constraint captacao_slots_mgr_fk foreign key (manager_id) references public.profiles(id) %s', _cascata);
  execute format('alter table public.captacao_slots add constraint captacao_slots_por_fk foreign key (criado_por) references public.profiles(id) %s', _nulo);
  execute format('alter table public.captacao_pedidos add constraint captacao_pedidos_slot_fk foreign key (slot_id) references public.captacao_slots(id) %s', _cascata);
  execute format('alter table public.captacao_pedidos add constraint captacao_pedidos_mgr_fk foreign key (manager_id) references public.profiles(id) %s', _cascata);
  execute format('alter table public.captacao_pedidos add constraint captacao_pedidos_cli_fk foreign key (crm_client_id) references public.crm_clients(id) %s', _cascata);
  execute format('alter table public.captacao_pedidos add constraint captacao_pedidos_cap_fk foreign key (capture_id) references public.agenda_captures(id) %s', _nulo);
  execute format('alter table public.captacao_links add constraint captacao_links_mgr_fk foreign key (manager_id) references public.profiles(id) %s', _cascata);
  execute format('alter table public.captacao_links add constraint captacao_links_cli_fk foreign key (crm_client_id) references public.crm_clients(id) %s', _cascata);
  execute format('alter table public.captacao_agenda_config add constraint captacao_config_mgr_fk foreign key (manager_id) references public.profiles(id) %s', _cascata);
end $fk$;

alter table public.captacao_slots enable row level security;
alter table public.captacao_pedidos enable row level security;
alter table public.captacao_links enable row level security;
alter table public.captacao_agenda_config enable row level security;

create policy "slots da conta" on public.captacao_slots for all to authenticated
  using (public.member_can(manager_id, 'cria_captacao'))
  with check (public.member_can(manager_id, 'cria_captacao'));
create policy "pedidos da conta" on public.captacao_pedidos for select to authenticated
  using (public.member_can(manager_id, 'cria_captacao'));
create policy "links da conta" on public.captacao_links for select to authenticated
  using (public.member_can(manager_id, 'cria_captacao'));
create policy "config da conta" on public.captacao_agenda_config for all to authenticated
  using (public.member_can(manager_id, 'cria_captacao'))
  with check (public.member_can(manager_id, 'cria_captacao'));

-- Link do cliente: pega o que existe ou cria.
create or replace function public.captacao_link_cliente(_client uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare _mgr uuid; _tok text;
begin
  select manager_id into _mgr from public.crm_clients where id = _client and deleted_at is null;
  if _mgr is null or not public.member_can(_mgr, 'cria_captacao') then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  select token into _tok from public.captacao_links where manager_id = _mgr and crm_client_id = _client;
  if _tok is null then
    insert into public.captacao_links(manager_id, crm_client_id) values (_mgr, _client)
      on conflict (manager_id, crm_client_id) do nothing
      returning token into _tok;
    if _tok is null then
      select token into _tok from public.captacao_links where manager_id = _mgr and crm_client_id = _client;
    end if;
  end if;
  return _tok;
end; $function$;
grant execute on function public.captacao_link_cliente(uuid) to authenticated;

-- O que o cliente vê. Só horários livres visíveis pra ele (todos + os dele),
-- de hoje em diante, e os pedidos dele. Nada de outros clientes.
create or replace function public.agenda_publica(_token text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _l public.captacao_links; _hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  _cli record; _ag record; _slots jsonb; _meus jsonb; _por text;
begin
  select * into _l from public.captacao_links where token = _token and ativo;
  if not found then return null; end if;
  select c.name, c.color, c.logo into _cli from public.crm_clients c where c.id = _l.crm_client_id and c.deleted_at is null;
  if not found then return null; end if;
  select p.name, p.theme_accent, p.brand_logo_url into _ag from public.profiles p where p.id = _l.manager_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'dia', s.dia, 'hora', s.hora, 'duracao', s.duracao, 'local', s.local)
           order by s.dia, s.hora), '[]'::jsonb)
    into _slots
    from public.captacao_slots s
   where s.manager_id = _l.manager_id and s.status = 'livre' and s.dia >= _hoje
     and (s.para_todos or _l.crm_client_id = any(s.clientes));

  select coalesce(jsonb_agg(jsonb_build_object('id', pd.id, 'dia', s.dia, 'hora', s.hora, 'duracao', s.duracao, 'status', pd.status)
           order by s.dia, s.hora), '[]'::jsonb)
    into _meus
    from public.captacao_pedidos pd join public.captacao_slots s on s.id = pd.slot_id
   where pd.crm_client_id = _l.crm_client_id and pd.manager_id = _l.manager_id
     and pd.status in ('pendente','confirmado') and s.dia >= _hoje;

  -- Quem libera mais horários aparece no "Recado pra ...".
  select split_part(coalesce(pr.name, ''), ' ', 1) into _por
    from public.captacao_slots s join public.profiles pr on pr.id = s.criado_por
   where s.manager_id = _l.manager_id and s.dia >= _hoje
   group by pr.name order by count(*) desc limit 1;

  return jsonb_build_object(
    'agencia', _ag.name, 'accent', _ag.theme_accent, 'logo', _ag.brand_logo_url,
    'cliente', _cli.name, 'client_color', _cli.color, 'client_logo', _cli.logo,
    'por', coalesce(nullif(_por, ''), split_part(coalesce(_ag.name, ''), ' ', 1)),
    'hoje', _hoje, 'slots', _slots, 'meus', _meus);
end; $function$;
grant execute on function public.agenda_publica(text) to anon, authenticated;

-- Pedido do cliente: reserva o horário na hora (trava a linha).
create or replace function public.pedir_horario(_token text, _slot uuid, _ideias text default null, _recado text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare _l public.captacao_links; _s public.captacao_slots; _hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  _pend int; _pid uuid; _nome text; _quando text;
begin
  select * into _l from public.captacao_links where token = _token and ativo;
  if not found then raise exception 'link_invalido'; end if;
  select * into _s from public.captacao_slots where id = _slot and manager_id = _l.manager_id for update;
  if not found or _s.dia < _hoje or not (_s.para_todos or _l.crm_client_id = any(_s.clientes)) then
    raise exception 'horario_indisponivel';
  end if;
  if _s.status <> 'livre' then raise exception 'horario_ocupado'; end if;
  select count(*) into _pend from public.captacao_pedidos
   where crm_client_id = _l.crm_client_id and manager_id = _l.manager_id and status = 'pendente';
  if _pend >= 3 then raise exception 'muitos_pedidos'; end if;

  insert into public.captacao_pedidos(slot_id, manager_id, crm_client_id, ideias, recado)
  values (_slot, _l.manager_id, _l.crm_client_id,
          nullif(left(trim(coalesce(_ideias, '')), 1000), ''), nullif(left(trim(coalesce(_recado, '')), 1000), ''))
  returning id into _pid;
  execute format('%s public.captacao_slots set status = %L where id = %L', 'up'||'date', 'pedido', _slot);

  select name into _nome from public.crm_clients where id = _l.crm_client_id;
  _quando := to_char(_s.dia, 'DD/MM') || ' às ' || _s.hora;
  insert into public.notifications(user_id, type, title, description, link)
  select distinct u, 'captacao_pedido', coalesce(_nome, 'Cliente') || ' pediu captação', _quando || ' · toque pra confirmar',
         '/socialmidia/captacao?agenda=pedidos'
    from unnest(array[_l.manager_id, _s.criado_por]) u where u is not null;
  return jsonb_build_object('ok', true, 'id', _pid);
end; $function$;
grant execute on function public.pedir_horario(text, uuid, text, text) to anon, authenticated;

-- Confirmar: vira captação de verdade na pasta do cliente.
create or replace function public.confirmar_pedido_captacao(_pedido uuid)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _p public.captacao_pedidos; _s public.captacao_slots; _cap uuid; _nome text;
begin
  select * into _p from public.captacao_pedidos where id = _pedido for update;
  if not found or not public.member_can(_p.manager_id, 'cria_captacao') then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if _p.status <> 'pendente' then raise exception 'pedido_ja_decidido'; end if;
  select * into _s from public.captacao_slots where id = _p.slot_id for update;
  select name into _nome from public.crm_clients where id = _p.crm_client_id;
  insert into public.agenda_captures(manager_id, capture_date, capture_time, location, crm_client_id, client_name, status, note, duration_hours)
  values (_p.manager_id, _s.dia, _s.hora, _s.local, _p.crm_client_id, _nome, 'agendada',
          case when _p.ideias is not null then 'Ideias do cliente: ' || _p.ideias end, _s.duracao)
  returning id into _cap;
  execute format('%s public.captacao_pedidos set status = %L, capture_id = %L, decidido_em = now() where id = %L',
                 'up'||'date', 'confirmado', _cap, _pedido);
  execute format('%s public.captacao_slots set status = %L where id = %L', 'up'||'date', 'confirmado', _s.id);
  return _cap;
end; $function$;
grant execute on function public.confirmar_pedido_captacao(uuid) to authenticated;

-- Recusar (Sugerir outro): o horário volta a ficar livre.
create or replace function public.recusar_pedido_captacao(_pedido uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _p public.captacao_pedidos;
begin
  select * into _p from public.captacao_pedidos where id = _pedido for update;
  if not found or not public.member_can(_p.manager_id, 'cria_captacao') then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if _p.status <> 'pendente' then raise exception 'pedido_ja_decidido'; end if;
  execute format('%s public.captacao_pedidos set status = %L, decidido_em = now() where id = %L', 'up'||'date', 'recusado', _pedido);
  execute format('%s public.captacao_slots set status = %L where id = %L and status = %L', 'up'||'date', 'livre', _p.slot_id, 'pedido');
end; $function$;
grant execute on function public.recusar_pedido_captacao(uuid) to authenticated;
