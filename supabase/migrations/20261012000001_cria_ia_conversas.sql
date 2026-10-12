-- HISTÓRICO DA CRIA IA (Walter, 12/10/2026: "ter um botão pra ver histórico
-- da conversa que abre um popup mostrando as últimas 10").
-- Até aqui a conversa vivia só na tela e sumia ao fechar o painel ou dar F5.
-- Uma linha por conversa, de cada PESSOA (auth.uid()): a colaboradora tem o
-- histórico dela, o dono o dele. As mensagens vão num jsonb só: a conversa é
-- sempre lida e gravada inteira, nunca consultada mensagem a mensagem.

create table if not exists public.cria_ia_conversas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo     text not null default 'Conversa',
  mensagens  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cria_ia_conversas_recentes
  on public.cria_ia_conversas (user_id, updated_at desc);

alter table public.cria_ia_conversas enable row level security;

drop policy if exists "cria_ia_conversas_dono_le" on public.cria_ia_conversas;
create policy "cria_ia_conversas_dono_le" on public.cria_ia_conversas
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "cria_ia_conversas_dono_cria" on public.cria_ia_conversas;
create policy "cria_ia_conversas_dono_cria" on public.cria_ia_conversas
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "cria_ia_conversas_dono_altera" on public.cria_ia_conversas;
create policy "cria_ia_conversas_dono_altera" on public.cria_ia_conversas
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cria_ia_conversas_dono_apaga" on public.cria_ia_conversas;
create policy "cria_ia_conversas_dono_apaga" on public.cria_ia_conversas
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.cria_ia_conversas to authenticated;
