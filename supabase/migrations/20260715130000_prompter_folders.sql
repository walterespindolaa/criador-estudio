-- Cria Prompter — pastas de roteiros (rótulo simples, sem tabela extra).
alter table public.prompter_scripts add column if not exists folder text;
