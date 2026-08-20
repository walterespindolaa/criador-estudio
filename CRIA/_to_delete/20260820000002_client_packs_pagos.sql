-- ============================================================
-- FASE 2 do eixo de escala: pacotes de clientes PAGOS via Stripe.
--
--  - paid_client_packs: quantidade de pacotes na assinatura Stripe
--    (kind=client_packs). SÓ o webhook escreve aqui (service_role).
--    Cancelou a assinatura → zera SÓ esta coluna; client_packs
--    (bônus/grandfather) fica intacto.
--  - client_packs_subscription_id: assinatura Stripe dos pacotes, pro
--    checkout atualizar a QUANTIDADE em vez de criar assinatura paralela
--    (mesmo conserto dos assentos de colaborador).
--  - cria_limite_clientes passa a somar os dois: teto = 3 +
--    (client_packs + paid_client_packs) × 10.
--  - RPC cria_limite_info(usados, teto) pro front mostrar o contador da
--    carteira (dona OU colaboradora via acts_for).
--  - As duas colunas novas entram na deny-list da policy de UPDATE.
--
-- Cliente NENHUM é apagado em downgrade: quem ficar acima do teto só não
-- consegue ADICIONAR novos (trigger da Fase 1).
--
-- Idempotente.
-- ============================================================

-- 1) Colunas do lado pago.
alter table public.profiles
  add column if not exists paid_client_packs int not null default 0;
alter table public.profiles
  add column if not exists client_packs_subscription_id text;

-- 2) Teto agora soma bônus + pagos.
create or replace function public.cria_limite_clientes(_manager uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select 3 + ((coalesce(p.client_packs, 0) + coalesce(p.paid_client_packs, 0)) * 10)
  from public.profiles p
  where p.id = _manager;
$$;

-- 3) Contador da carteira pro front (usados/teto).
--    acts_for já cobre "sou a própria dona" e "sou colaboradora ativa dela".
create or replace function public.cria_limite_info(_manager uuid)
returns table(usados int, teto int)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.acts_for(_manager) then
    raise exception 'sem permissão';
  end if;

  return query
  select
    (select count(*)::int from public.crm_clients c
      where c.manager_id = _manager and c.deleted_at is null) as usados,
    coalesce(public.cria_limite_clientes(_manager), 3) as teto;
end;
$$;

grant execute on function public.cria_limite_info(uuid) to authenticated;

-- 4) Deny-list completa com as duas colunas novas (padrão F21/F27).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role is not distinct from (select role from public.profiles where id = auth.uid())
  and plan is not distinct from (select plan from public.profiles where id = auth.uid())
  and subscription_status is not distinct from (select subscription_status from public.profiles where id = auth.uid())
  and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles where id = auth.uid())
  and stripe_subscription_id is not distinct from (select stripe_subscription_id from public.profiles where id = auth.uid())
  and trial_started_at is not distinct from (select trial_started_at from public.profiles where id = auth.uid())
  and trial_ends_at is not distinct from (select trial_ends_at from public.profiles where id = auth.uid())
  and access_expires_at is not distinct from (select access_expires_at from public.profiles where id = auth.uid())
  and account_type is not distinct from (select account_type from public.profiles where id = auth.uid())
  and seat_limit is not distinct from (select seat_limit from public.profiles where id = auth.uid())
  and paid_collab_seats is not distinct from (select paid_collab_seats from public.profiles where id = auth.uid())
  and agency_owner_id is not distinct from (select agency_owner_id from public.profiles where id = auth.uid())
  and storage_quota_bytes is not distinct from (select storage_quota_bytes from public.profiles where id = auth.uid())
  and parked_at is not distinct from (select parked_at from public.profiles where id = auth.uid())
  and parked_until is not distinct from (select parked_until from public.profiles where id = auth.uid())
  and bio_views is not distinct from (select bio_views from public.profiles where id = auth.uid())
  and collab_seats_subscription_id is not distinct from (select collab_seats_subscription_id from public.profiles where id = auth.uid())
  and client_packs is not distinct from (select client_packs from public.profiles where id = auth.uid())
  -- NOVAS travas:
  and paid_client_packs is not distinct from (select paid_client_packs from public.profiles where id = auth.uid())
  and client_packs_subscription_id is not distinct from (select client_packs_subscription_id from public.profiles where id = auth.uid())
);

revoke update (client_packs, paid_client_packs, client_packs_subscription_id)
  on public.profiles from authenticated;
