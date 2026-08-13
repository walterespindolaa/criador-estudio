-- Prints das métricas do Instagram anexados ao relatório do cliente.
-- A social mídia sobe a imagem (print do app do IG) e ela entra numa seção do
-- relatório. Guardamos só os CAMINHOS no Storage (bucket privado "relatorios");
-- a URL assinada é gerada na hora de renderizar.
alter table public.client_report_notes
  add column if not exists metrics_images text[] not null default '{}';
