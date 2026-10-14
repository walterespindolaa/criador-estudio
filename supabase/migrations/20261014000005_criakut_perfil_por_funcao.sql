-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · PERFIL POR FUNÇÃO + CIDADE (Walter, 14/10/2026) · JÁ APLICADA (registro)
-- Criadora contrata, não vende: a página dela mostra os últimos posts do
-- Instagram (só miniaturas guardadas no storage do Cria e links do instagram.com),
-- os seguidores e o que ela procura. Prestador segue com serviços e portfólio.
-- Cidade: a pessoa escolhe se aparece; escondida, some da página e da busca
-- "perto de mim".
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.criakut_perfis add column if not exists mostrar_cidade boolean not null default true;
alter table public.criakut_perfis add column if not exists mostrar_instagram boolean not null default true;
alter table public.criakut_perfis add column if not exists busco text[] not null default '{}';
alter table public.criakut_perfis add column if not exists busco_texto text;
alter table public.criakut_perfis add constraint criakut_perfis_busco_texto_check check (busco_texto is null or char_length(busco_texto) <= 300);
alter table public.criakut_perfis add constraint criakut_perfis_busco_check check (busco <@ array['social_media','designer','editor_video','filmmaker','copy']::text[] and cardinality(busco) <= 5);

do $p$ declare _def text := pg_get_functiondef('public.criakut_perfil(text)'::regprocedure); begin
  if _def not like '%''instagram_posts''%' then
    _def := replace(_def, $x$return to_jsonb(_p) - 'capa_original_url' - 'capa_ajuste' - 'mostrar_visitas'$x$,
      $x$return to_jsonb(_p) - 'capa_original_url' - 'capa_ajuste' - 'mostrar_visitas' - 'cidade'
    || jsonb_build_object('cidade', case when _p.user_id = _eu or _p.mostrar_cidade then _p.cidade end)$x$);
    _def := replace(_def, $x$      'trabalhos_concluidos',$x$,
$x$      'instagram_posts', case when _p.mostrar_instagram then coalesce((select jsonb_agg(jsonb_build_object('thumb', x.thumbnail_url, 'link', x.permalink, 'tipo', x.media_type, 'em', x.posted_at) order by x.posted_at desc)
                         from (select thumbnail_url, permalink, media_type, posted_at from social_insights
                               where user_id = _p.user_id and crm_client_id is null and object_type = 'media' and provider = 'instagram'
                                 and thumbnail_url like 'https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/public/%'
                                 and permalink like 'https://www.instagram.com/%'
                               order by posted_at desc nulls last limit 9) x), '[]'::jsonb) else '[]'::jsonb end,
      'instagram_seguidores', case when _p.mostrar_instagram then (select max(followers_count) from social_connections
                                where user_id = _p.user_id and crm_client_id is null and provider = 'instagram') end,
      'contratacoes', (select count(*) from criakut_propostas c where c.contratante_id = _p.user_id and c.status in ('fechada','concluida')),
      'pedidos_abertos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'funcao', d.funcao, 'tipo', d.tipo,
                           'valor_min_centavos', d.valor_min_centavos, 'valor_max_centavos', d.valor_max_centavos, 'unidade', d.unidade) order by d.criado_em desc)
                         from criakut_pedidos d where d.autor_id = _p.user_id and d.status = 'aberto'), '[]'::jsonb),
      'trabalhos_concluidos',$x$);
    execute _def;
  end if;
end $p$;

do $q$ declare _def text := pg_get_functiondef('public.criakut_procurar(text, text[], text[], integer, text, text, integer, integer)'::regprocedure); begin
  if _def not like '%mostrar_cidade%' then
    _def := replace(_def, $x$select p.user_id, p.slug, p.nome, p.funcao, p.cidade,$x$, $x$select p.user_id, p.slug, p.nome, p.funcao, case when p.mostrar_cidade then p.cidade end,$x$);
    _def := replace(_def, $x$(_cidade  is null or p.cidade ilike _cidade || '%')$x$, $x$(_cidade  is null or (p.mostrar_cidade and p.cidade ilike _cidade || '%'))$x$);
    execute _def;
  end if;
end $q$;
