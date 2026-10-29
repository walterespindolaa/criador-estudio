-- PAINEL DOS ROBÔS (mockup aprovado 29/10/2026). Só admin.
-- admin_robos(): por robô, o agendamento (cron.job_run_details) E o que a
-- função respondeu de verdade (cron_runs, gravado pela própria função), porque
-- o cron "succeeded" só quer dizer que o pedido saiu, não que deu certo.
-- O histórico do cron é limpo depois de 3 dias (cron-diario-faxina).
create or replace function public.admin_robos()
returns table(
  chave text, nome text, frequencia text, jobname text, agenda text, ativo boolean,
  ultima_execucao timestamptz, ultimo_status text, historico text[],
  falhas_recentes int, execs_recentes int,
  resultado_em timestamptz, resultado_ok boolean, resultado_detalhe text)
language plpgsql stable security definer
set search_path = public, cron
as $$
begin
  if not public.is_admin() then raise exception 'só admin'; end if;
  return query
  with robos(chave, nome, frequencia, jobname, beats) as (values
    ('tendencias', 'Tendências e bancos', 'seg e qui, 6h07', 'cria-bancos-seg-qui',
       array['trend-bank-refresh', 'story-trend-refresh']),
    ('avisos-stories', 'Avisos de stories', 'a cada 15 min', 'story-notifications-15min',
       array['story-notifications'])
  )
  select r.chave, r.nome, r.frequencia, r.jobname, j.schedule, j.active,
    (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
    (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
    array(select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 12),
    (select count(*)::int from cron.job_run_details d where d.jobid = j.jobid and d.status <> 'succeeded'),
    (select count(*)::int from cron.job_run_details d where d.jobid = j.jobid),
    (select max(c.last_run_at) from public.cron_runs c where c.job = any(r.beats)),
    (select bool_and(c.ok) from public.cron_runs c where c.job = any(r.beats)),
    (select string_agg(c.job || ': ' || coalesce(left(c.detail, 160), 'ok'), ' · ' order by c.job)
       from public.cron_runs c where c.job = any(r.beats))
  from robos r
  left join cron.job j on j.jobname = r.jobname;
end $$;

-- "Rodar agora": executa o MESMO comando do agendamento. Só os robôs do painel.
create or replace function public.admin_rodar_robo(_jobname text)
returns void
language plpgsql security definer
set search_path = public, cron
as $$
declare cmd text;
begin
  if not public.is_admin() then raise exception 'só admin'; end if;
  if _jobname not in ('cria-bancos-seg-qui', 'story-notifications-15min') then
    raise exception 'robô não liberado no painel';
  end if;
  select command into cmd from cron.job where jobname = _jobname;
  if cmd is null then raise exception 'robô não encontrado'; end if;
  execute cmd;
end $$;

revoke all on function public.admin_robos() from public, anon;
revoke all on function public.admin_rodar_robo(text) from public, anon;
grant execute on function public.admin_robos() to authenticated;
grant execute on function public.admin_rodar_robo(text) to authenticated;
