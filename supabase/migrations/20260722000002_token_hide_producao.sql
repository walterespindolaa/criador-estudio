-- Kanban de 5 status: o post nasce "em_producao" e, depois de publicado, vira
-- "postado". Nenhum desses dois pode aparecer pro cliente no link de aprovação —
-- ele só vê aguardando/ajuste/aprovado. Antes o RPC mostrava qualquer status
-- não-nulo, então "em produção" e "postado" vazariam. Aqui travamos o filtro.
CREATE OR REPLACE FUNCTION public.list_posts_by_token(_token text)
 RETURNS TABLE(post_id uuid, title text, platform text, format text, caption text, hook text, script text, content_blocks jsonb, approval_mode text, approval_stages jsonb, approval_status text, scheduled_date date, media jsonb, last_comment text, last_comment_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with tok as (
    select t.manager_id, t.external_client_id from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.id, p.title, p.platform, p.format,
         p.caption, p.hook, p.script, p.content_blocks,
         coalesce(p.approval_mode,'fast'), p.approval_stages,
         coalesce(p.approval_status,'pendente'),
         p.scheduled_date,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'provider', m.provider, 'thumbnail_url', m.thumbnail_url,
             'view_url', m.view_url, 'download_url', m.download_url,
             'bunny_video_id', m.bunny_video_id, 'file_type', m.file_type,
             'file_name', m.file_name, 'position', m.position
           ) order by m.position asc nulls last, m.created_at asc)
           from public.external_media_refs m where m.post_id = p.id
         ), '[]'::jsonb),
         c.content, c.author_role
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  left join lateral (
    select content, author_role from public.post_approval_comments
    where post_id = p.id order by created_at desc limit 1
  ) c on true
  where p.approval_status in ('pendente','ajuste_solicitado','aprovado')
  order by (coalesce(p.approval_status,'pendente') = 'ajuste_solicitado') desc,
           (coalesce(p.approval_status,'pendente') = 'pendente') desc,
           p.scheduled_date asc nulls last, p.created_at asc;
$function$;
