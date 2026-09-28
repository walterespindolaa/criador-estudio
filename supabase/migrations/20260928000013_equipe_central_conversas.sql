-- ============================================================
-- EQUIPE VIRA A CENTRAL DE PRODUÇÃO · CICLO 1 (Walter, 28/09/2026)
--
-- "Tem que ter um campo único de visualização da conversa entre a social
-- media e os prestadores de serviço." Até aqui cada conversa morava dentro
-- do próprio card: pra saber se o designer respondeu, a social mídia abria
-- peça por peça. Agora existe uma caixa de entrada só, na Equipe, com a
-- última fala de cada card e o que ainda não foi lido.
--
-- O que este arquivo faz:
-- 1) conversa_lida: até quando cada pessoa leu cada conversa. É o que separa
--    "tem mensagem" de "tem mensagem NOVA".
-- 2) conversas_com_parceiros(): a lista de conversas da agência, da mais
--    recente pra mais antiga, com o número de não lidas.
-- 3) marcar_conversa_lida(post): carimba a leitura.
-- 4) Os avisos passam a apontar pra Equipe (o painel saiu do Cria Post):
--    comentário do parceiro abre a conversa certa; prazo sugerido abre a
--    Produção. O link antigo continua funcionando (o app redireciona).
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

-- ── 1) Até onde eu li ─────────────────────────────────────────────────────
create table if not exists public.conversa_lida (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (user_id, post_id)
);

comment on table public.conversa_lida is
  'Quando cada pessoa leu por último a conversa de um card. Serve só pra contar mensagens novas.';

alter table public.conversa_lida enable row level security;

-- Cada um só LÊ a própria leitura. Gravar é só pela RPC marcar_conversa_lida,
-- que confere se o card é mesmo da pessoa (revisão 28/09: com insert direto
-- liberado, dava pra encher a tabela de ids alheios e sondar se um post existe).
drop policy if exists "conversa_lida_propria" on public.conversa_lida;
create policy "conversa_lida_propria" on public.conversa_lida
  for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.conversa_lida from authenticated, anon;

-- ── 2) A caixa de entrada da agência ──────────────────────────────────────
/* Só posts da PRÓPRIA conta (p.user_id = auth.uid()): a Equipe não aparece pra
   colaborador agindo por outra agência, e filtrar pelo dono deixa a consulta
   no índice de user_id em vez de varrer todos os posts delegados do banco.
   Entra só card com pelo menos uma fala entre social mídia e parceiro: card
   sem conversa não é conversa. */
create or replace function public.conversas_com_parceiros()
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
           where c.post_id = p.id and c.author_role in ('parceiro', 'social_media')),
         /* Não lida = fala do parceiro depois do que ela já viu. "Já viu"
            conta a leitura carimbada OU a última resposta dela: quem
            respondeu pelo editor do post leu, mesmo sem abrir a caixa. */
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.author_role in ('parceiro', 'social_media')
       order by c.created_at desc
       limit 1
    ) u on true
    left join public.conversa_lida l on l.user_id = auth.uid() and l.post_id = p.id
   where p.user_id = auth.uid()
     and p.assignee_id is not null
     and p.deleted_at is null
   order by u.created_at desc
   limit 200
$$;
revoke all on function public.conversas_com_parceiros() from public, anon;
grant execute on function public.conversas_com_parceiros() to authenticated;

-- ── 3) Carimbar a leitura ─────────────────────────────────────────────────
/* Security definer pra conferir que o card é mesmo da pessoa (dona ou
   parceiro dele) antes de gravar: sem isso daria pra encher a tabela com ids
   de posts alheios. */
create or replace function public.marcar_conversa_lida(_post_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (
    select 1 from public.posts p
     where p.id = _post_id
       and (public.acts_for(p.user_id) or p.assignee_id = auth.uid())
  ) then
    return;
  end if;
  insert into public.conversa_lida (user_id, post_id, lido_em)
  values (auth.uid(), _post_id, now())
  on conflict (user_id, post_id) do update set lido_em = excluded.lido_em;
end; $$;
revoke all on function public.marcar_conversa_lida(uuid) from public, anon;
grant execute on function public.marcar_conversa_lida(uuid) to authenticated;

-- ── 4) Os avisos apontam pra Equipe ───────────────────────────────────────
-- Mesmo corpo de 20260914000004, só com o destino novo quando a peça não tem
-- cockpit de cliente.
create or replace function public.link_da_peca(_post_id uuid, _external_client_id uuid, _para_parceiro boolean)
returns text language sql stable set search_path = public as $$
  select case
    when _para_parceiro then '/socialmidia/demandas?post=' || _post_id::text
    else coalesce(
      (select '/socialmidia/clientes/' || ec.crm_client_id::text || '/posts?post=' || _post_id::text
         from public.external_clients ec
        where ec.id = _external_client_id and ec.crm_client_id is not null),
      '/socialmidia/equipe/producao?post=' || _post_id::text)
  end
$$;

-- Mesmo corpo de 20260914000004; muda só o link do aviso (e).
create or replace function public.notify_parceiro_fluxo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _agencia text; _parceiro text; _titulo text; _prazo text; _motivo text;
  _ator uuid := auth.uid();
begin
  if new.assignee_id is null and old.assignee_id is null then return new; end if;
  _titulo := coalesce(new.title, 'post');
  _prazo := case when new.prazo_producao is not null then to_char(new.prazo_producao, 'DD/MM') else null end;

  -- a) Nova demanda (ou trocou de parceiro) -> parceiro
  if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
    select coalesce(nullif(pr.name, ''), 'Uma agência') into _agencia
    from public.profiles pr where pr.id = new.user_id;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_nova',
            '🎬 Nova demanda: ' || _titulo,
            _agencia || (case when _prazo is not null then ' pediu pra ' || _prazo else ' ainda vai combinar o prazo' end)
              || (case when new.cache_parceiro is not null then ' · R$ ' || replace(to_char(new.cache_parceiro, 'FM999999990.00'), '.', ',') else '' end) || '.',
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- b) Ajuste pedido -> parceiro (com o motivo, que é o último comentário dela)
  if new.producao_status = 'ajuste' and old.producao_status is distinct from 'ajuste' and new.assignee_id is not null then
    select c.content into _motivo from public.post_approval_comments c
    where c.post_id = new.id and c.author_role = 'social_media' order by c.created_at desc limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_ajuste', '🔁 Ajuste pedido: ' || _titulo,
            coalesce('"' || left(regexp_replace(_motivo, '^Ajuste:\s*', ''), 180) || '"', 'Abra o card pra ver o que mudar.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- c) Prazo confirmado pela social mídia -> parceiro
  if new.prazo_status = 'aceito' and old.prazo_status is distinct from 'aceito'
     and new.assignee_id is not null and (_ator is null or _ator <> new.assignee_id) then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_prazo', '📅 Prazo confirmado: ' || _titulo,
            coalesce('Entrega combinada pra ' || _prazo || '.', 'Prazo fechado.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- d) Parceiro entregou -> social mídia (dona do post)
  if new.producao_status = 'entregue' and old.producao_status is distinct from 'entregue' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_entregue', '✅ ' || coalesce(_parceiro, 'Parceiro') || ' entregou: ' || _titulo,
            'Revise e aprove, ou peça ajuste.',
            public.link_da_peca(new.id, new.external_client_id, false));
  end if;

  -- e) Parceiro sugeriu outro prazo -> social mídia. Aceitar se faz na
  --    Produção da Equipe (o painel saiu do Cria Post em 28/09/2026).
  if new.prazo_status = 'negociando' and old.prazo_status is distinct from 'negociando' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_prazo', '📅 ' || coalesce(_parceiro, 'Parceiro') || ' sugeriu outro prazo: ' || _titulo,
            coalesce('Propôs ' || to_char(new.prazo_sugerido, 'DD/MM') || '. Aceite ou responda.', 'Veja a proposta na Produção da Equipe.'),
            '/socialmidia/equipe/producao?post=' || new.id::text);
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_fluxo on public.posts;
create trigger trg_parceiro_fluxo after update on public.posts
  for each row execute function public.notify_parceiro_fluxo();

-- Mesmo corpo de 20260914000004; a fala do parceiro abre a CONVERSA na Equipe,
-- que é onde a social mídia responde sem caçar o card.
create or replace function public.notify_parceiro_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare _dono uuid; _assignee uuid; _titulo text; _parceiro text; _ec uuid;
begin
  if new.author_role not in ('parceiro', 'social_media') then return new; end if;
  -- Entregas e ajustes já geram aviso próprio pelo trigger de posts.
  if new.content like 'Entrega%' or new.content like 'Ajuste:%' or new.content like 'Prazo%' then return new; end if;
  select p.user_id, p.assignee_id, p.title, p.external_client_id
    into _dono, _assignee, _titulo, _ec
  from public.posts p where p.id = new.post_id;
  if _assignee is null then return new; end if;
  if new.author_role = 'parceiro' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = _assignee and m.manager_id = _dono limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_dono, 'demanda_comentario', '💬 ' || coalesce(_parceiro, 'Parceiro') || ' comentou: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', '/socialmidia/equipe/conversas?post=' || new.post_id::text);
  else
    insert into public.notifications (user_id, type, title, description, link)
    values (_assignee, 'demanda_comentario', '💬 Comentário no card: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', public.link_da_peca(new.post_id, _ec, true));
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_comentario on public.post_approval_comments;
create trigger trg_parceiro_comentario after insert on public.post_approval_comments
  for each row execute function public.notify_parceiro_comentario();
