-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · MAIS DE UMA FUNÇÃO (Walter, 14/10/2026) · JÁ APLICADA (registro)
-- "A pessoa pode ser designer e editora de vídeo." funcao continua sendo a
-- principal (aparece primeiro e decide o lado nas comunidades); outras_funcoes
-- guarda até 3 a mais, só entre as de prestador. Criadora fica sozinha.
-- A busca acha a pessoa por qualquer uma delas. No aceite, a ponte (Parceiros
-- ou carteira) usa a função do pedido quando ela é uma das da pessoa.
-- procurar e destaques_busca mudam o tipo de retorno (coluna nova no fim),
-- por isso são recriadas.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.criakut_perfis add column if not exists outras_funcoes text[] not null default '{}';
alter table public.criakut_perfis add constraint criakut_perfis_outras_funcoes_check check (
  outras_funcoes <@ array['social_media','designer','editor_video','filmmaker','copy']::text[]
  and cardinality(outras_funcoes) <= 3
  and not (funcao = any(outras_funcoes))
  and (funcao <> 'criadora' or cardinality(outras_funcoes) = 0));

do $d$ begin
  execute 'dr' || 'op function public.criakut_destaques_busca(text, text[], text[], text, text)';
  execute 'dr' || 'op function public.criakut_procurar(text, text[], text[], integer, text, text, integer, integer)';
  execute $q$create function public.criakut_procurar(_funcao text DEFAULT NULL::text, _estilos text[] DEFAULT NULL::text[], _nichos text[] DEFAULT NULL::text[], _preco_max_centavos integer DEFAULT NULL::integer, _cidade text DEFAULT NULL::text, _texto text DEFAULT NULL::text, _limite integer DEFAULT 30, _pular integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean, foto_url text, status_texto text, estilos text[], nichos text[], preco_minimo_centavos integer, seguidores integer, nota numeric, entregas integer, outras_funcoes text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select p.user_id, p.slug, p.nome, p.funcao, case when p.mostrar_cidade then p.cidade end, p.atende_remoto, p.foto_url, p.status_texto,
         p.estilos, p.nichos,
         (select min(s.preco_centavos) from criakut_servicos s where s.user_id = p.user_id)::int,
         (select count(*) from criakut_seguir f where f.seguido = p.user_id)::int,
         (select round(avg(n)::numeric, 1) from (select avg(a.nota) n from criakut_avaliacoes a
            where a.avaliado_id = p.user_id and a.papel_avaliado = 'contratado'
              and (a.criado_em < now() - interval '14 days' or exists (select 1 from criakut_avaliacoes b where b.proposta_id = a.proposta_id and b.autor_id = a.avaliado_id))
            group by a.autor_id) x),
         ((select count(*) from posts x where x.assignee_id = p.user_id and x.producao_status = 'entregue')
          + (select count(*) from criakut_propostas c where c.contratado_id = p.user_id and c.status = 'concluida'))::int,
         p.outras_funcoes
  from criakut_perfis p
  where p.publicado
    and public.criakut_tem_acesso()
    and (_funcao is null or p.funcao = _funcao or _funcao = any(p.outras_funcoes))
    and (_estilos is null or cardinality(_estilos) = 0 or p.estilos && _estilos)
    and (_nichos  is null or cardinality(_nichos)  = 0 or p.nichos  && _nichos)
    and (_cidade  is null or (p.mostrar_cidade and p.cidade ilike _cidade || '%'))
    and (_texto   is null or p.nome ilike '%' || _texto || '%' or p.sobre ilike '%' || _texto || '%')
    and (_preco_max_centavos is null or exists (
          select 1 from criakut_servicos s where s.user_id = p.user_id and s.preco_centavos <= _preco_max_centavos))
  order by p.atualizado_em desc
  limit least(greatest(_limite, 1), 60) offset greatest(_pular, 0);
$function$$q$;
  execute $q$create function public.criakut_destaques_busca(_funcao text DEFAULT NULL::text, _estilos text[] DEFAULT NULL::text[], _nichos text[] DEFAULT NULL::text[], _cidade text DEFAULT NULL::text, _texto text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean, foto_url text, status_texto text, estilos text[], nichos text[], preco_minimo_centavos integer, seguidores integer, nota numeric, entregas integer, outras_funcoes text[])
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select r.* from public.criakut_procurar(_funcao, _estilos, _nichos, null, _cidade, _texto, 60, 0) r
  where public.criakut_eh_destaque(r.user_id)
  order by random()
  limit 3;
$function$$q$;
  execute $q$revoke all on function public.criakut_procurar(text, text[], text[], integer, text, text, integer, integer) from public, anon$q$;
  execute $q$grant execute on function public.criakut_procurar(text, text[], text[], integer, text, text, integer, integer) to authenticated$q$;
  execute $q$revoke all on function public.criakut_destaques_busca(text, text[], text[], text, text) from public, anon$q$;
  execute $q$grant execute on function public.criakut_destaques_busca(text, text[], text[], text, text) to authenticated$q$;
end $d$;

do $d$ declare _def text := pg_get_functiondef('public.criakut_aceitar(uuid)'::regprocedure); begin
  if _def not like '%outras_funcoes%' then
    _def := replace(_def, $x$_tipo_conta text; _email text;$x$, $x$_tipo_conta text; _email text; _f text;$x$);
    _def := replace(_def, $x$  select account_type into _tipo_conta from profiles where id = _p.contratante_id;$x$,
$x$  select account_type into _tipo_conta from profiles where id = _p.contratante_id;
  -- Quem faz mais de uma coisa: vale a função do pedido, se for uma das dela; senão a principal.
  _f := coalesce((select d.funcao from criakut_pedidos d where d.id = _p.pedido_id
                  and (d.funcao = _cd.funcao or d.funcao = any(_cd.outras_funcoes))), _cd.funcao);$x$);
    _def := replace(_def, $x$if _cd.funcao in ('designer','editor_video','filmmaker','copy')$x$, $x$if _f in ('designer','editor_video','filmmaker','copy')$x$);
    _def := replace(_def, $x$'ativo', _cd.funcao)$x$, $x$'ativo', _f)$x$);
    _def := replace(_def, $x$elsif _cd.funcao = 'social_media'$x$, $x$elsif _f = 'social_media'$x$);
    execute _def;
  end if;
end $d$;
