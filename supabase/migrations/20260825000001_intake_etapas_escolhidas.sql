-- ============================================================
-- ESCOLHER O QUE VAI NO LINK
--
-- O formulário inteiro são seis blocos, e nem todo envio precisa dos seis.
-- Casos reais que apareceram no primeiro dia de uso:
--   · cliente que já é atendido há meses e só falta o CNPJ pro contrato;
--   · cliente novo que assinou e a social mídia quer só o briefing de marca,
--     porque os dados cadastrais ela já pegou na proposta;
--   · rebriefing anual: só as etapas de público e de tom de voz.
--
-- Mandar 30 perguntas pra quem precisa responder 6 é o caminho mais curto pro
-- formulário não voltar. Aqui o envio guarda QUAIS etapas ele leva.
--
-- steps null = todas (é o que os links já criados continuam sendo).
-- ============================================================

alter table public.client_intakes
  add column if not exists steps integer[];

create or replace function public.get_intake_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    'client_label', _cname,
    'accent', _accent, 'logo', _logo, 'by', _by);
end; $$;
grant execute on function public.get_intake_by_token(text) to anon, authenticated;
