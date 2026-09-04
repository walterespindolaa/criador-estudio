-- Preferências de notificação por categoria (04/09/2026).
-- Até aqui era tudo ou nada: ou a pessoa recebia TODO push, ou desligava.
-- Agora profiles.notification_prefs guarda o que ela desligou (jsonb, chave =
-- categoria, valor false = desligado; ausente = ligado). O gatilho de push
-- consulta antes de chamar o send-push; o SINO continua recebendo tudo.
--
-- IMPORTANTE: o gatilho notify_push_on_insert carrega o segredo interno
-- literal dentro do corpo. A migration NÃO conhece esse valor (no git é
-- placeholder). Por isso o bloco DO abaixo LÊ a função que está no banco,
-- extrai o segredo com regex e recria a função com a checagem de preferência,
-- sem o segredo passar pelo git.

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- Tipo -> categoria (mesma tabela que a tela de Configurações usa).
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes'
    when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes'
    when 'roteiro' then 'clientes'
    when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes'
    when 'renovacao_cliente' then 'clientes'
    when 'resumo_dia' then 'lembretes'
    when 'lembrete_postar' then 'lembretes'
    when 'posts_pendentes' then 'lembretes'
    when 'story' then 'lembretes'
    when 'captacao_amanha' then 'lembretes'
    when 'aniversario_cliente' then 'lembretes'
    when 'meta_batida' then 'conquistas'
    when 'dica_dia' then 'conquistas'
    when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas'
    when 'ideia_criada' then 'conquistas'
    else 'avisos' end
$$;

-- A pessoa quer push desta categoria? (ausente = sim)
create or replace function public.quer_push(_user uuid, _tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (p.notification_prefs ->> public.notif_categoria(_tipo))::boolean
       from public.profiles p where p.id = _user),
    true);
$$;

do $$
declare
  _src text;
  _secret text;
begin
  select pg_get_functiondef(p.oid) into _src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'notify_push_on_insert';
  if _src is null then
    raise notice 'notify_push_on_insert nao existe; nada a fazer';
    return;
  end if;
  -- Pega o valor que está entre aspas logo depois de x-internal-secret.
  _secret := substring(_src from '''x-internal-secret''\s*,\s*''([^'']+)''');
  if _secret is null or _secret = '__INTERNAL_PUSH_SECRET__' then
    raise exception 'nao achei o segredo real dentro de notify_push_on_insert; nao vou sobrescrever';
  end if;

  execute format($f$
    create or replace function public.notify_push_on_insert()
    returns trigger language plpgsql security definer set search_path = public as $b$
    begin
      -- Preferência da pessoa: categoria desligada nao vira push (o sino segue).
      if not public.quer_push(new.user_id, new.type) then
        return new;
      end if;
      perform net.http_post(
        url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', %L),
        body := jsonb_build_object(
          'user_id', new.user_id,
          'title', coalesce(new.title, 'Cria'),
          'message', coalesce(new.description, new.title, ''),
          'url', coalesce(new.link, '/app')));
      return new;
    exception when others then
      return new;
    end; $b$;
  $f$, _secret);
end $$;

drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push after insert on public.notifications
  for each row execute function public.notify_push_on_insert();
