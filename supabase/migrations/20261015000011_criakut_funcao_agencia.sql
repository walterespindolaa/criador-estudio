-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · "AGÊNCIA" COMO FUNÇÃO (Walter, 15/10/2026) · JÁ APLICADA (registro)
-- Agência funciona igual social mídia: entra na busca, no mural, no "o que
-- procuro" e, quando uma criadora contrata, a criadora entra na carteira.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.criakut_perfis drop constraint criakut_perfis_funcao_check;
alter table public.criakut_perfis add constraint criakut_perfis_funcao_check
  check (funcao = any (array['social_media','agencia','criadora','designer','editor_video','filmmaker','copy']));
alter table public.criakut_perfis drop constraint criakut_perfis_busco_check;
alter table public.criakut_perfis add constraint criakut_perfis_busco_check
  check ((busco <@ array['social_media','agencia','designer','editor_video','filmmaker','copy']) and cardinality(busco) <= 6);
alter table public.criakut_perfis drop constraint criakut_perfis_outras_funcoes_check;
alter table public.criakut_perfis add constraint criakut_perfis_outras_funcoes_check
  check ((outras_funcoes <@ array['social_media','agencia','designer','editor_video','filmmaker','copy'])
         and cardinality(outras_funcoes) <= 3 and not (funcao = any (outras_funcoes))
         and (funcao <> 'criadora' or cardinality(outras_funcoes) = 0));
alter table public.criakut_pedidos drop constraint criakut_pedidos_funcao_check;
alter table public.criakut_pedidos add constraint criakut_pedidos_funcao_check
  check (funcao = any (array['social_media','agencia','designer','editor_video','filmmaker','copy']));

-- Ponte 2 do aceite: criadora que contrata agência também entra na carteira dela.
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.criakut_aceitar'::regproc);
  if position($x$elsif _f = 'social_media' and _ct.funcao = 'criadora'$x$ in _def) > 0 then
    execute replace(_def, $x$elsif _f = 'social_media' and _ct.funcao = 'criadora'$x$,
                          $x$elsif _f in ('social_media','agencia') and _ct.funcao = 'criadora'$x$);
  end if;
end $d$;
