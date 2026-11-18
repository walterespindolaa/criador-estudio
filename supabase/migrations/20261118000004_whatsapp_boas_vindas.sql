-- WHATSAPP DO CRIA (18/11/2026, Walter). Quem deixa o WhatsApp no cadastro e
-- marca o aceite recebe a boas-vindas de 3 a 10 min depois. O robô (wa-robo)
-- conversa até 4 respostas e passa pra Gabi/Walter. Quem deixou o número vê o
-- banner da comunidade no app.

-- 1. Perfil: aceite e banner da comunidade.
alter table public.profiles
  add column if not exists whatsapp_optin boolean not null default false,
  add column if not exists whatsapp_optin_em timestamptz,
  add column if not exists comunidade_entrou_em timestamptz,
  add column if not exists comunidade_adiou_em timestamptz,
  add column if not exists comunidade_adiou_vezes int not null default 0;

-- 2. Configuração (uma linha só).
create table if not exists public.wa_config (
  id int primary key default 1 check (id = 1),
  robo_ligado boolean not null default false,
  comunidade_url text,
  max_por_hora int not null default 6,
  max_respostas_robo int not null default 4,
  avisar_ids uuid[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
insert into public.wa_config (id) values (1) on conflict (id) do nothing;
alter table public.wa_config enable row level security;
revoke all on public.wa_config from anon, authenticated;

-- 3. Conversas e mensagens.
create table if not exists public.wa_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  telefone text not null,
  perfil text not null default 'criador' check (perfil in ('criador', 'social_midia')),
  estado text not null default 'agendada'
    check (estado in ('agendada', 'enviando', 'enviada', 'conversando', 'equipe', 'encerrada', 'erro', 'sem_whatsapp', 'saiu')),
  enviar_em timestamptz not null default now(),
  enviada_em timestamptz,
  ultima_entrada_em timestamptz,
  respostas_robo int not null default 0,
  equipe_em timestamptz,
  motivo_equipe text,
  erro text,
  jid text,
  criado_em timestamptz not null default now()
);
create index if not exists wa_conversas_fila on public.wa_conversas (estado, enviar_em);
create index if not exists wa_conversas_tel on public.wa_conversas (telefone);
alter table public.wa_conversas enable row level security;
revoke all on public.wa_conversas from anon, authenticated;

create table if not exists public.wa_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.wa_conversas(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('pessoa', 'robo', 'equipe')),
  texto text,
  wa_msg_id text unique,
  criado_em timestamptz not null default now()
);
create index if not exists wa_mensagens_conversa on public.wa_mensagens (conversa_id, criado_em);
alter table public.wa_mensagens enable row level security;
revoke all on public.wa_mensagens from anon, authenticated;

-- 4. No cadastro: guarda o número, o aceite e agenda a boas-vindas.
-- Roda depois do handle_new_user (nome em ordem alfabética), com o perfil já
-- criado. Nunca derruba o cadastro.
create or replace function public.wa_novo_cadastro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tel text := new.raw_user_meta_data->>'whatsapp';
  v_optin boolean := coalesce(new.raw_user_meta_data->>'whatsapp_optin', '') = '1';
  v_intent text := coalesce(new.raw_user_meta_data->>'account_intent', 'creator');
begin
  if v_tel is null or v_tel !~ '^55[1-9][0-9]9[0-9]{8}$' then return new; end if;
  update public.profiles
     set phone = coalesce(nullif(phone, ''), v_tel),
         whatsapp_optin = v_optin,
         whatsapp_optin_em = case when v_optin then now() end
   where id = new.id;
  if v_optin and v_intent in ('creator', 'manager') then
    insert into public.wa_conversas (user_id, telefone, perfil, enviar_em)
    values (new.id, v_tel, case when v_intent = 'manager' then 'social_midia' else 'criador' end,
            now() + make_interval(secs => (180 + floor(random() * 420))::int))
    on conflict (user_id) do nothing;
  end if;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists on_auth_user_created_whatsapp on auth.users;
create trigger on_auth_user_created_whatsapp
  after insert on auth.users
  for each row execute function public.wa_novo_cadastro();

-- 5. Banner da comunidade: o app pergunta se mostra e marca o que a pessoa fez.
create or replace function public.comunidade_banner()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_url text;
  p record;
begin
  select comunidade_url into v_url from public.wa_config where id = 1;
  if v_url is null or v_url = '' then return jsonb_build_object('mostrar', false); end if;
  select phone, comunidade_entrou_em, comunidade_adiou_em, comunidade_adiou_vezes into p
    from public.profiles where id = auth.uid();
  if p is null or coalesce(p.phone, '') = '' or p.comunidade_entrou_em is not null
     or p.comunidade_adiou_vezes >= 2
     or (p.comunidade_adiou_em is not null and p.comunidade_adiou_em > now() - interval '3 days') then
    return jsonb_build_object('mostrar', false);
  end if;
  return jsonb_build_object('mostrar', true, 'url', v_url);
end $$;

create or replace function public.comunidade_marcar(_acao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _acao = 'entrou' then
    update public.profiles set comunidade_entrou_em = now() where id = auth.uid();
  elsif _acao = 'adiou' then
    update public.profiles
       set comunidade_adiou_em = now(), comunidade_adiou_vezes = comunidade_adiou_vezes + 1
     where id = auth.uid();
  end if;
end $$;

revoke all on function public.comunidade_banner() from public, anon;
revoke all on function public.comunidade_marcar(text) from public, anon;
grant execute on function public.comunidade_banner() to authenticated;
grant execute on function public.comunidade_marcar(text) to authenticated;
revoke all on function public.wa_novo_cadastro() from public, anon, authenticated;
