-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · CIDADE PADRONIZADA + COMUNIDADES POR PÚBLICO (Walter, 14/10/2026)
-- JÁ APLICADA NO BANCO (registro)
-- Cidade: só no formato "Itajaí - SC" (o app escolhe da lista do IBGE em
-- public/cidades-br.json). Comunidade: publico = todos | criadores | prestadores;
-- cada lado só vê, entra e lê as suas e as de todos (admin vê tudo).
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.criakut_perfis add constraint criakut_perfis_cidade_padrao check (cidade is null or cidade ~ '^[^ ].{1,58} - [A-Z]{2}$');
alter table public.criakut_pedidos add constraint criakut_pedidos_cidade_padrao check (cidade is null or cidade ~ '^[^ ].{1,58} - [A-Z]{2}$');

alter table public.criakut_comunidades add column if not exists publico text not null default 'todos';
alter table public.criakut_comunidades add constraint criakut_comunidades_publico_check check (publico in ('todos','criadores','prestadores'));
update public.criakut_comunidades set publico = 'prestadores' where slug in ('designers-do-cria','social-midias-de-sc','quanto-cobrar','primeiro-cliente');
insert into public.criakut_comunidades (slug, nome, descricao, emoji, cor, ordem, publico) values
 ('criadoras-do-cria', 'Criadoras do Cria', 'Rotina, ideia de pauta, bloqueio criativo e o que tá funcionando no seu nicho.', '🎤', '#FDE7E4', 7, 'criadores'),
 ('publi-e-marcas', 'Publi e marcas', 'Quanto cobrar de marca, mídia kit, contrato de publi e como chegar nas empresas.', '💼', '#FFF3D6', 8, 'criadores')
on conflict (slug) do nothing;

create or replace function public.criakut_lado(_u uuid)
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select case when p.funcao = 'criadora' then 'criadores' else 'prestadores' end from criakut_perfis p where p.user_id = _u;
$function$;
revoke all on function public.criakut_lado(uuid) from public, anon, authenticated;

create or replace function public.criakut_comunidade_pode(_publico text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select _publico = 'todos' or public.is_admin()
      or coalesce(public.criakut_lado(auth.uid()) = _publico, true);
$function$;
revoke all on function public.criakut_comunidade_pode(text) from public, anon, authenticated;

create or replace function public.criakut_comunidades_ver()
 returns table(id uuid, slug text, nome text, descricao text, emoji text, cor text, publico text, membros integer, topicos integer, sou_membro boolean, ativa boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.slug, c.nome, c.descricao, c.emoji, c.cor, c.publico,
         (select count(*) from criakut_comunidade_membros m where m.comunidade_id = c.id and m.ativo)::int,
         (select count(*) from criakut_topicos t where t.comunidade_id = c.id and t.apagado_em is null and not t.oculto)::int,
         exists (select 1 from criakut_comunidade_membros m where m.comunidade_id = c.id and m.user_id = auth.uid() and m.ativo),
         c.ativa
  from criakut_comunidades c
  where public.criakut_tem_acesso() and (c.ativa or public.is_admin()) and public.criakut_comunidade_pode(c.publico)
  order by c.ordem, c.nome;
$function$;
revoke all on function public.criakut_comunidades_ver() from public, anon;
grant execute on function public.criakut_comunidades_ver() to authenticated;

create or replace function public.criakut_admin_comunidade_salvar(_id uuid, _slug text, _nome text, _descricao text, _emoji text, _cor text, _ativa boolean, _ordem integer, _publico text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _r uuid;
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  if coalesce(_publico, 'todos') not in ('todos','criadores','prestadores') then raise exception 'Público inválido.'; end if;
  _r := public.criakut_admin_comunidade_salvar(_id, _slug, _nome, _descricao, _emoji, _cor, _ativa, _ordem);
  update criakut_comunidades set publico = coalesce(_publico, 'todos') where id = _r;
  return _r;
end $function$;
revoke all on function public.criakut_admin_comunidade_salvar(uuid, text, text, text, text, text, boolean, integer, text) from public, anon;
grant execute on function public.criakut_admin_comunidade_salvar(uuid, text, text, text, text, text, boolean, integer, text) to authenticated;

-- Comunidade, tópico e entrar passam a respeitar o público (troca de texto, só se ainda não trocada).
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.criakut_comunidade(text)'::regprocedure);
  if _def not like '%comunidade_pode%' then
    execute replace(_def, $x$select * into _c from criakut_comunidades where slug = lower(_slug) and (ativa or _admin);$x$,
      $x$select * into _c from criakut_comunidades where slug = lower(_slug) and (ativa or _admin) and public.criakut_comunidade_pode(publico);$x$);
  end if;
  _def := pg_get_functiondef('public.criakut_topico(uuid)'::regprocedure);
  if _def not like '%comunidade_pode%' then
    execute replace(_def, $x$select * into _c from criakut_comunidades where id = _t.comunidade_id and (ativa or _admin);$x$,
      $x$select * into _c from criakut_comunidades where id = _t.comunidade_id and (ativa or _admin) and public.criakut_comunidade_pode(publico);$x$);
  end if;
  _def := pg_get_functiondef('public.criakut_comunidade_entrar(uuid, boolean)'::regprocedure);
  if _def not like '%comunidade_pode%' then
    execute replace(_def, $x$if not exists (select 1 from criakut_comunidades where id = _comunidade and ativa) then raise exception 'Comunidade não encontrada.'; end if;$x$,
      $x$if not exists (select 1 from criakut_comunidades where id = _comunidade and ativa) then raise exception 'Comunidade não encontrada.'; end if;
  if coalesce(_entrar, true) and not exists (select 1 from criakut_comunidades where id = _comunidade and public.criakut_comunidade_pode(publico)) then
    raise exception 'Essa comunidade é de outro público.';
  end if;$x$);
  end if;
end $d$;
