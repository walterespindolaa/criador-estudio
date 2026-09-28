-- ============================================================
-- CAPA DO REELS (Walter, 28/09/2026)
--
-- "Quando for um Reels, eu ter opção de inserir capa, e se a capa for
-- inserida, a pré-visualização no Cria Post já aparece com ela."
--
-- A capa é a imagem que aparece no grid do perfil e no feed antes do play.
-- Até aqui o Reels mostrava o primeiro frame do vídeo (quase sempre um rosto
-- piscando ou um frame preto), e o cliente aprovava sem ver a capa de verdade.
--
-- 1) posts.cover_url: a imagem escolhida (fica no bucket `media`).
-- 2) capas_by_token: o portal do cliente busca as capas pelo mesmo token do
--    link de aprovação. Função à parte, de propósito: list_posts_by_token
--    tem retorno fixo e trocar o retorno exige derrubar a função que o portal
--    inteiro usa. Esta só acrescenta.
--
-- Não mexe na RLS de posts (a dona grava a capa pelo update que já tem).
-- Idempotente.
-- ============================================================

alter table public.posts
  add column if not exists cover_url text;

comment on column public.posts.cover_url is
  'Capa do Reels/vídeo escolhida pela social mídia. Aparece na prévia, no portal do cliente e vai junto na publicação.';

create or replace function public.capas_by_token(_token text)
returns table (post_id uuid, cover_url text)
language sql stable security definer set search_path = public as $$
  -- Mesmas regras de acesso do list_posts_by_token (20260914000005): token
  -- ativo, não vencido, módulo ligado, e só posts daquele cliente.
  with tok as (
    select t.manager_id, t.external_client_id, t.period_start, t.period_end
    from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.id, p.cover_url
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  where nullif(btrim(p.cover_url), '') is not null
    and p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
    -- Link de um período só enxerga as capas daquele período (revisão 28/09).
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date is not null
          and p.scheduled_date >= tok.period_start
          and p.scheduled_date <= tok.period_end)
    );
$$;
revoke all on function public.capas_by_token(text) from public;
grant execute on function public.capas_by_token(text) to anon, authenticated;
