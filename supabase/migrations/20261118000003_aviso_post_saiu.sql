-- Aviso "saiu agora" (post_saiu, 18/11/2026): quando um post sai pelo Cria,
-- chama quem cuida do perfil pra compartilhar no story e responder os
-- comentários na primeira hora. Fica na categoria Lembretes e não conta no
-- teto de 8 pushes por dia (social mídia com vários clientes passa disso).

create or replace function public.notif_categoria(_tipo text)
 returns text
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
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
    when 'post_saiu' then 'lembretes'
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

create or replace function public.quer_push(_user uuid, _tipo text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  _pref boolean;
  _hora int;
  _hoje int;
begin
  -- Preferência por categoria (ausente = ligado).
  select (p.notification_prefs ->> public.notif_categoria(_tipo))::boolean into _pref
    from public.profiles p where p.id = _user;
  if coalesce(_pref, true) = false then return false; end if;

  -- Silêncio das 22h às 7h (Brasília). Lead e comentário de cliente passam:
  -- são a pessoa do outro lado esperando resposta; o resto espera amanhecer
  -- (o sino continua recebendo tudo, só o push é segurado).
  _hora := extract(hour from (now() at time zone 'America/Sao_Paulo'))::int;
  if (_hora >= 22 or _hora < 7) and _tipo not in ('lead', 'comentario_cliente', 'cria_post') then
    return false;
  end if;

  -- "Saiu agora" só vale na hora: não entra no teto diário.
  if _tipo = 'post_saiu' then return true; end if;

  -- Teto: 8 pushes por dia por pessoa. Conta as notificações do dia que
  -- passariam pelo filtro de categoria; a partir da 9ª só o sino recebe.
  select count(*) into _hoje
    from public.notifications n
   where n.user_id = _user
     and n.created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if _hoje > 8 then return false; end if;

  return true;
end $function$;
