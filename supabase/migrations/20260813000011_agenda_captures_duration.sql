-- Duração estimada da captação em horas (1 a 5; 5 significa "5h ou mais").
alter table public.agenda_captures
  add column if not exists duration_hours smallint;
