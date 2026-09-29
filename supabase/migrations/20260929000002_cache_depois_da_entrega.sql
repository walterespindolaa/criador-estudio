/* ═══════════════════════════════════════════════════════════════════════════
   CACHÊ PREENCHIDO DEPOIS DA ENTREGA (Walter, 29/09/2026)

   "acabei não colocando [cachê] de uns, queria revisar todos". Agora dá pra
   editar o cachê direto no card, mas o gatilho tinha um furo: a despesa só
   nascia NA TRANSIÇÃO pra 'entregue'. Peça que foi entregue sem valor e
   ganhou valor depois nunca entrava no Caixa: o bloco (b) só corrigia uma
   despesa que já existisse, e não existia nenhuma.

   Agora, se o cachê muda, a peça JÁ está entregue, tem parceiro e não há
   despesa ligada a ela, o gatilho lança a despesa na hora. O resto do
   comportamento é o mesmo da versão de 14/09 (notificacao_leva_ao_lugar).

   Só troca o corpo da função: o trigger continua o mesmo.
   ═══════════════════════════════════════════════════════════════════════════ */

create or replace function public.lancar_cache_parceiro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _papel text; _nome text; _crm uuid; _cat text; _fin record;
  _atrasado boolean := false;
begin
  -- (b) Correção de valor: vale a qualquer momento, não só na entrega.
  if new.cache_parceiro is distinct from old.cache_parceiro then
    select f.* into _fin from public.fin_records f where f.post_id = new.id limit 1;
    if found then
      if coalesce(_fin.status, 'pendente') <> 'pago' then
        if new.cache_parceiro is null or new.cache_parceiro <= 0 then
          -- Zerou o combinado: a despesa some do Caixa, senão fica fantasma.
          delete from public.fin_records where id = _fin.id;
        else
          update public.fin_records set amount = new.cache_parceiro where id = _fin.id;
        end if;
      end if;
      return new;
    end if;
    -- (b2) NOVO: sem despesa ainda, peça já entregue e agora com valor.
    -- É o caso que ficava de fora: entregou sem cachê, valor veio depois.
    _atrasado := coalesce(new.producao_status, '') = 'entregue'
                 and new.assignee_id is not null
                 and coalesce(new.cache_parceiro, 0) > 0;
  end if;

  if not _atrasado then
    -- coalesce porque producao_status pode ser NULL (post sem parceiro).
    if coalesce(new.producao_status, '') <> 'entregue'
       or coalesce(old.producao_status, '') = 'entregue' then
      return new;
    end if;
    if new.assignee_id is null then return new; end if;

    -- (c) Entregue sem cachê: a agência precisa saber, senão ninguém paga.
    if new.cache_parceiro is null or new.cache_parceiro <= 0 then
      select coalesce(nullif(m.name, ''), 'O parceiro') into _nome
      from public.manager_members m
      where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
      insert into public.notifications (user_id, type, title, description, link)
      values (new.user_id, 'cache_aviso',
              '💸 Entrega sem cachê combinado: ' || coalesce(new.title, 'post'),
              coalesce(_nome, 'O parceiro') || ' entregou, mas esta peça não tem valor definido. '
                || 'Sem isso ela não entra no Caixa nem no "a receber" dele.',
              public.link_da_peca(new.id, new.external_client_id, false));
      return new;
    end if;
  end if;

  if exists (select 1 from public.fin_records f where f.post_id = new.id) then return new; end if;

  select m.role, coalesce(nullif(m.name, ''), 'Parceiro') into _papel, _nome
  from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
  select ec.crm_client_id into _crm from public.external_clients ec where ec.id = new.external_client_id;
  _cat := case _papel
    when 'designer' then 'Design'
    when 'editor_video' then 'Edição de vídeo'
    when 'copy' then 'Copy'
    when 'trafego' then 'Tráfego pago'
    else 'Freelancer' end;
  insert into public.fin_records (manager_id, crm_client_id, context, type, category, description, amount, date, status, post_id, assignee_id)
  values (new.user_id, _crm, 'pj', 'despesa', _cat,
          'Cachê ' || coalesce(_nome, 'Parceiro') || ': ' || coalesce(new.title, 'post'),
          new.cache_parceiro, current_date, 'pendente', new.id, new.assignee_id);
  return new;

exception when others then
  /* Cachê não pode travar a entrega nem a edição, mas também não pode sumir
     calado. Se nem a notificação entrar, fica o warning no log. */
  begin
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cache_aviso',
            '💸 Não consegui lançar o cachê: ' || coalesce(new.title, 'post'),
            'O valor foi salvo na peça, mas a despesa não entrou no Caixa. Lance na mão pra não perder o combinado.',
            '/socialmidia/criacaixa/empresa');
  exception when others then
    raise warning 'lancar_cache_parceiro falhou e nem notificou: %', sqlerrm;
  end;
  return new;
end; $$;

-- Conferência (depois de preencher o cachê de uma peça já entregue):
-- select id, amount, status, description from public.fin_records where post_id = '<id da peça>';
