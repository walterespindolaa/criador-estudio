-- ============================================================
-- F17: link de aprovacao por PERIODO aplicado so no navegador.
--
-- O list_posts_by_token devolvia TODOS os posts aprovaveis do cliente e o
-- AprovarPortal.tsx filtrava o intervalo no cliente. Qualquer um lendo a
-- resposta da RPC via os posts de fora do periodo (e os ids deles). Aqui o
-- filtro passa a valer NO SERVIDOR: casa approval_tokens.period_start/period_end
-- contra posts.scheduled_date.
--
-- RETROCOMPATIVEL (confere): token SEM periodo (period_start/period_end null)
-- continua mostrando TUDO. Espelhamos exatamente a regra do cliente, que so
-- filtrava quando OS DOIS limites estavam definidos (if (!ps || !pe) return
-- all): se algum limite for null, nao filtra. Assim nenhum post legitimo some
-- em relacao ao comportamento atual.
--
-- O filtro no cliente continua (como exibicao), mas agora e redundante: mesmo
-- que alguem chame a RPC direto, so recebe o periodo do link.
-- ============================================================
-- Precisa dropar antes: a funcao ja existe com uma coluna a mais no fim
-- (drive_folder_url), e o Postgres nao troca o tipo de retorno com
-- "create or replace" (erro 42P13). O drop + create recria com TODAS as
-- colunas atuais (incluindo drive_folder_url) e so acrescenta o filtro de periodo.
drop function if exists public.list_posts_by_token(text);
create or replace function public.list_posts_by_token(_token text)
 returns table(post_id uuid, title text, platform text, format text, caption text, hook text, script text, content_blocks jsonb, approval_mode text, approval_stages jsonb, approval_status text, scheduled_date date, media jsonb, last_comment text, last_comment_role text, drive_folder_url text)
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
         c.content, c.author_role,
         p.drive_folder_url
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  left join lateral (
    select content, author_role from public.post_approval_comments
    where post_id = p.id order by created_at desc limit 1
  ) c on true
  where p.approval_status in ('pendente','ajuste_solicitado','aprovado')
    -- Periodo do link: so filtra quando OS DOIS limites existem (igual ao
    -- cliente). Token sem periodo (algum limite null) mostra tudo.
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date is not null
          and p.scheduled_date >= tok.period_start
          and p.scheduled_date <= tok.period_end)
    )
  order by (coalesce(p.approval_status,'pendente') = 'ajuste_solicitado') desc,
           (coalesce(p.approval_status,'pendente') = 'pendente') desc,
           p.scheduled_date asc nulls last, p.created_at asc;
$function$;

-- Helper reutilizavel: este post cai no periodo (e no cliente) deste token?
-- Serve pras mutacoes *_by_token que agem sobre um post_id especifico
-- (approve_post_by_token, request_adjustment_by_token, approve_stage_by_token,
-- request_stage_adjustment_by_token). Essas funcoes vivem SO no banco Lovable
-- (nao ha fonte no repositorio), entao nao da pra reescrever o corpo delas com
-- seguranca aqui. O guard abaixo esta pronto pra ser colado no inicio de cada
-- uma (ver a entrega). Mesma regra do list: token sem periodo libera tudo.
create or replace function public.token_allows_post(_token text, _post_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.approval_tokens t
    join public.posts p
      on p.external_client_id = t.external_client_id
     and p.user_id = t.manager_id
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
      and p.id = _post_id
      and p.approval_status in ('pendente','ajuste_solicitado','aprovado')
      and (
        t.period_start is null or t.period_end is null
        or (p.scheduled_date is not null
            and p.scheduled_date >= t.period_start
            and p.scheduled_date <= t.period_end)
      )
  );
$$;
grant execute on function public.token_allows_post(text, uuid) to anon, authenticated;
