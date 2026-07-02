-- Admin: limpar conteúdo de um usuário SEM apagar a conta.
-- Descobre em runtime todas as tabelas com coluna de dono (user_id / manager_id),
-- exclui as tabelas de conta/cobrança/conexão/infra (preserve[]) e apaga o resto
-- filtrando pelo dono. Faz até 8 passadas pra respeitar FKs sem depender da ordem.
-- Em qualquer erro, a transação inteira faz rollback (nada é apagado pela metade).

create or replace function public.admin_wipe_user_content(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  -- Tabelas que NUNCA são limpas (conta, plano, cobrança, conexões, push, agência, logs, seeds).
  preserve text[] := array[
    'profiles','subscriptions','module_entitlements','billing_events','course_purchases',
    'partners','partner_referrals','account_members','manager_profiles',
    'google_drive_connections','social_connections','push_subscriptions','terms_acceptances',
    'audit_log','app_logs','admin_actions','account_deletion_log','ai_rate_limit','rl_buckets',
    'email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails',
    'reference_formats','reference_hooks','reference_prompts','content_trends','courses',
    'modules','broadcasts','partner_program_config'
  ];
  cand record;
  candidates text[] := '{}';
  remaining text[];
  nextr text[];
  item text; parts text[]; tbl text; col text;
  n bigint; total bigint := 0; pass int := 0;
  result jsonb := '{}'::jsonb;
begin
  if _user_id is null then raise exception 'user_id_required'; end if;

  -- Monta a lista "tabela:coluna" de tudo que pertence ao usuário e não está preservado.
  for cand in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name  = c.table_name
     and t.table_type  = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('user_id','manager_id')
      and c.table_name <> all(preserve)
  loop
    candidates := candidates || (cand.table_name || ':' || cand.column_name);
  end loop;

  remaining := candidates;
  while array_length(remaining, 1) is not null and pass < 8 loop
    pass := pass + 1;
    nextr := '{}';
    foreach item in array remaining loop
      parts := string_to_array(item, ':');
      tbl := parts[1]; col := parts[2];
      begin
        execute format('delete from public.%I where %I = $1', tbl, col) using _user_id;
        get diagnostics n = row_count;
        total := total + n;
        result := result || jsonb_build_object(tbl, coalesce((result->>tbl)::bigint, 0) + n);
      exception when foreign_key_violation then
        -- ainda tem filho referenciando: tenta na próxima passada
        nextr := nextr || item;
      end;
    end loop;
    exit when array_length(nextr, 1) is null;   -- acabou
    exit when nextr = remaining;                 -- sem progresso → aborta pra não travar
    remaining := nextr;
  end loop;

  if array_length(remaining, 1) is not null then
    raise exception 'wipe_incomplete (FK): %', array_to_string(remaining, ', ');
  end if;

  return jsonb_build_object('deleted_total', total, 'tables', result);
end;
$func$;

-- Só o backend (service_role) pode chamar — nunca o cliente.
revoke all on function public.admin_wipe_user_content(uuid) from public, anon, authenticated;
grant execute on function public.admin_wipe_user_content(uuid) to service_role;
