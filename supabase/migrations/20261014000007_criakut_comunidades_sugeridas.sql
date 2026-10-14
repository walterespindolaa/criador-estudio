-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · COMUNIDADE SUGERIDA PASSA PELO ADMIN (Walter, 14/10/2026)
-- JÁ APLICADA NO BANCO (registro)
-- Quem tem página sugere (status 'pendente'), o admin aprova ou recusa com
-- motivo. Antes de mandar, o app mostra as parecidas (trigrama ou palavra
-- de 5+ letras em comum). Limites: 3 pendentes por pessoa, 5 por semana,
-- nome igual a uma existente é recusado. Nome e descrição passam pela máscara
-- de contato. Aprovada: quem sugeriu entra nela e recebe aviso.
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

alter table public.criakut_comunidades add column if not exists status text not null default 'aprovada';
alter table public.criakut_comunidades add column if not exists criado_por uuid references auth.users(id) on delete set null;
alter table public.criakut_comunidades add column if not exists motivo_recusa text;
alter table public.criakut_comunidades add constraint criakut_comunidades_status_check check (status in ('pendente','aprovada','recusada'));
alter table public.criakut_comunidades add constraint criakut_comunidades_motivo_recusa_check check (motivo_recusa is null or char_length(motivo_recusa) <= 300);

create or replace function public.criakut_norm(_t text)
 returns text language sql immutable set search_path to 'public'
as $function$ select lower(extensions.unaccent(coalesce(_t, ''))); $function$;

create or replace function public.criakut_comunidade_visivel(_c criakut_comunidades)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select public.is_admin()
      or (_c.status = 'aprovada' and _c.ativa and public.criakut_comunidade_pode(_c.publico))
      or (_c.criado_por = auth.uid() and _c.status <> 'aprovada');
$function$;
revoke all on function public.criakut_comunidade_visivel(criakut_comunidades) from public, anon, authenticated;

create or replace function public.criakut_comunidades_parecidas(_nome text)
 returns table(slug text, nome text, publico text, status text, emoji text, cor text)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.slug, c.nome, c.publico, c.status, c.emoji, c.cor
  from criakut_comunidades c
  where public.criakut_tem_acesso() and c.status in ('aprovada','pendente') and c.ativa
    and char_length(trim(coalesce(_nome, ''))) >= 3
    and (extensions.similarity(public.criakut_norm(c.nome), public.criakut_norm(_nome)) > 0.28
         or exists (select 1 from regexp_split_to_table(public.criakut_norm(_nome), '[^a-z0-9]+') w
                    where char_length(w) >= 5 and public.criakut_norm(c.nome || ' ' || coalesce(c.descricao, '')) like '%' || w || '%'))
  order by extensions.similarity(public.criakut_norm(c.nome), public.criakut_norm(_nome)) desc
  limit 5;
$function$;
revoke all on function public.criakut_comunidades_parecidas(text) from public, anon;
grant execute on function public.criakut_comunidades_parecidas(text) to authenticated;

create or replace function public.criakut_comunidade_sugerir(_nome text, _descricao text, _emoji text, _publico text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('comunidade', 5); _id uuid; _slug text; _nome_eu text; _a record;
  _n text := public.criakut_mascarar(left(trim(coalesce(_nome, '')), 60));
begin
  select nome into _nome_eu from criakut_perfis where user_id = _eu;
  if _nome_eu is null then raise exception 'Crie sua página no Criakut antes de sugerir uma comunidade.'; end if;
  if char_length(_n) < 3 then raise exception 'Dê um nome com pelo menos 3 letras.'; end if;
  if coalesce(_publico, 'todos') not in ('todos','criadores','prestadores') then raise exception 'Público inválido.'; end if;
  if (select count(*) from criakut_comunidades where criado_por = _eu and status = 'pendente') >= 3 then
    raise exception 'Você já tem 3 comunidades esperando aprovação.';
  end if;
  if (select count(*) from criakut_comunidades where criado_por = _eu and criado_em > now() - interval '7 days') >= 5 then
    raise exception 'Limite de 5 sugestões por semana.';
  end if;
  if exists (select 1 from criakut_comunidades where public.criakut_norm(nome) = public.criakut_norm(_n) and status <> 'recusada') then
    raise exception 'Já existe uma comunidade com esse nome.';
  end if;
  _slug := left(trim(both '-' from regexp_replace(public.criakut_norm(_n), '[^a-z0-9]+', '-', 'g')), 32) || '-' || substr(md5(random()::text), 1, 4);
  if _slug !~ '^[a-z0-9]' then _slug := 'c' || _slug; end if;
  insert into criakut_comunidades (slug, nome, descricao, emoji, cor, publico, status, criado_por, ordem)
  values (_slug, _n, nullif(public.criakut_mascarar(left(trim(coalesce(_descricao, '')), 240)), ''), coalesce(nullif(left(trim(_emoji), 8), ''), 'papo'),
          '#FFE6DC', coalesce(_publico, 'todos'), 'pendente', _eu, 100)
  returning id into _id;
  for _a in select id from profiles where role = 'admin' loop
    perform public.criakut_avisar_link(_a.id, 'Comunidade pra aprovar', _nome_eu || ' sugeriu "' || _n || '"', '/app/cf-admin-panel');
  end loop;
  return _id;
end $function$;
revoke all on function public.criakut_comunidade_sugerir(text, text, text, text) from public, anon;
grant execute on function public.criakut_comunidade_sugerir(text, text, text, text) to authenticated;

create or replace function public.criakut_admin_comunidade_decidir(_id uuid, _aprovar boolean, _motivo text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _c criakut_comunidades;
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  select * into _c from criakut_comunidades where id = _id and status = 'pendente' for update;
  if not found then raise exception 'Comunidade não está em análise.'; end if;
  update criakut_comunidades set status = case when _aprovar then 'aprovada' else 'recusada' end,
    motivo_recusa = case when _aprovar then null else nullif(left(trim(coalesce(_motivo, '')), 300), '') end
  where id = _id;
  if _c.criado_por is not null then
    if _aprovar then
      insert into criakut_comunidade_membros (comunidade_id, user_id, ativo) values (_id, _c.criado_por, true)
      on conflict (comunidade_id, user_id) do update set ativo = true;
    end if;
    perform public.criakut_avisar_link(_c.criado_por,
      case when _aprovar then 'Sua comunidade foi aprovada!' else 'Sua comunidade não foi aprovada' end,
      _c.nome || case when _aprovar then ' já está no ar.' else coalesce(': ' || nullif(trim(coalesce(_motivo, '')), ''), '.') end,
      public.criakut_base(_c.criado_por) || '?aba=comunidades' || case when _aprovar then '&c=' || _c.slug else '' end);
  end if;
end $function$;
revoke all on function public.criakut_admin_comunidade_decidir(uuid, boolean, text) from public, anon;
grant execute on function public.criakut_admin_comunidade_decidir(uuid, boolean, text) to authenticated;

create or replace function public.criakut_comunidades_ver2()
 returns table(id uuid, slug text, nome text, descricao text, emoji text, cor text, publico text, status text, motivo_recusa text, minha_sugestao boolean, membros integer, topicos integer, sou_membro boolean, ativa boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.slug, c.nome, c.descricao, c.emoji, c.cor, c.publico, c.status, c.motivo_recusa, c.criado_por = auth.uid(),
         (select count(*) from criakut_comunidade_membros m where m.comunidade_id = c.id and m.ativo)::int,
         (select count(*) from criakut_topicos t where t.comunidade_id = c.id and t.apagado_em is null and not t.oculto)::int,
         exists (select 1 from criakut_comunidade_membros m where m.comunidade_id = c.id and m.user_id = auth.uid() and m.ativo),
         c.ativa
  from criakut_comunidades c
  where public.criakut_tem_acesso() and public.criakut_comunidade_visivel(c)
  order by (c.status = 'pendente') desc, c.ordem, c.nome;
$function$;
revoke all on function public.criakut_comunidades_ver2() from public, anon;
grant execute on function public.criakut_comunidades_ver2() to authenticated;

-- Comunidade, tópico, entrar, abrir tópico e responder: só valem pra aprovada.
create or replace function public.criakut_comunidade(_slug text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _c criakut_comunidades; _admin boolean := public.is_admin();
begin
  if _eu is null or not public.criakut_tem_acesso() then return null; end if;
  select * into _c from criakut_comunidades c0 where c0.slug = lower(_slug) and public.criakut_comunidade_visivel(c0);
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
  select * into _c from criakut_comunidades where id = _t.comunidade_id and (ativa or _admin) and (status = 'aprovada' or _admin) and public.criakut_comunidade_pode(publico);
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

create or replace function public.criakut_comunidade_entrar(_comunidade uuid, _entrar boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 30);
begin
  if not exists (select 1 from criakut_perfis where user_id = _eu) then raise exception 'Crie sua página no Criakut antes de entrar numa comunidade.'; end if;
  if not exists (select 1 from criakut_comunidades where id = _comunidade and ativa and status = 'aprovada') then raise exception 'Comunidade não encontrada.'; end if;
  if coalesce(_entrar, true) and not exists (select 1 from criakut_comunidades where id = _comunidade and public.criakut_comunidade_pode(publico)) then
    raise exception 'Essa comunidade é de outro público.';
  end if;
  insert into criakut_comunidade_membros (comunidade_id, user_id, ativo) values (_comunidade, _eu, coalesce(_entrar, true))
  on conflict (comunidade_id, user_id) do update set ativo = excluded.ativo;
end $function$;

create or replace function public.criakut_topico_criar(_comunidade uuid, _titulo text, _texto text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('comunidade', 10); _id uuid;
begin
  if not exists (select 1 from criakut_comunidade_membros m join criakut_comunidades c on c.id = m.comunidade_id and c.ativa and c.status = 'aprovada'
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
  if not exists (select 1 from criakut_comunidade_membros m join criakut_comunidades c on c.id = m.comunidade_id and c.ativa and c.status = 'aprovada'
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

-- Painel do admin ganha a fila "comunidades_pendentes" (troca de texto, só se ainda não trocada).
do $d$ declare _def text := pg_get_functiondef('public.criakut_admin_painel()'::regprocedure); begin
  if _def not like '%comunidades_pendentes%' then
    execute replace(_def, $x$    'destaques', (select count(*)$x$,
$x$    'comunidades_pendentes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'descricao', c.descricao, 'emoji', c.emoji,
        'publico', c.publico, 'criado_em', c.criado_em, 'autor', public.criakut_autor_json(c.criado_por)) order by c.criado_em)
      from criakut_comunidades c where c.status = 'pendente'), '[]'::jsonb),
    'destaques', (select count(*)$x$);
  end if;
end $d$;
