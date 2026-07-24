-- Coluna de origem no feedback: de onde a pessoa enviou (gestor | usuario).
-- RLS não muda: quem insere é o dono (auth.uid() = user_id) e o admin lê/atualiza.
alter table public.feedbacks add column if not exists origin text;
