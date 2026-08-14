-- Check de concluída na reunião da agenda (igual tarefa e captação).
alter table public.agenda_creations
  add column if not exists done boolean not null default false;
