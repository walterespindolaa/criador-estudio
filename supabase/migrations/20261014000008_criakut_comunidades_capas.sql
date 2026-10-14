-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · CAPAS DO CRIA NAS COMUNIDADES (Walter, 14/10/2026) · JÁ APLICADA (registro)
-- Sai o emoji, entra a capa desenhada por nicho (src/components/criakut/
-- CapaComunidade.tsx). O campo "emoji" passa a guardar a chave do tema
-- (papo, ideia, video, foto, design, grana, cliente, marca, mic, saude,
-- beleza, moda, comida, fitness, praia, cidade, pet, casa, viagem, edu).
-- Valor desconhecido cai em "papo" no app.
-- ═══════════════════════════════════════════════════════════════════════════
update public.criakut_comunidades set emoji = case slug
  when 'saude-e-estetica' then 'saude' when 'designers-do-cria' then 'design' when 'social-midias-de-sc' then 'praia'
  when 'reels-que-funcionam' then 'video' when 'quanto-cobrar' then 'grana' when 'primeiro-cliente' then 'cliente'
  when 'criadoras-do-cria' then 'mic' when 'publi-e-marcas' then 'marca' else emoji end;
alter table public.criakut_comunidades alter column emoji set default 'papo';

-- Padrão "papo" no lugar do balão de fala nas duas funções que criam comunidade.
do $d$ declare _def text; _e text := quote_literal(chr(128172)); begin
  _def := pg_get_functiondef('public.criakut_comunidade_sugerir(text,text,text,text)'::regprocedure);
  if position(_e in _def) > 0 then execute replace(_def, _e, '''papo'''); end if;
  _def := pg_get_functiondef('public.criakut_admin_comunidade_salvar(uuid,text,text,text,text,text,boolean,integer)'::regprocedure);
  if position(_e in _def) > 0 then execute replace(_def, _e, '''papo'''); end if;
end $d$;
