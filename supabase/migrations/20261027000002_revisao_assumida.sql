-- "Eu resolvo" (27/10/2026: "vai pro kanban do cliente e não sai daqui, esses
-- em ajuste"). O botão só navegava: nada mudava na peça, então ela seguia em
-- "Pra você revisar" até a social mídia reenviar pro cliente lá no quadro.
-- Agora "Eu resolvo" carimba quando ela assumiu o ajuste. A peça sai da fila
-- de revisão e só volta se o parceiro entregar de novo (entregue_em mais novo).
alter table public.posts add column if not exists revisao_assumida_em timestamptz;
