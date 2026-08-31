-- ============================================================
-- CRIA PARCEIROS · a camada PESSOAL do quadro (mockup aprovado)
--
-- O fluxo de produção é um contrato entre duas contas (Novo/Fazendo/Ajuste/
-- Entregue é a língua comum com a agência), mas o JEITO de trabalhar é
-- pessoal: é por isso que cada Trello é diferente. Aqui nasce a camada dele:
--
--   parceiro_etapas    as sub-etapas DELE dentro do "Fazendo" (Referências,
--                      Rascunho, Arte final...), renomeáveis e só dele.
--   parceiro_card_meta o que ele anota POR CARD sem a agência ver: em qual
--                      etapa pessoal está, o checklist e notas privadas.
--
-- A agência continua vendo só "Fazendo". Zero mudança no eixo compartilhado.
-- ============================================================

create table if not exists public.parceiro_etapas (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  created_at timestamptz default now()
);
alter table public.parceiro_etapas enable row level security;
drop policy if exists "parceiro_etapas_dono" on public.parceiro_etapas;
create policy "parceiro_etapas_dono" on public.parceiro_etapas
  for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create index if not exists idx_parceiro_etapas on public.parceiro_etapas(member_id, ordem);

create table if not exists public.parceiro_card_meta (
  member_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  etapa_id uuid references public.parceiro_etapas(id) on delete set null,
  -- checklist: [{"t": "Cortar takes", "done": true}, ...]
  checklist jsonb not null default '[]'::jsonb,
  notas text,
  updated_at timestamptz default now(),
  primary key (member_id, post_id)
);
alter table public.parceiro_card_meta enable row level security;
drop policy if exists "parceiro_card_meta_dono" on public.parceiro_card_meta;
create policy "parceiro_card_meta_dono" on public.parceiro_card_meta
  for all to authenticated
  using (member_id = auth.uid())
  -- Só cria meta de card que é realmente dele (o vínculo + assignee valem).
  with check (member_id = auth.uid() and public.parceiro_tem_o_card(post_id));
create index if not exists idx_parceiro_card_meta on public.parceiro_card_meta(member_id);
