-- Onboarding v3 (24/10/2026): aviso "meta da semana ficando pra trás".
-- O robô diário (daily-notifications) cria o tipo meta_semana quinta e sábado;
-- o push dele segue a categoria "lembretes" das preferências de notificação.
CREATE OR REPLACE FUNCTION public.notif_categoria(_tipo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes'
    when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes'
    when 'roteiro' then 'clientes'
    when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes'
    when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'resumo_dia' then 'lembretes'
    when 'lembrete_postar' then 'lembretes'
    when 'meta_semana' then 'lembretes'
    when 'posts_pendentes' then 'lembretes'
    when 'story' then 'lembretes'
    when 'captacao_amanha' then 'lembretes'
    when 'aniversario_cliente' then 'lembretes'
    when 'prazo_amanha' then 'lembretes'
    when 'demanda_prazo_amanha' then 'lembretes'
    when 'demanda_atrasada' then 'lembretes'
    when 'demanda_nova' then 'clientes'
    when 'demanda_ajuste' then 'clientes'
    when 'demanda_entregue' then 'clientes'
    when 'resumo_semana_ig' then 'conquistas'
    when 'meta_batida' then 'conquistas'
    when 'dica_dia' then 'conquistas'
    when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas'
    when 'ideia_criada' then 'conquistas'
    when 'comissao_paga' then 'conquistas'
    when 'parceiro' then 'avisos'
    when 'volte' then 'avisos'
    when 'acesso_vencendo' then 'avisos'
    else 'avisos' end
$function$;
