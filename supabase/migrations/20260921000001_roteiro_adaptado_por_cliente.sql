-- ============================================================
-- UM ROTEIRO ADAPTADO POR CLIENTE (Walter, 21/09/2026)
--
-- "Se e um reels que eu ja li antes, ele ta trazendo esse exemplo, mas nao faz
-- sentido, pq eu to em outro cliente."
--
-- video_analyses tem unique (manager_id, post_url): UMA linha por gestor e por
-- video. Isso esta certo pro que a linha guarda de verdade, que e a OBSERVACAO
-- do video (ritmo, cortes, blocos, gancho). Ler o mesmo reel duas vezes daria o
-- mesmo resultado e custaria credito de fornecedor a toa.
--
-- O problema e que o roteiro ADAPTADO tambem foi morar nessa linha, dentro de
-- result.roteiro_adaptado. Como a chave nao tem cliente, dois estragos:
--   1. o cliente B abria o video ja analisado e via o roteiro escrito pro A;
--   2. adaptar pro B APAGAVA o roteiro do A (era update no mesmo campo).
--
-- Aqui a adaptacao sai de dentro do result e vira tabela filha, com unique por
-- (analise, cliente). A analise do video continua uma so, e cada cliente ganha
-- a sua versao, que convivem. Nada e apagado: o backfill copia o que ja existe
-- pro cliente certo, e result fica como esta (a tela passa a ler daqui).
-- ============================================================

create table if not exists public.video_script_adaptations (
  id uuid primary key default gen_random_uuid(),
  video_analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  -- Repetido da analise de proposito: a RLS le daqui sem precisar de join.
  manager_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text,
  -- { titulo, blocos: [...], legenda_sugerida }
  roteiro jsonb not null,
  -- Lista do que precisa ser gravado, que tambem e do cliente, nao do video.
  o_que_gravar jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_analysis_id, crm_client_id)
);

create index if not exists idx_vsa_analise on public.video_script_adaptations(video_analysis_id);
create index if not exists idx_vsa_cliente on public.video_script_adaptations(crm_client_id, updated_at desc);

alter table public.video_script_adaptations enable row level security;

-- Mesma regra de video_analyses: dono do tenant e time leem, a edge escreve.
drop policy if exists vsa_select on public.video_script_adaptations;
create policy vsa_select on public.video_script_adaptations
  for select to authenticated using (public.acts_for(manager_id));

-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Tudo que ja foi adaptado tem o dono gravado em result->'adaptado_para'->>'id'
-- (foi posto la justamente pra tela poder dizer de quem era o roteiro). Isso
-- basta pra devolver cada roteiro ao cliente certo. Linha sem esse carimbo, ou
-- apontando pra cliente que nao existe mais, fica de fora: sem dono conhecido,
-- adivinhar seria repetir o erro.
insert into public.video_script_adaptations
  (video_analysis_id, crm_client_id, manager_id, cliente_nome, roteiro, o_que_gravar, created_at, updated_at)
select
  va.id,
  (va.result->'adaptado_para'->>'id')::uuid,
  va.manager_id,
  va.result->'adaptado_para'->>'nome',
  va.result->'roteiro_adaptado',
  va.result->'o_que_gravar',
  coalesce(va.finished_at, va.created_at),
  coalesce(va.finished_at, va.created_at)
from public.video_analyses va
where va.result ? 'roteiro_adaptado'
  and va.result->'adaptado_para'->>'id' is not null
  and exists (
    select 1 from public.crm_clients c
     where c.id = (va.result->'adaptado_para'->>'id')::uuid
       and c.manager_id = va.manager_id
  )
on conflict (video_analysis_id, crm_client_id) do nothing;
