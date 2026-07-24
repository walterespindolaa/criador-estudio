-- ============================================================
-- A4: colaborador/gestor NAO deve ler dados financeiros do dono da conta.
--
-- Contexto: a policy `member_read_profile` (20260722000004) deixa qualquer
-- membro ativo (is_account_member(id)) rodar `select * from profiles` na linha
-- do dono. Postgres nao faz RLS por COLUNA no SELECT, entao essa policy larga
-- expoe a linha INTEIRA, incluindo stripe_customer_id, stripe_subscription_id,
-- pix_key e subscription_status. Um colaborador consegue puxar esses campos.
--
-- Uso real do front (o que o membro REALMENTE precisa do perfil do dono):
--   1) src/components/AppLayout.tsx  -> theme_preset, theme_accent,
--      theme_sidebar, theme_font (pintar a interface do cliente).
--   2) src/hooks/useActiveProfile.ts -> id, name, avatar_url, niche,
--      instagram_handle, bio, weekly_goal, role, storage_used_bytes,
--      storage_quota_bytes, storage_retention_days.
-- Nenhum desses e financeiro. Os campos financeiros so sao lidos pelo PROPRIO
-- dono (Assinar.tsx, Configuracoes.tsx, CollabDialog, useProfile), nunca por
-- membro. Logo, um GRANT por coluna nao serve (quebraria o dono lendo os
-- proprios campos). A via correta e um caminho SECURITY DEFINER que devolve
-- SOMENTE colunas seguras + remover o select amplo.
--
-- Esta migration ENTREGA o caminho seguro (funcao abaixo). A remocao da policy
-- ampla fica COMENTADA ao final: dropar agora QUEBRA as duas telas acima, que
-- hoje fazem `from('profiles').select(...)` direto e dependem da policy. So e
-- seguro dropar DEPOIS de migrar esses dois pontos do front pra usar a funcao.
-- ============================================================

-- Caminho restrito: devolve so colunas seguras do perfil do dono, para o
-- membro ativo que gerencia a conta. SECURITY DEFINER + checagem de vinculo.
create or replace function public.get_managed_profile(_owner uuid)
returns table (
  id                     uuid,
  name                   text,
  avatar_url             text,
  niche                  text,
  instagram_handle       text,
  bio                    text,
  weekly_goal            integer,
  role                   text,
  account_type           text,
  theme_preset           text,
  theme_accent           text,
  theme_sidebar          text,
  theme_font             text,
  storage_used_bytes     bigint,
  storage_quota_bytes    bigint,
  storage_retention_days integer,
  -- Colunas NAO sensiveis usadas por outras telas do membro (links uteis e
  -- Link na Bio). Nada financeiro aqui: nunca incluir stripe/pix/subscription.
  useful_links           jsonb,
  bio_slug               text,
  bio_settings           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.avatar_url, p.niche, p.instagram_handle, p.bio,
    p.weekly_goal, p.role, p.account_type, p.theme_preset, p.theme_accent,
    p.theme_sidebar, p.theme_font, p.storage_used_bytes, p.storage_quota_bytes,
    p.storage_retention_days, p.useful_links, p.bio_slug, p.bio_settings
  from public.profiles p
  where p.id = _owner
    -- So o membro ATIVO da conta (ou o proprio dono) enxerga.
    and (public.is_account_member(p.id) or p.id = auth.uid());
$$;

grant execute on function public.get_managed_profile(uuid) to authenticated;

-- ============================================================
-- REMOCAO DO SELECT AMPLO — agora habilitada.
--
-- STATUS (2026-07-24): TODOS os pontos onde o MEMBRO lia o profile do dono ja
-- foram migrados pro RPC seguro get_managed_profile (so colunas nao sensiveis):
--   - src/hooks/useActiveProfile.ts  -> supabase.rpc('get_managed_profile')
--   - src/components/AppLayout.tsx    -> supabase.rpc('get_managed_profile')
--   - src/pages/app/Feed.tsx          -> supabase.rpc('get_managed_profile')
--   - src/hooks/useUserLinks.ts       -> supabase.rpc('get_managed_profile')
--   - src/pages/app/LinkInBio.tsx     -> supabase.rpc('get_managed_profile')
-- As colunas useful_links, bio_slug e bio_settings foram adicionadas ao
-- RETURNS/SELECT da funcao acima (nao sensiveis; sem stripe/pix/subscription).
--
-- Varredura final: os demais reads de `profiles` no front usam sempre o id do
-- PROPRIO usuario da sessao (useProfile, useTeam, lib/notifications) ou o
-- caminho de ADMIN (useAdmin, gated por policy de admin separada), nenhum
-- depende desta policy. Logo o acesso de MEMBRO ao profile do dono passa a ser
-- 100% via get_managed_profile, que so devolve colunas seguras.
--
-- Por isso derrubamos a policy ampla: ela expunha a linha INTEIRA
-- (stripe_customer_id, stripe_subscription_id, pix_key, subscription_status)
-- pra qualquer membro ativo. Removendo-a, o vazamento A4 fecha por completo.
drop policy if exists member_read_profile on public.profiles;
-- ============================================================
