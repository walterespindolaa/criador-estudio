# Fase C · Operação (o que só você consegue fazer)

Quatro verificações que nenhum código substitui. Cada uma tem "como fazer", "o que esperar" e "o que fazer se falhar". Marque a data ao lado de cada uma quando concluir.

## 1. Sentry está recebendo? (10 min) · feito em: ____

O Sentry agora carrega na ociosidade (não no primeiro paint). Precisa provar que continua chegando.

Como:
1. Abra o app em produção, logado, e deixe 5 segundos na tela.
2. No console do navegador (F12 > Console) cole e dê Enter:
   `setTimeout(() => { throw new Error("teste sentry " + Date.now()) }, 100)`
3. Abra sentry.io > projeto > Issues. Em até 2 minutos deve aparecer "teste sentry ...".

Se não aparecer:
- Confira se `VITE_SENTRY_DSN` está no Lovable (Settings > Environment). Sem ele, o código usa o DSN padrão que está em `src/lib/sentry.ts`; confira se é o do seu projeto.
- Confira no Sentry se o projeto está com "Inbound filters" bloqueando localhost/erros de browser.
- Me manda o print da aba Network filtrando por "sentry" (F12 > Network).

## 2. Relatório de saúde chegando por e-mail (1 dia) · feito em: ____

A partir do próximo deploy do `daily-health-report`, ele manda e-mail pro admin quando há erro nas últimas 24 h e toda segunda como confirmação.

Como forçar um teste hoje, sem esperar:
1. Supabase > Edge Functions > daily-health-report > Invoke. Header: `x-internal-secret` com o valor do `INTERNAL_PUSH_SECRET`. Body: `{}`.
2. A resposta mostra `saudavel`, `nErro`, `problemas`.
3. Se `saudavel: false`, o e-mail vai pra fila `transactional_emails` e o `process-email-queue` entrega em até 5 min. Confira a caixa do e-mail do seu perfil admin.
4. Se `saudavel: true` e não for segunda, não manda e-mail (correto). Pra ver o e-mail assim mesmo, gere um erro (item 1) e invoque de novo.

Se não chegar:
- Supabase > SQL: `select * from pgmq.q_transactional_emails order by enqueued_at desc limit 5;` mostra se enfileirou.
- `select job, last_run_at, ok, detail from cron_runs;` mostra se o process-email-queue rodou.

## 3. Teste de restore do backup (40 min, uma vez) · feito em: ____

Nunca foi feito. Robustez não passa de 8 sem isso. A ideia não é restaurar em produção: é provar que dá pra voltar.

Como (Supabase Pro tem backup diário; Lovable Cloud idem):
1. Supabase > Database > Backups. Confira que existe backup das últimas 24 h. Anote a hora.
2. Crie um projeto novo, vazio, no mesmo org (nome "cria-restore-teste"). Não precisa de plano pago pra testar.
3. No projeto de produção: Database > Backups > no backup mais recente, "Download" (arquivo .backup ou .sql). Se o botão não existir no seu plano, use o Supabase CLI: `supabase db dump --linked -f prod.sql` (com o CLI logado no projeto de produção).
4. No projeto de teste: SQL Editor > cole o dump (ou `psql` com a connection string do projeto teste: `psql "postgres://..." -f prod.sql`).
5. Confira três coisas no projeto de teste: `select count(*) from profiles;` bate com produção; `select count(*) from posts;` bate; abre uma ficha de cliente qualquer via SQL e os campos estão lá.
6. Apague o projeto de teste.

Anote: quanto tempo levou do passo 3 ao 5. Esse número é o seu "tempo de volta" se um dia precisar. Se passou de 1 h, me avisa que eu escrevo um script de restore.

Se o download/dump falhar: me manda a mensagem de erro exata. Storage (imagens no bucket) não entra nesse teste; ele fica no Supabase Storage e no Bunny, que têm redundância própria.

## 4. Um mês de Stripe de verdade (30 dias) · feito em: ____

O código do faturamento foi corrigido em 8 pontos nesta semana. Só produção prova. Com pelo menos 5 assinaturas reais, confira uma vez por semana:

Semana 1:
- Alguém assinou pela LP sem conta e depois criou conta: o plano ativou sozinho? (`claim-purchase`)
- Alguém assinou logado: o plano ativou na hora e `profiles.subscription_status = 'active'`?

Semana 2:
- Troque o plano de uma conta de teste sua (Pro > Studio) em /app/assinar: no Stripe deve aparecer UMA assinatura, atualizada, com proração. Se aparecerem duas, me avisa: é o bug antigo voltando.
- Compre um módulo numa conta de agência de teste e cancele; compre de novo. Tem que ativar as duas vezes.

Semana 3:
- No Stripe, use um cartão de teste que falha (se estiver em modo teste) ou aguarde uma falha real. Confira: e-mail "não conseguimos cobrar" chegou; o acesso continuou; `invoice.payment_failed` apareceu em Webhooks > Events com 200.
- Cancele uma assinatura de teste: e-mail de cancelamento chegou; `subscription_status = 'canceled'`.

Semana 4:
- Stripe > Developers > Webhooks > endpoint do Cria: taxa de sucesso. Qualquer evento com erro (não-200) 3 vezes seguidas: me manda o `event.id`.
- Admin > Logs: filtra por `edge:stripe-webhook`. Deve estar vazio.

## 5. Opcional: pentest externo (leva Segurança de 9 pra 9,5)

Quando tiver 50+ contas pagantes. Serviços como Cobalt, Intigriti ou um freelancer de segurança sênior (R$ 3 a 8 mil por um teste de 1 semana). O que pedir: RLS do Supabase, edge functions, páginas públicas por token, fluxo do Stripe. O relatório do pente fino (`pente-fino-pre-lancamento-2026-09-23.md`) é o ponto de partida deles.
