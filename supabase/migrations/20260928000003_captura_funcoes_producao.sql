-- ═══════════════════════════════════════════════════════════════════════════
-- CAPTURA DE PRODUÇÃO (28/09/2026) · lacuna L12 do plano de publicar no Instagram
--
-- Estas funções existiam SÓ no banco de produção (foram criadas direto no
-- painel). Ficam aqui exatamente como estão lá, sem mudar comportamento, pra
-- o projeto ter a fonte da verdade. Rodar de novo não muda nada.
--
-- Anotado pra corrigir no ciclo 3 (mídia), de propósito NÃO corrigido aqui:
--   · criapost_reorder_media e criapost_touch_media só aceitam o DONO
--     (auth.uid()); colaborador da equipe não consegue reordenar nem renovar.
--   · criapost_add_media grava expires_at = 7 dias: mídia de post agendado
--     pra mais longe pode sumir antes da publicação (L7).
-- ═══════════════════════════════════════════════════════════════════════════

-- manager_publish_client_post
CREATE OR REPLACE FUNCTION public.manager_publish_client_post(_post_id uuid, _publicado boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _owner uuid;
begin
  select user_id into _owner from public.posts
  where id = _post_id and external_client_id is null and deleted_at is null;
  if _owner is null then raise exception 'post_not_found'; end if;
  if not public.acts_for_cria_owner(_owner) then raise exception 'sem_permissao'; end if;
  update public.posts
     set status = case when _publicado then 'publicado' else 'agendado' end,
         published_at = case when _publicado then now() else null end
   where id = _post_id;
end; $function$;

-- criapost_promover_para_bunny
CREATE OR REPLACE FUNCTION public.criapost_promover_para_bunny(p_media_id uuid, p_view_url text, p_thumbnail_url text, p_bunny_video_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _dono uuid;
begin
  select p.user_id into _dono
  from public.external_media_refs m
  join public.posts p on p.id = m.post_id
  where m.id = p_media_id;

  if _dono is null then raise exception 'mídia não encontrada ou sem post'; end if;
  if not public.acts_for(_dono) then raise exception 'sem acesso a esta mídia'; end if;

  update public.external_media_refs
  set provider = 'bunny_stream',
      external_file_id = p_bunny_video_id,
      view_url = p_view_url,
      thumbnail_url = p_thumbnail_url,
      bunny_video_id = p_bunny_video_id
  where id = p_media_id;
end;
$function$;

-- criapost_add_media
CREATE OR REPLACE FUNCTION public.criapost_add_media(p_post_id uuid, p_provider text, p_external_file_id text, p_file_name text, p_file_type text, p_file_size bigint, p_view_url text, p_thumbnail_url text, p_download_url text, p_bunny_video_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid; v_id uuid;
begin
  -- Antes exigia external_client_id not null → o RASCUNHO (que nasce sem cliente,
  -- pra não vazar no kanban/portal) nunca era encontrado: post_nao_encontrado.
  select user_id into v_owner from posts where id = p_post_id;
  if v_owner is null then
    raise exception 'post_nao_encontrado';
  end if;

  -- Antes: v_owner <> auth.uid(). Isso travava o COLABORADOR, que atua no tenant
  -- do gestor. acts_for() já resolve dono OU membro ativo do time.
  if not public.acts_for(v_owner) then
    raise exception 'sem_permissao';
  end if;

  -- O módulo é do GESTOR (dono do post), não de quem está clicando.
  if not public.has_module('aprovapost_externo', v_owner) then
    raise exception 'modulo_inativo';
  end if;

  insert into external_media_refs(
    user_id, post_id, provider, external_file_id, file_name, file_type, file_size,
    thumbnail_url, view_url, download_url, bunny_video_id, expires_at)
  values (
    v_owner, p_post_id, p_provider, p_external_file_id, p_file_name, p_file_type, p_file_size,
    p_thumbnail_url, p_view_url, p_download_url, p_bunny_video_id, now() + interval '7 days')
  returning id into v_id;

  return v_id;
end $function$;

-- criapost_set_media_position
CREATE OR REPLACE FUNCTION public.criapost_set_media_position()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.position is null then
    select coalesce(max(position), -1) + 1 into new.position
    from public.external_media_refs where post_id = new.post_id;
  end if;
  return new;
end; $function$;

-- criapost_reorder_media
CREATE OR REPLACE FUNCTION public.criapost_reorder_media(p_post_id uuid, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = p_post_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not allowed';
  end if;
  update public.external_media_refs m
  set position = t.ord - 1
  from unnest(p_ids) with ordinality as t(id, ord)
  where m.id = t.id and m.post_id = p_post_id and m.user_id = auth.uid();
end; $function$;

-- criapost_touch_media
CREATE OR REPLACE FUNCTION public.criapost_touch_media(p_post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update external_media_refs set expires_at = now() + interval '7 days'
   where post_id = p_post_id
     and post_id in (select id from posts where user_id = auth.uid() and external_client_id is not null);
end $function$;

notify pgrst, 'reload schema';
