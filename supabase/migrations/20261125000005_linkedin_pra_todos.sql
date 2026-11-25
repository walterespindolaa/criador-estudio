-- ═══════════════════════════════════════════════════════════════════════════
-- LINKEDIN LIBERADO PRA TODOS · 25/11/2026
-- Walter, 25/11/2026: "linkedin acho que ja da pra liberar pra todos, ja nao ta
-- ativado?". A trava de master (20261103000002) valia pras três redes juntas.
-- Agora vale por rede: LinkedIn pra todo mundo; YouTube e TikTok seguem só pro
-- master até o Google e o TikTok aprovarem os apps.
--
-- O que muda:
-- 1. validar_publicacao_rede e agendar_publicacao_rede: a linha do is_admin()
--    passa a valer só quando a rede não é linkedin;
-- 2. linkedin_resultado e linkedin_resultado_salvar (resultado digitado à mão):
--    sai a linha do is_admin(). O direito ao post continua no conexao_do_post.
-- 3. agendar_publicacao_rede move o card, igual ao ig_agendar_publicacao
--    (Walter, 25/11/2026: "eu publiquei e nao saiu da aba de ideias ali do
--    Criando"): agendar na rede do post leva pra Agendado; cancelar devolve
--    pra Pronto (editando). Post de cliente não muda (lá a coluna segue a
--    aprovação). Publicar move pra Publicado no servidor (redes-publicar).
-- 4. Conserta os posts que já saíram pela rede deles e ficaram parados
--    (o "Texto Teste" do LinkedIn, em Ideia).
--
-- Itens 1 e 2 mexem na definição que está NO BANCO (pg_get_functiondef),
-- trocando só a linha da trava, pra não desfazer o que outras migrations já
-- mudaram. Idempotente: rodar de novo não acha a linha antiga e não muda nada.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  _f record;
  _def text;
  _novo text;
  _velha constant text := 'if not public.is_admin() then raise exception ''sem permissão''; end if;';
begin
  for _f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('validar_publicacao_rede', 'linkedin_resultado', 'linkedin_resultado_salvar')
  loop
    _def := pg_get_functiondef(_f.oid);
    if position(_velha in _def) = 0 then
      continue; -- já liberada
    end if;
    if _f.proname = 'validar_publicacao_rede' then
      _novo := replace(_def, _velha,
        'if _rede <> ''linkedin'' and not public.is_admin() then raise exception ''sem permissão''; end if;');
    else
      _novo := replace(_def, _velha, '-- LinkedIn pra todos desde 25/11/2026 (o direito ao post fica no conexao_do_post).');
    end if;
    execute _novo;
  end loop;
end;
$$;

-- agendar_publicacao_rede inteira (a do banco hoje + itens 1 e 3).
create or replace function public.agendar_publicacao_rede(
  _post_id uuid, _rede text, _ligar boolean,
  _opcoes jsonb default '{}'::jsonb, _titulo text default null, _texto text default null)
returns table (pub_id uuid, status text, publicar_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  _conn uuid;
  _p record;
  _quando timestamptz;
  _id uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if _rede <> 'linkedin' and not public.is_admin() then raise exception 'sem permissão'; end if;

  if not _ligar then
    perform public.conexao_do_post(_post_id, _rede);
    update public.post_publicacoes pp
       set status = 'cancelado', updated_at = now()
     where pp.post_id = _post_id and pp.rede = _rede and pp.status in ('rascunho', 'na_fila', 'erro');
    -- Cancelou na rede do post: o card volta de Agendado pra Pronto.
    update public.posts po
       set status = 'editando'
     where po.id = _post_id and po.external_client_id is null and po.platform = _rede and po.status = 'agendado';
    return query select pp.id, pp.status, pp.publicar_em from public.post_publicacoes pp
      where pp.post_id = _post_id and pp.rede = _rede;
    return;
  end if;

  _conn := public.validar_publicacao_rede(_post_id, _rede, _opcoes, _titulo);
  select scheduled_date, scheduled_time into _p from public.posts where id = _post_id;
  if _p.scheduled_date is null then
    raise exception 'Defina a data do post antes de agendar.';
  end if;
  _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
  if _quando < now() - interval '2 minutes' then
    raise exception 'A data e hora deste post já passaram. Ajuste a data ou use Publicar agora.';
  end if;

  insert into public.post_publicacoes as pp
    (post_id, rede, connection_id, status, publicar_em, titulo, texto, opcoes, erro, tentativas, criado_por)
  values
    (_post_id, _rede, _conn, 'na_fila', null, nullif(btrim(_titulo), ''), nullif(btrim(_texto), ''),
     coalesce(_opcoes, '{}'::jsonb), null, 0, auth.uid())
  on conflict (post_id, rede) do update set
    connection_id = excluded.connection_id, status = 'na_fila', publicar_em = null,
    titulo = excluded.titulo, texto = excluded.texto, opcoes = excluded.opcoes,
    erro = null, tentativas = 0, criado_por = excluded.criado_por, updated_at = now()
  returning pp.id into _id;
  -- Agendou na rede do post: o card vai pra Agendado (igual ao Instagram).
  update public.posts po
     set status = 'agendado'
   where po.id = _post_id and po.external_client_id is null and po.platform = _rede and po.status <> 'publicado';
  return query select _id, 'na_fila'::text, _quando;
end;
$$;
revoke all on function public.agendar_publicacao_rede(uuid, text, boolean, jsonb, text, text) from public, anon;
grant execute on function public.agendar_publicacao_rede(uuid, text, boolean, jsonb, text, text) to authenticated;

-- Item 4: post que já saiu na rede dele e ficou fora de Publicado.
update public.posts po
   set status = 'publicado',
       published_at = coalesce(po.published_at, pp.publicado_em, now()),
       approval_status = case when po.external_client_id is not null then 'postado' else po.approval_status end
  from public.post_publicacoes pp
 where pp.post_id = po.id and pp.rede = po.platform and pp.status = 'publicado'
   and coalesce(nullif(pp.opcoes->>'publishAt', '')::timestamptz, '-infinity') <= now()
   and po.deleted_at is null and po.status <> 'publicado';

-- Conferência: nenhuma das quatro pode sobrar com a trava antiga.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('validar_publicacao_rede', 'agendar_publicacao_rede', 'linkedin_resultado', 'linkedin_resultado_salvar')
       and position('if not public.is_admin() then raise exception ''sem permissão''; end if;' in pg_get_functiondef(p.oid)) > 0
  ) then
    raise exception 'a trava de master não saiu de alguma função';
  end if;
end;
$$;

notify pgrst, 'reload schema';
