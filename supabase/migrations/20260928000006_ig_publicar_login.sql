-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO INSTAGRAM · CICLO 2 · LOGIN COM A PERMISSÃO NOVA (28/09/2026)
-- Plano: CRIA/publicar-instagram-plano.md
--
-- 1. Quem pode pedir a permissão de publicar no login. Enquanto a Meta não
--    aprovar a análise, a permissão só funciona pra conta TESTADORA do app.
--    Pedir pra todo mundo arrisca a Meta recusar o login inteiro de quem não é
--    testador (e aí ninguém conecta nem os insights). Por isso a lista: só
--    quem está aqui recebe o pedido novo. Depois da aprovação, a função libera
--    pra todos pelo segredo INSTAGRAM_PUBLISH_ALL=true (sem mexer no banco).
-- 2. O navegador passa a enxergar needs_reconnect (pra mostrar o aviso
--    "Reconecte"). O token continua invisível.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ig_publicacao_testadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
-- Só o servidor lê (service role ignora RLS). Sem policy = navegador não vê.
alter table public.ig_publicacao_testadores enable row level security;
revoke all on public.ig_publicacao_testadores from anon, authenticated;

-- Walter e Gabriela, pelo e-mail de login (os dois cadastrados como
-- testadores no app da Meta: @walterespindola_ e @gabrielakwk).
insert into public.ig_publicacao_testadores (user_id)
select u.id from auth.users u
 where lower(u.email) in ('walterjoose@gmail.com', 'kwkgabriela@gmail.com')
on conflict (user_id) do nothing;

grant select (needs_reconnect) on public.social_connections to authenticated;

-- 3. Faxina do histórico do agendador. cron.job_run_details guarda TODA
--    execução desde sempre (o robô de e-mail roda a cada poucos segundos), e
--    foi isso que travou a consulta de conferência hoje. Roda de madrugada, em
--    segundo plano, e mantém só os últimos 7 dias.
do $$
begin
  perform cron.unschedule('cron-historico-faxina');
exception when others then null;
end $$;
select cron.schedule('cron-historico-faxina', '40 4 * * *',
  $c$delete from cron.job_run_details where end_time < now() - interval '7 days'$c$);

notify pgrst, 'reload schema';

-- Conferência: tem que listar as 2 pessoas.
select u.email from public.ig_publicacao_testadores t join auth.users u on u.id = t.user_id;
