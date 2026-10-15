-- ═══════════════════════════════════════════════════════════════════════════
-- BLINDAGEM DAS FUNÇÕES DO BANCO (Walter, 14/10/2026) · JÁ APLICADA (registro)
-- O alerta do Supabase mostrava 218 funções SECURITY DEFINER que qualquer um
-- com a chave pública (anon, a que vai no navegador) podia chamar direto pela
-- API. Algumas não conferiam quem chamava, por exemplo:
--   admin_wipe_user_content(_user_id)  apagava o conteúdo de QUALQUER conta;
--   enqueue_email                      mandava e-mail pela fila do Cria;
--   refund_hub_credits / bump_*         mexiam em créditos e cotas de qualquer um;
--   get_user_id_by_email               dizia se um e-mail tem conta.
-- Regra nova:
--   1) só servidor (edge functions com service role, crons, triggers): ninguém
--      de fora executa;
--   2) público de verdade (páginas por link/token, bio, convite, cadastro e as
--      funções usadas nas regras de acesso das tabelas): continua liberado;
--   3) todo o resto: só quem está logado.
-- ═══════════════════════════════════════════════════════════════════════════
do $b$
declare r record;
  _so_servidor text[] := array['admin_wipe_user_content','adotar_materiais_do_portal','agenda_item_peca_e_minha','apify_scrapes_orfaos','aplicar_intencao_parceiro','bio_lead_para_pipeline','bio_registrar_evento','bump_ai_quota','bump_ai_rate_limit','bump_hub_credits','bunny_limpaveis','bunny_soltar_midia','carimbar_feito_em','check_and_increment_rate_limit','cria_limite_clientes','crm_clients_guard_cria_owner','crm_clients_guard_limite','delete_email','email_queue_dispatch','email_queue_wake','enqueue_email','espelha_cor_cliente_no_external','fin_terceiro_guarda','get_user_id_by_email','guard_bio_slug_unico','handle_new_user','handle_new_user_trial','ig_copiar_resultado_pro_post','ig_ligar_insight_ao_post','ig_travar_publicacao','increment_bio_block_click','increment_bio_link_click','increment_bio_page_view','increment_bio_view','lancar_cache_parceiro','material_fluxo_depois','move_to_dlq','notify_client_comment','notify_new_bio_lead','notify_parceiro_comentario','notify_parceiro_fluxo','notify_post_approval','notify_push_on_insert','partner_regra','profiles_travar_colunas_de_controle','puxa_cor_do_cliente_central','rate_touch','read_email_batch','recalc_manager_storage','reconcile_agency_seats','refund_hub_credits','set_external_media_expiry','submit_bio_lead','submit_bio_page_lead','token_allows_post','token_rate_ok','update_storage_used']::text[];
  _publicas text[] := array['accept_proposal_by_token','acts_for','acts_for_equipe','approve_post_by_token','approve_script_approval_item_by_token','approve_stage_by_token','caixa_do_time','can_client','can_client_ext','capas_by_token','claim_account_invites','cofre_enviar_por_link','cofre_link_info','criakut_tem_acesso','get_cronograma_by_token','get_external_client_by_token','get_external_handle_by_token','get_intake_by_token','get_portal_settings','get_proposal_by_token','get_public_bio_blocks','get_public_bio_item','get_public_bio_items','get_public_bio_links_by_slug','get_public_bio_page_by_slug','get_public_bio_page_links_by_slug','get_public_profile_by_slug','get_script_approval_by_token','get_token_period','has_member_module','ig_convite_publico','is_account_manager','is_account_member','is_admin','is_team_member','list_materials_by_token','list_post_comments_by_token','list_posts_by_token','log_app_error','member_can','member_can_client','my_managed_accounts','my_team_accounts','parceiro_tem_o_card','pin_comment_by_token','portal_mark_viewed','reject_proposal_by_token','remove_pin_by_token','reorder_script_approval_by_token','request_adjustment_by_token','request_material_by_token','request_proposal_change_by_token','request_stage_adjustment_by_token','save_intake_by_token','save_script_approval_item_by_token','set_cronograma_data_by_token','set_cronograma_item_by_token','submit_intake_by_token','submit_script_approval_by_token','validate_partner_code']::text[];
begin
  for r in select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.prosecdef and p.prokind = 'f' loop
    if r.proname = any(_so_servidor) then
      execute format('revoke execute on function %s from public, anon, authenticated', r.f);
      execute format('grant execute on function %s to service_role', r.f);
    elsif r.proname = any(_publicas) then
      execute format('grant execute on function %s to anon, authenticated, service_role', r.f);
    else
      execute format('revoke execute on function %s from public, anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $b$;

-- Função nova nasce fechada pra quem não está logado (antes nascia aberta pra todo mundo).
-- Página pública nova que precisar de função: dar grant pra anon na própria migration.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- increment_storage: só mexe no espaço da própria conta (ou da conta que a pessoa gerencia).
create or replace function public.increment_storage(_user uuid, _delta bigint)
 returns void language sql security definer set search_path to 'public'
as $function$
  update public.profiles set storage_used_bytes = greatest(0, coalesce(storage_used_bytes, 0) + _delta)
  where id = _user and (auth.uid() is null or auth.uid() = _user or public.acts_for(_user));
$function$;
revoke execute on function public.increment_storage(uuid, bigint) from public, anon;
grant execute on function public.increment_storage(uuid, bigint) to authenticated, service_role;

-- Anexos do botão de feedback: o bucket é público por URL (o app usa getPublicUrl),
-- mas a regra de leitura deixava QUALQUER UM listar todos os prints de feedback
-- pela API. Agora só o dono do anexo ou o admin lista.
drop policy if exists "Public can view feedback attachment" on storage.objects;
create policy "Feedback: dono ou admin lista" on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_admin()));

-- Alerta "search_path mutável" nas 13 funções simples (não mudam comportamento).
do $b$ declare r record; begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = any(array['touch_crm_client_notes','canal_do_comentario','frases_do_briefing','ig_formato_compativel','ig_legenda_base','ig_recalcular_publicar_em','instante_brasilia','notif_categoria','touch_client_materials','eh_papel_parceiro','parceiro_ve','criakut_tocar_atualizado','criakut_preco'])
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') loop
    execute format('alter function %s set search_path = public, pg_temp', r.f);
  end loop;
end $b$;
