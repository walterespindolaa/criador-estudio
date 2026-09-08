-- ═══════════════════════════════════════════════════════════════════════════
-- LINK DE BRIEFING PARA CLIENTE QUE JÁ USA O CRIA (08/09/2026)
--
-- O link de cadastro (/cadastro/<token>) só servia pra cliente SEM conta Cria:
-- as respostas caíam em crm_clients.brand_core/persona. Pra quem TEM conta, a
-- ficha da agência é só um espelho do Brandbook que ele preenche no Cria dele,
-- então o que o link gravasse ia ser sobrescrito na próxima sincronização. Na
-- prática a tela dizia "peça pro cliente preencher" e não dava meio nenhum de
-- pedir (auditoria 08/09, Walter).
--
-- Agora o apply_intake escreve NOS DOIS lugares: continua preenchendo a ficha
-- do CRM (contrato, contato) e, quando o cliente tem conta, também joga as
-- respostas de marca no Brandbook do Cria DELE, que é a fonte da verdade.
--
-- Mesma filosofia de antes: só preenche o que está VAZIO, a não ser que a
-- social mídia peça pra sobrescrever. O que o cliente escreveu logado ganha
-- do que ele respondeu no formulário.
-- ═══════════════════════════════════════════════════════════════════════════

-- Quebra a resposta corrida do formulário em frases pro campo de array da
-- persona. Só ";" e quebra de linha: vírgula picotaria "acha caro, não confia".
create or replace function public.frases_do_briefing(_txt text)
returns text[] language sql immutable as $$
  select coalesce(
    array_remove(array(
      select btrim(x) from regexp_split_to_table(coalesce(_txt, ''), '[;\n]+') as x
      where btrim(x) <> ''
    ), null),
  '{}'::text[]);
$$;
grant execute on function public.frases_do_briefing(text) to authenticated;

create or replace function public.apply_intake(_intake_id uuid, _sobrescrever boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _i public.client_intakes; _a jsonb; _c public.crm_clients;
  _n integer := 0; _bc jsonb; _pe jsonb; _p0 jsonb;
  _txt text;
  _dono uuid;            -- conta Cria do cliente (crm_clients.cria_owner_id)
  _sec text; _key text; _val text; _ja text;
  _mapa text[][];
  _tem_persona boolean;
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
    birthday     = case when _sobrescrever or birthday is null
                        then coalesce((nullif(btrim(_a->>'birthday'),''))::date, birthday) else birthday end,
    updated_at   = now()
  where id = _c.id;

  -- ── Brandbook da ficha (jsonb) ──
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

  -- ── Persona da ficha ──
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

  -- ═══════════════════════════════════════════════════════════════════════
  -- LADO CRIA: se o cliente tem conta, o Brandbook DELE é a fonte da verdade
  -- ═══════════════════════════════════════════════════════════════════════
  _dono := _c.cria_owner_id;
  if _dono is not null then
    -- Mapa intake -> (seção, pergunta) do Brandbook do criador. As seções e
    -- chaves são as mesmas que a tela /app/brandbook grava, e as mesmas que o
    -- importador de PDF usa: assim o que entra pelo link fica indistinguível
    -- do que o cliente digitaria logado.
    -- Só chaves que o formulário realmente pergunta (src/lib/formularioCadastro.ts).
    _mapa := array[
      array['colorPalette',  'moodboard-visual',      'cores'],
      array['archetype',     'moodboard-identidade',  'se-fosse'],
      array['brandValues',   'moodboard-identidade',  'sensacoes'],
      array['vision',        'moodboard-contexto',    'por-que'],
      array['valueProp',     'moodboard-contexto',    'diferencial'],
      array['impact',        'moodboard-contexto',    'legado'],
      array['admiredBrands', 'moodboard-inspiracoes', 'marcas'],
      array['history',       'sobre-voce',            'comeco'],
      array['mainGoal',      'sobre-voce',            'meta'],
      array['specialty',     'linha-editorial',       'ideia-central'],
      array['contentThemes', 'linha-editorial',       'temas'],
      array['toneOfVoice',   'tom-de-voz',            'estilo'],
      array['avoid',         'tom-de-voz',            'evitar']
    ];

    for i in 1 .. array_length(_mapa, 1) loop
      _txt := _mapa[i][1]; _sec := _mapa[i][2]; _key := _mapa[i][3];
      _val := btrim(coalesce(_a->>_txt, ''));
      if _val = '' then continue; end if;

      select btrim(coalesce(me.answer, '')) into _ja
      from public.moodboard_entries me
      where me.user_id = _dono and me.section = _sec and me.question_key = _key;

      -- Sem resposta ainda, ou a social mídia mandou sobrescrever.
      -- Update depois insert em vez de "on conflict": não dependo de a
      -- constraint unique existir com esse nome exato no banco.
      if _ja is null or _ja = '' or _sobrescrever then
        update public.moodboard_entries set answer = _val
        where user_id = _dono and section = _sec and question_key = _key;
        if not found then
          insert into public.moodboard_entries (user_id, section, question_key, answer)
          values (_dono, _sec, _key, _val);
        end if;
        _n := _n + 1;
      end if;
    end loop;

    -- Persona do Cria: só cria a primeira se ele ainda não tiver nenhuma.
    -- Mexer numa persona que o cliente montou seria atropelar o trabalho dele.
    select exists(select 1 from public.personas where user_id = _dono) into _tem_persona;
    if not _tem_persona then
      insert into public.personas (user_id, name, location, how_you_help, notes,
                                   pain_points, desires, objections)
      values (
        _dono,
        left(coalesce(nullif(btrim(_a->>'audience'), ''), 'Público principal'), 80),
        nullif(btrim(_a->>'city'), ''),
        nullif(btrim(_a->>'offer'), ''),
        nullif(btrim(_a->>'doubts'), ''),
        public.frases_do_briefing(_a->>'pains'),
        public.frases_do_briefing(_a->>'desires'),
        public.frases_do_briefing(_a->>'objections')
      );
      _n := _n + 1;
    end if;
  end if;

  update public.client_intakes set status = 'aplicado', applied_at = now() where id = _i.id;
  return _n;
end; $$;
grant execute on function public.apply_intake(uuid, boolean) to authenticated;
