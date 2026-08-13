-- ── Cria Captação → Cria Post: fechar o ciclo (captação vira post) ─────────────
--
-- O material da captação (roteiro/nota) vira o ponto de partida de um rascunho no
-- Cria Post do cliente. Pra não duplicar (mandar a mesma captação pro post duas
-- vezes) e pra deixar o elo visível ("essa captação já virou post"), a captação
-- guarda o id do post que nasceu dela.
--
-- NÃO cria tabela nova: só uma coluna em public.agenda_captures. Idempotente
-- ("add column if not exists"), seguro de rodar de novo.
--
-- RLS: nada de política nova. agenda_captures já tem RLS por LINHA (dono via
--   acts_for(manager_id) + gate de módulo 'agenda'). Como a proteção é por linha,
--   a coluna nova herda a mesma proteção. Não afrouxamos nada.
--
-- FK com "on delete set null": se o post for excluído lá no Cria Post, a captação
-- não some nem quebra; ela só perde o vínculo e o botão "Virar post" volta a
-- aparecer (a pessoa pode gerar outro rascunho).
alter table public.agenda_captures
  add column if not exists converted_post_id uuid references public.posts(id) on delete set null;

comment on column public.agenda_captures.converted_post_id is
  'Post do Cria Post que nasceu desta captação (rascunho pré-preenchido com o roteiro/nota). NULL se o post for excluído ou se a captação ainda não virou post.';
