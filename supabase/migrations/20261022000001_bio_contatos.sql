-- ═══════════════════════════════════════════════════════════════════════════
-- CONTATOS DO LINK NA BIO (22/10/2026)
-- 1) bio_leads ganha tipo (contato | parceria | pedido), mensagem e detalhes.
-- 2) submit_bio_contato: porta única dos formulários novos (parceria e pedido),
--    só pela edge bio-track (service_role). Confere que o bloco é DAQUELA página.
-- 3) bio_lead_para_pipeline passa a exigir que o bloco seja do mesmo dono:
--    antes, um id de bloco de outra conta valia como chave "vai pro pipeline".
-- 4) Aviso de contato novo por e-mail, além do sino e do push, com freio.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colunas novas ------------------------------------------------------------
alter table public.bio_leads add column if not exists tipo text not null default 'contato';
alter table public.bio_leads add column if not exists mensagem text;
alter table public.bio_leads add column if not exists detalhes jsonb;

do $$ begin
  alter table public.bio_leads add constraint bio_leads_tipo_ok
    check (tipo in ('contato', 'parceria', 'pedido'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bio_leads add constraint bio_leads_mensagem_tam
    check (mensagem is null or char_length(mensagem) <= 1500);
exception when duplicate_object then null; end $$;

-- 2) Escapa texto pra entrar em HTML de e-mail --------------------------------
create or replace function public.html_seguro(_t text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select replace(replace(replace(replace(replace(coalesce(_t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- 3) Pipeline: o bloco tem que ser do mesmo dono -------------------------------
create or replace function public.bio_lead_para_pipeline(_manager uuid, _block_id uuid, _nome text, _email text, _telefone text, _de text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare _b public.bio_blocks;
begin
  if _block_id is null then return; end if;
  select * into _b from public.bio_blocks where id = _block_id;
  if not found then return; end if;
  -- Bloco de outra conta nunca decide nada aqui.
  if _b.user_id is distinct from _manager then return; end if;
  if coalesce(_b.data->>'paraPipeline', 'false') <> 'true' then return; end if;

  if exists (
    select 1 from public.crm_leads l
    where l.manager_id = _manager
      and l.stage not in ('fechado', 'perdido')
      and (
        (coalesce(nullif(btrim(_email), ''), '@nada') = coalesce(l.email, '@vazio'))
        or (coalesce(nullif(regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g'), ''), '@nada')
            = coalesce(nullif(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), ''), '@vazio'))
      )
  ) then return; end if;

  insert into public.crm_leads (manager_id, name, email, phone, stage, lead_origin, notes)
  values (
    _manager,
    coalesce(nullif(btrim(_nome), ''), nullif(btrim(_email), ''), nullif(btrim(_telefone), ''), 'Contato do link na bio'),
    nullif(btrim(_email), ''), nullif(btrim(_telefone), ''),
    'lead', 'link na bio',
    'Chegou pelo ' || coalesce(nullif(btrim(_de), ''), 'link na bio') || ' em ' ||
      to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI') || '.');
end; $function$;

-- 4) Porta dos formulários novos ---------------------------------------------
create or replace function public.submit_bio_contato(
  _slug text, _tipo text, _nome text default null, _email text default null, _telefone text default null,
  _mensagem text default null, _detalhes jsonb default null, _block_id uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  _dono uuid; _page uuid; _cliente text; _b public.bio_blocks; _kind text; _de text;
  _mail text := nullif(btrim(coalesce(_email, '')), '');
  _fone text := nullif(regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g'), '');
begin
  if _tipo not in ('parceria', 'pedido') then raise exception 'tipo inválido'; end if;

  -- Dono: conta de criador ou página montada pela agência (mesma regra da visita).
  select p.id into _dono from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug));
  if _dono is null then
    select bp.manager_id, bp.id, c.name into _dono, _page, _cliente
      from public.bio_pages bp
      join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
     where lower(bp.slug) = lower(btrim(_slug));
  end if;
  if _dono is null then raise exception 'página não encontrada'; end if;

  -- O bloco tem que existir, estar no ar e ser DESTA página e do tipo certo.
  _kind := case _tipo when 'parceria' then 'parceria' else 'cardapio' end;
  select * into _b from public.bio_blocks b
   where b.id = _block_id and b.is_active and b.kind = _kind
     and ((_page is null and b.page_id is null and b.user_id = _dono)
       or (_page is not null and b.page_id = _page));
  if not found then raise exception 'bloco inválido'; end if;

  -- Validação de tamanho e formato (a edge corta antes, aqui é a garantia).
  if char_length(coalesce(_nome, '')) > 120 or char_length(coalesce(_mail, '')) > 160
     or char_length(coalesce(_mensagem, '')) > 1500 then
    raise exception 'campo grande demais';
  end if;
  if _mail is not null and _mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'e-mail inválido'; end if;
  if _fone is not null and (char_length(_fone) < 10 or char_length(_fone) > 13) then raise exception 'telefone inválido'; end if;

  if _tipo = 'parceria' and _mail is null and _fone is null then
    raise exception 'informe e-mail ou telefone';
  end if;

  -- Pedido: só a lista de itens, no formato fechado [{nome, qtd, preco}].
  if _tipo = 'pedido' then
    if _detalhes is null or jsonb_typeof(_detalhes) <> 'array' or jsonb_array_length(_detalhes) = 0
       or jsonb_array_length(_detalhes) > 40 or char_length(_detalhes::text) > 4000 then
      raise exception 'pedido inválido';
    end if;
  else
    _detalhes := null;
  end if;

  if public.rate_touch('bio_contato:' || coalesce(_page, _dono)::text, 20) = false then
    raise exception 'muitas tentativas, tente em instantes';
  end if;

  insert into public.bio_leads (user_id, page_id, name, email, phone, source, tipo, mensagem, detalhes)
  values (_dono, _page, nullif(btrim(coalesce(_nome, '')), ''), _mail, nullif(btrim(coalesce(_telefone, '')), ''),
          'bio', _tipo, nullif(btrim(coalesce(_mensagem, '')), ''), _detalhes);

  if _tipo = 'parceria' then
    _de := 'formulário de parceria do ' || case when _page is null then 'meu link na bio'
                                                 else 'link na bio de ' || coalesce(_cliente, 'um cliente') end;
    perform public.bio_lead_para_pipeline(_dono, _block_id, _nome, _mail, _telefone, _de);
  end if;
end; $function$;

revoke all on function public.submit_bio_contato(text, text, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.submit_bio_contato(text, text, text, text, text, text, jsonb, uuid) to service_role;

-- 5) Aviso: sino + push (já existia) + e-mail com freio -----------------------
create or replace function public.notify_new_bio_lead()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  _cliente uuid; _nome text; _quem text; _titulo text; _link text; _email text; _quer text;
  _ultimos int; _mid text; _resumo text; _assunto text;
begin
  if new.page_id is not null then
    select bp.crm_client_id, c.name into _cliente, _nome
      from public.bio_pages bp
      join public.crm_clients c on c.id = bp.crm_client_id
     where bp.id = new.page_id;
  end if;

  _quem := coalesce(nullif(btrim(new.name), ''), new.email, new.phone, 'Alguém');
  _titulo := case new.tipo
    when 'parceria' then case when _cliente is null then 'Proposta de parceria no seu link na bio'
                              else 'Proposta de parceria no link na bio de ' || coalesce(_nome, 'um cliente') end
    when 'pedido' then case when _cliente is null then 'Pedido enviado pelo WhatsApp'
                            else 'Pedido pelo WhatsApp na bio de ' || coalesce(_nome, 'um cliente') end
    else case when _cliente is null then 'Novo lead no seu link in bio'
              else 'Novo lead no link na bio de ' || coalesce(_nome, 'um cliente') end
  end;
  _link := case when _cliente is null then '/app/linkinbio' else '/socialmidia/clientes/' || _cliente::text || '/link-bio' end;
  _resumo := case new.tipo
    when 'pedido' then 'Alguém montou um pedido e abriu o WhatsApp.'
    when 'parceria' then _quem || ' quer falar sobre uma parceria.'
    else _quem || ' deixou contato.' end;

  insert into public.notifications (user_id, type, title, description, link)
  values (new.user_id, 'lead', _titulo, _resumo, _link);

  -- E-mail: só contato e parceria (o pedido já chega no WhatsApp da pessoa).
  -- Freio: até 10 e-mails por hora por dono; o resto fica no sino.
  if new.tipo in ('contato', 'parceria') then
    begin
      select ((p.notification_prefs ->> 'leads')::boolean is distinct from false)::text
        into strict _quer
        from public.profiles p where p.id = new.user_id;
    exception when others then _quer := 'true';
    end;
    if coalesce(_quer, 'true') = 'true' then
      select count(*) into _ultimos from public.bio_leads l
       where l.user_id = new.user_id and l.tipo in ('contato', 'parceria')
         and l.created_at > now() - interval '1 hour';
      select u.email into _email from auth.users u where u.id = new.user_id;
      if _email is not null and _ultimos <= 10 then
        begin
          _mid := gen_random_uuid()::text;
          _assunto := regexp_replace(left(_titulo, 120), '[\r\n]+', ' ', 'g');
          perform public.enqueue_email('transactional_emails', jsonb_build_object(
            'to', _email,
            'subject', _assunto,
            'from', 'Cria <noreply@criasocialclub.com.br>',
            'sender_domain', 'notify.criasocialclub.com.br',
            'purpose', 'transactional',
            'html', '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">'
                 || '<p style="font-size:16px"><strong>' || public.html_seguro(_titulo) || '</strong></p>'
                 || '<table style="font-size:14px;border-collapse:collapse">'
                 || case when nullif(btrim(new.name), '') is not null then '<tr><td style="color:#6b7280;padding:2px 12px 2px 0">Nome</td><td>' || public.html_seguro(left(new.name, 120)) || '</td></tr>' else '' end
                 || case when new.email is not null then '<tr><td style="color:#6b7280;padding:2px 12px 2px 0">E-mail</td><td>' || public.html_seguro(left(new.email, 160)) || '</td></tr>' else '' end
                 || case when new.phone is not null then '<tr><td style="color:#6b7280;padding:2px 12px 2px 0">Telefone</td><td>' || public.html_seguro(left(new.phone, 40)) || '</td></tr>' else '' end
                 || '</table>'
                 || case when new.mensagem is not null then '<p style="font-size:14px;white-space:pre-line;background:#f6f4f0;padding:12px;border-radius:8px">' || public.html_seguro(left(new.mensagem, 1500)) || '</p>' else '' end
                 || '<p><a href="https://app.criasocialclub.com.br' || _link || '" style="color:#B4532A">Abrir no Cria</a></p>'
                 || '<p style="color:#9ca3af;font-size:12px">Você recebe este aviso porque tem um link na bio no Cria. Dá pra desligar em Configurações, Notificações, Leads.</p></div>',
            'text', _titulo || E'\n' || _resumo || E'\nhttps://app.criasocialclub.com.br' || _link,
            'label', 'bio_lead_' || new.tipo,
            'idempotency_key', 'bio_lead_' || new.id::text,
            'message_id', _mid,
            'queued_at', now()
          ));
        exception when others then
          raise notice 'e-mail de lead não enfileirado: %', sqlerrm;
        end;
      end if;
    end if;
  end if;
  return new;
end; $function$;
