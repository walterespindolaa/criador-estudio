-- ============================================================
-- LINK DE CADASTRO E BRIEFING (o cliente preenche, cai na ficha)
--
-- Como é hoje: pra fechar contrato a social mídia precisa de razão social,
-- CNPJ, endereço, responsável legal, e-mail e telefone. Isso vira uma sequência
-- de mensagens no WhatsApp ("me manda o CNPJ", "e o endereço completo?"), as
-- respostas chegam picadas entre outros assuntos, e alguém digita tudo de novo
-- na ficha. Depois, na primeira call, ela ainda descobre do zero o que a
-- empresa vende e pra quem.
--
-- Aqui isso vira UM link. O cliente abre, preenche no tempo dele (o rascunho
-- fica salvo), e quando finaliza a social mídia recebe o aviso e aplica no
-- cadastro com um clique. A call começa com as respostas na mão.
--
-- O QUE O CLIENTE NÃO VÊ: valor mensal, dia de vencimento, multa, duração.
-- Isso é decisão comercial da agência e continua sendo preenchido só por ela.
-- ============================================================

create table if not exists public.client_intakes (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- aberto -> cliente ainda preenchendo | enviado -> finalizou
  -- aplicado -> a social mídia já jogou as respostas na ficha
  status text not null default 'aberto',
  -- { chave: resposta } no formato dos campos da ficha
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  applied_at timestamptz
);
alter table public.client_intakes enable row level security;
drop policy if exists "client_intakes tenant" on public.client_intakes;
create policy "client_intakes tenant" on public.client_intakes
  for all to authenticated
  using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));
create index if not exists idx_client_intakes on public.client_intakes(manager_id, created_at desc);
create index if not exists idx_client_intakes_cliente on public.client_intakes(crm_client_id);

-- ════════════════════════════════════════════════════════════
-- LADO DO CLIENTE (anônimo, só com o token)
-- ════════════════════════════════════════════════════════════

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
    'client_label', _cname,
    'accent', _accent, 'logo', _logo, 'by', _by);
end; $$;
grant execute on function public.get_intake_by_token(text) to anon, authenticated;

-- Rascunho: o cliente fecha a aba no meio e volta depois sem perder nada.
create or replace function public.save_intake_by_token(_token text, _answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _i public.client_intakes;
begin
  select * into _i from public.client_intakes where token = _token;
  if not found then raise exception 'link inválido'; end if;
  if _i.status = 'aplicado' then raise exception 'este formulário já foi encerrado'; end if;

  update public.client_intakes
     set answers = coalesce(_answers, '{}'::jsonb)
   where id = _i.id;
end; $$;
grant execute on function public.save_intake_by_token(text, jsonb) to anon, authenticated;

create or replace function public.submit_intake_by_token(_token text, _answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _i public.client_intakes; _cname text;
begin
  select * into _i from public.client_intakes where token = _token;
  if not found then raise exception 'link inválido'; end if;

  update public.client_intakes
     set answers = coalesce(_answers, _i.answers), status = 'enviado', submitted_at = now()
   where id = _i.id;

  select c.name into _cname from public.crm_clients c where c.id = _i.crm_client_id;

  insert into public.notifications (user_id, type, title, description, link)
  values (_i.manager_id, 'cadastro', 'Cliente preencheu o cadastro',
          coalesce(_cname, 'Um cliente') || ' respondeu o formulário. Confira e aplique na ficha.',
          case when _i.crm_client_id is not null
               then '/socialmidia/criacrm/' || _i.crm_client_id::text
               else '/socialmidia/criacrm/clientes' end);
end; $$;
grant execute on function public.submit_intake_by_token(text, jsonb) to anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- LADO DA AGÊNCIA: jogar as respostas na ficha
--
-- Só preenche o que está VAZIO na ficha por padrão. Cliente digitando o nome da
-- empresa de um jeito diferente não pode sobrescrever o que a social mídia já
-- ajustou na mão. Com _sobrescrever = true ela força, quando quiser.
-- ════════════════════════════════════════════════════════════
create or replace function public.apply_intake(_intake_id uuid, _sobrescrever boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _i public.client_intakes; _a jsonb; _c public.crm_clients;
  _n integer := 0; _bc jsonb; _pe jsonb; _p0 jsonb;
  _txt text;
begin
  select * into _i from public.client_intakes where id = _intake_id;
  if not found then raise exception 'formulário não encontrado'; end if;
  if not public.acts_for(_i.manager_id) then raise exception 'sem permissão'; end if;
  if _i.crm_client_id is null then raise exception 'sem cliente vinculado'; end if;

  select * into _c from public.crm_clients where id = _i.crm_client_id;
  if not found then raise exception 'cliente não encontrado'; end if;
  _a := coalesce(_i.answers, '{}'::jsonb);

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
    'visualExpression','mainGoal','bigIdea','promise'
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
