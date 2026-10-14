-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · FASE 3 (Walter, 14/10/2026) · JÁ APLICADA NO BANCO (registro)
-- Mockup aprovado: CRIA/mockup-criakut-fase3.html
--
-- Recados na página, quem visitou (recíproco), comunidades (só o admin cria),
-- denúncias com ocultação automática, Destaque pago (R$ 14,90/mês, nasce
-- desligado) e o painel do admin.
--
-- SEGURANÇA: nenhuma tabela nova aceita leitura ou escrita direta. Tudo passa
-- por funções que conferem sessão, acesso ao Criakut, limite por minuto e por
-- dia. Apagar é sempre lógico (apagado_em / ativo), nada some do histórico.
-- O Destaque só é gravado pelo webhook do Stripe (service role).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TABELAS ────────────────────────────────────────────────────────────────
alter table public.criakut_perfis add column if not exists mostrar_visitas boolean not null default true;
insert into public.criakut_config (chave, valor) values ('destaque_ativo', 'false'::jsonb) on conflict (chave) do nothing;

create table if not exists public.criakut_recados (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null references auth.users(id) on delete cascade,
  autor_id    uuid not null references auth.users(id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 500),
  oculto      boolean not null default false,
  apagado_em  timestamptz,
  criado_em   timestamptz not null default now(),
  check (dono_id <> autor_id)
);
create index if not exists criakut_recados_dono on public.criakut_recados (dono_id, criado_em desc);
create index if not exists criakut_recados_autor on public.criakut_recados (autor_id, criado_em desc);

create table if not exists public.criakut_visitas (
  visitante_id uuid not null references auth.users(id) on delete cascade,
  visitado_id  uuid not null references auth.users(id) on delete cascade,
  dia          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  vezes        integer not null default 1,
  ultima       timestamptz not null default now(),
  primary key (visitado_id, dia, visitante_id)
);

create table if not exists public.criakut_comunidades (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  nome       text not null check (char_length(nome) between 3 and 60),
  descricao  text check (char_length(descricao) <= 240),
  emoji      text not null default '💬' check (char_length(emoji) <= 8),
  cor        text not null default '#FFE6DC' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativa      boolean not null default true,
  ordem      integer not null default 0,
  criado_em  timestamptz not null default now()
);

create table if not exists public.criakut_comunidade_membros (
  comunidade_id uuid not null references public.criakut_comunidades(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  primary key (comunidade_id, user_id)
);
create index if not exists criakut_membros_user on public.criakut_comunidade_membros (user_id) where ativo;

create table if not exists public.criakut_topicos (
  id            uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references public.criakut_comunidades(id) on delete cascade,
  autor_id      uuid not null references auth.users(id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 4 and 140),
  texto         text check (char_length(texto) <= 3000),
  fixo          boolean not null default false,
  oculto        boolean not null default false,
  apagado_em    timestamptz,
  respostas     integer not null default 0,
  criado_em     timestamptz not null default now(),
  ultima_em     timestamptz not null default now()
);
create index if not exists criakut_topicos_comunidade on public.criakut_topicos (comunidade_id, fixo desc, ultima_em desc);

create table if not exists public.criakut_respostas (
  id         uuid primary key default gen_random_uuid(),
  topico_id  uuid not null references public.criakut_topicos(id) on delete cascade,
  autor_id   uuid not null references auth.users(id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 3000),
  oculto     boolean not null default false,
  apagado_em timestamptz,
  criado_em  timestamptz not null default now()
);
create index if not exists criakut_respostas_topico on public.criakut_respostas (topico_id, criado_em);
create index if not exists criakut_respostas_autor on public.criakut_respostas (autor_id, criado_em desc);

create table if not exists public.criakut_denuncias (
  id        uuid primary key default gen_random_uuid(),
  autor_id  uuid not null references auth.users(id) on delete cascade,
  tipo      text not null check (tipo in ('recado','topico','resposta','perfil')),
  alvo_id   uuid not null,
  motivo    text check (char_length(motivo) <= 300),
  resolvida boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (autor_id, tipo, alvo_id)
);
create index if not exists criakut_denuncias_alvo on public.criakut_denuncias (tipo, alvo_id) where not resolvida;

create table if not exists public.criakut_destaques (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  status                 text not null,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  ate                    timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

alter table public.criakut_recados            enable row level security;
alter table public.criakut_visitas            enable row level security;
alter table public.criakut_comunidades        enable row level security;
alter table public.criakut_comunidade_membros enable row level security;
alter table public.criakut_topicos            enable row level security;
alter table public.criakut_respostas          enable row level security;
alter table public.criakut_denuncias          enable row level security;
alter table public.criakut_destaques          enable row level security;
revoke all on public.criakut_recados, public.criakut_visitas, public.criakut_comunidades, public.criakut_comunidade_membros,
  public.criakut_topicos, public.criakut_respostas, public.criakut_denuncias, public.criakut_destaques from anon, authenticated;

-- ── AJUDANTES ──────────────────────────────────────────────────────────────
-- Onde a pessoa abre o Criakut: conta de gestão ou parceiro no /socialmidia, o resto no /app.
create or replace function public.criakut_base(_user uuid)
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select case when (select account_type from profiles where id = _user) in ('manager','parceiro')
                or exists (select 1 from manager_members m where m.member_id = _user and public.eh_papel_parceiro(m.role))
              then '/socialmidia/criakut' else '/app/criakut' end;
$function$;

create or replace function public.criakut_link(_user uuid, _proposta uuid)
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select public.criakut_base(_user) || '?aba=propostas&p=' || _proposta::text;
$function$;

create or replace function public.criakut_avisar_link(_user uuid, _titulo text, _texto text, _link text)
 returns void language sql security definer set search_path to 'public'
as $function$
  insert into notifications (user_id, type, title, description, link)
  values (_user, 'criakut', left(_titulo, 120), left(_texto, 240), _link);
$function$;

-- Recado e comunidade não são classificado: telefone, e-mail e link viram ••••.
create or replace function public.criakut_mascarar(_t text)
 returns text language sql immutable set search_path to 'public'
as $function$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(_t, ''),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '••••', 'g'),
    '(https?://|www\.)\S+', '••••', 'gi'),
    '\S+\.(com\.br|com|net|org|me|ly|link|bio|site|app)(/\S*)?', '••••', 'gi'),
    '\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}', '••••', 'g');
$function$;

create or replace function public.criakut_eh_destaque(_u uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from criakut_destaques d where d.user_id = _u and d.status in ('active','trialing'));
$function$;

create or replace function public.criakut_autor_json(_u uuid)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object('nome', p.nome, 'slug', p.slug, 'foto_url', p.foto_url, 'funcao', p.funcao,
                            'destaque', public.criakut_eh_destaque(p.user_id))
  from criakut_perfis p where p.user_id = _u;
$function$;

-- Denúncia: 3 pessoas diferentes = some até o admin olhar.
create or replace function public.criakut_denunciar(_tipo text, _alvo uuid, _motivo text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('denuncia', 10); _dono uuid; _n int;
begin
  if _tipo not in ('recado','topico','resposta','perfil') then raise exception 'Tipo inválido.'; end if;
  _dono := case _tipo
    when 'recado' then (select autor_id from criakut_recados where id = _alvo)
    when 'topico' then (select autor_id from criakut_topicos where id = _alvo)
    when 'resposta' then (select autor_id from criakut_respostas where id = _alvo)
    else (select user_id from criakut_perfis where user_id = _alvo) end;
  if _dono is null then raise exception 'Não encontrei o que você quer denunciar.'; end if;
  if _dono = _eu then raise exception 'Não dá pra denunciar o que é seu.'; end if;
  insert into criakut_denuncias (autor_id, tipo, alvo_id, motivo) values (_eu, _tipo, _alvo, nullif(left(trim(coalesce(_motivo, '')), 300), ''))
  on conflict (autor_id, tipo, alvo_id) do nothing;
  select count(*) into _n from criakut_denuncias where tipo = _tipo and alvo_id = _alvo and not resolvida;
  if _n >= 3 then
    if _tipo = 'recado' then update criakut_recados set oculto = true where id = _alvo;
    elsif _tipo = 'topico' then update criakut_topicos set oculto = true where id = _alvo;
    elsif _tipo = 'resposta' then update criakut_respostas set oculto = true where id = _alvo;
    end if;
  end if;
end $function$;

-- ── RECADOS ────────────────────────────────────────────────────────────────
create or replace function public.criakut_recado_escrever(_dono uuid, _texto text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('recado', 6); _id uuid; _nome text; _slug text; _t text := left(trim(coalesce(_texto, '')), 500);
begin
  if _dono = _eu then raise exception 'Recado é pra página dos outros.'; end if;
  select nome into _nome from criakut_perfis where user_id = _eu;
  if _nome is null then raise exception 'Crie sua página no Criakut antes de deixar recado.'; end if;
  select slug into _slug from criakut_perfis where user_id = _dono and publicado;
  if _slug is null then raise exception 'Essa página não está disponível.'; end if;
  if _t = '' then raise exception 'Escreva o recado.'; end if;
  if (select count(*) from criakut_recados where autor_id = _eu and criado_em > now() - interval '1 day') >= 10 then
    raise exception 'Limite de 10 recados por dia. Amanhã tem mais.';
  end if;
  insert into criakut_recados (dono_id, autor_id, texto) values (_dono, _eu, public.criakut_mascarar(_t)) returning id into _id;
  perform public.criakut_avisar_link(_dono, 'Recado novo no Criakut', _nome || ': ' || left(public.criakut_mascarar(_t), 120), public.criakut_base(_dono));
  return _id;
end $function$;

create or replace function public.criakut_recado_apagar(_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 30);
begin
  update criakut_recados set apagado_em = now() where id = _id and apagado_em is null and (dono_id = _eu or autor_id = _eu or public.is_admin());
  if not found then raise exception 'Recado não encontrado.'; end if;
end $function$;

create or replace function public.criakut_recados(_slug text, _limite integer default 20, _pular integer default 0)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _p criakut_perfis;
begin
  if _eu is null then return null; end if;
  select * into _p from criakut_perfis where slug = lower(_slug);
  if not found then return null; end if;
  if _p.user_id <> _eu and (not _p.publicado or not public.criakut_tem_acesso()) then return null; end if;
  return jsonb_build_object(
    'total', (select count(*) from criakut_recados r join criakut_perfis a on a.user_id = r.autor_id
              where r.dono_id = _p.user_id and r.apagado_em is null and not r.oculto),
    'itens', coalesce((select jsonb_agg(x order by x->>'criado_em' desc) from (
        select jsonb_build_object('id', r.id, 'texto', r.texto, 'criado_em', r.criado_em,
               'autor', public.criakut_autor_json(r.autor_id),
               'posso_apagar', _eu in (r.dono_id, r.autor_id),
               'meu', r.autor_id = _eu) x
        from criakut_recados r join criakut_perfis a on a.user_id = r.autor_id
        where r.dono_id = _p.user_id and r.apagado_em is null and not r.oculto
        order by r.criado_em desc
        limit least(greatest(_limite, 1), 50) offset greatest(_pular, 0)) s), '[]'::jsonb));
end $function$;

-- ── QUEM VISITOU (recíproco) ───────────────────────────────────────────────
create or replace function public.criakut_registrar_visita(_slug text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _alvo uuid;
begin
  if _eu is null or not public.criakut_tem_acesso() then return; end if;
  select user_id into _alvo from criakut_perfis where slug = lower(_slug) and publicado;
  if _alvo is null or _alvo = _eu then return; end if;
  if not public.rate_touch('criakut-visita:' || _eu::text, 60) then return; end if;
  insert into criakut_visitas (visitante_id, visitado_id) values (_eu, _alvo)
  on conflict (visitado_id, dia, visitante_id) do update set vezes = criakut_visitas.vezes + 1, ultima = now();
end $function$;

create or replace function public.criakut_minhas_visitas()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _mostro boolean;
begin
  if _eu is null then return null; end if;
  select mostrar_visitas into _mostro from criakut_perfis where user_id = _eu;
  if _mostro is null then return null; end if;
  return jsonb_build_object(
    'mostrar', _mostro,
    'total_mes', (select count(distinct visitante_id) from criakut_visitas where visitado_id = _eu and dia > current_date - 30),
    'lista', case when not _mostro then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nome', p.nome, 'slug', p.slug, 'foto_url', p.foto_url, 'funcao', p.funcao, 'ultima', v.ultima) order by v.ultima desc)
      from (select visitante_id, max(ultima) ultima from criakut_visitas where visitado_id = _eu and dia > current_date - 30 group by 1 order by 2 desc limit 12) v
      join criakut_perfis p on p.user_id = v.visitante_id and p.publicado and p.mostrar_visitas), '[]'::jsonb) end);
end $function$;

-- ── COMUNIDADES ────────────────────────────────────────────────────────────
create or replace function public.criakut_comunidades_listar()
 returns table(id uuid, slug text, nome text, descricao text, emoji text, cor text, membros integer, topicos integer, sou_membro boolean, ativa boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.slug, c.nome, c.descricao, c.emoji, c.cor,
         (select count(*) from criakut_comunidade_membros m where m.comunidade_id = c.id and m.ativo)::int,
         (select count(*) from criakut_topicos t where t.comunidade_id = c.id and t.apagado_em is null and not t.oculto)::int,
         exists (select 1 from criakut_comunidade_membros m where m.comunidade_id = c.id and m.user_id = auth.uid() and m.ativo),
         c.ativa
  from criakut_comunidades c
  where public.criakut_tem_acesso() and (c.ativa or public.is_admin())
  order by c.ordem, c.nome;
$function$;

create or replace function public.criakut_comunidade_entrar(_comunidade uuid, _entrar boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 30);
begin
  if not exists (select 1 from criakut_perfis where user_id = _eu) then raise exception 'Crie sua página no Criakut antes de entrar numa comunidade.'; end if;
  if not exists (select 1 from criakut_comunidades where id = _comunidade and ativa) then raise exception 'Comunidade não encontrada.'; end if;
  insert into criakut_comunidade_membros (comunidade_id, user_id, ativo) values (_comunidade, _eu, coalesce(_entrar, true))
  on conflict (comunidade_id, user_id) do update set ativo = excluded.ativo;
end $function$;

create or replace function public.criakut_comunidade(_slug text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _c criakut_comunidades; _admin boolean := public.is_admin();
begin
  if _eu is null or not public.criakut_tem_acesso() then return null; end if;
  select * into _c from criakut_comunidades where slug = lower(_slug) and (ativa or _admin);
  if not found then return null; end if;
  return to_jsonb(_c) || jsonb_build_object(
    'sou_membro', exists (select 1 from criakut_comunidade_membros m where m.comunidade_id = _c.id and m.user_id = _eu and m.ativo),
    'membros', (select count(*) from criakut_comunidade_membros m where m.comunidade_id = _c.id and m.ativo),
    'amostra', coalesce((select jsonb_agg(jsonb_build_object('nome', p.nome, 'slug', p.slug, 'foto_url', p.foto_url))
                 from (select p.* from criakut_comunidade_membros m join criakut_perfis p on p.user_id = m.user_id and p.publicado
                       where m.comunidade_id = _c.id and m.ativo order by m.criado_em desc limit 9) p), '[]'::jsonb),
    'topicos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'fixo', t.fixo, 'respostas', t.respostas,
                 'criado_em', t.criado_em, 'ultima_em', t.ultima_em, 'oculto', t.oculto, 'autor', public.criakut_autor_json(t.autor_id))
                 order by t.fixo desc, t.ultima_em desc)
               from (select * from criakut_topicos t where t.comunidade_id = _c.id and t.apagado_em is null and (not t.oculto or _admin)
                     order by t.fixo desc, t.ultima_em desc limit 100) t), '[]'::jsonb));
end $function$;

create or replace function public.criakut_topico(_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _t criakut_topicos; _c criakut_comunidades; _admin boolean := public.is_admin();
begin
  if _eu is null or not public.criakut_tem_acesso() then return null; end if;
  select * into _t from criakut_topicos where id = _id and apagado_em is null and (not oculto or _admin);
  if not found then return null; end if;
  select * into _c from criakut_comunidades where id = _t.comunidade_id and (ativa or _admin);
  if not found then return null; end if;
  return jsonb_build_object(
    'id', _t.id, 'titulo', _t.titulo, 'texto', _t.texto, 'fixo', _t.fixo, 'oculto', _t.oculto, 'criado_em', _t.criado_em,
    'autor', public.criakut_autor_json(_t.autor_id), 'meu', _t.autor_id = _eu,
    'comunidade', jsonb_build_object('id', _c.id, 'slug', _c.slug, 'nome', _c.nome, 'emoji', _c.emoji, 'cor', _c.cor),
    'sou_membro', exists (select 1 from criakut_comunidade_membros m where m.comunidade_id = _c.id and m.user_id = _eu and m.ativo),
    'respostas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'texto', r.texto, 'criado_em', r.criado_em, 'oculto', r.oculto,
                   'autor', public.criakut_autor_json(r.autor_id), 'meu', r.autor_id = _eu) order by r.criado_em)
                 from (select * from criakut_respostas r where r.topico_id = _t.id and r.apagado_em is null and (not r.oculto or _admin)
                       order by r.criado_em limit 300) r), '[]'::jsonb));
end $function$;

create or replace function public.criakut_topico_criar(_comunidade uuid, _titulo text, _texto text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('comunidade', 10); _id uuid;
begin
  if not exists (select 1 from criakut_comunidade_membros m join criakut_comunidades c on c.id = m.comunidade_id and c.ativa
                 where m.comunidade_id = _comunidade and m.user_id = _eu and m.ativo) then
    raise exception 'Entre na comunidade pra abrir tópico.';
  end if;
  if char_length(trim(coalesce(_titulo, ''))) < 4 then raise exception 'Dê um título com pelo menos 4 letras.'; end if;
  if (select count(*) from criakut_topicos where autor_id = _eu and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Limite de 5 tópicos por dia.';
  end if;
  insert into criakut_topicos (comunidade_id, autor_id, titulo, texto)
  values (_comunidade, _eu, public.criakut_mascarar(left(trim(_titulo), 140)), nullif(public.criakut_mascarar(left(trim(coalesce(_texto, '')), 3000)), ''))
  returning id into _id;
  return _id;
end $function$;

create or replace function public.criakut_responder(_topico uuid, _texto text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('comunidade', 10); _t criakut_topicos; _id uuid; _nome text; _slug text;
  _x text := left(trim(coalesce(_texto, '')), 3000);
begin
  select * into _t from criakut_topicos where id = _topico and apagado_em is null and not oculto;
  if not found then raise exception 'Tópico não encontrado.'; end if;
  if not exists (select 1 from criakut_comunidade_membros m join criakut_comunidades c on c.id = m.comunidade_id and c.ativa
                 where m.comunidade_id = _t.comunidade_id and m.user_id = _eu and m.ativo) then
    raise exception 'Entre na comunidade pra responder.';
  end if;
  if _x = '' then raise exception 'Escreva a resposta.'; end if;
  if (select count(*) from criakut_respostas where autor_id = _eu and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Limite de 30 respostas por dia.';
  end if;
  insert into criakut_respostas (topico_id, autor_id, texto) values (_topico, _eu, public.criakut_mascarar(_x)) returning id into _id;
  update criakut_topicos set respostas = respostas + 1, ultima_em = now() where id = _topico;
  if _t.autor_id <> _eu then
    select nome into _nome from criakut_perfis where user_id = _eu;
    select slug into _slug from criakut_comunidades where id = _t.comunidade_id;
    perform public.criakut_avisar_link(_t.autor_id, 'Resposta no seu tópico', coalesce(_nome, 'Alguém') || ' respondeu "' || left(_t.titulo, 80) || '"',
      public.criakut_base(_t.autor_id) || '?aba=comunidades&c=' || _slug || '&t=' || _topico::text);
  end if;
  return _id;
end $function$;

create or replace function public.criakut_conteudo_apagar(_tipo text, _id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 30); _topico uuid;
begin
  if _tipo = 'topico' then
    update criakut_topicos set apagado_em = now() where id = _id and apagado_em is null and (autor_id = _eu or public.is_admin());
    if not found then raise exception 'Tópico não encontrado.'; end if;
  elsif _tipo = 'resposta' then
    update criakut_respostas set apagado_em = now() where id = _id and apagado_em is null and (autor_id = _eu or public.is_admin())
    returning topico_id into _topico;
    if _topico is null then raise exception 'Resposta não encontrada.'; end if;
    update criakut_topicos set respostas = greatest(respostas - 1, 0) where id = _topico;
  else
    raise exception 'Tipo inválido.';
  end if;
end $function$;

-- ── DESTAQUE ───────────────────────────────────────────────────────────────
create or replace function public.criakut_destaques_ids()
 returns setof uuid language sql stable security definer set search_path to 'public'
as $function$
  select d.user_id from criakut_destaques d join criakut_perfis p on p.user_id = d.user_id and p.publicado
  where d.status in ('active','trialing') and public.criakut_tem_acesso();
$function$;

-- Até 3 destaques que combinam com o filtro, em ordem sorteada (revezamento).
-- Mesmo formato da busca (criakut_procurar), pra o cartão ser o mesmo.
create or replace function public.criakut_destaques_busca(_funcao text default null, _estilos text[] default null, _nichos text[] default null, _cidade text default null, _texto text default null)
 returns table(user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean, foto_url text, status_texto text, estilos text[], nichos text[], preco_minimo_centavos integer, seguidores integer, nota numeric, entregas integer)
 language sql volatile security definer set search_path to 'public'
as $function$
  select r.* from public.criakut_procurar(_funcao, _estilos, _nichos, null, _cidade, _texto, 60, 0) r
  where public.criakut_eh_destaque(r.user_id)
  order by random()
  limit 3;
$function$;

create or replace function public.criakut_meu_destaque()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _d criakut_destaques; _p criakut_perfis; _ligado boolean;
begin
  if _eu is null then return null; end if;
  select * into _p from criakut_perfis where user_id = _eu;
  select * into _d from criakut_destaques where user_id = _eu;
  _ligado := coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'destaque_ativo'), false);
  return jsonb_build_object(
    'ativo', coalesce(_d.status in ('active','trialing'), false),
    'status', _d.status, 'ate', _d.ate, 'desde', _d.criado_em,
    'a_venda', _ligado,
    'pode_comprar', _ligado and _p.user_id is not null and _p.publicado and _p.funcao <> 'criadora',
    'motivo', case when not _ligado then 'desligado' when _p.user_id is null then 'sem_pagina'
                   when not _p.publicado then 'escondida' when _p.funcao = 'criadora' then 'criadora' else null end,
    'visitas_30d', (select count(distinct visitante_id) from criakut_visitas where visitado_id = _eu and dia > current_date - 30),
    'pedidos_30d', (select count(*) from criakut_propostas where contratado_id = _eu and criado_em > now() - interval '30 days'));
end $function$;

-- ── PERFIL: selo, comunidades e a chave de visitas (só pra dona) ──────────
-- Troca de texto na função da Fase 2 (só se ainda não foi trocada).
do $p$ declare _def text := pg_get_functiondef('public.criakut_perfil(text)'::regprocedure); begin
  if _def not like '%''comunidades''%' then
    _def := replace(_def, $x$return to_jsonb(_p) - 'capa_original_url' - 'capa_ajuste'$x$,
                          $x$return to_jsonb(_p) - 'capa_original_url' - 'capa_ajuste' - 'mostrar_visitas'$x$);
    _def := replace(_def, $x$      'trabalhos_concluidos',$x$,
$x$      'destaque', public.criakut_eh_destaque(_p.user_id),
      'mostrar_visitas', case when _p.user_id = _eu then _p.mostrar_visitas end,
      'comunidades', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'emoji', c.emoji, 'cor', c.cor) order by m.criado_em desc)
                     from criakut_comunidade_membros m join criakut_comunidades c on c.id = m.comunidade_id and c.ativa
                     where m.user_id = _p.user_id and m.ativo), '[]'::jsonb),
      'trabalhos_concluidos',$x$);
    execute _def;
  end if;
end $p$;

-- ── ADMIN ──────────────────────────────────────────────────────────────────
create or replace function public.criakut_admin_painel()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  return jsonb_build_object(
    'aberto', coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'aberto'), false),
    'destaque_ativo', coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'destaque_ativo'), false),
    'convidados', (select count(*) from criakut_convidados),
    'paginas', (select count(*) from criakut_perfis where publicado),
    'paginas_total', (select count(*) from criakut_perfis),
    'propostas_mes', (select count(*) from criakut_propostas where criado_em > now() - interval '30 days'),
    'fechadas_mes', (select count(*) from criakut_propostas where fechado_em > now() - interval '30 days'),
    'concluidas_mes', (select count(*) from criakut_propostas where concluido_em > now() - interval '30 days'),
    'paradas', (select count(*) from criakut_propostas p where p.status = 'fechada' and p.fechado_em < now() - interval '15 days' and not public.criakut_tem_entrega(p)),
    'destaques', (select count(*) from criakut_destaques where status in ('active','trialing')),
    'pontes', (select jsonb_object_agg(coalesce(ponte, 'nenhuma'), n) from (select ponte, count(*) n from criakut_propostas where ponte is not null group by 1) x),
    'denuncias', coalesce((select jsonb_agg(d order by d->>'ultima' desc) from (
        select jsonb_build_object('tipo', x.tipo, 'alvo_id', x.alvo_id, 'quantas', count(*), 'ultima', max(x.criado_em),
          'motivos', jsonb_agg(x.motivo) filter (where x.motivo is not null),
          'texto', case x.tipo when 'recado' then (select texto from criakut_recados where id = x.alvo_id)
                               when 'topico' then (select titulo || coalesce(': ' || texto, '') from criakut_topicos where id = x.alvo_id)
                               when 'resposta' then (select texto from criakut_respostas where id = x.alvo_id)
                               else (select nome || ' (página)' from criakut_perfis where user_id = x.alvo_id) end,
          'oculto', case x.tipo when 'recado' then (select oculto from criakut_recados where id = x.alvo_id)
                                when 'topico' then (select oculto from criakut_topicos where id = x.alvo_id)
                                when 'resposta' then (select oculto from criakut_respostas where id = x.alvo_id) else false end,
          'autor', public.criakut_autor_json(case x.tipo when 'recado' then (select autor_id from criakut_recados where id = x.alvo_id)
                               when 'topico' then (select autor_id from criakut_topicos where id = x.alvo_id)
                               when 'resposta' then (select autor_id from criakut_respostas where id = x.alvo_id) else x.alvo_id end)) d
        from criakut_denuncias x where not x.resolvida group by x.tipo, x.alvo_id) s), '[]'::jsonb));
end $function$;

create or replace function public.criakut_admin_config(_chave text, _ligar boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  if _chave not in ('aberto','destaque_ativo') then raise exception 'Chave inválida.'; end if;
  insert into criakut_config (chave, valor) values (_chave, to_jsonb(coalesce(_ligar, false)))
  on conflict (chave) do update set valor = excluded.valor;
end $function$;

create or replace function public.criakut_admin_convidar(_email text)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare _u uuid;
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  select id into _u from auth.users where lower(email) = lower(trim(_email));
  if _u is null then return 'sem_conta'; end if;
  insert into criakut_convidados (user_id) values (_u) on conflict (user_id) do nothing;
  if not found then return 'ja_convidado'; end if;
  return 'ok';
end $function$;

create or replace function public.criakut_admin_moderar(_tipo text, _alvo uuid, _ocultar boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  if _tipo = 'recado' then update criakut_recados set oculto = _ocultar where id = _alvo;
  elsif _tipo = 'topico' then update criakut_topicos set oculto = _ocultar where id = _alvo;
  elsif _tipo = 'resposta' then update criakut_respostas set oculto = _ocultar where id = _alvo;
  elsif _tipo = 'perfil' then
    if _ocultar then update criakut_perfis set publicado = false where user_id = _alvo; end if;
  else raise exception 'Tipo inválido.'; end if;
  update criakut_denuncias set resolvida = true where tipo = _tipo and alvo_id = _alvo;
end $function$;

create or replace function public.criakut_admin_comunidade_salvar(_id uuid, _slug text, _nome text, _descricao text, _emoji text, _cor text, _ativa boolean, _ordem integer)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _novo uuid;
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  if _id is null then
    insert into criakut_comunidades (slug, nome, descricao, emoji, cor, ativa, ordem)
    values (lower(trim(_slug)), trim(_nome), nullif(trim(coalesce(_descricao, '')), ''), coalesce(nullif(trim(_emoji), ''), '💬'), coalesce(_cor, '#FFE6DC'), coalesce(_ativa, true), coalesce(_ordem, 0))
    returning id into _novo;
    return _novo;
  end if;
  update criakut_comunidades set slug = lower(trim(_slug)), nome = trim(_nome), descricao = nullif(trim(coalesce(_descricao, '')), ''),
    emoji = coalesce(nullif(trim(_emoji), ''), '💬'), cor = coalesce(_cor, cor), ativa = coalesce(_ativa, ativa), ordem = coalesce(_ordem, ordem)
  where id = _id;
  return _id;
end $function$;

create or replace function public.criakut_admin_fixar(_topico uuid, _fixo boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  update criakut_topicos set fixo = coalesce(_fixo, false) where id = _topico;
end $function$;

-- ── COMUNIDADES INICIAIS ───────────────────────────────────────────────────
insert into public.criakut_comunidades (slug, nome, descricao, emoji, cor, ordem) values
  ('saude-e-estetica', 'Saúde e estética', 'Conteúdo pra clínica, consultório e estética sem tropeçar nas regras dos conselhos.', '🩺', '#FFE6DC', 1),
  ('designers-do-cria', 'Designers do Cria', 'Referência, preço, ferramenta, cliente difícil. Papo de quem desenha.', '🎨', '#EEE9FF', 2),
  ('social-midias-de-sc', 'Social mídias de SC', 'Quem atende no litoral e no Vale. Indicação, evento, parceria.', '🌊', '#E2F4EA', 3),
  ('reels-que-funcionam', 'Reels que funcionam', 'Gancho, edição, trend. Mande o seu e peça opinião.', '🎬', '#FFF3D6', 4),
  ('quanto-cobrar', 'Quanto cobrar', 'Tabela, pacote, reajuste. Sem vergonha de falar de dinheiro.', '💸', '#FDE7E4', 5),
  ('primeiro-cliente', 'Primeiro cliente', 'Pra quem está começando: proposta, contrato, briefing.', '🤝', '#EEE9FF', 6)
on conflict (slug) do nothing;

-- ── PERMISSÕES ─────────────────────────────────────────────────────────────
do $g$ declare f text; begin
  foreach f in array array[
    'criakut_base(uuid)', 'criakut_avisar_link(uuid, text, text, text)', 'criakut_eh_destaque(uuid)', 'criakut_autor_json(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'criakut_mascarar(text)', 'criakut_denunciar(text, uuid, text)',
    'criakut_recado_escrever(uuid, text)', 'criakut_recado_apagar(uuid)', 'criakut_recados(text, integer, integer)',
    'criakut_registrar_visita(text)', 'criakut_minhas_visitas()',
    'criakut_comunidades_listar()', 'criakut_comunidade_entrar(uuid, boolean)', 'criakut_comunidade(text)', 'criakut_topico(uuid)',
    'criakut_topico_criar(uuid, text, text)', 'criakut_responder(uuid, text)', 'criakut_conteudo_apagar(text, uuid)',
    'criakut_destaques_ids()', 'criakut_destaques_busca(text, text[], text[], text, text)', 'criakut_meu_destaque()',
    'criakut_admin_painel()', 'criakut_admin_config(text, boolean)', 'criakut_admin_convidar(text)',
    'criakut_admin_moderar(text, uuid, boolean)', 'criakut_admin_comunidade_salvar(uuid, text, text, text, text, text, boolean, integer)',
    'criakut_admin_fixar(uuid, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $g$;
