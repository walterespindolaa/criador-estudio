# Plano — Publicação automática, Inbox e Multi-plataforma (CRIA)

> Aposta grande. Diferente das outras features, depende de **APIs externas e review/auditoria de cada plataforma**. Por isso aqui é plano de escopo + ordem de execução, não código pronto.

## Princípio
Construir **uma fundação reutilizável** uma vez só e depois "plugar" cada plataforma. Aproveita o que o CRIA já tem: `scheduled_date`/`scheduled_time` nos posts, mídia no Arquivos/Drive, e o padrão de **edge function + pg_cron** que já usamos no robô diário e no push.

---

## Fase 0 — Fundação (independe de plataforma)
Feito uma vez, serve pra todas.

- **Tabela `social_connections`** — por conta/cliente e por plataforma: tokens (access + refresh, **criptografados**), expiração, status, escopos concedidos.
- **Tela "Conectar contas"** — OAuth de cada rede; mostra o que está conectado e permite reconectar.
- **Fila de publicação** — estados do post: `rascunho → agendado → publicando → publicado / erro` (com mensagem de erro e botão "tentar de novo").
- **Publicador agendado** — edge function disparada por `pg_cron` (a cada ~5 min) que pega os posts "agendados" cujo horário chegou e chama a API da plataforma. Mesmo padrão do robô diário.
- **Refresh de token** + tratamento de rate limit/erros + retry.

Esforço: médio-alto. **É o maior trabalho, mas único.**

---

## Fase 1 — Instagram: publicação automática ⭐ (começar por aqui)
Maior valor e **já estamos no review da Meta** (negócio verificado + 2 permissões de insights em análise).

- Permissão nova: **`instagram_business_content_publish`** (review próprio, 2–4 semanas, reprovação na 1ª é comum).
- Fluxo de 2 passos: cria container (`/media`) → publica (`/media_publish`).
- Começar por **feed (foto/carrossel) + Reels**; Stories depois.
- Requisito: conta Business/Creator ligada a uma Página do Facebook (a pessoa já tem no fluxo do CRIA).

Esforço: médio (a fundação já existe). Dependência: aprovação da Meta.

---

## Fase 2 — Instagram: Inbox (DMs + comentários)
O "inbox unificado" que mLabs/Metricool têm — começando só pelo Instagram (é o viável).

- Permissões: **`instagram_manage_messages`** (DMs) + **`instagram_manage_comments`** (comentários).
- UI de inbox: threads, **janela de 24h** pra responder, respostas rápidas, moderar/responder comentários.
- Usa **webhooks** da Meta pra receber mensagens em tempo real.

Esforço: médio-alto. Dependência: review da Meta (cada permissão é uma submissão).

---

## Fase 3 — Threads
Add-on barato depois que o encanamento da Meta existe (mesmo ecossistema). Publicação de texto/mídia.

Esforço: baixo (reaproveita Meta).

---

## Fase 4 — TikTok
Content Posting API.

- **Sem auditoria:** só 5 usuários/24h, contas **privadas**, conteúdo só `SELF_ONLY` (não fica público sozinho).
- **Com auditoria:** libera publicação pública. É um processo à parte (compliance + ToS).
- Caps de posts por criador/24h.

Esforço: médio. Estratégia: lançar em modo teste → submeter auditoria pra liberar público.

---

## Fase 5 — Pinterest
API **gratuita**. Começa em Trial (sandbox, só o dono vê) → pedir upgrade pra Standard no painel. Bom pra nichos visuais (gastronomia, moda, decoração).

Esforço: baixo-médio.

---

## Adiar / talvez não valha
- **LinkedIn** — exige LinkedIn Partner Program; a Community Management API (tier Standard) **rejeita "agendadores genéricos"** e parceria custa caro (US$ 10k–50k+/ano). Só se houver demanda forte de clientes B2B.
- **YouTube (upload)** — cota baixa (cada upload custa muito da cota diária); inviável em escala sem aumento de cota. Avaliar caso a caso.

---

## Recomendação de ordem
1. **Fase 0 + Fase 1** assim que a Meta aprovar — maior ROI, aproveita o review em andamento, é a paridade nº1 com os concorrentes.
2. **Fase 2** (Inbox IG) — diferencia forte.
3. **Fase 3 (Threads)** e **Fase 5 (Pinterest)** — adds baratos.
4. **Fase 4 (TikTok)** quando valer a auditoria.
5. LinkedIn/YouTube só sob demanda.

## Riscos / pré-requisitos
- Segurança dos tokens (criptografia + RLS apertada).
- Cada plataforma = um app + review/auditoria próprios e prazos próprios.
- Auto-publish exige a mídia já no post (o CRIA já tem isso via Arquivos/Drive).
- Rate limits e tratamento de falha (retry, avisar o usuário, push de "deu erro ao publicar").

## Fontes
- Instagram Graph API 2026 (publicação + mensagens): https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/ , https://postproxy.dev/blog/post-to-instagram-via-api/
- TikTok Content Posting API (auditoria): https://developers.tiktok.com/doc/content-posting-api-get-started , https://www.postpeer.dev/blog/best-tiktok-posting-api
- LinkedIn / Pinterest / YouTube (acesso 2026): https://zernio.com/blog/linkedin-posting-api , https://www.blotato.com/blog/pinterest-api-pricing
