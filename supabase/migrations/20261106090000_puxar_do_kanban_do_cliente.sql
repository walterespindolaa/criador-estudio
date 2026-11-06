-- PUXAR DO KANBAN DO CLIENTE (Walter, 06/11/2026; mockup aprovado)
-- 1) Quem criou cada post (vale daqui pra frente; posts antigos ficam null).
-- 2) De qual post do kanban do cliente um post do Cria Post foi puxado.
-- 3) A RPC do importador devolve quem criou e se já foi puxado.
alter table public.posts add column if not exists created_by uuid default auth.uid();
alter table public.posts add column if not exists importado_de uuid;
create index if not exists posts_importado_de_idx on public.posts (importado_de) where importado_de is not null;

create or replace function public.manager_client_posts(client_owner_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  result jsonb;
begin
  if not exists (
    select 1
    from public.account_members am
    where am.owner_id = client_owner_id
      and am.status = 'active'
      and (
        am.member_id = auth.uid()
        or public.is_team_member(am.member_id)
      )
  ) then
    raise exception 'Sem permissao para ler os posts deste cliente';
  end if;

  select coalesce(jsonb_agg(post_row order by ord, sd nulls last, ca desc), '[]'::jsonb)
    into result
  from (
    select
      jsonb_build_object(
        'id', p.id, 'title', p.title, 'status', p.status,
        'platform', p.platform, 'format', p.format,
        'caption', p.caption, 'hook', p.hook, 'script', p.script,
        'cta', p.cta, 'sections', p.sections,
        'scheduled_date', p.scheduled_date, 'scheduled_time', p.scheduled_time,
        'created_at', p.created_at,
        'created_by', p.created_by,
        'criado_pela_agencia', (p.created_by is not null and p.created_by <> client_owner_id),
        'criado_por_nome', (select pf.name from public.profiles pf where pf.id = p.created_by),
        'ja_importado', exists (
          select 1 from public.posts q
          where q.importado_de = p.id and q.deleted_at is null
        ),
        'media', coalesce((
          select jsonb_agg(jsonb_build_object(
            'provider', r.provider, 'external_file_id', r.external_file_id,
            'file_name', r.file_name, 'file_type', r.file_type, 'file_size', r.file_size,
            'view_url', r.view_url, 'thumbnail_url', r.thumbnail_url,
            'download_url', r.download_url, 'bunny_video_id', r.bunny_video_id,
            'position', r.position
          ) order by r.position nulls first, r.created_at)
          from public.external_media_refs r
          where r.post_id = p.id
            and coalesce(r.substituida, false) = false
        ), '[]'::jsonb)
      ) as post_row,
      case p.status
        when 'editando' then 0 when 'agendado' then 1 when 'gravando' then 2
        when 'roteiro' then 3 when 'ideia' then 4 else 5
      end as ord,
      p.scheduled_date as sd,
      p.created_at as ca
    from public.posts p
    where p.user_id = client_owner_id
      and p.external_client_id is null
      and p.deleted_at is null
  ) t;

  return result;
end;
$function$;
