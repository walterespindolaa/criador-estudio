-- Forma de pagamento padronizada.
-- Antes era texto livre no lançamento e não existia no cliente — por isso não dava
-- pra mostrar "como esse cliente paga" no Cria Gestão nem somar por forma.

alter table public.crm_clients
  add column if not exists payment_method text;

alter table public.fin_recurring
  add column if not exists payment_method text;

comment on column public.crm_clients.payment_method is 'Como o cliente paga: Pix, Boleto, Cartão de crédito, Cartão de débito, Transferência / TED, Dinheiro, Outro';
comment on column public.fin_recurring.payment_method is 'Forma de pagamento herdada pelos lançamentos gerados a partir deste recorrente';
