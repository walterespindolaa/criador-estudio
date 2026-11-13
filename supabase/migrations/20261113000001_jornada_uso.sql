-- JORNADA DO ADMIN: O USO DE VERDADE (Walter, 13/11/2026).
-- Desde 12/11 o criador entra direto e tem 7 dias sem cartão. A ficha do
-- admin seguia o funil antigo (planos, pagamento, teste com cartão) e marcava
-- "parou aqui" nos planos pra quem só estava usando o teste. Esta função passa
-- a mandar também o uso: quantas ferramentas abriu, se criou post, em quantos
-- dias usou e a confirmação de e-mail do cadastro novo. Só acrescenta o campo
-- "uso"; o resto do retorno fica igual.
create or replace function public.admin_jornada(_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select to_jsonb(b) || jsonb_build_object(
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'telas', d.telas) order by d.dia desc)
        from (select t.dia, jsonb_agg(jsonb_build_object('modulo', t.modulo, 'n', t.aberturas) order by t.aberturas desc) telas
                from public.uso_telas t
               where t.user_id = _id and t.dia > (now() at time zone 'America/Sao_Paulo')::date - 14
               group by t.dia) d), '[]'::jsonb),
    'uso', jsonb_build_object(
      'ferramentas', (select count(distinct t.modulo)::int from public.uso_telas t
                       where t.user_id = _id and t.modulo not in ('assinar', 'inicio', 'dashboard', 'configuracoes', 'obrigado')),
      'primeira_ferramenta_dia', (select min(t.dia) from public.uso_telas t
                       where t.user_id = _id and t.modulo not in ('assinar', 'inicio', 'dashboard', 'configuracoes', 'obrigado')),
      'dias_ativos', (select count(distinct t.dia)::int from public.uso_telas t where t.user_id = _id),
      'n_posts', (select count(*)::int from public.posts p where p.user_id = _id and p.deleted_at is null),
      'primeiro_post_em', (select min(p.created_at) from public.posts p where p.user_id = _id and p.deleted_at is null),
      'email_novo', exists (select 1 from public.email_confirmacao e where e.user_id = _id),
      'email_novo_em', (select e.confirmado_em from public.email_confirmacao e where e.user_id = _id)))
    into r
    from public.jornada_base(null, array[_id]) b;
  return r;
end $$;
revoke all on function public.admin_jornada(uuid) from public, anon;
grant execute on function public.admin_jornada(uuid) to authenticated;

notify pgrst, 'reload schema';
