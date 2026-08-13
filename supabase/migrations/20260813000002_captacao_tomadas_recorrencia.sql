-- ── Cria Captação: lista de tomadas (checklist) + captação recorrente ──────────
--
-- Duas features novas, ambas em cima da tabela que já existe (public.agenda_captures).
-- NÃO cria tabela nova. Todas as colunas entram com "add column if not exists"
-- (idempotente, seguro de rodar de novo).
--
-- RLS: nada de política nova. agenda_captures já tem RLS por LINHA do projeto
--   (dono via acts_for(manager_id) em 20260708160000_collab_access + gate de módulo
--    member_can(manager_id,'agenda') na f22). Como as políticas são por linha, não
--   por coluna, as colunas novas herdam a MESMA proteção automaticamente. As linhas
--   geradas pela recorrência (feitas no cliente, com o mesmo manager_id da origem)
--   caem exatamente sob a mesma política de INSERT/SELECT. Não afrouxamos nada.

-- 1) LISTA DE TOMADAS (CHECKLIST) ──────────────────────────────────────────────
-- O que precisa sair naquela gravação (ex.: "1 Reels", "3 Fotos", "1 Story"), pra
-- a social mídia não voltar do local e faltar coisa. jsonb array; cada item é
-- { id: text, texto: text, feito: bool }. `default '[]'` pra nunca vir null (a
-- tela lê sem tratar null). Captação antiga fica com lista vazia.
alter table public.agenda_captures
  add column if not exists shot_list jsonb not null default '[]'::jsonb;

-- 2) CAPTAÇÃO RECORRENTE (mensal, por DIA DO MÊS) ─────────────────────────────
-- Modelo escolhido: MENSAL POR DIA DO MÊS ("todo dia 10"), que é o caso do Walter
-- (cliente que grava todo mês no mesmo esquema). Por dia-do-mês, e não por dia-da-
-- semana, porque o combinado com o cliente é uma data ("dia 10"), não "toda 2ª".
--
--   recurring           -> liga/desliga a geração das próximas ocorrências.
--   recurrence_day       -> dia do mês (1..31); dia > último dia do mês cai no
--                           último dia (a materialização no cliente já faz o clamp).
--   recurrence_source_id -> nas ocorrências GERADAS, aponta pra captação de origem
--                           (a que tem recurring=true). É o que dá anti-duplicata
--                           robusta: o "grupo" de uma recorrência é a origem + todas
--                           as filhas que apontam pra ela; a checagem de "esse mês já
--                           foi criado?" é por (grupo, mês), não por casamento frouxo
--                           de cliente+data. A origem tem source_id nulo (ela é a raiz).
--                           Sem FK de propósito: é só uma etiqueta; apagar a origem não
--                           deve derrubar/cascatear as ocorrências já criadas.
alter table public.agenda_captures
  add column if not exists recurring boolean not null default false;
alter table public.agenda_captures
  add column if not exists recurrence_day int;
alter table public.agenda_captures
  add column if not exists recurrence_source_id uuid;

-- Índice pra resolver o grupo de uma recorrência (origem -> filhas) rápido. Parcial:
-- só as linhas geradas têm source_id, então o índice fica pequeno.
create index if not exists idx_agenda_captures_recurrence_source
  on public.agenda_captures (recurrence_source_id)
  where recurrence_source_id is not null;
