-- PORTAL: DIAS COM POST EM PRODUÇÃO (Walter, 19/10/2026; mockup aprovado)
--
-- O link do cliente só mostrava post aguardando, com ajuste ou aprovado. O
-- cliente não tinha prévia dos dias em que vai sair algo. Esta função entrega
-- SÓ a data e o formato dos posts em produção daquele cliente: nada de título,
-- legenda, mídia ou id. Mesmas travas do list_posts_by_token (token ativo, não
-- vencido, módulo do Cria Post ativo e período do link).

create or replace function public.agenda_producao_by_token(_token text)
 returns table(dia date, formato text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with tok as (
    select t.manager_id, t.external_client_id, t.period_start, t.period_end
    from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.scheduled_date, p.format
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  where p.approval_status = 'em_producao'
    and coalesce(p.is_draft, false) = false
    and p.deleted_at is null
    and p.scheduled_date is not null
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date >= tok.period_start and p.scheduled_date <= tok.period_end)
    )
  order by p.scheduled_date;
$function$;

grant execute on function public.agenda_producao_by_token(text) to anon, authenticated;
