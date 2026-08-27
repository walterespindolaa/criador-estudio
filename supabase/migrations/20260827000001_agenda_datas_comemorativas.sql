-- ============================================================
-- DATA COMEMORATIVA CADASTRADA NA AGENDA
--
-- Hoje a única porta de entrada de data comemorativa é o cronograma: a social
-- mídia monta a lista dentro de UM cliente, manda o link, ele marca. Isso é
-- ótimo pro fluxo de aprovação e péssimo pro trabalho dela.
--
-- O motivo é simples. "Dia Mundial da Fisioterapia" não é assunto de um
-- cliente: é assunto de TODOS os clientes de fisioterapia da carteira. Do jeito
-- atual ela abre cronograma por cronograma e digita a mesma data quantas vezes
-- forem os clientes, e se esquecer de um, aquele cliente perde a data.
--
-- Aqui a data nasce UMA vez, na agenda, e ela escolhe de quais clientes aquilo
-- é assunto. O que cada cliente vai fazer com a data continua sendo decidido no
-- cronograma dele, como sempre foi: o vínculo criado aqui alimenta o cronograma
-- vivo de cada um, e o cliente aprova no link igual antes.
-- ============================================================

create table if not exists public.agenda_datas (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,

  label text not null,

  /* O DIA. Guardado sempre como data completa, inclusive quando repete todo
     ano: assim a coluna continua sendo `date` de verdade (ordenável, filtrável,
     comparável), e quem decide se o ano importa é o `repete_anual`. Guardar
     "DD/MM" em texto pra economizar um campo é o tipo de atalho que cobra caro
     na primeira consulta por período. */
  dia date not null,
  /* Ligado: reaparece todo ano no mesmo dia e mês, que é o comportamento normal
     de data comemorativa. Desligado: evento pontual (uma feira, um lançamento),
     acontece uma vez e não volta. */
  repete_anual boolean not null default true,

  /* MANDAR PRO CRONOGRAMA DOS CLIENTES?
     Nem toda data precisa de aprovação. "Dia do Cliente" é lembrete dela pra
     preparar alguma coisa; "Dia Mundial da Fisioterapia" é pauta que o cliente
     decide se quer. Forçar tudo pro cronograma enchia o link do cliente de
     data que não era pergunta pra ele. */
  no_cronograma boolean not null default true,

  /* Cor do chip na agenda. Nula = a cor padrão do tipo. */
  cor text,
  nota text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* De quais clientes esta data é assunto.
   Tabela separada e não um array de ids: com tabela dá pra apagar em cascata
   quando o cliente sai, e dá pra saber depois se aquele vínculo já virou item
   no cronograma daquele cliente (cronograma_data_id). */
create table if not exists public.agenda_data_clientes (
  id uuid primary key default gen_random_uuid(),
  agenda_data_id uuid not null references public.agenda_datas(id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  /* A linha que esta data virou no cronograma daquele cliente, quando virou.
     É o elo que permite não duplicar ao editar, e saber se o cliente aprovou. */
  cronograma_data_id uuid references public.cronograma_datas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agenda_data_id, crm_client_id)
);

-- Pra quem já rodou este arquivo antes da coluna existir.
alter table public.agenda_datas add column if not exists no_cronograma boolean not null default true;

alter table public.agenda_datas enable row level security;
alter table public.agenda_data_clientes enable row level security;

/* acts_for: o dono OU um colaborador ativo dele. É o mesmo helper que o resto
   do CRM usa, então colaborador enxerga a agenda do time sem caso especial. */
drop policy if exists "agenda_datas do time" on public.agenda_datas;
create policy "agenda_datas do time" on public.agenda_datas
  for all to authenticated
  using (public.acts_for(manager_id))
  with check (public.acts_for(manager_id));

drop policy if exists "agenda_data_clientes do time" on public.agenda_data_clientes;
create policy "agenda_data_clientes do time" on public.agenda_data_clientes
  for all to authenticated
  using (exists (
    select 1 from public.agenda_datas d
    where d.id = agenda_data_id and public.acts_for(d.manager_id)
  ))
  with check (exists (
    select 1 from public.agenda_datas d
    where d.id = agenda_data_id and public.acts_for(d.manager_id)
  ));

create index if not exists idx_agenda_datas_manager on public.agenda_datas(manager_id, dia);
create index if not exists idx_agenda_data_clientes_data on public.agenda_data_clientes(agenda_data_id);
create index if not exists idx_agenda_data_clientes_cliente on public.agenda_data_clientes(crm_client_id);

-- ────────────────────────────────────────────────────────────
-- ESPELHAR NO CRONOGRAMA DE CADA CLIENTE
--
-- A data escolhida aqui precisa chegar no link que o cliente abre, senão ela
-- vira lembrete interno e o cliente nunca decide nada sobre ela.
--
-- A função encontra o cronograma VIVO de cada cliente (o mais recente que não
-- está arquivado) e coloca a data lá. Cliente sem cronograma aberto é pulado de
-- propósito: criar um cronograma vazio só pra abrigar uma data deixaria a lista
-- do cliente cheia de cronograma fantasma.
--
-- Idempotente: guarda o id da linha criada em agenda_data_clientes, então
-- salvar de novo atualiza em vez de duplicar.
-- ────────────────────────────────────────────────────────────
create or replace function public.agenda_data_para_cronogramas(_agenda_data_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v record;
  alvo uuid;
  nova uuid;
  quantos integer := 0;
  dia_txt text;
begin
  select * into d from public.agenda_datas where id = _agenda_data_id;
  if d.id is null then return 0; end if;
  -- Marcada como lembrete só dela: não vai pro link de ninguém.
  if not coalesce(d.no_cronograma, true) then return 0; end if;
  -- Só o dono (ou colaborador dele) mexe nisto, mesmo com security definer.
  if not public.acts_for(d.manager_id) then
    raise exception 'sem permissão para esta data';
  end if;

  -- O cronograma guarda o dia como texto legível ("08/09"), que é o que o
  -- cliente lê no link.
  dia_txt := to_char(d.dia, 'DD/MM');

  for v in
    select c.id as vinculo_id, c.crm_client_id, c.cronograma_data_id
    from public.agenda_data_clientes c
    where c.agenda_data_id = _agenda_data_id
  loop
    -- Já existe a linha no cronograma? Atualiza o texto e segue.
    if v.cronograma_data_id is not null
       and exists (select 1 from public.cronograma_datas cd where cd.id = v.cronograma_data_id) then
      update public.cronograma_datas
         set label = d.label, day_label = dia_txt
       where id = v.cronograma_data_id;
      quantos := quantos + 1;
      continue;
    end if;

    -- O cronograma vivo daquele cliente: o mais recente que não foi arquivado.
    select cr.id into alvo
      from public.cronogramas cr
     where cr.manager_id = d.manager_id
       and cr.crm_client_id = v.crm_client_id
       and coalesce(cr.status, 'rascunho') <> 'arquivado'
     order by cr.created_at desc
     limit 1;

    if alvo is null then continue; end if;   -- sem cronograma aberto: pula

    insert into public.cronograma_datas (cronograma_id, label, day_label, sort_order)
    values (
      alvo, d.label, dia_txt,
      coalesce((select max(sort_order) + 1 from public.cronograma_datas where cronograma_id = alvo), 0)
    )
    returning id into nova;

    update public.agenda_data_clientes set cronograma_data_id = nova where id = v.vinculo_id;
    quantos := quantos + 1;
  end loop;

  return quantos;
end;
$$;

revoke all on function public.agenda_data_para_cronogramas(uuid) from public, anon, authenticated;
grant execute on function public.agenda_data_para_cronogramas(uuid) to authenticated;

-- ============================================================
-- Conferência (rode depois, é só leitura)
-- ============================================================
-- select d.label, to_char(d.dia, 'DD/MM/YYYY') as dia, d.repete_anual, d.cor,
--        count(c.id) as clientes,
--        count(c.cronograma_data_id) as ja_no_cronograma
--   from public.agenda_datas d
--   left join public.agenda_data_clientes c on c.agenda_data_id = d.id
--  group by d.id
--  order by d.dia;
