# Migração do Cria: Lovable Cloud → Supabase própria + Vercel

Mapa v2 · 12/10/2026 (revisão do mapa de 01/10, depois de auditar o repositório no commit `69d824e`)

## Objetivo

Banco, autenticação, arquivos, Edge Functions, segredos, robôs, e-mail, IA e hospedagem do app sob controle do Walter, sem depender da Lovable pra nada. A Lovable deixa de ser a hospedagem e deixa de mexer no GitHub.

## Decisões (confirmadas pelo Walter em 01/10/2026)

- Sair da Lovable Cloud: banco, funções, arquivos e hospedagem do app.
- Supabase numa **organização nova, só do Cria** (separada da HUB Zephyr), plano Pro, região `sa-east-1`.
- E-mails do app pelo **Resend**.
- IA pelo **Gemini direto** (mesmo modelo, chave própria do Google AI Studio).
- App na **Vercel**.
- Substituem as decisões de 07/05/2026 (Lovable para edge functions e banco) e de 28/05/2026 (e-mails pelo Custom Emails da Lovable). **Ainda não registrado no DECISOES.md**: registrar no "fecha a sessão".

## Regra de ouro

O Cria atual fica no ar e intacto até o fim. O domínio só muda depois de tudo testado no endereço `.vercel.app`. Se der errado, o domínio volta pra Lovable em minutos e o webhook antigo do Stripe é reativado. A Lovable Cloud só é desligada dias depois, com tudo estável.

A exportação do banco pela Lovable sai **uma vez a cada 24h**. A de sábado é o backup e é o que vai pro projeto novo. **Ninguém usa o Cria entre a exportação e a troca do domínio** (avisar a Gabriela e quem mais estiver usando).

---

## Auditoria de 12/10: o que mudou desde o mapa de 01/10

| # | Achado | O que fazer |
|---|---|---|
| 1 | A organização "Cria Social Club" existe (projeto `ecbzfjzoqidowrsfsfih`, Free, pausado), mas o conector da Supabase só foi autorizado pra HUB Zephyr. | Restaurar o projeto, subir a organização pro Pro e reautorizar o conector incluindo a organização do Cria. |
| 2 | `migrar-segredos` não copia `BUNNY_TUTORIAIS_API_KEY` e `BUNNY_TUTORIAIS_LIBRARY_ID` (nasceram em 01/10 com os tutoriais). | Adicionar os dois na lista e republicar a função na Lovable. |
| 3 | **O cofre (Vault) não sobrevive à mudança.** Os segredos `internal_push_secret` e `email_queue_service_role_key` são criptografados com a chave do projeto velho. No projeto novo eles vêm ilegíveis, e push, robôs do Instagram, ingestão do Bunny e fila de e-mail param. | Função temporária no projeto novo que grava no cofre o `INTERNAL_PUSH_SECRET` e a service role nova, lidos dos segredos do próprio projeto. Ninguém vê o valor. Apagar depois. |
| 4 | O app **não tem login com Google** (só senha e código por e-mail). O passo "Google provider" do mapa antigo sai. | O Google continua só no Drive. Conferir no Google Cloud se o endereço `.vercel.app` de teste está nas origens autorizadas. |
| 5 | `auth-email-hook` só funciona com a assinatura da Lovable. Na Supabase própria ele não é usado. | E-mails de login pelo SMTP do Resend, com os 6 modelos do Cria (`_shared/email-templates`: cadastro, recuperar senha, código, convite, troca de e-mail, reautenticação) convertidos pra HTML e colados no painel. Eu converto. |
| 6 | IA: `ai-context-builder`, `apify-scrape`, `higgsfield-generate` e `video-analyze` ainda escrevem o endereço do gateway da Lovable, mas passam pelo `_shared/ia.ts`, que troca pro Gemini quando existe `GEMINI_API_KEY`. | Funciona no dia. Limpeza do código depois (fase 10). |
| 7 | Endereço do projeto velho escrito à mão: `.env`, `client.ts`, `index.html`, `config.toml` e, no banco, gatilho de push, motor do Instagram, coleta de dados, ingestão do Bunny e robôs. | Trocar no código (eu) e no banco (SQL que eu entrego depois de ver o inventário). |
| 8 | **A Lovable continua ligada ao GitHub.** Depois da troca, um commit dela pode voltar `.env` e `client.ts` pro projeto velho. | Desconectar a Lovable do repositório no fim do sábado, antes de liberar a Gabriela. |
| 9 | O `.env` está no git porque a Lovable precisava dele no build. | Atualizar com o projeto novo (só chaves públicas). Na Vercel as variáveis ficam no painel. |
| 10 | A página de Privacidade cita "Supabase / Lovable Cloud", "Gemini via Lovable AI Gateway" e "Lovable: envio de e-mails". | Atualizar o texto (LGPD): Supabase, Google Gemini, Resend, Vercel. Eu faço na fase 10. |
| 11 | **Risco a confirmar:** não sabemos se a exportação da Lovable traz `auth.users` com as senhas. Sem isso, todo mundo teria que redefinir senha. | Conferir no arquivo antes de restaurar. Se não vier, decidimos ali: redefinição de senha pra todos (são poucas contas) ou adiar. |
| 12 | Robôs: o repositório mostra uns 13 (`cria-ig-sync`, `cria-ig-stories`, `agency-inventory-cleanup`, `rl-buckets-cleanup`, `cron-historico-faxina`, `trend-bank-weekly`, `cria-bunny-ingerir`, `apify-scrapes-orfaos`, `cria-ig-publicar-fila` e os de notificação, refresh do Instagram e e-mails). Alguns foram criados à mão no banco. | A lista real sai do inventário (Fase 0). |

O resto do mapa de 01/10 continua valendo: 67 funções, todas com `verify_jwt` no `config.toml`; 10 buckets (`avatars`, `bio-media`, `crm`, `feedback`, `files`, `ig-thumbs`, `media`, `relatorios`, `saved-covers`, `tutoriais`); vídeos no Bunny não mudam; `exportar-storage` e `migrar-segredos` já existem no código.

---

## Fase 0 · Inventário (feito em 12/10)

Rodado no SQL Editor da Lovable (só leitura). Resultado:

- **Usuários:** 24, todos com senha, todos com login por e-mail. Nenhum Google.
- **Banco:** 2,1 GB, mas as tabelas do app somam poucos milhares de linhas (maiores: `social_audience` 1.035, `posts` 978, `social_insights` 793, `notifications` 783). O volume está em tabela de sistema (histórico de robô, respostas do pg_net ou arquivo das filas). Investigar e limpar antes da exportação.
- **Arquivos:** cerca de 1 GB em 1.955 arquivos. `media` 472 MB (975), `ig-thumbs` 200 MB (507), `relatorios` 197 MB (só 6), `bio-media` 64 MB, `saved-covers` 22 MB, `avatars` 18 MB, `crm` 18 MB, `files` 16 MB, `tutoriais` 15 MB (222), `feedback` vazio. Privados: `crm`, `files`, `relatorios`, `tutoriais`.
- **Extensões:** pg_cron, pg_net, pg_stat_statements, pg_trgm, pgcrypto, pgmq, plpgsql, supabase_vault, uuid-ossp.
- **Filas (pgmq):** `auth_emails`, `transactional_emails` e as duas de erro (`_dlq`).
- **Cofre:** `internal_push_secret` e `email_queue_service_role_key` (confirma o achado 3).
- **Robôs ativos (16):** `agency-inventory-cleanup`, `apify-scrapes-orfaos`, `cria-bunny-ingerir`, `cria-daily-health`, `cria-daily-notif`, `cria-ig-publicar-fila` (a cada minuto), `cria-ig-refresh`, `cria-ig-stories`, `cria-ig-sync`, `cria-lifecycle-emails`, `criapost-media-cleanup-daily`, `cron-historico-faxina`, `rl-buckets-cleanup`, `storage-cleanup-daily`, `story-notifications-15min`, `trash-purge-daily`. **12 deles chamam o endereço velho.** O `trend-bank-weekly` do repositório não existe em produção.
- **Funções do banco com o endereço velho:** `email_queue_dispatch`, `email_queue_wake`, `notify_push_on_insert`.
- **Contagem por tabela:** guardada no CSV de 12/10, é o gabarito da conferência no sábado (contar de novo na hora da exportação).

**Projeto novo:** já existe o `ecbzfjzoqidowrsfsfih` (organização "Cria Social Club", plano Free, criado em 01/10 e pausado por inatividade). Walter está restaurando; depois sobe a organização pro Pro. Conferir a região (`sa-east-1`) quando voltar.

## Fase 1 · Preparação (até sexta)

Walter:
1. **Supabase:** criar a organização "Cria Social Club" no plano Pro, com o mesmo login (pra eu enxergar pelo conector). O projeto eu crio no sábado.
2. **Token pessoal da Supabase** (Account → Access Tokens): colar como segredo `MIGRACAO_PAT` na Lovable. Não mandar no chat.
3. **Resend:** conta, domínio `criasocialclub.com.br`, registros DNS na Cloudflare, esperar "Verified", gerar a API key e guardar em `~/Downloads/cria-segredos.env`.
4. **Gemini:** aistudio.google.com → Get API key → guardar no mesmo arquivo.
5. **No Mac:** `brew install libpq && brew link --force libpq` e conferir `npx supabase --version`.
6. **Vercel:** `npx vercel login` funcionando.
7. Publicar na Lovable `exportar-storage` e `migrar-segredos` (esta já com os 2 segredos novos do Bunny).

Eu:
1. Atualizar `migrar-segredos` (achado 2).
2. Escrever a função temporária do cofre (achado 3) e a SQL que a acompanha.
3. Converter os 6 modelos de e-mail pra HTML (achado 5).
4. Deixar pronto, num branch separado, o pacote de código da virada: `.env`, `client.ts`, `index.html`, `config.toml` e `vercel.json` com todas as rotas no `index.html`. Esse branch só entra na `main` no sábado.
5. Com o inventário: a SQL que troca o endereço velho no banco e recria os robôs.

## Fase 2 · Sábado: backup e projeto novo (≈ 30 min)

1. Avisar a Gabriela: Cria fora do ar até a gente liberar.
2. Lovable → Cloud → Advanced settings → **Export project data** → Database. Salvar em `~/Downloads/` (**nunca no repositório**).
3. Eu crio o projeto `cria-social-club` em `sa-east-1`.
4. Project Settings → API Keys: usar as **chaves legadas** (anon e service_role em JWT). As novas (`sb_publishable_...`) quebram as funções com `verify_jwt = true`.

## Fase 3 · Banco (≈ 45 min)

1. Conferir no arquivo se tem `auth.users` com senha (achado 11).
2. Eu ligo no projeto novo as extensões do inventário (pg_cron, pg_net, pgmq, supabase_vault, pgcrypto e as outras que aparecerem).
3. Walter restaura no Mac com `psql` e a string de conexão do projeto novo (a senha fica só no terminal dele). Eu passo o comando exato depois de ver o formato do arquivo.
4. Eu confiro contra o inventário: linhas por tabela, usuários, funções, gatilhos, filas.
5. SQL que troca o endereço velho por `https://<novo>.supabase.co` nas funções e gatilhos.

## Fase 4 · Segredos, cofre e funções (≈ 40 min)

1. Lovable: segredo `MIGRACAO_NOVO_REF` = ref novo → rodar `migrar-segredos` (prévia, depois cópia).
2. `npx supabase secrets set --env-file ~/Downloads/cria-segredos.env --project-ref <novo>` (Gemini e Resend).
3. `npx supabase functions deploy --project-ref <novo>` (todas, com o `config.toml`).
4. Rodar a função do cofre (achado 3) e apagar a função e a SQL temporária.
5. Recriar os robôs com o endereço novo (lista do inventário). Conferir `cron_runs` com `ok = true`.

## Fase 5 · Arquivos (≈ 30 a 60 min, depende do volume do inventário)

1. Eu crio os buckets com as mesmas configurações (público/privado, limite, tipos).
2. `exportar-storage` (velho) gera links de 6h. Uma função temporária no projeto novo baixa e grava cada arquivo no mesmo caminho.
3. Conferência: arquivos por bucket, velho contra novo.

## Fase 6 · Login e e-mail (≈ 20 min)

1. Authentication → URL Configuration: Site URL `https://app.criasocialclub.com.br`; Redirect URLs `https://app.criasocialclub.com.br/**` e o endereço `.vercel.app`.
2. Authentication → SMTP: `smtp.resend.com`, porta 465, usuário `resend`, senha = API key do Resend, remetente `noreply@criasocialclub.com.br`.
3. Authentication → Email Templates: colar os 6 modelos.

## Fase 7 · App na Vercel (≈ 30 min)

1. Vercel → Add New Project → `walterespindolaa/criador-estudio` → preset Vite.
2. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (anon legado), `VITE_SUPABASE_PROJECT_ID`, `VITE_META_PIXEL_ID`.
3. Entrar com o branch da virada na `main` (Fase 1, item 4 do meu lado).
4. Testar no `.vercel.app` antes de mexer no domínio.

## Fase 8 · Testes (≈ 45 min)

- [ ] Login com senha (Walter, Gabriela, conta fake) e por código no e-mail
- [ ] Recuperar senha (chega pelo Resend, com o modelo do Cria)
- [ ] Início, Clientes, ficha do cliente
- [ ] Cria Post: criar post, subir imagem, link de aprovação, aprovar pelo link
- [ ] Upload de vídeo pelo Drive vai pro Bunny
- [ ] Equipe: produção com parceiro, entrega com arquivo, galeria
- [ ] Cria Caixa, Captação, Radar (uma pesquisa)
- [ ] IA: gerar legenda (agora no Gemini) e uma tendência
- [ ] Push no celular
- [ ] Instagram: conectar uma conta de teste (retorno na função nova)
- [ ] Stripe: checkout de um módulo (cancelar logo depois)
- [ ] Robôs: `cron_runs` com `ok = true` depois de rodar

## Fase 9 · Virada (≈ 15 min)

1. Stripe → Webhooks: endpoint novo `https://<novo>.supabase.co/functions/v1/stripe-webhook` com os mesmos eventos; segredo → `STRIPE_WEBHOOK_SECRET` no projeto novo. Desativar (não apagar) o antigo.
2. Meta (app do Cria): URL de retorno → `https://<novo>.supabase.co/functions/v1/instagram-oauth`.
3. Vercel → Domains: `app.criasocialclub.com.br`. Na Cloudflare, apontar o `app` pra Vercel.
4. Repetir login e aprovação no domínio de verdade.
5. **Desconectar a Lovable do GitHub** (achado 8).
6. Liberar a Gabriela.

### Volta, se der errado

Cloudflare: `app` de volta pra Lovable. Stripe: reativar o webhook antigo. O projeto velho está intacto. (Se a Lovable já tiver sido desconectada do GitHub, reconectar.)

## Fase 10 · Depois (dias seguintes)

- Apagar `exportar-storage`, `migrar-segredos`, as temporárias do projeto novo e os segredos `MIGRACAO_PAT` / `MIGRACAO_NOVO_REF`; revogar o token na Supabase.
- Apagar do Mac o arquivo de exportação e o `cria-segredos.env`.
- Limpeza de código: tirar o endereço do gateway da Lovable das 4 funções de IA, o `auth-email-hook`, o `lovable-tagger`, o `previewAuthStorage`, as origens `*.lovable.app` no CORS; atualizar a página de Privacidade.
- `supabase db dump --schema public` do projeto novo e versionar (fecha o schema drift: tabelas e RPCs criadas sem migration).
- CONTEXTO.md (stack nova) e DECISOES.md.
- Uns dias estável: remover a Lovable Cloud e cancelar o que for só dela.

---

## Mapa das chaves secretas

**Copiadas pela `migrar-segredos`** (da Lovable pro projeto novo, sem ninguém ver):
APP_URL, ALLOWED_ORIGIN, INTERNAL_PUSH_SECRET, CRIAPOST_CLEANUP_SECRET, CRON_SECRET, TREND_CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO, STRIPE_PRICE_ESSENCIAL, STRIPE_PRICE_AGENCY_SEAT, STRIPE_COLLAB_SEAT_PRICE_ID, STRIPE_CLIENT_PACK_PRICE_ID, BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_HOST, BUNNY_CRIAPOST_API_KEY, BUNNY_CRIAPOST_LIBRARY_ID, BUNNY_CRIAPOST_CDN_HOSTNAME, BUNNY_CRIAPOST_CDN_HOST, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_HOST, BUNNY_STORAGE_PULLZONE, **BUNNY_TUTORIAIS_API_KEY, BUNNY_TUTORIAIS_LIBRARY_ID** (novos), INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_PUBLISH_ALL, META_PIXEL_ID, META_CAPI_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_API_KEY, PERPLEXITY_API_KEY, APIFY_TOKEN, TWELVELABS_API_KEY, HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ELEVENLABS_API_KEY.

A prévia da função diz quais desses **não existem** hoje na Lovable. Esses entram no `cria-segredos.env`.

**Novas, no `cria-segredos.env`:** GEMINI_API_KEY, RESEND_API_KEY, STRIPE_WEBHOOK_SECRET (só na virada).

**Automáticas no projeto novo:** SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

**No cofre do banco (Vault), refeitos no projeto novo:** `internal_push_secret` (= INTERNAL_PUSH_SECRET), `email_queue_service_role_key` (= service role nova).

**Deixam de existir:** LOVABLE_API_KEY, LOVABLE_SEND_URL.

**Fora das funções (painéis):** senha SMTP do Resend (Auth → SMTP).

## Endereços que apontam pro projeto velho

| Onde | O que trocar |
|---|---|
| Meta (app do Cria) | Retorno do `instagram-oauth` |
| Stripe | Webhook novo pro `stripe-webhook` |
| Banco (gatilhos, motor do Instagram, Bunny, robôs) | Tudo que chama `exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/...` |
| Código | `.env`, `client.ts`, `index.html`, `config.toml` |
| Cloudflare | DNS do `app.` pra Vercel |
| Google Cloud | Origens autorizadas do Drive: incluir o `.vercel.app` de teste |
