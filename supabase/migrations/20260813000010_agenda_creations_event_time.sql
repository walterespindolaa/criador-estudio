-- Hora da reunião na agenda (antes a "criação" não tinha horário nenhum).
alter table public.agenda_creations
  add column if not exists event_time time;
