-- PRÉVIA DOS LINKS NO WHATSAPP (Walter, 19/10/2026; mockup aprovado)
--
-- O WhatsApp (e Instagram, Telegram, iMessage) não roda o app: só lê o título
-- e a imagem da página. O middleware da Vercel pergunta aqui, NA HORA, quem
-- mandou o link, pra quem e de que mês, e monta a prévia. Nada é texto fixo:
-- o mês vem do período do link, o nome vem da conta dona do link.
--
-- Devolve SÓ o que pode aparecer numa prévia que qualquer um com o link vê:
-- nome e logo da conta (o mesmo que o portal mostra no cabeçalho, profiles.name
-- e brand_logo_url), nome do cliente, mês/período e uma contagem. Nunca
-- conteúdo de post, legenda, mídia ou valores. Link inválido, vencido ou
-- revogado devolve null e a prévia cai na genérica do CRIA, sem dizer nada.

create or replace function public.link_previa(_tipo text, _token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  _conta uuid; _cliente text; _ini date; _fim date; _mes date; _n int;
  _r jsonb;
begin
  if _token is null or length(_token) < 4 or length(_token) > 200 then return null; end if;

  if _tipo in ('aprovar', 'materiais') then
    select t.manager_id, ec.name, t.period_start, t.period_end
      into _conta, _cliente, _ini, _fim
      from public.approval_tokens t
      join public.external_clients ec on ec.id = t.external_client_id
     where t.token = _token and t.active = true
       and (t.expires_at is null or t.expires_at > now())
     limit 1;
    if _conta is null then return null; end if;
    if _tipo = 'aprovar' then
      if not public.has_module('aprovapost_externo', _conta) then return null; end if;
      select count(*) into _n
        from public.approval_tokens t
        join public.posts p on p.external_client_id = t.external_client_id and p.user_id = t.manager_id
       where t.token = _token
         and p.approval_status = 'pendente'
         and p.deleted_at is null
         and coalesce(p.is_draft, false) = false
         and (t.period_start is null or t.period_end is null
              or (p.scheduled_date is not null and p.scheduled_date between t.period_start and t.period_end));
    end if;

  elsif _tipo = 'roteiros' then
    select s.manager_id, coalesce(nullif(s.client_name, ''), cc.name),
           case when s.month ~ '^\d{4}-\d{2}$' then to_date(s.month || '-01', 'YYYY-MM-DD') end
      into _conta, _cliente, _mes
      from public.script_approvals s
      left join public.crm_clients cc on cc.id = s.crm_client_id
     where s.token = _token limit 1;

  elsif _tipo = 'cronograma' then
    select c.manager_id, coalesce(nullif(c.client_label, ''), cc.name), c.mes_ref
      into _conta, _cliente, _mes
      from public.cronogramas c
      left join public.crm_clients cc on cc.id = c.crm_client_id
     where c.token = _token limit 1;

  elsif _tipo = 'agendar' then
    select l.manager_id, cc.name into _conta, _cliente
      from public.captacao_links l
      join public.crm_clients cc on cc.id = l.crm_client_id
     where l.token = _token and l.ativo = true limit 1;
    if _conta is not null then
      select min(s.dia) into _mes
        from public.captacao_slots s
        join public.captacao_links l on l.token = _token
       where s.manager_id = l.manager_id and s.status = 'livre'
         and s.dia >= (now() at time zone 'America/Sao_Paulo')::date
         and (s.para_todos or l.crm_client_id = any(s.clientes));
    end if;

  elsif _tipo = 'cadastro' then
    select i.manager_id, cc.name into _conta, _cliente
      from public.client_intakes i
      left join public.crm_clients cc on cc.id = i.crm_client_id
     where i.token = _token limit 1;

  elsif _tipo = 'acessos' then
    select k.manager_id, cc.name into _conta, _cliente
      from public.cofre_links k
      left join public.crm_clients cc on cc.id = k.crm_client_id
     where k.token = _token and k.revogado_em is null
       and (k.expires_at is null or k.expires_at > now()) limit 1;

  elsif _tipo = 'conectar' then
    select cc.manager_id, cc.name into _conta, _cliente
      from public.ig_convites g
      join public.crm_clients cc on cc.id = g.crm_client_id
     where g.token = _token and g.cancelado_em is null and g.usado_em is null
       and (g.expira_em is null or g.expira_em > now()) limit 1;

  elsif _tipo = 'proposta' then
    -- Proposta de collab: quem manda é a criadora, quem recebe é a marca.
    select c.user_id, c.brand into _conta, _cliente
      from public.collabs c
     where c.proposal_token = _token and c.proposal_status <> 'none' limit 1;

  elsif _tipo = 'indicacao' then
    -- Link /p/CODIGO da parceira: primeiro nome dela e o benefício real do cupom.
    select jsonb_build_object(
             'tipo', 'indicacao',
             'indicador', split_part(trim(p.full_name), ' ', 1),
             'desconto_pct', p.coupon_discount_pct,
             'meses', p.coupon_duration_months)
      into _r
      from public.partners p
     where upper(p.coupon_code) = upper(trim(_token)) and p.status = 'approved'
     limit 1;
    return _r;

  else
    return null;
  end if;

  if _conta is null then return null; end if;

  select jsonb_build_object(
           'tipo', _tipo,
           'conta_nome', nullif(trim(p.name), ''),
           'conta_logo', case when p.brand_logo_url ~ '^https://' then p.brand_logo_url end,
           'cliente', nullif(trim(_cliente), ''),
           'periodo_inicio', _ini,
           'periodo_fim', _fim,
           'mes', _mes,
           'contagem', _n)
    into _r
    from public.profiles p where p.id = _conta;
  return _r;
end;
$function$;

revoke all on function public.link_previa(text, text) from public;
grant execute on function public.link_previa(text, text) to anon, authenticated;
