-- Cria Captacao vira modulo PAGO (R$ 19,90/mes = price_cents 1990).
--
-- O que e gated: a PAGINA /socialmidia/captacao (o painel de gerencia das
-- captacoes). Marcar captacao na Agenda continua GRATIS: aquilo le/escreve em
-- public.agenda_captures, que ja e gated por 'agenda' (member_can na f22) e NAO
-- muda aqui. Nenhuma RLS de dado e alterada nesta migration.
--
-- Esta migration mexe SO no CATALOGO: insere a linha em public.modules. O gate
-- do menu e da rota vive no front (ManagerLayout + ModuleGate, code
-- 'cria_captacao'). A liberacao ja funciona automatica porque tudo le esta
-- tabela de forma dinamica:
--   - checkout self-serve (create-module-checkout) le modules por code;
--   - admin libera no modal "criar social midia" (le modules ativos);
--   - stripe-webhook grava module_entitlements pelo module_code do metadata.
--
-- stripe_price_id fica NULL de proposito: o Walter precisa criar o preco
-- recorrente de R$ 19,90/mes no Stripe e preencher stripe_price_id nesta linha
-- (mesmo caminho dos outros modulos pagos). Ate la, a compra self-serve responde
-- 'module_unavailable', mas o admin JA consegue liberar de graca inserindo em
-- module_entitlements pelo modal.
--
-- Idempotente: on conflict (code) do nothing.
insert into public.modules (code, name, description, price_cents, active, coming_soon, sort_order)
values (
  'cria_captacao',
  'Cria Captacao',
  'Gerencie as captacoes do mes por dia e local, com roteiro, teleprompter, folha do dia, lista de tomadas, captacao recorrente e sugestao por cidade',
  1990,
  true,
  false,
  40
)
on conflict (code) do nothing;
