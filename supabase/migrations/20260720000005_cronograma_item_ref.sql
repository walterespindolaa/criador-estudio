-- Campo de referência (link de inspiração) por item do cronograma.
alter table public.cronograma_items
  add column if not exists ref_url text;
