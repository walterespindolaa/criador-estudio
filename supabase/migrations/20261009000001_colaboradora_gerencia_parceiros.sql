-- ═══════════════════════════════════════════════════════════════════════════
-- COLABORADORA GERENCIA PRODUÇÃO COM PARCEIROS (Gabriela/Walter, 09/10/2026)
--
-- "Talvez lá no Kollab, onde eu compartilho as infos como social media, ter
-- uma opção de eu conseguir gerenciar por lá, mas deveria ser opcional."
--
-- Decisão: opcional e decidido pela DONA da conta. Em Equipe > Pessoas, no
-- cartão de cada colaboradora, uma chave "Gerenciar produção com parceiros".
-- Vem desligada. É uma linha em manager_member_permissions com
-- module_code = 'parceiros_producao' (a tabela não tem check no module_code).
--
-- Ligada, a colaboradora (dentro da conta da agência) vê Produção, Conversas
-- e Canal da marca, e o "Enviar para" lista os parceiros DA AGÊNCIA.
-- Continua só com a dona: Pessoas, marcar pagamento, vincular/remover parceiro.
--
-- E fecha uma porta que existia: o "Enviar para" dentro da conta da agência
-- listava os parceiros DA COLABORADORA (meus_parceiros filtra auth.uid()), e
-- dava pra mandar peça da agência pra quem não é parceiro dela. O gatilho do
-- bloco 3 só aceita parceiro ativo da conta dona do post.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Quem pode gerir a produção com parceiros de uma conta ──────────────
create or replace function public.pode_gerir_parceiros(_manager uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _manager = auth.uid()
      or exists (
        select 1
          from public.manager_members m
          join public.manager_member_permissions perm on perm.member_row_id = m.id
         where m.manager_id = _manager
           and m.member_id = auth.uid()
           and m.status = 'ativo'
           and not public.eh_papel_parceiro(m.role)
           and perm.module_code = 'parceiros_producao'
      );
$$;
revoke all on function public.pode_gerir_parceiros(uuid) from public, anon;
grant execute on function public.pode_gerir_parceiros(uuid) to authenticated;

-- Parceiros ativos de UMA conta. Mesmo formato de meus_parceiros().
create or replace function public.parceiros_da_conta(_manager uuid)
returns table (member_id uuid, nome text, email text, role text)
language sql stable security definer set search_path = public as $$
  select m.member_id, coalesce(m.name, m.email, 'Parceiro'), m.email, m.role
    from public.manager_members m
   where m.manager_id = _manager
     and public.pode_gerir_parceiros(_manager)
     and m.status = 'ativo'
     and public.eh_papel_parceiro(m.role)
   order by coalesce(m.name, m.email);
$$;
revoke all on function public.parceiros_da_conta(uuid) from public, anon;
grant execute on function public.parceiros_da_conta(uuid) to authenticated;

-- ── 2) Caixa de conversas de UMA conta ────────────────────────────────────
-- Cópia de conversas_com_parceiros() (20260929000001), trocando
-- p.user_id = auth.uid() por p.user_id = _manager + a pergunta de permissão.
-- "Lida" continua por pessoa (conversa_lida.user_id = auth.uid()).
create or replace function public.conversas_com_parceiros_da_conta(_manager uuid)
returns table (
  post_id uuid,
  titulo text,
  formato text,
  external_client_id uuid,
  assignee_id uuid,
  producao_status text,
  ultima_texto text,
  ultima_papel text,
  ultima_em timestamptz,
  total int,
  nao_lidas int
)
language sql stable security definer set search_path = public as $$
  select p.id,
         p.title,
         p.format,
         p.external_client_id,
         p.assignee_id,
         coalesce(p.producao_status, 'aguardando'),
         u.content,
         u.author_role,
         u.created_at,
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.canal = 'parceiro'),
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro' and c.canal = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media' and s.canal = 'parceiro'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.canal = 'parceiro'
       order by c.created_at desc
       limit 1
    ) u on true
    left join public.conversa_lida l on l.user_id = auth.uid() and l.post_id = p.id
   where p.user_id = _manager
     and public.pode_gerir_parceiros(_manager)
     and p.assignee_id is not null
     and p.deleted_at is null
   order by u.created_at desc
   limit 200
$$;
revoke all on function public.conversas_com_parceiros_da_conta(uuid) from public, anon;
grant execute on function public.conversas_com_parceiros_da_conta(uuid) to authenticated;

-- ── 3) O servidor confere quem delega e pra quem ──────────────────────────
-- Não é RLS (a RLS de posts não muda): é um gatilho BEFORE que só olha
-- assignee_id e cache_parceiro. Chamadas das RPCs security definer (dono
-- postgres) e do service role passam direto, igual ao guarda de aprovação.
create or replace function public.posts_guard_parceiro()
returns trigger
language plpgsql set search_path = public as $$
declare
  _mudou_parceiro boolean;
  _mudou_cache boolean;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    _mudou_parceiro := new.assignee_id is not null;
    _mudou_cache := new.cache_parceiro is not null;
  else
    _mudou_parceiro := new.assignee_id is distinct from old.assignee_id;
    _mudou_cache := new.cache_parceiro is distinct from old.cache_parceiro;
  end if;
  if not (_mudou_parceiro or _mudou_cache) then return new; end if;

  if not public.pode_gerir_parceiros(new.user_id) then
    raise exception 'Só a dona da conta, ou quem ela liberou em Equipe > Pessoas, envia peça pra parceiro ou muda o cachê.';
  end if;

  if _mudou_parceiro and new.assignee_id is not null and not exists (
       select 1 from public.manager_members m
        where m.manager_id = new.user_id
          and m.member_id = new.assignee_id
          and m.status = 'ativo'
          and public.eh_papel_parceiro(m.role)) then
    raise exception 'Essa pessoa não é parceira desta conta. A dona vincula em Equipe > Pessoas.';
  end if;

  return new;
end; $$;

drop trigger if exists trg_posts_guard_parceiro on public.posts;
create trigger trg_posts_guard_parceiro before insert or update on public.posts
  for each row execute function public.posts_guard_parceiro();
