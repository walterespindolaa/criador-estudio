# Mapa dos Tutoriais Guiados (Tours) — CRIA

> **RODADA GESTOR: EXECUTADA em 06/08/2026.** Todos os tours do lado gestor (/socialmidia/*) foram revisados contra a tela real de hoje. Estado atual, tour a tour:
>
> | Tour | Rota | Status 06/08 | O que cobre agora |
> |---|---|---|---|
> | `gestor-dashboard` | /dashboard | revisado (ok) | 4 números + olhinho, módulos, Visão geral do mês (gh-mes), aprovações, clientes + bolinha de saúde + Continuar de onde parou |
> | `gestor-clientes` | /clientes | revisado (ok) | criar cliente, filtros usa o Cria/aprova por link, card com pendências e link |
> | `gestor-cliente-hub` | /clientes/:id | **REESCRITO (13 passos)** | hero (selos, cor única do cliente, Entrar no Cria dele), status + encerramento agendado ("Encerra em DD/MM · cancelar"), destaques, **banco de hashtags (Copiar todas + Colar hashtags no editor)**, nav por cor, subnav, kanban do cliente (cond.), **Produção: visões Kanban/Calendário + Ordem manual\|Por data (cond.)**, **quadro de 5 status + etiquetas internas + vários links de Ideia/Referência (cond.)**, **Materiais (⠿, prazo na Agenda) (cond.)**, **Relatório (funil com Publicados como número principal, comparação, destaque) (cond.)**, **Portal (personalização + Excluir do Cria Post mantém o CRM) (cond.)**, Links úteis + Drive. Navega pelas âncoras `cli-sub-*` (landing + subnav) |
> | `gestor-agenda` | /agenda | **REESCRITO (8 passos)** | quadro (⠿ + arrastar o vazio pro lado), **7 tipos de card** (criações, tarefas, captações, posts, Cria do cliente, materiais, aniversários), **filtro por cliente (cond.)**, semana/mês, **alternador Períodos (manhã/tarde/noite)**, **botão Relatório de produtividade (comparação + ranking)**, faixa Em produção recolhível (cond.), captações |
> | `gestor-aprovacoes` | /aprovacoes | revisado (ok) | 4 filas, pílulas de filtro, lista do mais novo pro mais velho |
> | `gestor-hubcria` | /hubcria | revisado (ok) | priorização de clientes, análise avulsa |
> | `gestor-criapost` | /criapost/* | ajustado | abas (Calendário geral agora cita as cores por formato), posts moram no cliente |
> | `gestor-criacrm` | /criacrm/* | ajustado | abas: **Tarefas com Kanban\|Calendário**, **Pipeline arrastando o card + rolagem lateral**, contratos; ficha pendura tudo |
> | `gestor-crm-cliente` | /criacrm/:id | revisado (ok) | hero autosave, status com data, 6 seções, brandbook com PDF |
> | `gestor-criacaixa` | /criacaixa/* | revisado (ok) | Empresa x Pessoal, abas (Visão geral, Clientes, Calendário, Mensalidades > Lançamentos, Relatórios), inativar com data |
> | `gestor-equipe` | /equipe | revisado (ok) | assentos, convite com módulos/clientes |
> | `gestor-parceria` / `gestor-contas` | back-office | revisados (ok) | fora do tour completo, como antes |
> | `gestor-lixeira` | /lixeira | **NOVO** | mesma tela do criador, rota própria do gestor (o "?" dizia "em breve"); passo da lista é condicional |
>
> Âncoras `data-tour` novas desta rodada: `ag-relatorio` e `ag-cliente-filtro` (AgendaCriacao), `cli-sub-<sub>` nas pílulas do subnav e nos cards da landing do ClienteHub (posts, cronograma, relatorio, materiais, portal…), `prod-ferramentas` + `prod-quadro` + `rel-card` (CriaPostBoard), `mat-quadro` (MateriaisBoard), `cli-hashtags` (ClientHashtags), `portal-config` (ClientePortalTab). `ag-periodos` (já existia) agora tem passo. Zero alvo órfão nos tours do gestor (checagem cruzada alvo x JSX), zero travessão. `gestor-lixeira` fica fora do TRAINING_SEQUENCES (back-office, igual parceria/contas).

> **STATUS: EXECUTADO em 30/07/2026.** Todo o plano abaixo (blocos B, C-ALTA, C-MÉDIA e C-BAIXA) foi implementado. O documento fica como histórico do diagnóstico e como referência da arquitetura. Resumo do que ficou: 37 tours (13 gestor + 24 criador), zero alvo órfão (checagem cruzada alvo x `data-tour` no JSX), zero travessão.
>
> Mecanismos novos no `registry.ts` criados nessa rodada:
> - `routePattern`: permite `route` com segmento `:id` (casa por segmento, e o curinga precisa parecer id). É como o tour do cockpit (`/socialmidia/clientes/:id`) e o da ficha do CRM (`/socialmidia/criacrm/:id`) são encontrados.
> - `pareceId()` no match por `routePrefix`: impede que uma rota com id herde o tour do módulo pai (era o vazamento do item B.3).
>
> Tours sem rota própria (painel/modal) seguem o padrão do editor de post: a `route` é um marcador que nunca casa e o tour abre por um "?" na própria UI (`startTour(id)`). É o caso do `cria-ia`.
>
> Não foi criado tour pro widget de Feedback: é um Dialog global sem rota, e o botão de anexar já é autoexplicativo.

Como funciona: tours são config-driven. Arquivos: `src/lib/tours/registry.ts` (tipos, lista `TOURS`, `findTourByRoute`, `TRAINING_SEQUENCES`), `src/lib/tours/criador.ts` (`/app/*`), `src/lib/tours/gestor.ts` (`/socialmidia/*`). O botão "?" é `src/components/tour/HelpButton.tsx`; o motor é `src/components/tour/TourProvider.tsx` (`useTour`). Cada passo aponta pra um `[data-tour="chave"]` na tela. Pra criar tour novo: adicionar um `TourConfig` (rota + steps) no arquivo da área, marcar os `data-tour` nos elementos, e (se quiser no tour completo) incluir o id em `TRAINING_SEQUENCES`.

Saúde geral: boa. Zero passos quebrados (todos os alvos existem). Ajustes são de texto/fluxo + telas novas sem tour.

---

## A) MANTER (ok como está)

Área do criador (`/app/*`), todos com alvo presente e texto coerente: dashboard, ideias, criando, post-editor (o mais bem cuidado, já refatorado com o Estúdio virando aba Arte), tarefas, metas, stories, tendências, feed, aprovação, brandbook (parcial), linkinbio, media-kit, biblioteca, collabs, histórico, insights, configurações, autopilot (Cria Plano), prompter, relatórios, lixeira, módulos.

Área do gestor: gestor-clientes, gestor-agenda (base), gestor-hubcria (Cria Radar), gestor-criapost, gestor-equipe.

---

## B) AJUSTAR (tour existe, texto/fluxo desatualizou)

1. **Cria Caixa** (`gestor-criacaixa`, passo `hero-tabs`) — PRIORIDADE. Texto fala de "Lançamentos" e "Recorrentes" como abas, mas a tela mudou: abas são Visão geral, Mensalidades (com Lançamentos como sub-aba), Calendário, Clientes, Relatórios. Reescrever o passo; mencionar "inativar cliente com data" se quiser cobrir.

2. **Home do gestor / copiloto** (`gestor-dashboard`) — enriquecer. Alvos ok, mas não menciona 3 coisas novas: o "olhinho" (ocultar/mostrar valores), o painel "Visão geral do mês" (produção por status) e a bolinha de saúde do cliente + "Continuar de onde parou". Sugestão: +1 passo pra "Visão geral do mês" e frases nos passos de números e clientes.

3. **Vazamento de rota do CRM** (`gestor-criacrm` com `routePrefix: true`) — a rota `/criacrm/:id` (ficha do cliente, outra tela) herda o tour errado do CRM. Tirar o `routePrefix` (listar as sub-rotas exatas) ou fazer o `findTourByRoute` ignorar segmentos que parecem id. Conferir também se `CriaCrm` ainda é usado ou foi substituído pelo cockpit.

4. **Agenda** (`gestor-agenda`) — baixa. Ganhou filtros, faixa "Em produção" e cards "Cria do cliente", nada disso é coberto. Avaliar +1 passo (precisa marcar `data-tour` nesses elementos).

5. **Ideias > Salvos** (`ideias-salvos`) — baixa. A aba foi repaginada (salvar link, pasta, recuperar capas). Alvo existe, só o texto está aquém.

---

## C) CRIAR (telas/features novas SEM tour)

### ALTA
1. **Cockpit do cliente (`ClienteHub`)** — o maior buraco. Tela central e mais reformada, SEM tour e SEM nenhum `data-tour`. Navegação em 2 níveis: Visão geral, Cria Post (Produção/Cronograma/**Kanban do cliente**/Relatório/Materiais/Portal), Cria Gestão (brandbook), Cria Caixa (financeiro do cliente), Cria Radar, Instagram, **Links úteis + Drive**. Tour deveria cobrir: abas por cor = módulos; fluxo Ideias→Cronograma→Posts→Relatório; o Kanban do cliente (sincronizado ao vivo); Links úteis + pastas do Drive; inativar cliente com data. Precisa de tour novo + `data-tour` nos anchors + tratamento da rota `:id` (hoje excluída; talvez um tour acionado manual pelo "?").

### MÉDIA
2. **Aprovações agregada (`/socialmidia/aprovacoes`)** — linkada do dashboard, sem tour próprio. Tour curto do funil de todos os clientes.
3. **Brandbook — importar PDF (`/app/brandbook`)** — tour só tem 1 passo; a importação de PDF (recurso novo, distribui nas seções) não é apontada. +1 passo (marcar `data-tour` no botão importar).
4. **Ficha do cliente no CRM (`CriaCrmClient`)** — se ainda em uso, sem tour próprio e hoje pega o tour errado por vazamento de prefixo (ver B.3).

### BAIXA
5. Feedback com anexo (widget global), Cria IA (cota/tom), back-office (Parceria/Comissões/Contas).

### Anchors órfãos (dá pra aproveitar)
- `data-tour="dash-instagram"` existe no Dashboard mas nenhum passo usa — bom pra um passo de conectar Instagram.
- `data-tour="estudio-procedencia"` no ArtStudio não é referenciado por nenhum passo.

---

## Onde mexer quando for implementar
`src/lib/tours/gestor.ts`, `src/lib/tours/criador.ts`, `src/lib/tours/registry.ts` (TRAINING_SEQUENCES + rota `:id`), e marcar `data-tour` novos em `src/pages/socialmidia/ClienteHub.tsx`, `src/pages/socialmidia/Aprovacoes.tsx`, `src/pages/app/Brandbook.tsx`.
