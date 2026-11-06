-- ============================================================
-- TAREFAS: repetição e passos (Walter, 06/11/2026, mockup aprovado)
--
--  - repeticao: 'dia' | 'semana' | 'mes' (null = não repete). Ao concluir,
--    o app cria a próxima da série com o prazo seguinte.
--  - repeticao_gerada: a próxima já foi criada (desmarcar e marcar de novo
--    não duplica a série).
--  - passos: checklist curto dentro da tarefa, [{ "texto": "...", "feito": false }].
--  - concluida_em: quando foi marcada como feita (o "feitas" da semana e a
--    ordem da aba Feitas usam isso).
--
-- RLS: as colunas moram na própria tasks, então valem as policies que já
-- existem (dono, gestor da conta e membro da conta). Nada novo a liberar.
-- Idempotente.
-- ============================================================

alter table public.tasks add column if not exists repeticao text;
alter table public.tasks add column if not exists repeticao_gerada boolean not null default false;
alter table public.tasks add column if not exists passos jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists concluida_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_repeticao_check') then
    alter table public.tasks add constraint tasks_repeticao_check
      check (repeticao is null or repeticao in ('dia', 'semana', 'mes'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_passos_array_check') then
    alter table public.tasks add constraint tasks_passos_array_check
      check (jsonb_typeof(passos) = 'array' and jsonb_array_length(passos) <= 30);
  end if;
end $$;

-- Tarefas que já estavam concluídas ganham a data da última atualização.
update public.tasks
   set concluida_em = coalesce(updated_at, created_at)
 where status = 'concluida' and concluida_em is null;

notify pgrst, 'reload schema';
