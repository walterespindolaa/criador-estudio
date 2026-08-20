-- ============================================================
-- FASE 1 do eixo de escala da social mídia: carteira de clientes.
--
-- Modelo de preço em dois eixos: módulos vendem FUNÇÃO, a carteira vende
-- CAPACIDADE. Grátis = até 3 clientes no CRM. Cada pacote de +10 clientes
-- é vendido à parte (Fase 2 cuida do pacote PAGO via Stripe).
--
--  - profiles.client_packs: pacotes BÔNUS/grandfather (nunca mexidos pelo
--    Stripe). O pacote pago vem em outra coluna (paid_client_packs, Fase 2)
--    pra cancelamento de assinatura nunca apagar bônus dado na mão.
--  - Teto = 3 + client_packs × 10 (Fase 2 soma os pagos).
--  - Trigger BEFORE INSERT em crm_clients barra APENAS a criação de cliente
--    novo acima do teto. Ninguém perde cliente já cadastrado, nunca.
--  - Grandfathering: quem já tinha mais de 3 clientes ganha os pacotes bônus
--    necessários pra cobrir o que já usa (ex.: 15 clientes → 2 pacotes,
--    teto 23).
--  - client_packs entra na deny-list da policy de UPDATE de profiles
--    (mesmo padrão F21/F27): usuário não se auto-presenteia com pacotes.
--
-- Idempotente. JÁ APLICADA em produção em 2026-08-19 (verificada:
-- gestora com 15 clientes ficou com teto 23; demo com 13 ficou 13/13).
-- ============================================================

-- 1) Coluna de pacotes bônus/grandfather.
alter table public.profiles
  add column if not exists client_packs int not null default 0;

-- 2) Teto da carteira. Fase 2 substitui pra somar os pacotes pagos.
create or replace function public.cria_limite_clientes(_manager uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select 3 + (coalesce(p.client_packs, 0) * 10)
  from public.profiles p
  where p.id = _manager;
$$;

-- 3) Guarda no INSERT: acima do teto só não entra cliente NOVO.
--    (Lixeira conta como fora: deleted_at preenchido não ocupa vaga.)
create or replace function public.crm_clients_guard_limite()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  usados int;
  teto int;
begin
  select count(*) into usados
  from public.crm_clients
  where manager_id = new.manager_id and deleted_at is null;

  teto := coalesce(public.cria_limite_clientes(new.manager_id), 3);

  if usados >= teto then
    raise exception 'limite_clientes_atingido: % de %', usados, teto
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_clients_limite on public.crm_clients;
create trigger trg_crm_clients_limite
  before insert on public.crm_clients
  for each row execute function public.crm_clients_guard_limite();

-- 4) Grandfathering: ninguém que já usa mais de 3 fica travado.
update public.profiles p
set client_packs = greatest(
      p.client_packs,
      ceil((q.qtd - 3) / 10.0)::int
    )
from (
  select manager_id, count(*) as qtd
  from public.crm_clients
  where deleted_at is null
  group by manager_id
  having count(*) > 3
) q
where p.id = q.manager_id;

-- 5) client_packs congelado contra auto-escrita (padrão F21/F27:
--    WITH CHECK completo + revoke de coluna como cinto extra).
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
  -- NOVA trava:
  and client_packs is not distinct from (select client_packs from public.profiles where id = auth.uid())
);

revoke update (client_packs) on public.profiles from authenticated;
