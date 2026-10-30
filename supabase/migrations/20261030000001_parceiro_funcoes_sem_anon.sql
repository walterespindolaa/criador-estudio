-- PENTE FINO DO ACESSO DOS PARCEIROS (30/10/2026)
-- Estas funções nunca são chamadas sem login, mas estavam liberadas pra
-- "anon" (visitante sem conta). Nenhuma vazava dado (todas dependem do login
-- ou só devolvem sim/não), mas porta aberta sem uso é porta a menos pra
-- vigiar. "authenticated" continua: o gatilho posts_guard_parceiro e as
-- edges de download usam com o login da pessoa.
revoke execute on function public.parceiro_atende_cliente(uuid, uuid, uuid) from public, anon;
revoke execute on function public.parceiros_aptos_cliente(uuid, uuid) from public, anon;
revoke execute on function public.parceiros_aptos_post(uuid) from public, anon;
revoke execute on function public.parceiro_tem_o_card(uuid) from public, anon;
revoke execute on function public.notify_parceiro_pagamento() from public, anon;
