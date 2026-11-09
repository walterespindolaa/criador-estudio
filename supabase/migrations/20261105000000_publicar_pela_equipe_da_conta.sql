-- Painel "Publicar no Instagram" sumia pra social mídia da conta (Walter, 04/11/2026:
-- "NAO APARECE NA MINHA CONTA DE SOCIAL MEDIA PRA AGENDAR ESSE, MESMA COISA NA DO CRIA").
-- Causa: a conta da social mídia é gerente da conta da Gabi e da Cria em
-- account_members (o RLS de posts deixa ver e editar), mas ig_conexao_do_post e
-- conexao_do_post só aceitavam dono, agência ou manager_members. A RPC dava
-- "sem permissão para este post" e o painel se escondia.
-- Correção: aceitar também quem é membro ativo da conta (account_members) ou
-- dono do perfil (profiles.perfil_de), igual ao is_account_member do RLS.
do $$
declare
  _fn regprocedure;
  _def text;
  _velho text := E'           and not public.eh_papel_parceiro(m.role))))\n  ) then';
  _novo text := E'           and not public.eh_papel_parceiro(m.role))))\n'
    || E'    or exists (select 1 from public.account_members am\n'
    || E'       where am.owner_id = _p.user_id and am.member_id = _quem and am.status = ''active'')\n'
    || E'    or exists (select 1 from public.profiles pf\n'
    || E'       where pf.id = _p.user_id and pf.perfil_de = _quem)\n'
    || E'  ) then';
begin
  foreach _fn in array array['public.ig_conexao_do_post(uuid,uuid)'::regprocedure,
                             'public.conexao_do_post(uuid,text,uuid)'::regprocedure] loop
    _def := pg_get_functiondef(_fn);
    if position('public.account_members am' in _def) > 0 then continue; end if;
    if position(_velho in _def) = 0 then raise exception 'trecho não achado em %', _fn; end if;
    execute replace(_def, _velho, _novo);
  end loop;
end $$;
