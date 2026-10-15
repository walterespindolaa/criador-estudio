-- URGENTE NA PEÇA DO PARCEIRO (Walter, 14/10/2026: "um sinal de urgente pra
-- ela saber que coloquei como prioridade"). Mockup aprovado em 15/10.
-- A social mídia liga no "Enviar pra produção"; o parceiro vê em vermelho e a
-- peça sobe pro topo da fila dele, antes da ordem por prazo.

alter table public.posts add column if not exists urgente boolean not null default false;

-- A fila ganha a coluna e passa a ordenar urgente primeiro. Mudou o formato
-- do retorno, então precisa recriar (create or replace não troca colunas).
drop function if exists public.parceiro_minha_fila();
create function public.parceiro_minha_fila()
 returns table(post_id uuid, titulo text, formato text, plataforma text, producao_status text, prazo_producao date, publica_em date, assigned_at timestamp with time zone, agencia_id uuid, agencia_nome text, cliente_nome text, cliente_handle text, cliente_cor text, cliente_logo text, etiquetas uuid[], prazo_status text, prazo_sugerido date, cache numeric, external_client_id uuid, capa text, revisoes integer, urgente boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    p.id, p.title, p.format, p.platform,
    coalesce(p.producao_status, 'aguardando'),
    p.prazo_producao, p.scheduled_date, p.assigned_at,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    ec.instagram_handle,
    cc.color, cc.logo,
    p.internal_tags,
    p.prazo_status, p.prazo_sugerido,
    p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id and not m.substituida
      order by m.position asc nulls last, m.created_at asc
      limit 1),
    coalesce(p.revisoes, 0),
    coalesce(p.urgente, false)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by coalesce(p.urgente, false) desc, p.prazo_producao asc nulls last, p.assigned_at asc;
$function$;

revoke all on function public.parceiro_minha_fila() from public, anon;
grant execute on function public.parceiro_minha_fila() to authenticated, service_role;

-- O card aberto devolve o campo (os dois lados usam). Troca só a última
-- linha do jsonb_build_object, sem reescrever o resto da função à mão.
do $$
declare _def text;
begin
  _def := pg_get_functiondef('public.parceiro_abrir_card(uuid)'::regprocedure);
  if position('''urgente''' in _def) = 0 then
    _def := replace(_def, '''comentarios'', _coments);',
                          '''comentarios'', _coments, ''urgente'', coalesce(_p.urgente, false));');
    if position('''urgente''' in _def) = 0 then
      raise exception 'parceiro_abrir_card mudou: não achei o fim do jsonb_build_object';
    end if;
    execute _def;
  end if;
end $$;
