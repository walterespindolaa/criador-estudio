-- Prompter: roteiro avulso também entra na fila "Pra gravar" (25/10/2026).
-- Antes só os posts da fase Produzindo do Criando apareciam lá; o roteiro
-- subido no Prompter ficava só em "Meus roteiros".
--   na_fila    true = aparece em "Pra gravar" (roteiro novo já nasce na fila)
--   gravado_em quando a pessoa tocou "Já gravei" (vai pra "Já gravados")
alter table public.prompter_scripts
  add column if not exists na_fila boolean not null default true,
  add column if not exists gravado_em timestamptz;

-- Os roteiros que já existiam não inundam a fila: ficam na biblioteca e a
-- pessoa manda pra gravar pelo menu do card quando quiser.
update public.prompter_scripts set na_fila = false where na_fila = true;
