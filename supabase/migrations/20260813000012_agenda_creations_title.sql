-- Título da reunião na agenda (ex.: "Alinhamento mensal").
alter table public.agenda_creations
  add column if not exists title text;
