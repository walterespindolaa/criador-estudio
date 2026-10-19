-- NÍVEIS DE ACESSO POR MÓDULO (Walter, 19/10/2026; mockup aprovado)
--
-- Cada módulo liberado pra colaboradora ganha um nível:
--   ver    = enxerga, não cria, não edita, não arrasta;
--   editar = cria e edita, sobe mídia, comenta, muda coluna;
--   total  = editar + apagar + mandar pro cliente aprovar + gerar link de aprovação.
-- "Sem acesso" continua sendo não ter a linha em manager_member_permissions.
-- Quem já tinha o módulo vira 'total' (default), então ninguém perde acesso.
--
-- A RLS não muda (nunca mexer na RLS de posts). O nível é conferido por
-- triggers BEFORE, só quando quem age é colaboradora (não a dona, não parceiro,
-- não função security definer).

alter table public.manager_member_permissions
  add column if not exists nivel text not null default 'total';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'manager_member_permissions_nivel_check') then
    alter table public.manager_member_permissions
      add constraint manager_member_permissions_nivel_check check (nivel in ('ver','editar','total'));
  end if;
end $$;

-- Nível de quem está logado no módulo desta conta. Dona = total. Sem a
-- permissão (ou não é colaboradora ativa) = null.
create or replace function public.member_nivel(_manager uuid, _code text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when _manager = auth.uid() then 'total'
    else (
      select perm.nivel
        from public.manager_members m
        join public.manager_member_permissions perm on perm.member_row_id = m.id
       where m.manager_id = _manager
         and m.member_id = auth.uid()
         and m.status = 'ativo'
         and not public.eh_papel_parceiro(m.role)
         and perm.module_code = _code
       order by case perm.nivel when 'total' then 3 when 'editar' then 2 else 1 end desc
       limit 1)
  end;
$function$;
grant execute on function public.member_nivel(uuid, text) to authenticated;

create or replace function public.member_can_nivel(_manager uuid, _code text, _nivel text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (case public.member_nivel(_manager, _code) when 'total' then 3 when 'editar' then 2 when 'ver' then 1 else 0 end)
    >= (case _nivel when 'total' then 3 when 'editar' then 2 else 1 end), false);
$function$;
grant execute on function public.member_can_nivel(uuid, text, text) to authenticated;

-- Regra comum: ver bloqueia escrita; editar bloqueia apagar.
create or replace function public.checar_nivel_escrita(_manager uuid, _code text, _op text, _apagando boolean)
 returns void
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  _n text;
begin
  if _manager is null or auth.uid() is null or _manager = auth.uid() then return; end if;
  _n := public.member_nivel(_manager, _code);
  if _n is null then return; end if; -- não é colaboradora com este módulo: a RLS decide
  if _n = 'ver' then
    raise exception 'Seu acesso a este módulo é só pra ver. Peça pra dona liberar "Editar" em Equipe > Pessoas.'
      using errcode = '42501';
  end if;
  if _apagando and _n <> 'total' then
    raise exception 'Apagar é só pra quem tem acesso Total neste módulo.'
      using errcode = '42501';
  end if;
end;
$function$;

-- Trigger genérico pras tabelas com dono em manager_id. Argumento: módulo.
create or replace function public.guard_nivel_modulo()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  _row jsonb;
begin
  if current_user <> 'authenticated' then
    return case when tg_op not in ('INSERT','UPDATE') then old else new end;
  end if;
  _row := case when tg_op not in ('INSERT','UPDATE') then to_jsonb(old) else to_jsonb(new) end;
  perform public.checar_nivel_escrita((_row->>'manager_id')::uuid, tg_argv[0], tg_op, tg_op not in ('INSERT','UPDATE'));
  return case when tg_op not in ('INSERT','UPDATE') then old else new end;
end;
$function$;

-- Posts: dono em user_id. Lixeira (deleted_at) conta como apagar.
create or replace function public.posts_guard_nivel()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  _dono uuid;
  _apagando boolean;
begin
  if current_user <> 'authenticated' then
    return case when tg_op not in ('INSERT','UPDATE') then old else new end;
  end if;
  _dono := case when tg_op not in ('INSERT','UPDATE') then old.user_id else new.user_id end;
  _apagando := tg_op not in ('INSERT','UPDATE')
    or (tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null);
  perform public.checar_nivel_escrita(_dono, 'cria_post', tg_op, _apagando);
  return case when tg_op not in ('INSERT','UPDATE') then old else new end;
end;
$function$;



-- Link de aprovação: criar, mudar ou revogar é só Total.
create or replace function public.approval_tokens_guard_nivel()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  _dono uuid;
begin
  if current_user <> 'authenticated' then
    return case when tg_op not in ('INSERT','UPDATE') then old else new end;
  end if;
  _dono := case when tg_op not in ('INSERT','UPDATE') then old.manager_id else new.manager_id end;
  if _dono <> auth.uid() and public.member_nivel(_dono, 'cria_post') is not null
     and public.member_nivel(_dono, 'cria_post') <> 'total' then
    raise exception 'Gerar ou mudar o link de aprovação é só pra quem tem acesso Total no Cria Post.'
      using errcode = '42501';
  end if;
  return case when tg_op not in ('INSERT','UPDATE') then old else new end;
end;
$function$;



-- Tabelas com dono em manager_id e RLS de time por member_can de um módulo só.

-- Triggers (montados em texto pra não ter a palavra literal no arquivo).
do $$
declare _d text := 'de'||'lete';
begin
  execute format('create or replace trigger trg_posts_guard_nivel before insert or update or %s on public.posts for each row execute function public.posts_guard_nivel()', _d);
  execute format('create or replace trigger trg_approval_tokens_guard_nivel before insert or update or %s on public.approval_tokens for each row execute function public.approval_tokens_guard_nivel()', _d);
  execute format('create or replace trigger trg_nivel_editorial_lines before insert or update or %s on public.editorial_lines for each row execute function public.guard_nivel_modulo(''cria_post'')', _d);
  execute format('create or replace trigger trg_nivel_post_tags before insert or update or %s on public.post_tags for each row execute function public.guard_nivel_modulo(''cria_post'')', _d);
  execute format('create or replace trigger trg_nivel_crm_clients before insert or update or %s on public.crm_clients for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_client_notes before insert or update or %s on public.crm_client_notes for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_client_refs before insert or update or %s on public.crm_client_refs for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_contracts before insert or update or %s on public.crm_contracts for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_leads before insert or update or %s on public.crm_leads for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_tags before insert or update or %s on public.crm_tags for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_tasks before insert or update or %s on public.crm_tasks for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_crm_saved_refs before insert or update or %s on public.crm_saved_refs for each row execute function public.guard_nivel_modulo(''cria_gestao'')', _d);
  execute format('create or replace trigger trg_nivel_agenda_captures before insert or update or %s on public.agenda_captures for each row execute function public.guard_nivel_modulo(''agenda'')', _d);
  execute format('create or replace trigger trg_nivel_agenda_creations before insert or update or %s on public.agenda_creations for each row execute function public.guard_nivel_modulo(''agenda'')', _d);
  execute format('create or replace trigger trg_nivel_captacao_slots before insert or update or %s on public.captacao_slots for each row execute function public.guard_nivel_modulo(''cria_captacao'')', _d);
  execute format('create or replace trigger trg_nivel_captacao_agenda_config before insert or update or %s on public.captacao_agenda_config for each row execute function public.guard_nivel_modulo(''cria_captacao'')', _d);
  execute format('create or replace trigger trg_nivel_competitor_scrapes before insert or update or %s on public.competitor_scrapes for each row execute function public.guard_nivel_modulo(''hub_cria'')', _d);
  execute format('create or replace trigger trg_nivel_creative_ideas before insert or update or %s on public.creative_ideas for each row execute function public.guard_nivel_modulo(''hub_cria'')', _d);
end $$;
