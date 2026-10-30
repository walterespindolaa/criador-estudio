/* E-MAIL DE LEAD COM A CARA DO CRIA (Gabriela, 30/10/2026: "melhorar layout").
   O aviso de lead do link na bio era o único e-mail montado à mão no banco:
   texto solto, link sublinhado, sem logo. Agora veste a mesma moldura dos
   outros e-mails (_shared/email-moldura.ts), com botão de WhatsApp quando o
   lead deixou telefone, que é o que a pessoa quer fazer ao ler o aviso. */

-- A moldura dos e-mails, versão SQL (mesmo HTML do email-moldura.ts).
create or replace function public.email_moldura_cria(
  _tag text, _titulo text, _cor text, _cor_texto text, _sticker text,
  _corpo_html text, _botao_texto text, _botao_url text, _nota_html text)
returns text language sql immutable set search_path = public as $$
  select '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">'
  || '<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&display=swap" rel="stylesheet"></head>'
  || '<body style="margin:0;padding:0;background:#F4EFE3;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EFE3" style="background:#F4EFE3;"><tr><td align="center" style="padding:28px 14px 36px;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">'
  || '<tr><td align="center" style="padding:0 0 22px;"><img src="https://app.criasocialclub.com.br/logo-cria.png" width="112" alt="Cria" style="display:block;width:112px;height:auto;border:0;"></td></tr>'
  || '<tr><td style="background:#FFFFFF;border-radius:30px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
  || '<tr><td bgcolor="' || _cor || '" style="background:' || _cor || ';border-radius:30px 30px 0 0;padding:30px 30px 28px 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle">'
  || '<p style="margin:0 0 10px;"><span style="display:inline-block;background:#FFFFFF;color:#1E1A17;border-radius:999px;padding:5px 14px;font-family:''Baloo 2'',''Arial Rounded MT Bold'',Arial,sans-serif;font-size:13px;font-weight:800;">' || _tag || '</span></p>'
  || '<h1 style="margin:0;font-family:''Baloo 2'',''Arial Rounded MT Bold'',''Arial Black'',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:800;color:' || _cor_texto || ';">' || _titulo || '</h1>'
  || '</td><td width="118" align="right" valign="middle" style="padding-left:12px;"><img src="https://app.criasocialclub.com.br/' || _sticker || '" width="108" alt="" style="display:block;width:108px;height:auto;border:0;"></td></tr></table></td></tr>'
  || '<tr><td style="padding:28px 36px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#3A332E;">' || _corpo_html || '</td></tr>'
  || case when _botao_url is null then '' else
       '<tr><td style="padding:26px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#CE4A1D" style="background:#CE4A1D;border-radius:999px;"><a href="' || _botao_url || '" style="display:inline-block;padding:16px 32px;font-family:''Baloo 2'',''Arial Rounded MT Bold'',Arial,sans-serif;font-size:17px;font-weight:800;color:#FFFFFF;text-decoration:none;">' || _botao_texto || ' &rarr;</a></td></tr></table></td></tr>' end
  || case when _nota_html is null then '<tr><td style="padding:0 0 30px;"></td></tr>' else
       '<tr><td style="padding:22px 36px 32px;"><p style="margin:0;padding-top:16px;border-top:1px solid #EDE5DA;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#8A7F76;">' || _nota_html || '</p></td></tr>' end
  || '</table></td></tr><tr><td align="center" style="padding:26px 10px 0;"><img src="https://app.criasocialclub.com.br/stickers/selo-da-ideia-ao-post-rosa.png" width="150" alt="Da ideia ao post" style="display:block;width:150px;height:auto;border:0;margin:0 auto 12px;">'
  || '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A7F76;">Cria Social Club · feito pro criador brasileiro<br><a href="https://criasocialclub.com.br" style="color:#8A7F76;">criasocialclub.com.br</a> · <a href="https://app.criasocialclub.com.br/privacidade" style="color:#8A7F76;">privacidade</a></p>'
  || '</td></tr></table></td></tr></table></body></html>';
$$;
revoke execute on function public.email_moldura_cria(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;

create or replace function public.notify_new_bio_lead()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  _cliente uuid; _nome text; _quem text; _titulo text; _link text; _email text; _quer text;
  _ultimos int; _mid text; _resumo text; _assunto text;
  _fone text; _wa text; _linha text; _corpo text; _tag text;
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
          _tag := case when new.tipo = 'parceria' then 'Parceria' else 'Novo lead' end;

          -- WhatsApp direto: só dígitos; número brasileiro sem DDI ganha o 55.
          _fone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
          if length(_fone) in (10, 11) then _fone := '55' || _fone; end if;
          _wa := case when length(_fone) between 12 and 13 then 'https://wa.me/' || _fone end;

          _linha := '<tr><td style="padding:10px 0;border-bottom:1px solid #EDE5DA;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8A7F76;width:96px;vertical-align:top;">%s</td><td style="padding:10px 0;border-bottom:1px solid #EDE5DA;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1E1A17;font-weight:bold;">%s</td></tr>';
          _corpo := '<p style="margin:0 0 6px;">' || public.html_seguro(_resumo) || '</p>'
            || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px;">'
            || case when nullif(btrim(new.name), '') is not null then format(_linha, 'Nome', public.html_seguro(left(new.name, 120))) else '' end
            || case when new.phone is not null then format(_linha, 'Telefone', public.html_seguro(left(new.phone, 40))) else '' end
            || case when new.email is not null then format(_linha, 'E-mail',
                 '<a href="mailto:' || public.html_seguro(left(new.email, 160)) || '" style="color:#1E1A17;">' || public.html_seguro(left(new.email, 160)) || '</a>') else '' end
            || '</table>'
            || case when new.mensagem is not null then
                 '<p style="margin:16px 0 0;font-size:15px;white-space:pre-line;background:#F7F3EE;padding:14px 16px;border-radius:16px;color:#3A332E;">' || public.html_seguro(left(new.mensagem, 1500)) || '</p>' else '' end
            || case when _wa is not null then
                 '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;"><tr><td bgcolor="#25D366" style="background:#25D366;border-radius:999px;"><a href="' || _wa || '" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Chamar no WhatsApp</a></td></tr></table>' else '' end;

          perform public.enqueue_email('transactional_emails', jsonb_build_object(
            'to', _email,
            'subject', _assunto,
            'from', 'Cria <noreply@criasocialclub.com.br>',
            'sender_domain', 'notify.criasocialclub.com.br',
            'purpose', 'transactional',
            'html', public.email_moldura_cria(_tag, public.html_seguro(_titulo), '#3E9152', '#FFFFFF',
                      'stickers/selo-social-club-amarelo.png', _corpo,
                      'Ver no Cria', 'https://app.criasocialclub.com.br' || _link,
                      'Você recebe este aviso porque tem um link na bio no Cria. Dá pra desligar em Configurações, Notificações, Leads.'),
            'text', _titulo || E'\n' || _resumo
                    || case when new.phone is not null then E'\nTelefone: ' || new.phone else '' end
                    || case when new.email is not null then E'\nE-mail: ' || new.email else '' end
                    || E'\nhttps://app.criasocialclub.com.br' || _link,
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
