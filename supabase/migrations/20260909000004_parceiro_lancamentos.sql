-- ═══════════════════════════════════════════════════════════════════════════
-- O CACHÊ QUE O PARCEIRO LANÇA NA MÃO (09/09/2026)
--
-- "Meus cachês" só mostrava o que nasceu DENTRO do Cria: peça delegada por uma
-- agência que usa a plataforma. Mas o designer também fecha pacote fechado,
-- trabalha pra agência que não está aqui e combina valor no WhatsApp. Sem um
-- lugar pra anotar isso, a página respondia metade da vida financeira dele e
-- ele voltava pra planilha (Walter, 09/09/2026).
--
-- Isto NÃO é o Caixa. É uma anotação simples: cliente, valor, quanto já foi
-- pago, como foi pago. Quem quer fluxo de caixa de verdade tem o Cria Caixa, e
-- a própria página convida pra ele.
--
-- Escopo: cada linha é do parceiro que criou. Ninguém mais lê nem escreve.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.parceiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  -- Texto livre de propósito: boa parte é agência que não usa o Cria.
  cliente text not null,
  descricao text,
  valor numeric(12,2) not null default 0,
  -- Quanto JÁ entrou. Menor que o valor = pagamento parcial, que é o caso
  -- mais comum de pacote (metade na assinatura, metade na entrega).
  valor_pago numeric(12,2) not null default 0,
  forma_pagamento text,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parceiro_lancamentos_membro
  on public.parceiro_lancamentos (member_id, data desc);

alter table public.parceiro_lancamentos enable row level security;

drop policy if exists "parceiro_lancamentos_proprios" on public.parceiro_lancamentos;
create policy "parceiro_lancamentos_proprios" on public.parceiro_lancamentos
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop trigger if exists trg_parceiro_lancamentos_updated on public.parceiro_lancamentos;
create trigger trg_parceiro_lancamentos_updated
  before update on public.parceiro_lancamentos
  for each row execute function public.update_updated_at_column();

-- Conferência:
-- select * from public.parceiro_lancamentos where member_id = auth.uid();
