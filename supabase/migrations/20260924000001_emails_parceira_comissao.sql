-- ═══════════════════════════════════════════════════════════════════════════
-- FASE A · CICLO 3 (24/09/2026) · Comissão paga avisa a parceira
--
-- `admin_pagar_competencia` fechava o mês em silêncio. Agora, na mesma
-- transação, a parceira recebe o sino (e o push, pelo gatilho que já existe)
-- e um e-mail com o valor. Tudo em bloco protegido: aviso que falha não
-- desfaz o pagamento. Corpo igual ao de 20260922000002, só o final muda.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.admin_pagar_competencia(
  _partner_id uuid, _competencia date, _proof_url text default null, _note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _total int; _qtd int; _payout uuid;
  _uid uuid; _email text; _nome text; _valor text; _mes text; _mid text;
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
      perform public.enqueue_email('transactional_emails', jsonb_build_object(
        'to', _email,
        'subject', 'Sua comissão de ' || _mes || ' foi paga',
        'from', 'Cria <noreply@criasocialclub.com.br>',
        'sender_domain', 'notify.criasocialclub.com.br',
        'purpose', 'transactional',
        'html', '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">'
             || '<p>Oi' || coalesce(', ' || split_part(_nome, ' ', 1), '') || '.</p>'
             || '<p>A sua comissão de <strong>' || _mes || '</strong> foi paga: <strong>' || _valor || '</strong>'
             || ' (' || _qtd || ' lançamento' || case when _qtd > 1 then 's' else '' end || ').</p>'
             || '<p>O extrato completo está em Indique e ganhe, dentro do Cria.'
             || case when _proof_url is not null then ' O comprovante está anexado lá.' else '' end || '</p>'
             || '<p style="color:#6b7280;font-size:13px">Obrigado por indicar o Cria.</p></div>',
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
end; $$;
revoke execute on function public.admin_pagar_competencia(uuid, date, text, text) from anon;
grant execute on function public.admin_pagar_competencia(uuid, date, text, text) to authenticated;

-- Categoria do push (a função de categorias é a única fonte; ver 20260923000002).
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes'
    when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes'
    when 'roteiro' then 'clientes'
    when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes'
    when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'resumo_dia' then 'lembretes'
    when 'lembrete_postar' then 'lembretes'
    when 'posts_pendentes' then 'lembretes'
    when 'story' then 'lembretes'
    when 'captacao_amanha' then 'lembretes'
    when 'aniversario_cliente' then 'lembretes'
    when 'prazo_amanha' then 'lembretes'
    when 'demanda_prazo_amanha' then 'lembretes'
    when 'demanda_atrasada' then 'lembretes'
    when 'demanda_nova' then 'clientes'
    when 'demanda_ajuste' then 'clientes'
    when 'demanda_entregue' then 'clientes'
    when 'resumo_semana_ig' then 'conquistas'
    when 'meta_batida' then 'conquistas'
    when 'dica_dia' then 'conquistas'
    when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas'
    when 'ideia_criada' then 'conquistas'
    when 'comissao_paga' then 'conquistas'
    when 'parceiro' then 'avisos'
    when 'volte' then 'avisos'
    when 'acesso_vencendo' then 'avisos'
    else 'avisos' end
$$;

notify pgrst, 'reload schema';
