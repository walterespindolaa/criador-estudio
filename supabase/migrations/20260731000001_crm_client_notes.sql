-- ============================================================
-- BLOCO DE NOTAS DO CLIENTE (modelo "Notas do iPhone")
--
-- Antes: UMA nota única por cliente, num campo de texto corrido
-- (account_members.manager_notes, lido/gravado pelas RPCs get_manager_notes /
-- set_manager_notes). Tudo o que foi conversado com o cliente ao longo de meses
-- ia empilhando no mesmo bloco, sem título, sem data, sem busca.
--
-- Agora: VÁRIAS notas por cliente, cada uma com título, corpo e data, agrupadas
-- por período na tela (Hoje / Últimos 30 dias / mês) e com busca.
--
-- Escopo da nota (uma das duas pontas, ou as duas):
--   crm_client_id    → cliente do CRM (ficha do Cria Gestão, ClienteHub)
--   account_owner_id → conta CRIA gerenciada (a lista de contas do gestor)
-- Cliente do CRM com conta CRIA vinculada (cria_owner_id) grava as DUAS, então a
-- mesma nota aparece nos dois lugares. É o que evita "duas caixas de notas".
--
-- pinned: SIM, vale a pena. O uso real é "o que foi combinado com o cliente" e
-- sempre existe uma ou duas coisas que a social mídia precisa ver toda vez que
-- abre a ficha (paleta aprovada, o que não pode falar, prazo do contrato). Sem
-- fixar, isso afunda na lista em duas semanas de anotação. É uma coluna boolean,
-- custo zero, e resolve um problema que aparece cedo.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar e sem duplicar as notas
-- importadas do modelo antigo.
-- ============================================================

create table if not exists public.crm_client_notes (
  id               uuid primary key default gen_random_uuid(),
  manager_id       uuid not null references auth.users(id) on delete cascade,
  crm_client_id    uuid references public.crm_clients(id) on delete cascade,
  account_owner_id uuid references auth.users(id) on delete cascade,
  title            text not null default '',
  -- HTML simples (negrito, itálico, lista). Sanitizado no cliente com DOMPurify.
  body             text not null default '',
  pinned           boolean not null default false,
  -- De onde a nota veio quando foi importada do modelo antigo (null = nota nova).
  -- Serve de chave de idempotência da migração de dados lá embaixo.
  legacy_source    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint crm_client_notes_escopo
    check (crm_client_id is not null or account_owner_id is not null)
);

-- Reexecução em base que já tinha uma versão anterior da tabela.
alter table public.crm_client_notes add column if not exists pinned boolean not null default false;
alter table public.crm_client_notes add column if not exists legacy_source text;
alter table public.crm_client_notes add column if not exists account_owner_id uuid references auth.users(id) on delete cascade;

grant select, insert, update, delete on public.crm_client_notes to authenticated;
grant all on public.crm_client_notes to service_role;

alter table public.crm_client_notes enable row level security;

-- RLS de time, EXATAMENTE o padrão das outras tabelas do CRM (crm_clients,
-- crm_tasks, client_materials): dono do tenant OU colaborador ativo dele.
drop policy if exists "crm_client_notes_team" on public.crm_client_notes;
create policy "crm_client_notes_team" on public.crm_client_notes
  for all to authenticated
  using (public.acts_for(manager_id))
  with check (public.acts_for(manager_id));

-- Índices pros filtros reais da tela: lista de um cliente (fixadas primeiro,
-- mais recentes primeiro) e lista de uma conta CRIA gerenciada.
create index if not exists idx_crm_client_notes_client
  on public.crm_client_notes (crm_client_id, pinned desc, updated_at desc);
create index if not exists idx_crm_client_notes_owner
  on public.crm_client_notes (account_owner_id, pinned desc, updated_at desc);
create index if not exists idx_crm_client_notes_manager
  on public.crm_client_notes (manager_id, updated_at desc);

-- Chaves de idempotência da importação (só valem pras linhas importadas).
create unique index if not exists uq_crm_client_notes_legacy_am
  on public.crm_client_notes (manager_id, account_owner_id)
  where legacy_source = 'account_members';
create unique index if not exists uq_crm_client_notes_legacy_crm
  on public.crm_client_notes (crm_client_id)
  where legacy_source = 'crm_clients';

-- updated_at = última vez que o CONTEÚDO mudou (é ele que ordena e agrupa a
-- lista por período). Fixar/desafixar não é edição: se contasse, desafixar uma
-- nota de junho jogaria ela pro grupo "Hoje" sem ninguém ter escrito nada.
create or replace function public.touch_crm_client_notes()
returns trigger language plpgsql as $$
begin
  if (new.title is distinct from old.title) or (new.body is distinct from old.body) then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end; $$;
drop trigger if exists trg_touch_crm_client_notes on public.crm_client_notes;
create trigger trg_touch_crm_client_notes
  before update on public.crm_client_notes
  for each row execute function public.touch_crm_client_notes();

comment on table public.crm_client_notes is
  'Bloco de notas por cliente (várias notas, modelo Notas do iPhone). Substitui a nota única de account_members.manager_notes e crm_clients.notes, que ficam como backup.';

-- ============================================================
-- MIGRAÇÃO DOS DADOS ANTIGOS — NADA PODE SE PERDER
--
-- Duas origens de nota única viram a PRIMEIRA nota da caixa nova:
--   1) account_members.manager_notes → o que a social mídia escrevia no popup
--      "Notas" da lista de contas (HTML, já sanitizado na gravação).
--   2) crm_clients.notes             → o campo "Anotações" da ficha do CRM
--      (texto puro; vira HTML com <br> pra não perder as quebras de linha).
--
-- Título: primeira linha do texto (até 60 caracteres); se não der pra extrair,
-- cai pra "Anotações".
--
-- NENHUMA das colunas antigas é apagada aqui: elas continuam no banco como
-- backup. Só depois de conferir é que vale limpar, em outra rodada.
-- Rodar de novo não duplica (ON CONFLICT DO NOTHING nos índices únicos acima).
-- ============================================================

-- 1) account_members.manager_notes
with origem as (
  select
    am.member_id                                    as manager_id,
    am.owner_id                                     as account_owner_id,
    am.manager_notes                                as body,
    -- texto puro pra decidir se tem conteúdo e pra tirar o título
    btrim(regexp_replace(
      regexp_replace(
        replace(replace(am.manager_notes, '&nbsp;', ' '), '&amp;', '&'),
        '<br\s*/?>|</p>|</div>|</li>|</h[1-6]>', E'\n', 'gi'),
      '<[^>]*>', '', 'g'))                          as texto,
    (select c.id
       from public.crm_clients c
      where c.cria_owner_id = am.owner_id
        and c.manager_id = am.member_id
        and c.deleted_at is null
      order by c.created_at
      limit 1)                                      as crm_client_id
  from public.account_members am
  where am.member_id is not null
    and am.manager_notes is not null
)
insert into public.crm_client_notes
  (manager_id, crm_client_id, account_owner_id, title, body, legacy_source, created_at, updated_at)
select
  o.manager_id,
  o.crm_client_id,
  o.account_owner_id,
  coalesce(nullif(btrim(left(split_part(o.texto, E'\n', 1), 60)), ''), 'Anotações'),
  o.body,
  'account_members',
  now(), now()
from origem o
where o.texto <> ''
on conflict do nothing;

-- 2) crm_clients.notes (campo "Anotações" da ficha)
insert into public.crm_client_notes
  (manager_id, crm_client_id, account_owner_id, title, body, legacy_source, created_at, updated_at)
select
  c.manager_id,
  c.id,
  c.cria_owner_id,
  coalesce(nullif(btrim(left(split_part(btrim(c.notes), E'\n', 1), 60)), ''), 'Anotações'),
  -- texto puro → HTML seguro (escapa e preserva as quebras de linha)
  replace(
    replace(
      replace(
        replace(btrim(c.notes), '&', '&amp;'),
        '<', '&lt;'),
      '>', '&gt;'),
    E'\n', '<br>'),
  'crm_clients',
  now(), now()
from public.crm_clients c
where c.deleted_at is null
  and btrim(coalesce(c.notes, '')) <> ''
on conflict do nothing;
