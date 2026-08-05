-- ── ENCERRAMENTO AGENDADO NÃO É INATIVO ──
-- Regra: o cliente é ativo até o DIA do encerramento, INCLUSIVE.
-- O fluxo antigo de "Inativar cliente" gravava status = 'inativo' na hora,
-- mesmo quando a data de encerramento escolhida ainda estava no futuro.
-- Resultado: cliente com contrato vigente (ex.: BRAVI e VERSITY) sumia do
-- filtro "Ativos" da lista de clientes.
--
-- O app novo já grava certo (encerramento futuro mantém status 'ativo' e a
-- leitura deriva sozinha quando a data passa, ver src/lib/cliente-status.ts).
-- Aqui só consertamos as linhas antigas que ficaram marcadas como inativas
-- com o contrato ainda valendo. Idempotente: rodar de novo não muda nada.
update public.crm_clients
   set status = 'ativo',
       active = true
 where status = 'inativo'
   and contract_end_date is not null
   and contract_end_date >= (now() at time zone 'America/Sao_Paulo')::date;
