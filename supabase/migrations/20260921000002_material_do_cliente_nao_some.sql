-- ============================================================
-- O PEDIDO DE MATERIAL QUE SUMIA ENTRE O PORTAL E O QUADRO
-- (Gabriela, 21/09/2026: "mandei um material e nao caiu aqui")
--
-- client_materials guarda DUAS chaves de cliente: crm_client_id (a ficha do
-- CRM) e external_client_id (o cliente do portal, dono do token do link).
-- O portal lia por uma, o quadro do app lia pela outra.
--
-- Quando o cliente pede pelo link, request_material_by_token copia o
-- crm_client_id de dentro do external_clients. Esse vinculo e OPCIONAL e
-- editavel ("Sem vinculo" na aba Portal): estando vazio, o pedido nasce com
-- crm_client_id nulo. O portal seguia mostrando (acha pelo token) e o quadro
-- nunca encontrava. Parecia que o pedido tinha evaporado.
--
-- Esta migration faz quatro coisas:
--   1. religa os pedidos orfaos que ja existem;
--   2. faz o vinculo ADOTAR os pedidos antigos quando alguem liga a ficha
--      depois (trigger), pra nao ter que rodar SQL de novo;
--   3. aceita o tipo 'post_carrossel', que a Gabriela pediu na lista;
--   4. deixa o cliente mandar ANEXO junto do pedido (_attachments).
--
-- O front tambem passou a procurar pelas duas chaves, entao mesmo um pedido
-- sem ficha vinculada aparece no quadro. Cinto e suspensorio de proposito:
-- perder pedido de cliente e o pior erro possivel nesse fluxo.
-- ============================================================

-- 1) RELIGAR O QUE JA EXISTE ------------------------------------------------
update public.client_materials m
   set crm_client_id = ec.crm_client_id
  from public.external_clients ec
 where m.external_client_id = ec.id
   and m.crm_client_id is null
   and ec.crm_client_id is not null;

-- 2) ADOCAO AUTOMATICA AO VINCULAR ------------------------------------------
-- Ligar o portal a uma ficha depois nao pode deixar pra tras o que o cliente
-- ja tinha pedido. Roda so quando o vinculo MUDA, e so nas linhas orfas.
create or replace function public.adotar_materiais_do_portal()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.crm_client_id is not null
     and new.crm_client_id is distinct from old.crm_client_id then
    update public.client_materials
       set crm_client_id = new.crm_client_id
     where external_client_id = new.id
       and crm_client_id is null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_adotar_materiais_do_portal on public.external_clients;
create trigger trg_adotar_materiais_do_portal
  after update of crm_client_id on public.external_clients
  for each row execute function public.adotar_materiais_do_portal();

-- 3 e 4) PEDIDO COM TIPO NOVO E COM ANEXO -----------------------------------
-- Postgres nao troca assinatura com create or replace: drop antes.
drop function if exists public.request_material_by_token(text, text, text, text);
drop function if exists public.request_material_by_token(text, text, text, text, date);
drop function if exists public.request_material_by_token(text, text, text, text, date, jsonb);

create function public.request_material_by_token(
  _token text, _title text, _description text, _kind text default 'arte_avulsa',
  _due_date date default null, _attachments jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _mgr uuid; _crm uuid; _ec uuid; _cname text; _id uuid; _k text; _prazo date; _anexos jsonb;
begin
  select ec.manager_id, ec.crm_client_id, ec.id, coalesce(ec.name, 'O cliente')
    into _mgr, _crm, _ec, _cname
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if _mgr is null then
    raise exception 'Link invalido ou expirado';
  end if;
  if _title is null or btrim(_title) = '' then
    raise exception 'Titulo obrigatorio';
  end if;

  _k := lower(coalesce(_kind, 'arte_avulsa'));
  if _k not in ('apresentacao','flyer','arte_avulsa','post_carrossel','logo','outro') then
    _k := 'outro';
  end if;

  -- Sem data, o prazo e o proprio dia do pedido (hora de Brasilia): assim o
  -- pedido SEMPRE aparece na Agenda, e a social midia decide se empurra.
  _prazo := greatest(coalesce(_due_date, (now() at time zone 'America/Sao_Paulo')::date),
                     (now() at time zone 'America/Sao_Paulo')::date);

  -- Anexo so entra como lista, e no maximo 5: o upload em si passa pela edge
  -- material-anexo, que e quem valida tamanho e tipo. Aqui so guardamos o que
  -- ela devolveu, sem confiar no formato cru do navegador.
  _anexos := case
    when jsonb_typeof(coalesce(_attachments, '[]'::jsonb)) = 'array'
      then (select coalesce(jsonb_agg(x), '[]'::jsonb)
              from (select x from jsonb_array_elements(_attachments) x limit 5) s)
    else '[]'::jsonb
  end;

  insert into public.client_materials
    (manager_id, crm_client_id, external_client_id, title, description, kind, status,
     requested_by, due_date, attachments)
  values
    (_mgr, _crm, _ec, btrim(_title), nullif(btrim(coalesce(_description,'')), ''), _k, 'solicitado',
     'cliente', _prazo, _anexos)
  returning id into _id;

  insert into public.notifications (user_id, type, title, description, link)
  values (_mgr, 'material', 'Novo pedido de material',
          _cname || ' pediu: ' || btrim(_title) || ' (pra ' || to_char(_prazo, 'DD/MM') || ')',
          case when _crm is not null
               then '/socialmidia/clientes/' || _crm::text || '/materiais'
               else '/socialmidia/clientes' end);

  return _id;
end; $$;
grant execute on function public.request_material_by_token(text, text, text, text, date, jsonb) to anon, authenticated;

-- 5) O PORTAL PRECISA DEVOLVER OS ANEXOS TAMBEM -----------------------------
drop function if exists public.list_materials_by_token(text);

create function public.list_materials_by_token(_token text)
returns table (
  id uuid, title text, description text, kind text, status text,
  created_at timestamptz, due_date date, updated_at timestamptz, attachments jsonb
)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, m.description, m.kind, m.status, m.created_at, m.due_date,
         m.updated_at, coalesce(m.attachments, '[]'::jsonb)
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  join public.client_materials m on m.external_client_id = ec.id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and m.requested_by = 'cliente'
  order by (m.status = 'finalizado'), m.due_date nulls last, m.created_at desc;
$$;
grant execute on function public.list_materials_by_token(text) to anon, authenticated;
