-- Primeiros passos do cliente (19/10/2026): a social mídia esconde a jornada
-- de um cliente no X (com confirmação). Vale em qualquer aparelho e pra equipe.
-- Já aplicado em produção pelo conector Supabase; arquivo de registro.
alter table public.crm_clients add column if not exists jornada_oculta boolean not null default false;
comment on column public.crm_clients.jornada_oculta is 'Primeiros passos do cliente escondidos pela social midia (X com confirmacao). 2026-10-19.';
