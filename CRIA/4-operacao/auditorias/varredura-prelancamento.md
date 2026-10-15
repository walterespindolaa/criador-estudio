# Varredura pré-lançamento — CRIA

Data: 24/07/2026. Escopo: bugs funcionais, mobile/UX, segurança/dados, performance/escala. Só mapeamento (nada foi alterado). Prioridade sugerida: resolver os **BLOQUEADORES** antes de lançar, depois Alto, depois o resto conforme fôlego.

Nota boa: o núcleo do app está maduro (mutations com rollback, RLS por conta, bundle com lazy-load, defesas mobile já aplicadas). Os riscos reais estão concentrados em poucos pontos, a maioria barata de corrigir.

---

## BLOQUEADORES DE LANÇAMENTO

### Funcionais

**B1. Kanban: erro de salvamento passa despercebido + confete falso**
`src/hooks/usePosts.ts:109-111`, `src/hooks/useCriaPost.ts:332-335` (reorderExternalPosts), `src/pages/app/Criando.tsx:294-301`.
O update otimista usa `Promise.all(...).catch()`, mas o Supabase resolve a promise mesmo em erro (devolve `{error}`, não rejeita). Resultado: se o save falhar (RLS/rede), o card fica movido na tela, o banco não persiste, e no próximo refetch ele "pula de volta" sem aviso. Pior: ao arrastar pra "Publicado", o confete e o log "post_published" disparam mesmo se o save falhou. Corrigir: checar o `error` de cada update, reverter + toast em falha, e só comemorar após confirmação.

**B2. Datas gravadas no fuso errado (toISOString)**
Vários pontos gravam data com `toISOString().split/slice`, que no Brasil (UTC-3) após ~21h já vira o dia seguinte:
`PipelineBoard.tsx:94` (closed_date do contrato), `ContractsTab.tsx:127-131`, `ContractGeneratorDialog.tsx:14`, `FinTransferDialog.tsx:12` (transferência PJ→PF), `useHubCria.ts:329` (scheduled_date de posts por ideia). Sintoma: contrato "fechado hoje" à noite vira amanhã; lançamento no dia errado. Corrigir: usar os helpers de `src/lib/date-br.ts`.

### Segurança (VERIFICAR NO BANCO — objetos criados pelo Lovable, fora das migrations)

**B3. Token de aprovação pública: confirmar entropia**
`useCriaPost.ts:156` insere em `approval_tokens` sem passar `token` (vem de um DEFAULT do banco não versionado). TODO o portal público depende da imprevisibilidade desse token. Se o default não for aleatório forte (ex.: `gen_random_uuid()`), dá pra enumerar e ler/alterar posts de qualquer cliente. Ação: confirmar no banco que o default é aleatório (>=122 bits) e versionar o DDL.

**B4. RLS de `post_approval_comments`: confirmar**
`useApprovals.ts:101,113` e `useCriaPost.ts:191,363` leem/escrevem direto nessa tabela pelo client. Não existe RLS versionada pra ela. Se a policy do dashboard estiver ausente ou `using(true)`, qualquer usuário logado pode ler feedback de clientes de outra agência e inserir comentários forjados. Ação: confirmar policy de select/insert amarrada ao dono do post; versionar.

**B5. RPCs de escrita do portal fora do repo**
`approve_post_by_token`, `request_adjustment_by_token`, `get_external_client_by_token`, `portal_mark_viewed`, `has_module` não estão nas migrations. São o caminho de escrita público (mudam status dos posts). Ação: exportar do banco e confirmar `SECURITY DEFINER` + `set search_path` + checagem de `active`/`expires_at` do token.

### Performance

**B6. Faltam índices nas colunas quentes (o mais barato e mais impactante)**
Só há 16 índices no projeto e nenhum cobre as FKs/colunas mais filtradas: `posts.external_client_id`, `posts.scheduled_date`, `posts(user_id, approval_status)`, `external_media_refs.post_id`, `fin_records.manager_id`, `crm_*.manager_id`, `post_approval_comments.post_id`. Como RLS e queries filtram exatamente por elas, cada leitura vira seq scan e degrada com o uso. Corrigir: criar índices btree (e compostos p/ `posts(external_client_id, approval_status)` e `posts(user_id, scheduled_date)`).

**B7. Board de posts puxa tudo com refetch agressivo**
`useCriaPost.ts:175-185` e `:346-356`: `select("*")` sem limite/paginação + `staleTime:0, refetchOnMount:"always", refetchOnWindowFocus:true`. Cada montagem e cada foco de janela re-baixa todos os posts com todas as colunas de texto. Trava/lag no kanban com centenas de posts, pior no mobile. Corrigir: selecionar só colunas do card, limitar por status/janela, relaxar o refetch.

**B8. Home copiloto carrega 3-4 tabelas inteiras a cada visita**
`useOperationSignals.ts:42-46` junta todos os posts (`select("*")`), todos os clientes CRM, clientes externos e o extrato financeiro completo. A tela inicial fica mais lenta conforme a conta acumula histórico. Corrigir: agregar no banco (RPC/view) ou limitar à janela relevante (ex.: 60 dias + pendentes).

---

## ALTO (logo após os bloqueadores)

**A1. Sync do Instagram diz "atualizados!" com token expirado**
`useSocialInsights.ts:226-240`. A edge devolve `reconnect:true` quando o token da conta própria expirou, mas o front ignora e mostra sucesso. Usuário segue com dados velhos. Corrigir: tratar `data.reconnect` com toast de reconexão.

**A2. Saldo de créditos do HUB engole erro e libera gasto pago**
`useHubCria.ts:289-293` + `CriativoTab.tsx:182-186,589-596`. Falha ao ler a cota retorna `{used:0,quota:0}`, e como a trava só age com `quota>0`, uma falha transitória libera análises pagas do Apify sem limite. Corrigir: distinguir "sem cota" de "falha ao ler cota"; em falha, não liberar.

**A3. Token de proposta de collab com entropia fraca**
`useCollabs.ts:190`: `slugify(marca)-` + 8 hex (~32 bits) e prefixo adivinhável. As RPCs são `grant to anon`. Quem sabe o nome da marca consegue brute force e ler/aceitar/recusar proposta no lugar do criador. Corrigir: `crypto.randomUUID()` inteiro, sem prefixo.

**A4. member_read_profile expõe dados financeiros a colaboradores**
`20260722000004:51-53`: colaborador consegue `select *` no profile do dono (inclui stripe_customer_id, stripe_subscription_id, pix_key). Corrigir: view/RPC devolvendo só nome/avatar.

---

## MÉDIO

**M1. Lançamento financeiro salva com R$ 0** — `CriaCaixa.tsx:1037-1038` só valida descrição; amount cai pra 0. Bloquear `<= 0`.
**M2. addCategory/addSubcategory pode apagar dados do perfil** — `CriaCaixa.tsx:298-320`: se profile ainda não carregou, grava null por cima de nome/CNPJ/razão. Bloquear enquanto `!profile`.
**M3. Mensalidade "vence hoje" vira "atrasada" à noite** — `CriaCaixa.tsx:132` (todayISO por toISOString) usado em 254/491/1196/1297. Usar `hojeBR()`.
**M4. Filtro de data do Estúdio com off-by-one** — `Criando.tsx:383,387,546,550`. Usar `date-br.ts`.
**M5. Poll do scrape ignora erro e trava 4 min** — `useHubCria.ts:254-260`. Checar `error` e abortar cedo.
**M6. Dropdown "Links úteis" do cabeçalho vaza pra fora da tela no mobile** — `ClienteHub.tsx:640` (`right-0 w-[260px]` ancorado na ponta esquerda). Copiar o padrão do dropdown de Cor (`left-0` + `max-w-[calc(100vw-3rem)]`).
**M7. Teclado do iOS cobre o "Salvar" em formulários centralizados** — dialogs centralizados (`dialog.tsx:55-56`) em Caixa/Agenda/Novo cliente. Ancorar no topo no mobile (`top-4 translate-y-0 max-h-[90dvh]`).
**M8. social_connections.access_token legível pelo dono no client** — `20260618000002:12`. Mover leitura do token só pra service_role.
**M9. Listas grandes sem virtualização** — kanban, calendário mensal, grids de mídia renderizam item a item; trava no mobile com muitos itens. Virtualizar as listas longas.
**M10. Queries de CRM/financeiro/insights sem LIMIT + invalidations amplas** — `useCrm.ts`, `useFinance.ts`, `useSocialInsights.ts`. Paginar/limitar e incluir `agencyOwnerId` nas keys de invalidação.

---

## BAIXO / refinamentos

- Alvos de toque < 40px em ações reais (check de tarefa da Agenda `AgendaCriacao.tsx:618` é o mais crítico, convive com o drag).
- Abas horizontais sem pista de que rolam (`ClienteHub.tsx:358`): fade/seta na borda.
- "Sua operação hoje" perde a seta de ação no mobile (`ManagerHome.tsx:469`): manter a ChevronRight.
- `useSyncCrmFromCria` sem onError (`useCrm.ts:154`): falha em silêncio.
- Conversão lead→cliente com `catch {}` esconde estado parcial (`PipelineBoard.tsx:98`).
- Tokens de cronograma sem expiração/revogação; `get_token_period` checa só `active`, não `expires_at`.
- CORS libera qualquer `*.lovable.app`; rate-limit compartilhado falha aberto em endpoints públicos.
- PostEditor.tsx (2595 linhas) e PostDrawerLegacy pouco memoizados: re-renders custosos.

---

## Suspeitas a confirmar
- Status de cliente fora do enum atual pode derrubar tela (`CriaCrmClient.tsx:279`, `ClienteHub.tsx:307` usam `?? "ativo"`, não `?.cls`). Confirmar se o banco tem status legado.
- meta-capi / bio-track (públicas): confirmar rate-limit efetivo e que não logam segredos.
- Catálogos com `using(true)` (courses, content_trends, cria_stories): confirmar que não têm dado por-tenant.

## O que já está bom (não requer ação)
Mutations principais com rollback + onError; RLS por conta nas tabelas pessoais; edge admin/manager validando getUser()+posse; crons com segredo; buckets sensíveis fechados; DOMPurify aplicado; bundle com lazy-load e PDF sob demanda; defesas mobile de base (font 16px, safe-area, date/time do Safari, drag touch).
