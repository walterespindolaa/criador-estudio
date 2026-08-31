-- ============================================================
-- METAS EM 3 NÍVEIS (31/08) · pedido do Walter
--
-- A mesma tabela structured_goals passa a servir três donos:
--   · 'pessoal'  = a meta do criador (o que já existia; default preserva tudo)
--   · 'operacao' = a meta da OPERAÇÃO da social mídia (aba Metas do Cria Gestão)
--   · 'cliente'  = meta de um cliente específico, cadastrada na estratégia
-- Também entram a data de conclusão (o Walter quer ver criada em X /
-- concluída em Y) e a fonte automática (meta de seguidores do criador se
-- atualiza sozinha com o número do Instagram).
-- ============================================================

alter table public.structured_goals
  add column if not exists scope text not null default 'pessoal',
  add column if not exists external_client_id uuid references public.external_clients(id) on delete cascade,
  add column if not exists concluida_em timestamptz,
  add column if not exists auto_source text;

-- Guarda-corpo: só os três escopos conhecidos.
do $$ begin
  alter table public.structured_goals
    add constraint structured_goals_scope_check check (scope in ('pessoal','operacao','cliente'));
exception when duplicate_object then null; end $$;

create index if not exists idx_goals_user_scope on public.structured_goals(user_id, scope);
create index if not exists idx_goals_external_client on public.structured_goals(external_client_id);
