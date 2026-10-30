/* E-MAIL DE COMISSÃO PAGA COM A MOLDURA DO CRIA (30/10/2026).
   Pente fino dos e-mails: era o último, junto com o de lead, montado à mão no
   banco (texto solto, sem logo). Agora usa email_moldura_cria, a mesma dos
   outros. Depende da migração 20261030000003 (que cria a moldura). A lógica
   do pagamento não mudou em nada: só o HTML e o remetente do aviso. */
create or replace function public.admin_pagar_competencia(_partner_id uuid, _competencia date, _proof_url text default null::text, _note text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  _total int; _qtd int; _payout uuid;
  _uid uuid; _email text; _nome text; _valor text; _mes text; _mid text; _corpo text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'apenas admin';
  end if;

  select coalesce(sum(amount_cents), 0), count(*) into _total, _qtd
    from public.partner_commission_entries
   where partner_id = _partner_id and competencia = _competencia and status = 'payable';

  if _qtd = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'nada a pagar nesta competencia');
  end if;

  insert into public.partner_payouts
    (partner_id, competencia, total_cents, entries_count, status, paid_at, paid_by, proof_url, note)
  values
    (_partner_id, _competencia, _total, _qtd, 'pago', now(), auth.uid(), _proof_url, _note)
  on conflict (partner_id, competencia) do update set
    total_cents = excluded.total_cents, entries_count = excluded.entries_count,
    status = 'pago', paid_at = now(), paid_by = auth.uid(),
    proof_url = coalesce(excluded.proof_url, public.partner_payouts.proof_url),
    note = coalesce(excluded.note, public.partner_payouts.note)
  returning id into _payout;

  update public.partner_commission_entries
     set status = 'paid', payout_id = _payout
   where partner_id = _partner_id and competencia = _competencia and status = 'payable';

  -- Aviso pra parceira (sino + push + e-mail). Nunca derruba o pagamento.
  begin
    select pt.user_id, pr.email, coalesce(pt.full_name, pr.name)
      into _uid, _email, _nome
      from public.partners pt
      left join public.profiles pr on pr.id = pt.user_id
     where pt.id = _partner_id;
    _valor := 'R$ ' || to_char(_total / 100.0, 'FM999G999G990D00');
    _mes := to_char(_competencia, 'MM/YYYY');
    if _uid is not null then
      insert into public.notifications (user_id, type, title, description, link)
      values (_uid, 'comissao_paga', 'Comissão paga: ' || _valor,
              'A comissão de ' || _mes || ' foi paga. O extrato já mostra como pago.',
              '/socialmidia/parceria');
    end if;
    if _email is not null then
      _mid := gen_random_uuid()::text;
      _corpo := '<p style="margin:0 0 14px;">Oi' || coalesce(', ' || public.html_seguro(split_part(_nome, ' ', 1)), '') || '.</p>'
        || '<p style="margin:0 0 14px;">A sua comissão de <strong>' || _mes || '</strong> foi paga.</p>'
        || '<p style="margin:0 0 14px;font-family:''Baloo 2'',''Arial Rounded MT Bold'',Arial,sans-serif;font-size:34px;font-weight:800;color:#1E1A17;line-height:1.1;">' || _valor
        || '<span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:normal;color:#8A7F76;margin-top:4px;">' || _qtd || ' lançamento' || case when _qtd > 1 then 's' else '' end || '</span></p>'
        || '<p style="margin:0 0 14px;">O extrato completo está em Indique e ganhe, dentro do Cria.'
        || case when _proof_url is not null then ' O comprovante está anexado lá.' else '' end || '</p>';
      perform public.enqueue_email('transactional_emails', jsonb_build_object(
        'to', _email,
        'subject', 'Sua comissão de ' || _mes || ' foi paga',
        'from', 'Cria Social Club <noreply@criasocialclub.com.br>',
        'sender_domain', 'notify.criasocialclub.com.br',
        'purpose', 'transactional',
        'html', public.email_moldura_cria('Comissão', 'Sua comissão de ' || _mes || ' foi paga', '#F2C21E', '#1E1A17',
                  'stickers/selo-social-club-verde.png', _corpo,
                  'Ver o extrato', 'https://app.criasocialclub.com.br/socialmidia/parceria',
                  'Obrigado por indicar o Cria.'),
        'text', 'Sua comissão de ' || _mes || ' foi paga: ' || _valor || '. Extrato em Indique e ganhe, no Cria.',
        'label', 'comissao_paga',
        'idempotency_key', _mid,
        'message_id', _mid,
        'queued_at', now()
      ));
    end if;
  exception when others then
    raise notice 'aviso de comissão paga não enviado: %', sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'total_cents', _total, 'lancamentos', _qtd, 'payout_id', _payout);
end; $function$;
