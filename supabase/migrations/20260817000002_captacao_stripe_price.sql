-- Cria Captação: liga o checkout self-serve (price criado no Stripe pelo Walter).
-- Produto: prod_V5jqGQ42FjH3p1 · Price: price_1U5YMQRDE8ybSi6Vfcz3RvdC
update public.modules
   set stripe_price_id = 'price_1U5YMQRDE8ybSi6Vfcz3RvdC',
       active = true,
       coming_soon = false
 where code = 'cria_captacao';
