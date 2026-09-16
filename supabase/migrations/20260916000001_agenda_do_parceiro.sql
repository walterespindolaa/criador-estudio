-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 11: A AGENDA DO PARCEIRO (16/09/2026) · pedido do Walter
--
-- O parceiro tem FILA, mas não tem AGENDA. A diferença não é cosmética: fila é
-- "o que me mandaram", agenda é "como eu organizo o meu dia". Quem é designer
-- ou filmmaker não trabalha só pra uma agência: tem o card da Gabriela, tem o
-- casamento no sábado, tem a reunião de segunda, tem "preciso exportar antes de
-- viajar". Hoje nada disso cabe no produto, então ela abre o Cria pra ver a
-- fila e o Google Agenda pra viver. Quando isso acontece, o Cria vira consulta,
-- não ferramenta.
--
-- TRÊS FONTES, UMA AGENDA:
--   1. as ENTREGAS com prazo, que já existem (parceiro_minha_fila);
--   2. as TAREFAS E COMPROMISSOS dela, que nascem aqui;
--   3. os DIAS DE GRAVAÇÃO em que a social mídia marcou ela.
--
-- POR QUE TABELA NOVA E NÃO A `tasks` QUE JÁ EXISTE
-- `tasks` é a lista de tarefas do CRIADOR: mora dentro do app de criador, o
-- vínculo dela é com o post do próprio dono, e a tela de Tarefas lê os posts
-- dele. Enfiar o parceiro ali significaria mexer numa tabela que toda conta de
-- criador usa hoje, pra ganhar o quê: reaproveitar quatro colunas. O parceiro
-- também precisa de duas coisas que `tasks` não tem (hora do compromisso e a
-- agência a que o item pertence). Tabela própria, risco zero pra quem já usa.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) OS ITENS DELA ──────────────────────────────────────────────────────
create table if not exists public.parceiro_agenda_itens (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references auth.users(id) on delete cascade,
  -- tarefa: tem prazo e pode não ter dia. compromisso: tem dia e hora.
  tipo text not null default 'tarefa',
  titulo text not null,
  data date,
  hora text,
  local text,
  nota text,
  prioridade text not null default 'media',
  feito boolean not null default false,
  feito_em timestamptz,
  -- Elo opcional com a peça delegada: "exportar o carrossel da Fulana".
  post_id uuid references public.posts(id) on delete set null,
  -- A agência a que isso pertence, quando pertence a alguma. É o que deixa o
  -- extrato do circuito 12 separar o trabalho por contratante.
  agencia_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parceiro_agenda_itens is
  'Tarefas e compromissos do próprio parceiro. Nada aqui é visível pra agência: é a camada pessoal dele, como a parceiro_etapas do quadro.';

alter table public.parceiro_agenda_itens
  drop constraint if exists chk_agenda_tipo;
alter table public.parceiro_agenda_itens
  add constraint chk_agenda_tipo check (tipo in ('tarefa', 'compromisso'));

alter table public.parceiro_agenda_itens
  drop constraint if exists chk_agenda_prioridade;
alter table public.parceiro_agenda_itens
  add constraint chk_agenda_prioridade check (prioridade in ('urgente', 'alta', 'media', 'baixa'));

/* Compromisso SEM dia não é compromisso, é anotação: ele existe pra ocupar um
   lugar no calendário. Tarefa sem prazo continua valendo (é a lista de "quando
   der"), e é por isso que a regra não vale pros dois. */
alter table public.parceiro_agenda_itens
  drop constraint if exists chk_agenda_compromisso_tem_dia;
alter table public.parceiro_agenda_itens
  add constraint chk_agenda_compromisso_tem_dia
  check (tipo <> 'compromisso' or data is not null);

create index if not exists idx_agenda_parceiro_data
  on public.parceiro_agenda_itens(parceiro_id, data);
create index if not exists idx_agenda_parceiro_aberto
  on public.parceiro_agenda_itens(parceiro_id) where not feito;

alter table public.parceiro_agenda_itens enable row level security;

drop policy if exists "agenda do parceiro é dele" on public.parceiro_agenda_itens;
create policy "agenda do parceiro é dele" on public.parceiro_agenda_itens
  for all using (parceiro_id = auth.uid()) with check (parceiro_id = auth.uid());

/* O carimbo de conclusão vem do banco, não do navegador: é ele que o extrato do
   mês usa pra dizer "isto foi fechado em setembro". Relógio de celular errado
   jogaria trabalho pro mês errado. */
create or replace function public.carimbar_feito_em()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.feito and not coalesce(old.feito, false) then
    new.feito_em := now();
  elsif not new.feito then
    new.feito_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agenda_feito_em on public.parceiro_agenda_itens;
create trigger trg_agenda_feito_em
  before insert or update on public.parceiro_agenda_itens
  for each row execute function public.carimbar_feito_em();

/* A peça amarrada tem que ser DELA. Sem isto, a coluna post_id aceitaria
   qualquer uuid de post do banco: a checagem de chave estrangeira do Postgres
   não passa por RLS, então ela viraria uma forma de descobrir se um id existe.
   Não vaza conteúdo, mas é uma porta que não precisa ficar aberta. */
create or replace function public.agenda_item_peca_e_minha()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is not null and not exists (
    select 1 from public.posts p
     where p.id = new.post_id and p.assignee_id = auth.uid()
  ) then
    raise exception 'Esta peça não está com você.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agenda_peca_minha on public.parceiro_agenda_itens;
create trigger trg_agenda_peca_minha
  before insert or update of post_id on public.parceiro_agenda_itens
  for each row execute function public.agenda_item_peca_e_minha();

-- ── 2) O DIA DE GRAVAÇÃO SABE QUEM VAI GRAVAR ─────────────────────────────
-- `agenda_captures.team` existe desde julho e é TEXTO LIVRE: serve pra escrever
-- "eu + Jo", não pra ligar uma pessoa de verdade. Sem um id, não há como a
-- captação aparecer na agenda de ninguém. A coluna nova não substitui a antiga:
-- a equipe continua sendo texto (tem gente que não tem conta no Cria), e o
-- parceiro marcado é um a mais, com nome e sobrenome no banco.
alter table public.agenda_captures
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null;

comment on column public.agenda_captures.parceiro_id is
  'Parceiro de produção escalado pra este dia. É o que faz a gravação aparecer na agenda dele.';

create index if not exists idx_agenda_captures_parceiro
  on public.agenda_captures(parceiro_id, capture_date) where parceiro_id is not null;

-- ── 3) AS GRAVAÇÕES DELA ──────────────────────────────────────────────────
-- Mesma arquitetura da fase 1: o parceiro não enxerga a tabela, fala com uma
-- função que confere o vínculo na unha. E o vínculo tem que estar ATIVO: a
-- regra do circuito 1 vale aqui também, quem foi desligado para de ver o nome
-- do cliente no mesmo instante, mesmo em gravação que já estava marcada.
drop function if exists public.parceiro_minhas_gravacoes(date, date);
create function public.parceiro_minhas_gravacoes(_de date, _ate date)
returns table (
  captura_id uuid,
  dia date,
  hora text,
  duracao_horas smallint,
  local text,
  cliente_nome text,
  agencia_id uuid,
  agencia_nome text,
  status text,
  nota text,
  roteiros integer
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.capture_date,
    c.capture_time,
    c.duration_hours,
    c.location,
    coalesce(nullif(cl.name, ''), nullif(c.client_name, ''), 'Sem cliente'),
    c.manager_id,
    coalesce(prof.name, m.email, 'Agência'),
    c.status,
    c.note,
    (select count(*)::int from public.capture_scripts s where s.capture_id = c.id)
  from public.agenda_captures c
  join public.manager_members m
    on m.manager_id = c.manager_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
   and public.eh_papel_parceiro(m.role)
  left join public.crm_clients cl on cl.id = c.crm_client_id
  left join public.profiles prof on prof.id = c.manager_id
  where c.parceiro_id = auth.uid()
    and c.capture_date between _de and _ate
  order by c.capture_date, c.capture_time nulls last;
$$;

revoke all on function public.parceiro_minhas_gravacoes(date, date) from public, anon;
grant execute on function public.parceiro_minhas_gravacoes(date, date) to authenticated;

-- ── 4) OS TÍTULOS DAS PEÇAS AMARRADAS ─────────────────────────────────────
-- A tarefa pode apontar pra uma peça, e a agenda precisa escrever o nome dela.
-- O parceiro não lê `posts` direto (fase 1), então vai por função, e só devolve
-- peça que está com ele.
drop function if exists public.parceiro_titulos_das_pecas(uuid[]);
create function public.parceiro_titulos_das_pecas(_ids uuid[])
returns table (post_id uuid, titulo text, cliente_nome text)
language sql stable security definer set search_path = public as $$
  -- O `join` com manager_members NÃO é decoração: é a regra do circuito 1.
  -- Vínculo pausado para de mostrar título de peça e nome de cliente no mesmo
  -- instante, e uma tarefa antiga amarrada numa peça daquela agência seria
  -- justamente o buraco por onde o nome continuaria saindo.
  select p.id,
         coalesce(nullif(p.title, ''), 'Peça sem título'),
         coalesce(nullif(ec.name, ''), '')
    from public.posts p
    join public.manager_members m
      on m.manager_id = p.user_id
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    left join public.external_clients ec on ec.id = p.external_client_id
   where p.id = any(coalesce(_ids, '{}'::uuid[]))
     and p.assignee_id = auth.uid()
     and p.deleted_at is null;
$$;

revoke all on function public.parceiro_titulos_das_pecas(uuid[]) from public, anon;
grant execute on function public.parceiro_titulos_das_pecas(uuid[]) to authenticated;

-- Conferência:
-- select * from public.parceiro_minhas_gravacoes('2026-09-01', '2026-09-30');
-- select id, tipo, titulo, data, feito_em from public.parceiro_agenda_itens order by created_at desc limit 5;
