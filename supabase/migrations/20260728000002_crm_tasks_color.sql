-- ============================================================
-- Cor opcional na tarefa do CRM.
--
-- Tarefa SEM cliente não tinha como se destacar na agenda (herdava só a cor
-- padrão cinza). Agora o social mídia pode escolher uma cor pra ela.
-- Guarda um hex (ex.: "#0061EE") ou null (usa a cor padrão).
-- Idempotente.
-- ============================================================

alter table public.crm_tasks add column if not exists color text;

comment on column public.crm_tasks.color is
  'Cor opcional (hex) da tarefa na agenda. Null = cor padrão. Útil pra tarefa sem cliente.';
