-- ============================================================
-- CONTA DE SOCIAL MÍDIA É GRATUITA.
--
-- O fluxo estava errado: quem se cadastrava escolhendo "social mídia" caía numa
-- tela de checkout obrigatório (/comecar-agencia) e só entrava depois de comprar
-- assentos. Isso contradiz o modelo do produto e a própria landing, que diz
-- "área do gestor gratuita, você ativa só os módulos que usar".
--
-- O certo: a conta abre de graça, com Início, Clientes, Cockpit, Agenda e
-- Aprovações. O que se paga é MÓDULO (Cria Post, Cria Gestão, Cria Caixa,
-- Cria Radar) e ASSENTO de cliente, cada um contratado dentro do app.
--
-- Aqui: o gatilho que cria o perfil passa a ler a intenção escolhida no cadastro
-- e já marca a conta como gestora, sem cobrança. Mais o conserto de quem ficou
-- preso na tela de pagamento antes desta correção.
-- Idempotente.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Criador'),
    -- Cadastrou como social mídia? Já nasce gestora, de graça. Qualquer outro
    -- valor (ou ausência) segue como criadora, que é o padrão.
    case when new.raw_user_meta_data->>'account_intent' = 'manager'
         then 'manager' else null end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Conserta quem já se cadastrou como social mídia e ficou preso no checkout.
update public.profiles p
   set account_type = 'manager'
  from auth.users u
 where u.id = p.id
   and u.raw_user_meta_data->>'account_intent' = 'manager'
   and coalesce(p.account_type, '') <> 'manager';
