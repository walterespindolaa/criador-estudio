-- ROTEIRO EDITADO PELO CLIENTE NÃO ATUALIZAVA O TEXTO (Gabriela, 20/10/2026)
--
-- Causa (provada na revisão 02f45648, aplicada 20/10 09:34): a página do
-- cliente grava as CENAS editadas em client_scenes, mas o client_content ia
-- com o texto antigo. apply_script_approval copiava os dois: cenas novas,
-- texto velho. A lista de roteiros, o copiar e o "virar post" leem o texto.
-- O editor da agência não tinha o problema porque refaz o texto das cenas.
--
-- Conserto: função que monta o texto das cenas igual ao cenasParaTexto do app
-- (conferido: 27 de 28 roteiros idênticos; o 28º é um teste antigo de texto
-- realmente diferente), apply usa ela, e os roteiros já aplicados foram refeitos.

create or replace function public.roteiro_texto_das_cenas(_cenas jsonb)
returns text language sql immutable set search_path to 'public' as $$
  select string_agg(
           'Cena ' || ord || E':\n' || fala
           || case when direcao <> '' then E'\n[' || direcao || ']' else '' end,
           E'\n\n' order by ord)
    from (
      select row_number() over (order by i) as ord,
             -- trim do JavaScript: tira espaço E quebra de linha das pontas
             regexp_replace(coalesce(c->>'fala', ''), '^\s+|\s+$', '', 'g') as fala,
             regexp_replace(coalesce(c->>'direcao', ''), '^\s+|\s+$', '', 'g') as direcao
        from jsonb_array_elements(case when jsonb_typeof(_cenas) = 'array' then _cenas else '[]'::jsonb end)
             with ordinality as e(c, i)
       where regexp_replace(coalesce(c->>'fala', ''), '\s', '', 'g') <> ''
          or regexp_replace(coalesce(c->>'direcao', ''), '\s', '', 'g') <> ''
    ) x;
$$;

create or replace function public.apply_script_approval(_approval_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _a public.script_approvals; _it record; _n integer := 0; _txt text;
begin
  select * into _a from public.script_approvals where id = _approval_id;
  if not found then raise exception 'revisão não encontrada'; end if;
  if not public.acts_for(_a.manager_id) then raise exception 'sem permissão'; end if;

  for _it in select * from public.script_approval_items where approval_id = _a.id loop
    if _it.script_id is null then continue; end if;

    if _it.removed then
      update public.capture_scripts
         set capture_id = null,
             title = case when title ilike '[removido pelo cliente]%' then title
                          else '[removido pelo cliente] ' || title end,
             updated_at = now()
       where id = _it.script_id;
      _n := _n + 1;
      continue;
    end if;

    -- 20/10/2026: o cliente edita as CENAS; o texto corrido que vinha junto
    -- era o antigo. Com cenas, o texto oficial passa a ser feito delas.
    _txt := public.roteiro_texto_das_cenas(_it.client_scenes);

    update public.capture_scripts
       set title    = coalesce(nullif(btrim(coalesce(_it.client_title, '')), ''), title),
           content  = coalesce(_txt, _it.client_content, content),
           scenes   = coalesce(_it.client_scenes, scenes),
           position = coalesce(_it.client_position, position),
           updated_at = now()
     where id = _it.script_id;
    _n := _n + 1;
  end loop;

  update public.script_approvals set status = 'aplicado', applied_at = now() where id = _a.id;
  return _n;
end; $function$;

-- Reparo (rodado em 20/10/2026): roteiros de revisões já aplicadas com texto
-- diferente das cenas. Corrigiu "Você acha caro?" e "Dezembro com a sua melhor versão".
update public.capture_scripts s
   set content = public.roteiro_texto_das_cenas(s.scenes), updated_at = now()
  from public.script_approval_items i
  join public.script_approvals a on a.id = i.approval_id
 where i.script_id = s.id and a.status = 'aplicado'
   and jsonb_typeof(s.scenes) = 'array' and jsonb_array_length(s.scenes) > 0
   and public.roteiro_texto_das_cenas(s.scenes) is distinct from s.content;
