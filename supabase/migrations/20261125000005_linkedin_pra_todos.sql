-- ═══════════════════════════════════════════════════════════════════════════
-- LINKEDIN LIBERADO PRA TODOS · 25/11/2026
-- Walter, 25/11/2026: "linkedin acho que ja da pra liberar pra todos, ja nao ta
-- ativado?". A trava de master (20261103000002) valia pras três redes juntas.
-- Agora vale por rede: LinkedIn pra todo mundo; YouTube e TikTok seguem só pro
-- master até o Google e o TikTok aprovarem os apps.
--
-- O que muda:
-- 1. validar_publicacao_rede e agendar_publicacao_rede: a linha do is_admin()
--    passa a valer só quando a rede não é linkedin;
-- 2. linkedin_resultado e linkedin_resultado_salvar (resultado digitado à mão):
--    sai a linha do is_admin(). O direito ao post continua no conexao_do_post.
--
-- Mexe na definição que está NO BANCO (pg_get_functiondef), trocando só a linha
-- da trava, pra não desfazer o que outras migrations já mudaram nessas funções.
-- Idempotente: rodar de novo não acha a linha antiga e não muda nada.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  _f record;
  _def text;
  _novo text;
  _velha constant text := 'if not public.is_admin() then raise exception ''sem permissão''; end if;';
begin
  for _f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('validar_publicacao_rede', 'agendar_publicacao_rede', 'linkedin_resultado', 'linkedin_resultado_salvar')
  loop
    _def := pg_get_functiondef(_f.oid);
    if position(_velha in _def) = 0 then
      continue; -- já liberada
    end if;
    if _f.proname in ('validar_publicacao_rede', 'agendar_publicacao_rede') then
      _novo := replace(_def, _velha,
        'if _rede <> ''linkedin'' and not public.is_admin() then raise exception ''sem permissão''; end if;');
    else
      _novo := replace(_def, _velha, '-- LinkedIn pra todos desde 25/11/2026 (o direito ao post fica no conexao_do_post).');
    end if;
    execute _novo;
  end loop;
end;
$$;

-- Conferência: nenhuma das quatro pode sobrar com a trava antiga.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('validar_publicacao_rede', 'agendar_publicacao_rede', 'linkedin_resultado', 'linkedin_resultado_salvar')
       and position('if not public.is_admin() then raise exception ''sem permissão''; end if;' in pg_get_functiondef(p.oid)) > 0
  ) then
    raise exception 'a trava de master não saiu de alguma função';
  end if;
end;
$$;

notify pgrst, 'reload schema';
