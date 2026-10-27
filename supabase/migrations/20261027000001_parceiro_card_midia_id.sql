-- Card do parceiro (27/10/2026): "Salvar no celular" dava "Tentar de novo" em
-- todas as mídias. O card montava um id falso pra cada mídia ("0-https://...")
-- e a edge criapost-download-file procura pelo id da external_media_refs:
-- 404 "Mídia não encontrada" (8 de 8 no log das 12h01). Agora o card devolve o
-- id de verdade. Troca feita em cima da definição VIVA (banco diverge do repo).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.parceiro_abrir_card(uuid)'::regprocedure);
  if position('''id'', m.id' in d) = 0 then
    if position('''url'', coalesce(nullif(btrim(m.view_url), ''''), m.thumbnail_url),' in d) = 0 then
      raise exception 'parceiro_abrir_card mudou: não achei o trecho das mídias';
    end if;
    d := replace(d, '''url'', coalesce(nullif(btrim(m.view_url), ''''), m.thumbnail_url),',
                    '''id'', m.id,' || chr(10) || '           ''url'', coalesce(nullif(btrim(m.view_url), ''''), m.thumbnail_url),');
    execute d;
  end if;
end $$;
