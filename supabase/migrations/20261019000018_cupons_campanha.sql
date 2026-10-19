-- CUPONS DE CAMPANHA (Walter, 19/10/2026)
--
-- Cupom de campanha é diferente do código de parceira: não gera comissão e
-- carrega um período grátis com cartão na hora. O primeiro é CRIA3MESES:
-- 3 meses grátis, depois 25% off por 12 meses, depois preço cheio.
--
-- Quem lê e grava a tabela é só o servidor (create-checkout e stripe-webhook,
-- com service role) e admin. O app logado só consegue perguntar "esse código
-- vale?" pela função cupom_campanha_checar, que não devolve o id do Stripe nem
-- os usos.

create table if not exists public.cupons_campanha (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  dias_gratis integer not null default 0 check (dias_gratis between 0 and 730),
  desconto_pct numeric(5,2) not null default 0 check (desconto_pct >= 0 and desconto_pct <= 100),
  desconto_meses integer not null default 0 check (desconto_meses between 0 and 36),
  stripe_coupon_id text,
  ativo boolean not null default true,
  valido_ate timestamptz,
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  usos integer not null default 0,
  planos text[],
  criado_em timestamptz not null default now(),
  constraint cupons_campanha_codigo_maiusculo check (codigo = upper(btrim(codigo)) and codigo <> '')
);

create unique index if not exists cupons_campanha_codigo_ci on public.cupons_campanha (upper(codigo));

alter table public.cupons_campanha enable row level security;
revoke all on table public.cupons_campanha from anon, authenticated;
grant all on table public.cupons_campanha to service_role;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cupons_campanha' and policyname = 'cupons_campanha_admin') then
    create policy cupons_campanha_admin on public.cupons_campanha
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
-- Admin passa pela policy, mas sem grant de tabela o PostgREST barra antes.
-- Grant só de leitura e edição pro authenticated; a policy deixa só admin.
grant select, insert, update on table public.cupons_campanha to authenticated;

-- "Esse código de campanha vale pra este plano?"
-- Não existe: nenhuma linha. Existe: uma linha, com motivo null (vale) ou o
-- motivo de não valer (inativo, expirado, esgotado, plano).
-- _plan null = não confere o plano (usado na tela, antes de escolher).
create or replace function public.cupom_campanha_checar(_code text, _plan text default null)
 returns table(codigo text, dias_gratis integer, desconto_pct numeric, desconto_meses integer, motivo text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.codigo, c.dias_gratis, c.desconto_pct, c.desconto_meses,
         case
           when not c.ativo then 'inativo'
           when c.valido_ate is not null and c.valido_ate < now() then 'expirado'
           when c.limite_usos is not null and c.usos >= c.limite_usos then 'esgotado'
           when _plan is not null and c.planos is not null and not (_plan = any(c.planos)) then 'plano'
           else null
         end
    from public.cupons_campanha c
   where upper(c.codigo) = upper(btrim(coalesce(_code, '')))
   limit 1;
$function$;
revoke execute on function public.cupom_campanha_checar(text, text) from public, anon;
grant execute on function public.cupom_campanha_checar(text, text) to authenticated, service_role;

-- Conta um uso. Só o webhook chama, uma vez por checkout concluído (o webhook
-- já é idempotente por event_id).
create or replace function public.cupom_campanha_registrar_uso(_codigo text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.cupons_campanha set usos = usos + 1
   where upper(codigo) = upper(btrim(coalesce(_codigo, '')));
$function$;
revoke execute on function public.cupom_campanha_registrar_uso(text) from public, anon, authenticated;
grant execute on function public.cupom_campanha_registrar_uso(text) to service_role;

-- Seed: CRIA3MESES. Só planos de criador (agência paga por assento, fica de fora).
insert into public.cupons_campanha (codigo, dias_gratis, desconto_pct, desconto_meses, ativo, planos)
values ('CRIA3MESES', 90, 25, 12, true, array['essencial','pro','studio'])
on conflict ((upper(codigo))) do nothing;
