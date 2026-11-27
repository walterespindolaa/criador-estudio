-- POST ARQUIVADO (Walter, 27/11/2026: "esse vídeo está pronto mas não vamos
-- postar, mas eu não queria tirar ele do histórico"). Arquivar é um status a
-- mais (approval_status = 'arquivado'), com justificativa obrigatória na tela.
-- O link do cliente e a agenda dele filtram por status conhecido, então o post
-- arquivado some de lá sozinho. arquivado_de guarda a coluna de onde saiu, pra
-- "Desarquivar" devolver pro mesmo lugar.
-- Só colunas novas: a RLS de posts não muda.
alter table public.posts add column if not exists arquivado_motivo text;
alter table public.posts add column if not exists arquivado_em timestamptz;
alter table public.posts add column if not exists arquivado_de text;
