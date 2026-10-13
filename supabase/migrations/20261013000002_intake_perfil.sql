-- Link de cadastro/briefing por perfil: especialista ou empresa (pedido da Gabi, 13/10/2026).
-- O perfil muda a voz das perguntas e pré-marca o PF/CNPJ do contrato.
-- Links antigos ficam como especialista (era o texto que eles já mostravam).

alter table public.client_intakes
  add column if not exists perfil text not null default 'especialista';

alter table public.client_intakes
  drop constraint if exists client_intakes_perfil_check;
alter table public.client_intakes
  add constraint client_intakes_perfil_check check (perfil in ('especialista', 'empresa'));

-- A página pública precisa saber o perfil pra montar as perguntas.
create or replace function public.get_intake_by_token(_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _i public.client_intakes;
  _accent text; _logo text; _by text; _cname text;
begin
  select * into _i from public.client_intakes where token = _token;
  if not found then return null; end if;

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _i.manager_id;
  select c.name into _cname from public.crm_clients c where c.id = _i.crm_client_id;

  return jsonb_build_object(
    'status', _i.status,
    'answers', _i.answers,
    'steps', _i.steps,
    'perfil', _i.perfil,
    'client_label', _cname,
    'accent', _accent, 'logo', _logo, 'by', _by);
end; $function$;
