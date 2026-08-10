-- ============================================================
-- F22: permissao de colaborador tem que valer NO BANCO, nao so no React.
--
-- O problema: as tabelas da agencia (crm_*, external_clients, agenda_*,
-- creative_ideas, competitor_scrapes, client_materials, tags, posts de time)
-- usavam a policy de time `acts_for(manager_id)`, que e true pra QUALQUER
-- colaborador ATIVO, ignorando manager_member_permissions (modulos e client_ids
-- por colaborador). O ModuleGate do front era so cosmetico: quem chamasse o
-- supabase direto (ou trocasse a rota na mao) via a agencia INTEIRA.
--
-- A correcao segue EXATAMENTE o padrao ja em producao do Cria Caixa
-- (has_member_module / fin_module_gate): dono do tenant passa sempre; o
-- colaborador so passa se o gestor liberou o modulo daquela tabela pra ele.
--
-- SEMANTICA DE "SEM PERMISSAO CONFIGURADA" (confirmado no codigo):
--   - O convite (manager-member-invite) SEMPRE grava uma linha de permissao
--     por modulo liberado (default = cria_post, cria_gestao, hub_cria, agenda),
--     com all_clients = true.
--   - A UI (useSetMemberModule) grava all_clients=true ao ligar um modulo e
--     APAGA a linha ao desligar.
--   Logo: linha AUSENTE = modulo NAO liberado = negar (mesma regra do Caixa).
--   NAO existe a semantica "vazio = tudo liberado" neste projeto.
--   Como todo colaborador convidado pelo fluxo normal ja tem os 4 modulos com
--   all_clients=true, esta migration e NO-OP pra eles: so passa a NEGAR quando o
--   gestor DESLIGOU explicitamente um modulo (que e o furo que estamos fechando).
--
-- ESCOPO POR CLIENTE (client_ids): como hoje todo colaborador esta com
-- all_clients=true, o gate por cliente e um no-op na pratica e so aperta o caso
-- (raro) de um colaborador escopado a client_ids especificos. Aplicamos onde a
-- coluna crm_client_id existe de forma limpa. Onde a coluna do cliente nao e
-- clara (crm_tasks/crm_contracts/crm_client_refs: schema vive so no banco),
-- ficamos no gate por MODULO, que ja e o ganho de seguranca principal. Preferir
-- AMPLIAR na duvida a NEGAR: nunca escondemos linha de quem tem o modulo.
--
-- Aditiva e idempotente: as policies de DONO (manager_id = auth.uid()) que
-- existem em varias tabelas continuam; aqui so trocamos as policies `_team`.
-- ============================================================

-- ── Helpers ────────────────────────────────────────────────────────────────
-- member_can: dono do tenant OU colaborador ativo COM o modulo liberado.
-- (Mesma logica de has_member_module; nome novo pedido no fechamento do F22.)
create or replace function public.member_can(_manager uuid, _code text)
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
          and perm.module_code = _code
      );
$$;
grant execute on function public.member_can(uuid, text) to authenticated;

-- member_can_client: idem, e ainda respeita o escopo por cliente (client_ids).
-- Null-safe: _client null (linha sem cliente amarrado) NAO bloqueia, cai no gate
-- de modulo. all_clients=true libera todos os clientes. So aperta quando o
-- colaborador foi escopado a uma lista e a linha e de outro cliente.
create or replace function public.member_can_client(_manager uuid, _client uuid, _code text)
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
          and perm.module_code = _code
          and (
            coalesce(perm.all_clients, false) = true
            or _client is null
            or _client = any(perm.client_ids)
          )
      );
$$;
grant execute on function public.member_can_client(uuid, uuid, text) to authenticated;

-- ── Gate por MODULO (member_can) nas tabelas manager_id-keyed ───────────────
-- Cada tabela vai pro modulo que o menu/entitlement chama:
--   cria_gestao -> CRM (clientes, leads, contratos, tarefas, refs, notas, tags)
--   cria_post   -> posts de cliente, aprovacao, etiquetas de post
--   hub_cria    -> analises de concorrente e ideias
--   agenda      -> agenda de criacao
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('crm_leads',        'cria_gestao'),
      ('crm_contracts',    'cria_gestao'),
      ('crm_tasks',        'cria_gestao'),
      ('crm_client_refs',  'cria_gestao'),
      ('agenda_creations', 'agenda'),
      ('agenda_captures',  'agenda')
    ) as t(tbl, code)
  loop
    execute format('alter table public.%I enable row level security;', rec.tbl);
    execute format('drop policy if exists %I on public.%I;', rec.tbl||'_team', rec.tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.member_can(manager_id, %L)) with check (public.member_can(manager_id, %L));',
      rec.tbl||'_team', rec.tbl, rec.code, rec.code
    );
  end loop;
end $$;

-- crm_tags: catalogo de etiquetas de CLIENTE -> cria_gestao
drop policy if exists "crm_tags_team" on public.crm_tags;
create policy "crm_tags_team" on public.crm_tags
  for all to authenticated
  using (public.member_can(manager_id, 'cria_gestao'))
  with check (public.member_can(manager_id, 'cria_gestao'));

-- post_tags: catalogo de etiquetas INTERNAS de post -> cria_post
drop policy if exists "post_tags_team" on public.post_tags;
create policy "post_tags_team" on public.post_tags
  for all to authenticated
  using (public.member_can(manager_id, 'cria_post'))
  with check (public.member_can(manager_id, 'cria_post'));

-- external_clients: e a ficha do cliente externo, usada TANTO pela gestao
-- (CRM) QUANTO pelo Cria Post. Um colaborador so-de-post precisa dela pra
-- montar/enviar os posts. Por isso liberamos com gestao OU post (nunca menos
-- que hoje pra quem tem qualquer um dos dois).
drop policy if exists "external_clients_team" on public.external_clients;
create policy "external_clients_team" on public.external_clients
  for all to authenticated
  using (public.member_can(manager_id, 'cria_gestao') or public.member_can(manager_id, 'cria_post'))
  with check (public.member_can(manager_id, 'cria_gestao') or public.member_can(manager_id, 'cria_post'));

-- approval_tokens: pertencem ao fluxo de aprovacao do Cria Post.
drop policy if exists "approval_tokens_team" on public.approval_tokens;
create policy "approval_tokens_team" on public.approval_tokens for all to authenticated
  using (public.member_can(manager_id, 'cria_post'))
  with check (public.member_can(manager_id, 'cria_post'));

-- posts de time (cliente externo): so o colaborador com cria_post toca.
-- posts.user_id E o gestor (dono do tenant), entao member_can(user_id,...)
-- deixa o dono passar (user_id = auth.uid()) e o colaborador so com o modulo.
drop policy if exists "posts_team_external" on public.posts;
create policy "posts_team_external" on public.posts for all to authenticated
  using (external_client_id is not null and public.member_can(user_id, 'cria_post'))
  with check (external_client_id is not null and public.member_can(user_id, 'cria_post'));

-- ── Gate por MODULO + CLIENTE (member_can_client) onde ha crm_client_id ─────

-- crm_clients: a propria linha e o cliente (id). cria_gestao.
drop policy if exists "crm_clients_team" on public.crm_clients;
create policy "crm_clients_team" on public.crm_clients for all to authenticated
  using (public.member_can_client(manager_id, id, 'cria_gestao'))
  with check (public.member_can_client(manager_id, id, 'cria_gestao'));

-- crm_saved_refs: referencias que a social midia salva DENTRO de um cliente.
drop policy if exists crm_saved_refs_owner on public.crm_saved_refs;
create policy crm_saved_refs_owner on public.crm_saved_refs for all to authenticated
  using (public.member_can_client(manager_id, crm_client_id, 'cria_gestao'))
  with check (public.member_can_client(manager_id, crm_client_id, 'cria_gestao'));

-- crm_client_notes: notas por cliente. cria_gestao.
drop policy if exists "crm_client_notes_team" on public.crm_client_notes;
create policy "crm_client_notes_team" on public.crm_client_notes for all to authenticated
  using (public.member_can_client(manager_id, crm_client_id, 'cria_gestao'))
  with check (public.member_can_client(manager_id, crm_client_id, 'cria_gestao'));

-- creative_ideas: banco de ideias por cliente. hub_cria.
drop policy if exists "creative_ideas_team" on public.creative_ideas;
create policy "creative_ideas_team" on public.creative_ideas for all to authenticated
  using (public.member_can_client(manager_id, crm_client_id, 'hub_cria'))
  with check (public.member_can_client(manager_id, crm_client_id, 'hub_cria'));

-- competitor_scrapes: analises por cliente. hub_cria.
drop policy if exists "competitor_scrapes_team" on public.competitor_scrapes;
create policy "competitor_scrapes_team" on public.competitor_scrapes for all to authenticated
  using (public.member_can_client(manager_id, crm_client_id, 'hub_cria'))
  with check (public.member_can_client(manager_id, crm_client_id, 'hub_cria'));

-- client_materials: materiais por cliente. Usado no cockpit do cliente E na
-- producao de post -> libera com gestao OU post (mesma logica do external_clients).
drop policy if exists "client_materials_team" on public.client_materials;
create policy "client_materials_team" on public.client_materials for all to authenticated
  using (
    public.member_can_client(manager_id, crm_client_id, 'cria_gestao')
    or public.member_can_client(manager_id, crm_client_id, 'cria_post')
  )
  with check (
    public.member_can_client(manager_id, crm_client_id, 'cria_gestao')
    or public.member_can_client(manager_id, crm_client_id, 'cria_post')
  );

-- Observacao (documentada na entrega): crm_tasks / crm_contracts /
-- crm_client_refs ficaram no gate por MODULO (cria_gestao) e nao por cliente,
-- porque o schema dessas tabelas nao esta no repositorio (vive so no banco
-- Lovable). Como todo colaborador atual esta com all_clients=true, isso NAO
-- muda o comportamento de ninguem; o escopo por cliente dessas tabelas fica pra
-- uma fase 2 com o schema em maos. As RPCs security definer do switcher de
-- conta (my_team_accounts, my_managed_accounts) continuam em acts_for de
-- proposito: entrar no tenant nao e especifico de modulo.
