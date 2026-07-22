-- Ordem manual dos cards no kanban do criador (Criando). Sem isso, os cards só
-- ordenavam por data e não dava pra reordenar dentro da coluna (card novo caía
-- sempre no fim). Agora cada post tem board_order e a coluna respeita ele.
alter table public.posts add column if not exists board_order int not null default 0;

-- Backfill: mantém a ordem que já aparecia (mais novo no topo) por usuário e status.
with ranked as (
  select id, row_number() over (partition by user_id, coalesce(status, 'ideia') order by created_at desc) as rn
  from public.posts
)
update public.posts p set board_order = r.rn from ranked r where r.id = p.id;
