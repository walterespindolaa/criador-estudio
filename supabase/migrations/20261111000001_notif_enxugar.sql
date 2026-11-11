-- Enxuga as notificações (Walter, 11/11/2026): menos avisos e mais certeiros.
-- 1) robô de saúde só avisa quando pede atenção; 2) mesmo assunto não lido vira um
-- aviso com contador; 3) rotina pra quem não abre o sino passa a ser semanal.

create or replace function public.notif_enxugar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _chave text;
  _id uuid;
  _titulo text;
  _n int;
  _total int;
  _lidas int;
begin
  -- 1) Robô de saúde: "tudo certo" não vira aviso. Só chega quando pede atenção.
  if new.type = 'sistema' and new.title like 'CRIA saudável%' then
    return null;
  end if;

  -- 2) Mesmo assunto ainda não lido: junta num aviso só, com contador.
  if new.type in ('publicacao_instagram', 'cria_post', 'demanda_comentario', 'demanda_entregue') then
    _chave := split_part(new.title, ':', 1);
    select n.id, n.title into _id, _titulo
      from public.notifications n
     where n.user_id = new.user_id
       and n.type = new.type
       and coalesce(n.read, false) = false
       and n.created_at > now() - interval '12 hours'
       and (
         (new.type = 'demanda_comentario' and coalesce(n.link, '') = coalesce(new.link, ''))
         or (new.type <> 'demanda_comentario'
             and regexp_replace(split_part(n.title, ':', 1), ' \(\d+\)$', '') = _chave)
       )
     order by n.created_at desc
     limit 1;
    if _id is not null then
      _n := coalesce((regexp_match(split_part(_titulo, ':', 1), ' \((\d+)\)$'))[1]::int, 1) + 1;
      update public.notifications
         set title = _chave || ' (' || _n || ')',
             description = new.description,
             link = case when coalesce(link, '') = coalesce(new.link, '') then link
                         when new.type = 'publicacao_instagram' then '/socialmidia/criapost/publicacoes'
                         else coalesce(new.link, link) end,
             created_at = now()
       where id = _id;
      return null;
    end if;
  end if;

  -- 3) Avisos de rotina pra quem não abre o sino: passa a ser um por semana.
  if new.type in ('resumo_dia', 'meta_semana', 'volte', 'resumo_semana_ig') then
    select count(*), count(*) filter (where coalesce(u.read, false))
      into _total, _lidas
      from (select n.read from public.notifications n
             where n.user_id = new.user_id
               and n.type in ('resumo_dia', 'meta_semana', 'volte', 'resumo_semana_ig')
             order by n.created_at desc limit 7) u;
    if _total >= 7 and _lidas = 0 and exists (
         select 1 from public.notifications n
          where n.user_id = new.user_id
            and n.type in ('resumo_dia', 'meta_semana', 'volte', 'resumo_semana_ig')
            and n.created_at > now() - interval '7 days') then
      return null;
    end if;
  end if;

  return new;
exception when others then
  -- O filtro nunca pode impedir um aviso de entrar.
  return new;
end $$;

drop trigger if exists trg_notif_enxugar on public.notifications;
create trigger trg_notif_enxugar before insert on public.notifications
  for each row execute function public.notif_enxugar();
