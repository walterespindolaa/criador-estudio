-- ═══════════════════════════════════════════════════════════════════════════
-- COR DO CLIENTE: UMA FONTE DE VERDADE SÓ
--
-- O PROBLEMA
-- Existiam DUAS colunas de cor pro MESMO cliente:
--   crm_clients.color      (cadastro central, escolhida na ficha/cockpit/lista)
--   external_clients.color (cliente do Cria Post, escolhida no portal)
-- A agenda pintava tarefa, captação e material com a cor do CRM e o card do POST
-- com a cor do external. A pessoa escolhia a cor num lugar e o post continuava com
-- outra, porque cada card lia de uma coluna diferente. Nada sincronizava as duas.
--
-- A DECISÃO
-- crm_clients.color MANDA. É o cadastro central: existe pra todo cliente (inclusive
-- quem não usa o Cria Post), é o que a lista de clientes, o cockpit, o kanban, a
-- home e a agenda já leem na maioria dos casos. external_clients.color continua
-- existindo (o portal e o calendário do gestor leem de lá) mas vira ESPELHO.
--
-- COMO PROPAGA
-- Gatilho no banco, não código no front: front esquece, e a cor tem que espelhar
-- mesmo quando quem muda é um robô, um SQL na mão ou outra tela.
--   1) mudou crm_clients.color  -> espelha em todo external_clients vinculado
--   2) external_clients ganhou/trocou vínculo -> puxa a cor do CRM na hora
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. RECONCILIAÇÃO DO QUE JÁ EXISTE ───────────────────────────────────────
-- Regra do desempate: o CRM ganha quando tem cor. É a cor que a pessoa escolhe na
-- ficha e no cockpit (os dois lugares onde ela realmente vai definir a identidade
-- do cliente); a cor do external, na maioria dos casos, nunca foi escolhida de
-- propósito, foi gravada pelo formulário do portal, que abria pré-selecionado em
-- #EA4918 e salvava esse laranja junto com qualquer outra alteração.
-- Quando o CRM está VAZIO e o external tem cor, promovemos a do external pra o CRM
-- (a pessoa escolheu ali, não podemos perder o dado).

-- 1a. External sem cor herda a do CRM.
update public.external_clients ec
   set color = cc.color
  from public.crm_clients cc
 where ec.crm_client_id = cc.id
   and cc.color is not null
   and ec.color is null;

-- 1b. CRM sem cor herda a do external (promove a escolha que só existia lá).
--     Quando um mesmo cliente do CRM tem mais de um external com cor (legado), vence
--     o external mais antigo, que é o vínculo original.
update public.crm_clients cc
   set color = sub.color
  from (
    select distinct on (ec.crm_client_id) ec.crm_client_id, ec.color
      from public.external_clients ec
     where ec.crm_client_id is not null
       and ec.color is not null
     order by ec.crm_client_id, ec.created_at asc
  ) sub
 where cc.id = sub.crm_client_id
   and cc.color is null;

-- 1c. Conflito (as duas com cor e diferentes): o CRM ganha, o external é sobrescrito.
update public.external_clients ec
   set color = cc.color
  from public.crm_clients cc
 where ec.crm_client_id = cc.id
   and cc.color is not null
   and ec.color is distinct from cc.color;

-- ── 2. GATILHO: CRM -> EXTERNAL ─────────────────────────────────────────────
create or replace function public.espelha_cor_cliente_no_external()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só mexe quando a cor realmente mudou (evita update em cascata desnecessário).
  if new.color is distinct from old.color then
    update public.external_clients
       set color = new.color
     where crm_client_id = new.id
       and color is distinct from new.color;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_espelha_cor_cliente on public.crm_clients;
create trigger trg_espelha_cor_cliente
  after update of color on public.crm_clients
  for each row
  execute function public.espelha_cor_cliente_no_external();

-- ── 3. GATILHO: EXTERNAL PUXA A COR DO CRM AO VINCULAR ──────────────────────
-- Ativar o Cria Post num cliente cria a linha em external_clients sem cor. Sem isto
-- o card do post nasceria laranja padrão até alguém reabrir a ficha e salvar de novo.
create or replace function public.puxa_cor_do_cliente_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _cor text;
begin
  if new.crm_client_id is null then
    return new;
  end if;
  -- Só puxa quando o vínculo é novo/mudou ou quando a linha ainda não tem cor.
  if tg_op = 'INSERT'
     or new.crm_client_id is distinct from old.crm_client_id
     or new.color is null then
    select cc.color into _cor from public.crm_clients cc where cc.id = new.crm_client_id;
    if _cor is not null then
      new.color := _cor;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_puxa_cor_do_cliente_central on public.external_clients;
create trigger trg_puxa_cor_do_cliente_central
  before insert or update of crm_client_id, color on public.external_clients
  for each row
  execute function public.puxa_cor_do_cliente_central();

comment on column public.crm_clients.color is
  'Cor do cliente (hex). FONTE DE VERDADE: pinta a agenda, a lista, o kanban e o cockpit. external_clients.color é espelho disto (gatilho trg_espelha_cor_cliente).';
comment on column public.external_clients.color is
  'Espelho de crm_clients.color (mantido por gatilho). Não edite direto: edite a cor na ficha do cliente.';
