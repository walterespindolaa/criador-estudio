-- TESTE DE 7 DIAS COM CARTÃO, SÓ PRO CRIADOR (Walter, 03/11/2026, mockup aprovado).
-- 1. Três colunas novas no perfil, gravadas só pelo servidor (webhook do Stripe):
--      assinatura_teste_ate        fim do teste da assinatura (null quando não está em teste)
--      teste_cartao_inicio         quando a pessoa começou um teste com cartão (nunca é apagada:
--                                  é ela que diz "já usou o teste")
--      boas_vindas_assinatura_em   quando saiu o e-mail da primeira cobrança (manda uma vez só)
-- 2. As três entram na trava de colunas de controle (usuário não muda pela API).
-- 3. Criador que se cadastra pela tela nova (marca teste_com_cartao = 1 nos metadados)
--    não ganha mais os 7 dias automáticos sem cartão. Social mídia, Meu perfil, conta
--    de cliente, convite e parceiro continuam exatamente como estão.

alter table public.profiles
  add column if not exists assinatura_teste_ate timestamptz,
  add column if not exists teste_cartao_inicio timestamptz,
  add column if not exists boas_vindas_assinatura_em timestamptz;

create or replace function public.profiles_travar_colunas_de_controle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  if new.storage_used_bytes is distinct from old.storage_used_bytes
     or new.storage_quota_bytes is distinct from old.storage_quota_bytes
     or new.role is distinct from old.role
     or new.plan is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     /* Só o servidor LIGA a flag; o próprio usuário DESLIGA depois de trocar
        a senha em /app/trocar-senha. Sem isso a tela entrava em loop. */
     or (new.must_change_password is distinct from old.must_change_password
         and not (coalesce(old.must_change_password, false) = true and coalesce(new.must_change_password, false) = false))
     or new.parceiro_role is distinct from old.parceiro_role
     or new.account_type is distinct from old.account_type
     or new.codigo_parceiro is distinct from old.codigo_parceiro
     or new.perfil_de is distinct from old.perfil_de
     -- teste com cartão (03/11/2026)
     or new.assinatura_teste_ate is distinct from old.assinatura_teste_ate
     or new.teste_cartao_inicio is distinct from old.teste_cartao_inicio
     or new.boas_vindas_assinatura_em is distinct from old.boas_vindas_assinatura_em
  then
    raise exception 'coluna de controle do perfil so muda pelo servidor';
  end if;
  return new;
end $function$;

create or replace function public.handle_new_user_trial()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  /* Criador do cadastro novo testa com cartão (o teste nasce no checkout do
     Stripe). Só vale pra conta sem tipo (criador) e que não é Meu perfil. */
  if new.account_type is null and new.perfil_de is null and exists (
       select 1 from auth.users u
        where u.id = new.id
          and u.raw_user_meta_data->>'teste_com_cartao' = '1'
          and coalesce(u.raw_user_meta_data->>'account_intent', '') = '') then
    return new;
  end if;
  update public.profiles
     set trial_started_at = now(),
         trial_ends_at = now() + interval '7 days',
         plan = 'trial'
   where id = new.id;
  return new;
end;
$function$;

notify pgrst, 'reload schema';
