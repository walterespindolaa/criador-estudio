# Mapa dos Tutoriais Guiados (Tours) — CRIA

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
