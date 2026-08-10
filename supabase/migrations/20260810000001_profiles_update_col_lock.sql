-- ============================================================
-- PARTE A do conserto de takeover cross-tenant (F21/F27).
--
-- A policy "Users can update own profile" congelava role/plan/assinatura/stripe/
-- trial/access_expires_at, mas DEIXAVA o próprio usuário se auto-gravar campos de
-- privilégio: account_type, seat_limit, paid_collab_seats, agency_owner_id,
-- storage_quota_bytes, parked_at, parked_until, bio_views e
-- collab_seats_subscription_id. Isso permitia virar gestora com assentos,
-- se auto-vincular a outra conta, inflar cota de storage etc.
--
-- Conserto em duas camadas:
--  1) WITH CHECK completo (camada garantida no Supabase): a RLS passa a congelar
--     TODAS as colunas de privilégio. Esta é a trava que efetivamente vale, porque
--     o WITH CHECK é avaliado sempre, independente de grants de coluna.
--  2) REVOKE por coluna (defesa em profundidade): pedido no escopo. Observação
--     honesta: no Postgres o REVOKE de coluna é NO-OP quando existe UPDATE no
--     nível da tabela (padrão do Supabase p/ authenticated). Por isso ele NÃO
--     substitui o WITH CHECK; entra só como cinto extra caso o grant de tabela
--     seja removido no futuro.
--
-- account_type: existe um fluxo LEGÍTIMO em que a conta vira gestora de graça.
--  - No cadastro, o trigger handle_new_user já grava account_type='manager' a
--    partir de raw_user_meta_data.account_intent (migration
--    20260802000001_conta_social_midia_gratis.sql). Esse caminho continua
--    intacto: o trigger é security definer e roda como owner, fora da RLS.
--  - Quem se cadastrou como CRIADORA e depois decide abrir a área de social mídia
--    (tela ComecarAgencia) gravava account_type pelo cliente. Com a coluna
--    travada, isso quebraria. Movemos essa gravação pro servidor com a RPC
--    security definer tornar_conta_manager() abaixo, que valida auth.uid() e só
--    marca a PRÓPRIA conta como gestora (não mexe em assento/plano/nada pago).
--
-- Idempotente.
-- ============================================================

-- 1) Policy de UPDATE com deny-list COMPLETA das colunas de privilégio.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  -- já congeladas antes:
  and role is not distinct from (select role from public.profiles where id = auth.uid())
  and plan is not distinct from (select plan from public.profiles where id = auth.uid())
  and subscription_status is not distinct from (select subscription_status from public.profiles where id = auth.uid())
  and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles where id = auth.uid())
  and stripe_subscription_id is not distinct from (select stripe_subscription_id from public.profiles where id = auth.uid())
  and trial_started_at is not distinct from (select trial_started_at from public.profiles where id = auth.uid())
  and trial_ends_at is not distinct from (select trial_ends_at from public.profiles where id = auth.uid())
  and access_expires_at is not distinct from (select access_expires_at from public.profiles where id = auth.uid())
  -- NOVAS travas (buraco do F21/F27):
  and account_type is not distinct from (select account_type from public.profiles where id = auth.uid())
  and seat_limit is not distinct from (select seat_limit from public.profiles where id = auth.uid())
  and paid_collab_seats is not distinct from (select paid_collab_seats from public.profiles where id = auth.uid())
  and agency_owner_id is not distinct from (select agency_owner_id from public.profiles where id = auth.uid())
  and storage_quota_bytes is not distinct from (select storage_quota_bytes from public.profiles where id = auth.uid())
  and parked_at is not distinct from (select parked_at from public.profiles where id = auth.uid())
  and parked_until is not distinct from (select parked_until from public.profiles where id = auth.uid())
  and bio_views is not distinct from (select bio_views from public.profiles where id = auth.uid())
  and collab_seats_subscription_id is not distinct from (select collab_seats_subscription_id from public.profiles where id = auth.uid())
);

-- 2) REVOKE por coluna (defesa em profundidade — ver observação no cabeçalho).
--    Todas as colunas existem (auditado em src/integrations/supabase/types.ts).
--    O webhook do Stripe e as edges usam service_role, que IGNORA este revoke.
revoke update (
  role, plan, subscription_status, stripe_customer_id, stripe_subscription_id,
  trial_started_at, trial_ends_at, access_expires_at, seat_limit, paid_collab_seats,
  collab_seats_subscription_id, storage_quota_bytes, agency_owner_id,
  parked_at, parked_until, account_type, bio_views
) on public.profiles from authenticated;

-- 3) Caminho legítimo p/ virar gestora de graça, agora no servidor.
--    Security definer roda como owner (fura RLS e ignora o revoke acima), então a
--    RPC grava mesmo com account_type travado pra escrita direta do cliente.
--    Só marca a PRÓPRIA conta; não concede assento, plano nem nada pago.
create or replace function public.tornar_conta_manager()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sem sessão';
  end if;
  update public.profiles
     set account_type = 'manager'
   where id = auth.uid()
     and coalesce(account_type, '') <> 'manager';
end;
$$;

grant execute on function public.tornar_conta_manager() to authenticated;
