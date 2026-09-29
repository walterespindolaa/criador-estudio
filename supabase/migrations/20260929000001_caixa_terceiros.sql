-- ═══════════════════════════════════════════════════════════════════════════
-- CRIA CAIXA > TERCEIROS (29/09/2026)
--
-- A agência conferia na mão, todo dia 15, o que cada designer / editor /
-- filmmaker produziu e quanto devia. Agora:
--   1. fin_terceiros: a ficha do terceiro (nota do combinado, fechamento, forma
--      de pagamento). Parceiro com conta no Cria ganha ficha na primeira vez que
--      alguém salva; quem não tem conta é cadastrado à mão (member_id null).
--   2. fin_records.terceiro_id: avulso de terceiro sem conta.
--      fin_records.pago_em: quando foi pago (a coluna date continua sendo a data
--      da entrega / do serviço, que é o que o fechamento usa).
--   3. Trava no banco: só o DONO marca pagamento de terceiro. A colaboradora vê
--      e lança, mas não paga, não desfaz pagamento e não apaga linha paga.
--   4. A data do cachê passa a ser a da entrega no fuso BR (antes era
--      current_date em UTC: entrega depois das 21h caía no dia seguinte).
--   5. RPC terceiros_da_agencia: a lista (parceiros + manuais) pro dono e pro
--      time com cria_caixa. Parceiro nunca lê fichas nem notas.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Tabela e colunas ──────────────────────────────────────────────────
create table if not exists public.fin_terceiros (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references auth.users(id) on delete set null,
  nome text not null default '',
  papel text not null default 'outro',
  nota text not null default '',
  fechamento text not null default 'mensal'
    check (fechamento in ('servico', 'dia15', 'quinzenal', 'mensal')),
  pagamento text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_fin_terceiros_membro
  on public.fin_terceiros (manager_id, member_id) where member_id is not null;
create index if not exists idx_fin_terceiros_manager on public.fin_terceiros (manager_id);

alter table public.fin_records
  add column if not exists terceiro_id uuid references public.fin_terceiros(id) on delete set null;
alter table public.fin_records add column if not exists pago_em date;
create index if not exists idx_fin_records_terceiro
  on public.fin_records (manager_id, terceiro_id) where terceiro_id is not null;
create index if not exists idx_fin_records_assignee
  on public.fin_records (manager_id, assignee_id) where assignee_id is not null;

-- Cachês já pagos: melhor aproximação da data do pagamento é a própria data.
update public.fin_records
   set pago_em = date
 where status = 'pago' and pago_em is null and assignee_id is not null;

-- ── 2) Quem é "do Caixa": dono ou time com cria_caixa, nunca parceiro ────
create or replace function public.caixa_do_time(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or exists (
        select 1
          from public.manager_members m
          join public.manager_member_permissions perm on perm.member_row_id = m.id
         where m.manager_id = target
           and m.member_id = auth.uid()
           and m.status = 'ativo'
           and not public.eh_papel_parceiro(m.role)
           and perm.module_code = 'cria_caixa'
      );
$$;
revoke all on function public.caixa_do_time(uuid) from public, anon;
grant execute on function public.caixa_do_time(uuid) to authenticated;

alter table public.fin_terceiros enable row level security;
grant select, insert, update, delete on public.fin_terceiros to authenticated;
grant all on public.fin_terceiros to service_role;
drop policy if exists "fin_terceiros_time" on public.fin_terceiros;
create policy "fin_terceiros_time" on public.fin_terceiros for all to authenticated
  using (public.caixa_do_time(manager_id))
  with check (public.caixa_do_time(manager_id));

-- ── 3) Guarda do dinheiro do terceiro ────────────────────────────────────
create or replace function public.fin_terceiro_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _entregue timestamptz;
begin
  -- Apagar linha já paga de terceiro: só o dono.
  if tg_op = 'DELETE' then
    if old.status = 'pago'
       and (old.assignee_id is not null or old.terceiro_id is not null)
       and _uid is not null and _uid <> old.manager_id then
      raise exception 'Só o dono da conta pode apagar um pagamento de terceiro já feito.';
    end if;
    return old;
  end if;

  -- Cachê de peça: a data é a da entrega, no fuso BR.
  if tg_op = 'INSERT' and new.post_id is not null and new.assignee_id is not null then
    select p.entregue_em into _entregue from public.posts p where p.id = new.post_id;
    if _entregue is not null then
      new.date := (_entregue at time zone 'America/Sao_Paulo')::date;
    end if;
  end if;

  -- Só o dono paga (ou desfaz pagamento) de terceiro.
  if _uid is not null and _uid <> new.manager_id
     and (new.assignee_id is not null or new.terceiro_id is not null
          or (tg_op = 'UPDATE' and (old.assignee_id is not null or old.terceiro_id is not null))) then
    if tg_op = 'INSERT' and new.status = 'pago' then
      raise exception 'Só o dono da conta marca pagamento de terceiro.';
    end if;
    if tg_op = 'UPDATE' and (
         (new.status is distinct from old.status and (new.status = 'pago' or old.status = 'pago'))
         or (old.status = 'pago' and (new.amount is distinct from old.amount
                                      or new.pago_em is distinct from old.pago_em))
       ) then
      raise exception 'Só o dono da conta marca ou altera pagamento de terceiro.';
    end if;
  end if;

  -- pago_em acompanha o status (vale pra qualquer lançamento).
  if new.status = 'pago' then
    if tg_op = 'INSERT' or old.status is distinct from 'pago' then
      new.pago_em := coalesce(new.pago_em, (now() at time zone 'America/Sao_Paulo')::date);
    end if;
  else
    new.pago_em := null;
  end if;

  return new;
end; $$;

drop trigger if exists trg_fin_terceiro_guarda on public.fin_records;
create trigger trg_fin_terceiro_guarda
  before insert or update or delete on public.fin_records
  for each row execute function public.fin_terceiro_guarda();

-- ── 4) Lista de terceiros da agência ─────────────────────────────────────
create or replace function public.terceiros_da_agencia(_manager uuid)
returns table (
  terceiro_id uuid, member_id uuid, nome text, papel text, nota text,
  fechamento text, pagamento text, no_cria boolean
)
language sql stable security definer set search_path = public as $$
  select * from (
    -- Parceiros com conta: ativos, ou que saíram mas ainda têm valor a receber.
    select t.id as terceiro_id, m.member_id as member_id,
           coalesce(nullif(m.name, ''), m.email, 'Parceiro') as nome,
           m.role as papel,
           coalesce(t.nota, '') as nota, coalesce(t.fechamento, 'mensal') as fechamento,
           coalesce(t.pagamento, '') as pagamento,
           true as no_cria
      from public.manager_members m
      left join public.fin_terceiros t
        on t.manager_id = m.manager_id and t.member_id = m.member_id
     where m.manager_id = _manager
       and public.eh_papel_parceiro(m.role)
       and (m.status = 'ativo'
            or exists (select 1 from public.fin_records f
                        where f.manager_id = _manager and f.assignee_id = m.member_id
                          and f.status <> 'pago'))
    union all
    -- Cadastrados à mão (sem conta no Cria).
    select t.id, null::uuid, t.nome, t.papel, t.nota, t.fechamento, t.pagamento, false
      from public.fin_terceiros t
     where t.manager_id = _manager and t.member_id is null and t.ativo
  ) x
  where public.caixa_do_time(_manager)
  order by x.nome;
$$;
revoke all on function public.terceiros_da_agencia(uuid) from public, anon;
grant execute on function public.terceiros_da_agencia(uuid) to authenticated;

-- ── Conferência (só leitura) ─────────────────────────────────────────────
-- select * from public.terceiros_da_agencia(auth.uid());
-- select tgname from pg_trigger where tgrelid = 'public.fin_records'::regclass and not tgisinternal;
