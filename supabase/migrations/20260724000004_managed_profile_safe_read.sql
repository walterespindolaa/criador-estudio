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
  storage_retention_days integer
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
    p.storage_retention_days
  from public.profiles p
  where p.id = _owner
    -- So o membro ATIVO da conta (ou o proprio dono) enxerga.
    and (public.is_account_member(p.id) or p.id = auth.uid());
$$;

grant execute on function public.get_managed_profile(uuid) to authenticated;

-- ============================================================
-- REMOCAO DO SELECT AMPLO — NAO habilitar sem validar o front antes.
--
-- Passo a passo pra fechar o vazamento por completo (fora do escopo desta
-- entrega, exige editar TS):
--   1) Migrar src/hooks/useActiveProfile.ts e o efeito de tema em
--      src/components/AppLayout.tsx pra chamar
--      supabase.rpc('get_managed_profile', { _owner: ownerId }) em vez de
--      from('profiles').select(...).
--   2) Confirmar que nenhuma OUTRA tela le o profile do dono via membro.
--   3) So entao rodar o drop abaixo (descomentar):
--
-- drop policy if exists member_read_profile on public.profiles;
--
-- Enquanto o drop nao roda, o vazamento continua aberto: a funcao acima ja
-- existe e e o caminho seguro, mas a policy ampla ainda permite `select *`.
-- ============================================================
