-- ============================================================
-- CADASTRO PELO GOOGLE (Walter, 25/11/2026: "queria que a pessoa fizesse login
-- ou cadastro tanto com a conta do google quanto manualmente").
--
-- No cadastro por e-mail, as escolhas da tela (tipo de conta, papel de parceiro,
-- plano da LP, origem do anúncio) vão nos metadados da conta e os gatilhos de
-- criação leem na hora (handle_new_user, aplicar_intencao_parceiro). Pelo Google
-- elas não vêm: a conta nasceria sempre como criador. Esta função aplica as
-- escolhas na volta do Google, em /entrar-google.
--
-- Travas pra não mexer em conta errada:
--   - só a própria pessoa (auth.uid());
--   - só conta que nasceu pelo Google há menos de 30 minutos (conta antiga que
--     apenas ligou o Google, inclusive a de e-mail com o mesmo endereço, nunca
--     é tocada);
--   - roda uma vez só (marca cadastro_google_aplicado);
--   - aceita só uma lista fechada de campos, com tamanho limitado;
--   - social mídia e parceiro fazem exatamente o que os gatilhos do cadastro
--     por e-mail fazem.
-- Idempotente (create or replace).
-- ============================================================

create or replace function public.aplicar_cadastro_google(_meta jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _u auth.users%rowtype;
  _limpo jsonb := '{}'::jsonb;
  _k text;
  _intencao text;
  _papel text;
begin
  if _uid is null then
    return 'sem_sessao';
  end if;

  select * into _u from auth.users where id = _uid;
  if not found then
    return 'sem_conta';
  end if;

  if _u.created_at < now() - interval '30 minutes' then
    return 'conta_antiga';
  end if;

  if not exists (select 1 from auth.identities i where i.user_id = _uid and i.provider = 'google') then
    return 'sem_google';
  end if;

  if coalesce(_u.raw_user_meta_data->>'cadastro_google_aplicado', '') = '1' then
    return 'ja_aplicado';
  end if;

  -- Só os campos que o cadastro por e-mail também manda; texto, até 120 letras.
  foreach _k in array array['account_intent', 'parceiro_role', 'utm_source', 'utm_medium',
                            'utm_campaign', 'utm_content', 'veio_de_anuncio', 'plano_escolhido'] loop
    if _meta ? _k and jsonb_typeof(_meta->_k) = 'string' and btrim(_meta->>_k) <> '' then
      _limpo := _limpo || jsonb_build_object(_k, left(btrim(_meta->>_k), 120));
    end if;
  end loop;

  _intencao := _limpo->>'account_intent';
  if _intencao is not null and _intencao not in ('manager', 'parceiro') then
    _limpo := _limpo - 'account_intent';
    _intencao := null;
  end if;
  if coalesce(_limpo->>'plano_escolhido', '') not in ('', 'essencial', 'pro', 'studio') then
    _limpo := _limpo - 'plano_escolhido';
  end if;

  -- Metadados: os relatórios de tráfego e a jornada leem daqui.
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || _limpo
                              || jsonb_build_object('cadastro_google_aplicado', '1')
   where id = _uid;

  -- Social mídia: igual ao handle_new_user (nasce gestora, de graça).
  if _intencao = 'manager' then
    update public.profiles
       set account_type = 'manager'
     where id = _uid and account_type is null;
  end if;

  -- Parceiro: igual ao aplicar_intencao_parceiro (grátis, sem teste).
  if _intencao = 'parceiro' then
    _papel := coalesce(nullif(btrim(_limpo->>'parceiro_role'), ''), 'designer');
    if not public.eh_papel_parceiro(_papel) then
      _papel := 'designer';
    end if;
    update public.profiles
       set account_type = 'parceiro',
           parceiro_role = _papel,
           plan = 'free',
           trial_started_at = null,
           trial_ends_at = null
     where id = _uid and account_type is null;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.aplicar_cadastro_google(jsonb) from public, anon;
grant execute on function public.aplicar_cadastro_google(jsonb) to authenticated;

comment on function public.aplicar_cadastro_google(jsonb) is
  'Aplica as escolhas da tela de cadastro (tipo de conta, plano, origem) em conta que acabou de nascer pelo Google. Chamada por /entrar-google. 25/11/2026.';
