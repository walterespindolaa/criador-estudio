-- ============================================================
-- O RECADO DA ESTRATÉGIA
--
-- O cronograma guarda O QUE vai ser publicado e nada sobre POR QUÊ. Um mês
-- depois, olhando "Setembro" com dez posts, não sobra nenhum registro de que
-- aquele mês foi montado pra puxar autoridade, ou pra aquecer um lançamento, ou
-- porque o cliente pediu menos venda direta. A decisão fica só na cabeça de
-- quem montou, e some junto com ela.
--
-- Este campo é NOTA INTERNA, de propósito. Não entra em get_cronograma_by_token
-- e portanto não aparece no link que o cliente abre: é onde a social mídia fala
-- com ela mesma e com o time, e ela precisa poder escrever "cliente reclamou do
-- último mês" sem medo.
-- ============================================================

alter table public.cronogramas add column if not exists descricao text;

comment on column public.cronogramas.descricao is
  'Recado interno sobre a estratégia do mês. NUNCA exposto no link público: get_cronograma_by_token não devolve esta coluna.';

-- ============================================================
-- Conferência (rode depois, é só leitura)
-- ============================================================
-- select title, to_char(mes_ref, 'MM/YYYY') as mes, left(descricao, 60) as recado
--   from public.cronogramas order by created_at desc limit 20;
