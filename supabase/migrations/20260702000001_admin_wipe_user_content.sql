-- Admin: limpar conteúdo de um usuário SEM apagar a conta.
-- Ordem explícita de deletes (filhas → pais) derivada do grafo real de FKs.
-- Quase todos os FKs entre tabelas de conteúdo são CASCADE/SET NULL, então esta
-- ordem não dá deadlock. MANTÉM: login, plano, assinatura, cobrança, conexões
-- (IG/Drive), push, termos e vínculos de agência.

create or replace function public.admin_wipe_user_content(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  u uuid := _user_id;
  total bigint := 0;
  n bigint;
begin
  if u is null then raise exception 'user_id_required'; end if;

  -- filhas / dependentes primeiro
  delete from post_approval_comments where post_id in (select id from posts where user_id = u);
  get diagnostics n = row_count; total := total + n;
  delete from cronograma_items where cronograma_id in (select id from cronogramas where manager_id = u);
  get diagnostics n = row_count; total := total + n;
  delete from cronograma_datas where cronograma_id in (select id from cronogramas where manager_id = u);
  get diagnostics n = row_count; total := total + n;
  delete from crm_client_refs where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from crm_tasks where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from crm_contracts where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from approval_tokens where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from collab_deliverables where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from milestones where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from habit_logs where user_id = u; get diagnostics n = row_count; total := total + n;

  -- conteúdo (folhas)
  delete from social_insights where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from social_metrics_daily where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from external_media_refs where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from media_items where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from status_covers where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from user_hooks where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from user_formats where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from user_prompts where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from user_library_usage where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from moodboard_entries where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from monthly_goals where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from monthly_reflections where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from autopilot_runs where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from bio_leads where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from bio_links where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from notifications where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from tasks where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from files where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from feedbacks where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from brand_items where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from story_slots where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from media_kit_profiles where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from personas where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from collabs where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from habits where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from structured_goals where user_id = u; get diagnostics n = row_count; total := total + n;

  -- crm / agência
  delete from crm_leads where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from fin_records where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from fin_recurring where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from cronogramas where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from crm_clients where manager_id = u; get diagnostics n = row_count; total := total + n;
  delete from external_clients where manager_id = u; get diagnostics n = row_count; total := total + n;

  -- posts, ideias e pilares por último
  delete from ideas where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from posts where user_id = u; get diagnostics n = row_count; total := total + n;
  delete from pillars where user_id = u; get diagnostics n = row_count; total := total + n;

  return jsonb_build_object('deleted_total', total);
end;
$func$;

revoke all on function public.admin_wipe_user_content(uuid) from public, anon, authenticated;
grant execute on function public.admin_wipe_user_content(uuid) to service_role;
