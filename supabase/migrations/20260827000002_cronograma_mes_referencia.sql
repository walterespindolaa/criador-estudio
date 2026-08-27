-- ============================================================
-- O MÊS DO CRONOGRAMA
--
-- O cronograma nunca soube de que mês ele é. O título ("Setembro") era só
-- texto livre, e isso vazava em três lugares:
--
-- 1) O cabeçalho do link público mostrava o intervalo das datas PREENCHIDAS.
--    Com dez posts e dois com data, o cliente lia "15/09 a 16/09" e entendia
--    que o mês inteiro tinha dois dias de conteúdo. O número estava certo e a
--    informação estava errada.
--
-- 2) A data comemorativa que a social mídia manda da agenda caía no cronograma
--    mais recente, qualquer que fosse o mês dele. Uma data de 15/08 aterrissava
--    no cronograma de Setembro.
--
-- 3) Criar cronograma era digitar o mês à mão, e "setembro", "Setembro 2026" e
--    "SET/26" viravam três coisas diferentes pro sistema.
--
-- mes_ref guarda o primeiro dia do mês de referência. Continua opcional: o que
-- já existe segue funcionando pelo título, como antes.
-- ============================================================

alter table public.cronogramas add column if not exists mes_ref date;

comment on column public.cronogramas.mes_ref is
  'Primeiro dia do mês de referência do cronograma. Nulo nos antigos, que continuam se identificando pelo título.';

create index if not exists idx_cronogramas_mes_ref
  on public.cronogramas(manager_id, mes_ref) where mes_ref is not null;

-- ────────────────────────────────────────────────────────────
-- A data agora procura o cronograma DO MÊS DELA
--
-- Antes pegava sempre o cronograma vivo mais recente. Agora, quando existe um
-- cronograma marcado com o mês da data, é ele que recebe. Sem nenhum do mês, cai
-- na regra antiga (o mais recente não arquivado), pra não parar de funcionar
-- pra quem ainda não preencheu o mês nos cronogramas dele.
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
  mes_da_data date;
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
  mes_da_data := date_trunc('month', d.dia)::date;

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

    /* O cronograma DO MÊS da data, se existir. É o que evita uma data de agosto
       aparecer no cronograma de setembro só porque setembro é o mais recente. */
    select cr.id into alvo
      from public.cronogramas cr
     where cr.manager_id = d.manager_id
       and cr.crm_client_id = v.crm_client_id
       and coalesce(cr.status, 'rascunho') <> 'arquivado'
       and cr.mes_ref = mes_da_data
     order by cr.created_at desc
     limit 1;

    -- Nenhum com o mês marcado: cai na regra antiga, o mais recente vivo.
    if alvo is null then
      select cr.id into alvo
        from public.cronogramas cr
       where cr.manager_id = d.manager_id
         and cr.crm_client_id = v.crm_client_id
         and coalesce(cr.status, 'rascunho') <> 'arquivado'
       order by cr.created_at desc
       limit 1;
    end if;

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

-- ────────────────────────────────────────────────────────────
-- O link público precisa enxergar o mês
--
-- Mesma função de sempre, com mes_ref no payload. Copiada inteira de propósito:
-- create or replace substitui o corpo, então omitir qualquer pedaço aqui
-- apagaria a marca da agência, a cor do cliente ou as datas do link.
-- ────────────────────────────────────────────────────────────
create or replace function public.get_cronograma_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _c public.cronogramas; _items jsonb; _datas jsonb;
  _accent text; _logo text; _by text;
  _client_color text; _client_logo text;
begin
  select * into _c from public.cronogramas where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'title', i.title, 'copy', i.copy, 'description', i.description, 'date', i.date,
           'type', i.type, 'approval_status', i.approval_status, 'client_comment', i.client_comment,
           'ref_url', i.ref_url
         ) order by i.sort_order, i.created_at), '[]'::jsonb)
    into _items from public.cronograma_items i where i.cronograma_id = _c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'label', d.label, 'day_label', d.day_label, 'selected', d.selected
         ) order by d.sort_order, d.created_at), '[]'::jsonb)
    into _datas from public.cronograma_datas d where d.cronograma_id = _c.id;

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _c.manager_id;

  select cc.color, cc.logo into _client_color, _client_logo
    from public.external_clients ec
    join public.crm_clients cc on cc.id = ec.crm_client_id
    where ec.id = _c.external_client_id;

  return jsonb_build_object(
    'title', _c.title, 'mes_ref', _c.mes_ref,
    'client_label', _c.client_label, 'client_handle', _c.client_handle,
    'status', _c.status, 'accent', _accent, 'logo', _logo, 'by', _by,
    'client_color', _client_color, 'client_logo', _client_logo,
    'items', _items, 'datas', _datas);
end; $$;

grant execute on function public.get_cronograma_by_token(text) to anon, authenticated;

-- ============================================================
-- Conferência (rode depois, é só leitura)
-- ============================================================
-- select title, to_char(mes_ref, 'MM/YYYY') as mes, status, created_at
--   from public.cronogramas order by created_at desc limit 20;
