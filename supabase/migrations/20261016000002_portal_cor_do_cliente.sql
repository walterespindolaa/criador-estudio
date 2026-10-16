-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAL DE APROVAÇÃO: COR DO CLIENTE (Gabriela, 16/10/2026) · JÁ APLICADA (registro)
-- "Em cada navegador está indo uma cor diferente": o cliente não tinha cor e o
-- portal caía no tema salvo no navegador de quem abria. O app agora usa uma
-- cor fixa quando falta (AprovarPortal.tsx) e esta função passa a considerar
-- também a cor antiga do cliente (external_clients.color) e ignora texto vazio.
-- ═══════════════════════════════════════════════════════════════════════════
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.get_external_client_by_token(text)'::regprocedure);
  if position('coalesce(ec.brand_color, cc.color)' in _def) > 0 then
    execute replace(_def, 'coalesce(ec.brand_color, cc.color)',
      'coalesce(nullif(ec.brand_color,''''), nullif(cc.color,''''), nullif(ec.color,''''))');
  end if;
end $d$;
