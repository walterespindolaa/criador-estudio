-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA (21/10/2026), depois da auditoria.
--
-- 1. trafego_publico / trafego_origem com search_path fixo (aviso do advisor).
-- 2. rate_touch_janela: freio com janela configurável (o rate_touch só tem 1
--    minuto). Usado pela troca de senha: 3 pedidos por e-mail e 10 por IP por
--    hora, valendo pra todas as instâncias da função.
-- 3. Crons 1, 2 e 17 liam o segredo escrito no próprio comando, que aparece
--    no log do banco a cada rodada. Agora leem do Vault (internal_push_secret),
--    igual aos outros robôs. As funções storage-cleanup, criapost-media-cleanup,
--    bunny-cleanup-publicados e bunny-diagnostico passaram a conferir
--    x-internal-secret = INTERNAL_PUSH_SECRET.
-- 4. link_previews (cache de capa compartilhado por todas as contas): só a
--    edge saved-fetch grava. O navegador só lê.
-- ═══════════════════════════════════════════════════════════════════════════

alter function public.trafego_publico(text, text) set search_path = public;
alter function public.trafego_origem(text, text, boolean) set search_path = public;

create or replace function public.rate_touch_janela(_key text, _limit integer, _segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s int := greatest(60, least(_segundos, 86400));
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / s) * s);
  c int;
begin
  insert into public.rl_buckets(key, window_start, count) values (_key, w, 1)
  on conflict (key, window_start) do update set count = public.rl_buckets.count + 1
  returning count into c;
  return c <= _limit;
end $$;
revoke all on function public.rate_touch_janela(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_touch_janela(text, integer, integer) to service_role;

select cron.alter_job(1, command := $c$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{}'::jsonb);
$c$);
select cron.alter_job(2, command := $c$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/criapost-media-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{}'::jsonb);
$c$);
select cron.alter_job(17, command := $c$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/bunny-ingerir-drive',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{}'::jsonb);
$c$);

drop policy if exists "link_previews escrita" on public.link_previews;
drop policy if exists "link_previews atualiza" on public.link_previews;
revoke insert, update, delete on public.link_previews from anon, authenticated;
