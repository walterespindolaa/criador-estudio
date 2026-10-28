-- ═══════════════════════════════════════════════════════════════════════════
-- ABA PUBLICAÇÕES: conexão do Instagram de VÁRIOS posts numa chamada (28/10/2026)
--
-- A aba lista os posts de todos os clientes e precisa saber, por post, em que
-- @ ele sai e se dá pra publicar pelo Cria (ou se o cliente precisa reconectar).
-- Chamar ig_conexao_do_post post a post seria uma ida ao banco por card.
-- Post que a pessoa não pode ver simplesmente não volta.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.ig_status_publicacoes(_post_ids uuid[])
returns table (post_id uuid, username text, pode_publicar boolean, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare
  _id uuid;
  _c record;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  foreach _id in array coalesce(_post_ids[1:300], '{}'::uuid[]) loop
    begin
      select * into _c from public.ig_conexao_do_post(_id) limit 1;
      post_id := _id; username := _c.username; pode_publicar := coalesce(_c.pode_publicar, false); motivo := _c.motivo;
      return next;
    exception when others then
      null; -- sem permissão ou post apagado: fica de fora
    end;
  end loop;
end $$;
revoke all on function public.ig_status_publicacoes(uuid[]) from public, anon;
grant execute on function public.ig_status_publicacoes(uuid[]) to authenticated;
