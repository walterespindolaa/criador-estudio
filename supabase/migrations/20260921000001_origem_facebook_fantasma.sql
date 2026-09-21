-- ============================================================
-- O "FACEBOOK" QUE NUNCA EXISTIU (Walter, 21/09/2026)
--
-- "Ta dando essas metricas do link da bio errado, pq por exemplo, nao tem o
-- link no facebook."
--
-- Ele tem razao, e a culpa e de uma regra antiga que ja foi corrigida no
-- codigo, mas deixou lixo gravado. Ate 09/09/2026 qualquer referrer que
-- contivesse "facebook" virava origem 'facebook'. Acontece que o navegador de
-- dentro do INSTAGRAM no Android manda referrer de l.facebook.com, porque os
-- tres apps da Meta dividem o mesmo encurtador. Ou seja: visita que veio do
-- Instagram foi gravada como Facebook.
--
-- O codigo novo ja separa isso em 'meta' ("App da Meta", sem chutar qual dos
-- tres). Esta migration so acerta o que ficou gravado errado. Nada e apagado:
-- as linhas mudam de rotulo, os numeros continuam os mesmos.
--
-- 09/09/2026 e a data do deploy da correcao: dali pra frente 'facebook'
-- significa facebook.com de verdade e fica onde esta.
-- ============================================================

-- 1) ANTES DE MUDAR, OLHE. Rode so este select pra ver o que existe hoje:
--
--    select origem, min(dia) as primeiro, max(dia) as ultimo,
--           sum(views) as visitas, sum(clicks) as cliques
--      from public.bio_stats_daily
--     group by origem
--     order by visitas desc;
--
-- Se 'facebook' so aparecer com dia < 2026-09-09, e exatamente o caso descrito
-- acima e o update abaixo resolve. Se aparecer com dia recente, ai e Facebook
-- de verdade (alguem colou o link la) e nao se mexe.

-- 2) Relabel do periodo em que a regra estava errada.
update public.bio_stats_daily
   set origem = 'meta'
 where origem = 'facebook'
   and dia < date '2026-09-09';

-- 3) O mesmo vale pro Messenger, que caia na mesma armadilha.
update public.bio_stats_daily
   set origem = 'meta'
 where origem = 'messenger'
   and dia < date '2026-09-09';
