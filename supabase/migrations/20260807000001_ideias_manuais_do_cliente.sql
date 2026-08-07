-- ============================================================
-- IDEIAS MANUAIS NO COCKPIT DO CLIENTE
--
-- Pedido da operação: "ter onde ir anotando ideia de conteúdo pro
-- cliente ao longo da semana, pra depois virar post ou cronograma".
--
-- NÃO nasce tabela nova: a creative_ideas (HUB CRIA) já é o banco de
-- ideias por cliente (manager_id + crm_client_id + ciclo de vida
-- novo/usar/usada/descartada). A ideia digitada na mão entra nela com
-- source = 'manual' (a coluna source é texto livre, sem check).
-- O INSERT pela social mídia já é permitido: a policy creative_ideas_team
-- (collab_access) é FOR ALL com acts_for(manager_id).
--
-- O que falta são três colunas:
--   1. ref_url        → link de referência opcional da ideia
--   2. converted_post_id       → em qual post do Cria Post a ideia virou
--   3. converted_cronograma_id → em qual cronograma a ideia entrou
-- As converted_* são a memória do "aproveitada": a ideia não some ao
-- converter, ela marca de onde veio o conteúdo (status 'usada' + link).
-- ============================================================

alter table public.creative_ideas
  add column if not exists ref_url text,
  add column if not exists converted_post_id uuid references public.posts(id) on delete set null,
  add column if not exists converted_cronograma_id uuid references public.cronogramas(id) on delete set null;

comment on column public.creative_ideas.ref_url is
  'Link de referência opcional da ideia (post do Instagram, Drive, Pinterest...).';
comment on column public.creative_ideas.converted_post_id is
  'Post do Cria Post que nasceu desta ideia (status vira usada). NULL se o post for excluído.';
comment on column public.creative_ideas.converted_cronograma_id is
  'Cronograma que recebeu esta ideia como item (status vira usada). NULL se o cronograma for excluído.';
