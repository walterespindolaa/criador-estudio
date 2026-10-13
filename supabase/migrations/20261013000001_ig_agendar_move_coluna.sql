-- AGENDAR MOVE O CARD (Walter, 13/10/2026): ligar a publicação automática num
-- post do criador deixava o card em Planejamento/Pronto. Agora ele vai pra
-- coluna Agendado; desligar devolve pra Pronto (editando). Post de cliente
-- (Cria Post) não muda: lá as colunas seguem a aprovação, não o status.
CREATE OR REPLACE FUNCTION public.ig_agendar_publicacao(_post_id uuid, _ligar boolean)
 RETURNS TABLE(publish_status text, publicar_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  _p record;
  _c record;
  _quando timestamptz;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;

  select * into _c from public.ig_conexao_do_post(_post_id) limit 1;

  select id, external_client_id, approval_status, scheduled_date, scheduled_time,
         posts.publish_status as st
    into _p from public.posts where id = _post_id and deleted_at is null;

  if not _ligar then
    update public.posts set auto_publish = false,
           publish_status = case when posts.publish_status = 'na_fila' then null else posts.publish_status end,
           status = case when posts.external_client_id is null and posts.status = 'agendado' then 'editando' else posts.status end
     where id = _post_id;
    return query select p.publish_status, p.publicar_em from public.posts p where p.id = _post_id;
    return;
  end if;

  if _p.st in ('publicando', 'publicado') then
    raise exception 'Este post já foi (ou está sendo) publicado.';
  end if;
  if not coalesce(_c.pode_publicar, false) then
    raise exception '%', coalesce(_c.motivo, 'O Instagram deste perfil não pode publicar pelo Cria.');
  end if;
  if _p.external_client_id is not null and coalesce(_p.approval_status, '') <> 'aprovado' then
    raise exception 'O cliente ainda não aprovou este post. A publicação automática libera depois da aprovação.';
  end if;
  if _p.scheduled_date is null then
    raise exception 'Defina a data do post antes de ligar a publicação automática.';
  end if;
  _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
  if _quando < now() - interval '2 minutes' then
    raise exception 'A data e hora deste post já passaram. Ajuste a data ou use Publicar agora.';
  end if;

  update public.posts
     set auto_publish = true, publish_status = 'na_fila', publicar_em = _quando,
         publish_error = null, publish_attempts = 0, publish_by = auth.uid(),
         status = case when posts.external_client_id is null then 'agendado' else posts.status end
   where id = _post_id;
  return query select 'na_fila'::text, _quando;
end $function$;
