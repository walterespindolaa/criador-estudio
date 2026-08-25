-- ============================================================
-- FORMA E DIA DE PAGAMENTO NO LINK DE CADASTRO
--
-- O formulário evitava qualquer assunto de dinheiro de propósito: perguntar
-- valor, multa ou duração ao cliente inverte quem conduz a negociação.
--
-- Só que dia e forma de pagamento não são negociação, são preferência dele. E
-- são justamente as duas informações que faltavam pra mensalidade nascer com
-- vencimento certo no Caixa. Sem elas, a social mídia fecha o contrato e ainda
-- volta no WhatsApp pra perguntar "qual dia fica melhor pra você?".
--
-- payment_day é INTEIRO na ficha, então aqui a resposta é limpa (só dígitos) e
-- validada entre 1 e 31. Qualquer coisa fora disso é descartada em silêncio, em
-- vez de estourar o apply inteiro por causa de um campo.
--
-- O resto da função é idêntico à versão anterior.
-- ============================================================

create or replace function public.apply_intake(_intake_id uuid, _sobrescrever boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _i public.client_intakes; _a jsonb; _c public.crm_clients;
  _n integer := 0; _bc jsonb; _pe jsonb; _p0 jsonb;
  _txt text; _dia integer;
begin
  select * into _i from public.client_intakes where id = _intake_id;
  if not found then raise exception 'formulário não encontrado'; end if;
  if not public.acts_for(_i.manager_id) then raise exception 'sem permissão'; end if;
  if _i.crm_client_id is null then raise exception 'sem cliente vinculado'; end if;

  select * into _c from public.crm_clients where id = _i.crm_client_id;
  if not found then raise exception 'cliente não encontrado'; end if;
  _a := coalesce(_i.answers, '{}'::jsonb);

  -- Dia do pagamento: só dígitos, e só se fizer sentido no calendário.
  _dia := nullif(regexp_replace(coalesce(_a->>'payment_day', ''), '[^0-9]', '', 'g'), '')::integer;
  if _dia is not null and (_dia < 1 or _dia > 31) then _dia := null; end if;

  -- ── Colunas do cadastro ──
  update public.crm_clients set
    company_name = case when _sobrescrever or coalesce(company_name,'') = ''
                        then coalesce(nullif(btrim(_a->>'company_name'),''), company_name) else company_name end,
    cnpj         = case when _sobrescrever or coalesce(cnpj,'') = ''
                        then coalesce(nullif(btrim(_a->>'cnpj'),''), cnpj) else cnpj end,
    -- Pessoa física assina em nome próprio: o formulário não pergunta o
    -- responsável de novo, então o nome do contrato é o próprio responsável.
    owner_name   = case when _sobrescrever or coalesce(owner_name,'') = ''
                        then coalesce(nullif(btrim(_a->>'owner_name'),''),
                                      nullif(btrim(_a->>'company_name'),''), owner_name) else owner_name end,
    email        = case when _sobrescrever or coalesce(email,'') = ''
                        then coalesce(nullif(btrim(_a->>'email'),''), email) else email end,
    phone        = case when _sobrescrever or coalesce(phone,'') = ''
                        then coalesce(nullif(btrim(_a->>'phone'),''), phone) else phone end,
    whatsapp     = case when _sobrescrever or coalesce(whatsapp,'') = ''
                        then coalesce(nullif(btrim(_a->>'whatsapp'),''), whatsapp) else whatsapp end,
    address      = case when _sobrescrever or coalesce(address,'') = ''
                        then coalesce(nullif(btrim(_a->>'address'),''), address) else address end,
    city         = case when _sobrescrever or coalesce(city,'') = ''
                        then coalesce(nullif(btrim(_a->>'city'),''), city) else city end,
    instagram    = case when _sobrescrever or coalesce(instagram,'') = ''
                        then coalesce(nullif(btrim(_a->>'instagram'),''), instagram) else instagram end,
    -- NOVOS: preferência de pagamento do cliente.
    payment_method = case when _sobrescrever or coalesce(payment_method,'') = ''
                        then coalesce(nullif(btrim(_a->>'payment_method'),''), payment_method) else payment_method end,
    payment_day  = case when _sobrescrever or payment_day is null
                        then coalesce(_dia, payment_day) else payment_day end,
    -- Aniversário: o formulário manda "2000-MM-DD", igual ao seletor da ficha.
    birthday     = case when _sobrescrever or birthday is null
                        then coalesce((nullif(btrim(_a->>'birthday'),''))::date, birthday) else birthday end,
    updated_at   = now()
  where id = _c.id;

  -- ── Brandbook (jsonb): mesma regra de não atropelar o que já existe ──
  _bc := coalesce(_c.brand_core, '{}'::jsonb);
  foreach _txt in array array[
    'mainProducts','marketSince','history','brandValues','impact','vision','admiredBrands',
    'offer','valueProp','audience','contentThemes','avoid','specialty','coreMessage',
    'archetype','toneOfVoice','personality','communicationStyle','colorPalette','typography',
    'contract_type',
    'visualExpression','mainGoal','bigIdea','promise','perception6m','successMetric'
  ] loop
    if coalesce(btrim(_a->>_txt), '') <> ''
       and (_sobrescrever or coalesce(btrim(_bc->>_txt), '') = '') then
      _bc := jsonb_set(_bc, array[_txt], to_jsonb(btrim(_a->>_txt)));
      _n := _n + 1;
    end if;
  end loop;

  -- ── Persona: o formulário alimenta a PRIMEIRA persona ──
  _pe := coalesce(_c.persona, '[]'::jsonb);
  if jsonb_typeof(_pe) <> 'array' then _pe := jsonb_build_array(_pe); end if;
  if jsonb_array_length(_pe) = 0 then _pe := jsonb_build_array('{}'::jsonb); end if;
  _p0 := _pe->0;
  foreach _txt in array array['pains','desires','doubts','objections','seeks','valuesWhat','buying','lifestyle'] loop
    if coalesce(btrim(_a->>_txt), '') <> ''
       and (_sobrescrever or coalesce(btrim(_p0->>_txt), '') = '') then
      _p0 := jsonb_set(_p0, array[_txt], to_jsonb(btrim(_a->>_txt)));
      _n := _n + 1;
    end if;
  end loop;
  _pe := jsonb_set(_pe, '{0}', _p0);

  update public.crm_clients set brand_core = _bc, persona = _pe, updated_at = now() where id = _c.id;
  update public.client_intakes set status = 'aplicado', applied_at = now() where id = _i.id;
  return _n;
end; $$;
grant execute on function public.apply_intake(uuid, boolean) to authenticated;
