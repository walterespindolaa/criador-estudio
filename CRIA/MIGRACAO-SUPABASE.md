# Migração do Cria: Lovable Cloud → Supabase própria + Vercel

Mapa · 01/10/2026 · execução marcada pro **sábado**

## Decisões (confirmadas pelo Walter em 01/10/2026)

- Sair da Lovable Cloud: banco, funções, arquivos e hospedagem do app.
- Supabase numa **organização nova, só do Cria** (separada da HUB Zephyr), plano Pro.
- E-mails do app pelo **Resend**.
- IA do app pelo **Gemini direto** (mesmo modelo de hoje, chave própria do Google AI Studio).
- App na **Vercel**.
- Substituem: "Lovable para edge functions e banco" (07/05/2026) e "e-mails do app pelo Custom Emails da Lovable".

## Regra de ouro

O Cria atual fica no ar e intacto até o fim. O domínio só muda depois de tudo testado. Se algo der errado, o domínio volta pra Lovable em minutos. A Lovable Cloud só é removida dias depois, com tudo funcionando.

A Lovable exporta o banco **uma vez a cada 24h**. A exportação de sábado é ao mesmo tempo o backup e o que vai pro projeto novo. **Ninguém usa o Cria entre a exportação e a troca do domínio** (avisar a Gabriela).

---

## O que já está pronto no código (01/10)

| Peça | O que faz |
|---|---|
| `_shared/ia.ts` | A IA vai pro Gemini quando existe `GEMINI_API_KEY`; sem ela, segue pela Lovable. O mesmo código roda nos dois lados. |
| `process-email-queue` | Envia pelo Resend quando existe `RESEND_API_KEY`; sem ela, pela Lovable. |
| `exportar-storage` | Temporária, só admin. Lista os arquivos dos buckets e gera links de 6h pra cópia. |
| `migrar-segredos` | Temporária, só admin. Copia as chaves secretas da Lovable direto pro projeto novo, sem mostrar valores. |
| `supabase/config.toml` | Todas as funções com `verify_jwt` definido (as chamadas por robô ou por página pública ficam `false`). |
| `~/Downloads/cria-segredos.env` | Modelo com as 3 chaves NOVAS (Gemini, Resend, webhook do Stripe). Não vai pro git. |

---

## Antes de sábado (pode ser na sexta)

1. **Supabase:** criar a organização "Cria Social Club" no plano Pro (com o mesmo login, pra eu enxergar pelo conector). Não criar o projeto; eu crio no sábado, em `sa-east-1`.
2. **Token pessoal da Supabase:** Account → Access Tokens → gerar. Colar como segredo `SUPABASE_PAT` **na Lovable** (não mandar no chat).
3. **Resend:** criar conta, adicionar o domínio `criasocialclub.com.br`, colocar os registros DNS na Cloudflare e esperar ficar "Verified". Gerar a API key e guardar no `cria-segredos.env`.
4. **Gemini:** aistudio.google.com → Get API key → guardar no `cria-segredos.env`.
5. **No Mac:** instalar o cliente do Postgres: `brew install libpq && brew link --force libpq`. Conferir `npx supabase --version`.
6. **Vercel:** `npx vercel login` funcionando (hoje deu "Not authorized").
7. **Publicar na Lovable** as funções `exportar-storage` e `migrar-segredos`.

---

## Sábado, passo a passo

### Fase 1 · Backup e projeto novo (≈ 30 min)

1. Avisar a Gabriela: Cria fora do ar pra ela até a gente liberar.
2. Lovable → More → Cloud → Overview → Advanced settings → **Export project data** → Database → Start export. Chega por e-mail. Salvar o arquivo em `~/Downloads/` (**nunca no repositório**).
3. Eu crio o projeto novo (`cria-social-club`, `sa-east-1`) pela Supabase.
4. Em Project Settings → API Keys: usar as **chaves legadas** (anon e service_role em formato JWT). As chaves novas (`sb_publishable_...`) não são JWT e quebrariam as funções com `verify_jwt = true`.

### Fase 2 · Banco (≈ 45 min)

1. Antes da restauração, eu ligo no projeto novo as extensões que o dump usa (pg_cron, pg_net, pgmq, pgcrypto e outras que aparecerem no arquivo).
2. Você restaura o arquivo no Mac com o `psql` e a string de conexão do projeto novo (a senha fica só no seu terminal). Eu te passo o comando exato depois de ver o formato do arquivo.
3. Eu confiro: contagem de linhas por tabela (velho × novo), usuários em `auth.users`, funções e gatilhos.
4. Eu acho e troco tudo dentro do banco que ainda aponta pro endereço velho (`exuxlwdnkgmhtnwoyvwo`): gatilho de push, robôs e funções.

### Fase 3 · Chaves e funções (≈ 30 min)

1. Lovable: segredo `SUPABASE_NOVO_REF` com o ref do projeto novo → rodar `migrar-segredos` (prévia, depois copiar).
2. `npx supabase secrets set --env-file ~/Downloads/cria-segredos.env --project-ref <novo>` (Gemini e Resend).
3. `npx supabase functions deploy --project-ref <novo>` (publica todas de uma vez, com o `config.toml`).
4. Robôs (pg_cron): recriar no projeto novo com o endereço novo. Lista hoje: cria-ig-refresh, cria-daily-notif, story-notifications-15min, trash-purge-daily, cria-lifecycle-emails, cria-daily-health, storage-cleanup-daily, criapost-media-cleanup-daily, agency-inventory-cleanup, rl-buckets-cleanup, trend-bank-weekly, cria-bunny-ingerir, e o processador da fila de e-mail. Eu confiro no dump o que existe de fato.

### Fase 4 · Arquivos (≈ 30 a 60 min, depende do volume)

Buckets usados pelo código: `avatars`, `bio-media`, `crm`, `feedback`, `files`, `ig-thumbs`, `media`, `relatorios`, `saved-covers`, `tutoriais` (e os que a função listar).

1. Eu crio os buckets no projeto novo com as mesmas configurações (público/privado, limite, tipos).
2. A cópia: `exportar-storage` (velho) gera os links e uma função temporária no projeto novo baixa e grava cada arquivo no mesmo caminho.
3. Conferência: quantidade de arquivos por bucket (velho × novo).

Vídeos e mídia do Cria Post estão no Bunny: não mudam.

### Fase 5 · Login e e-mail (≈ 30 min)

1. Supabase novo → Authentication → URL Configuration: Site URL `https://app.criasocialclub.com.br`; Redirect URLs `https://app.criasocialclub.com.br/**` e o endereço de teste da Vercel.
2. Authentication → SMTP: Resend (`smtp.resend.com`, porta 465, usuário `resend`, senha = API key do Resend), remetente `noreply@criasocialclub.com.br`.
3. Authentication → Email Templates: colar os modelos do Cria (eu entrego o HTML pronto).
4. Google login: Authentication → Providers → Google, mesmo Client ID e Secret. No Google Cloud (`creatorsflow-492615`), adicionar a URL de retorno nova: `https://<novo>.supabase.co/auth/v1/callback`.

### Fase 6 · App na Vercel (≈ 30 min)

1. Vercel → Add New Project → repositório `walterespindolaa/criador-estudio` → preset Vite.
2. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (anon legado), `VITE_SUPABASE_PROJECT_ID`, `VITE_META_PIXEL_ID`.
3. Eu ajusto no código: `src/integrations/supabase/client.ts` (endereço de reserva), `index.html`, `supabase/config.toml` (project_id) e o `vercel.json` (todas as rotas apontando pro `index.html`).
4. Testar no endereço `.vercel.app`, antes de mexer no domínio.

### Fase 7 · Testes (≈ 45 min)

- [ ] Login com senha (sua conta, a da Gabriela e a fake)
- [ ] Login com Google
- [ ] Recuperar senha (chega e-mail pelo Resend)
- [ ] Início, Clientes, ficha do cliente
- [ ] Cria Post: criar post, subir imagem, link de aprovação, aprovar pelo link
- [ ] Upload de vídeo pelo Drive vai pro Bunny
- [ ] Cria Caixa, Captação, Radar (uma pesquisa)
- [ ] IA: gerar legenda (agora no Gemini)
- [ ] Push no celular
- [ ] Stripe: checkout de um módulo (pode cancelar logo depois)
- [ ] Robô: `cron_runs` com `ok = true` depois de rodar

### Fase 8 · Virada (≈ 15 min)

1. Stripe → Developers → Webhooks: criar endpoint `https://<novo>.supabase.co/functions/v1/stripe-webhook` com os mesmos eventos de hoje; copiar o segredo → `STRIPE_WEBHOOK_SECRET` no projeto novo. Desativar (não apagar) o antigo.
2. Meta (app do Cria): trocar a URL de retorno do Instagram pra função nova `instagram-oauth`.
3. Vercel → Domains: adicionar `app.criasocialclub.com.br`. Na Cloudflare, apontar o registro do app pra Vercel.
4. Testar de novo login e aprovação pelo domínio de verdade.
5. Liberar a Gabriela.

### Volta, se der errado

Na Cloudflare, apontar `app.criasocialclub.com.br` de volta pra Lovable e reativar o webhook antigo do Stripe. O projeto velho continua lá, intacto.

### Depois (dias seguintes)

- Apagar as funções temporárias `exportar-storage` e `migrar-segredos` e o segredo `SUPABASE_PAT` (revogar o token na Supabase).
- Apagar o arquivo de exportação e o `cria-segredos.env` do Mac.
- Atualizar o CONTEXTO.md (stack nova) e registrar no DECISOES.md.
- Depois de uns dias estável: remover a Lovable Cloud do projeto.

---

## Mapa das chaves secretas

**Vão sozinhas pela `migrar-segredos`** (copiadas da Lovable sem ninguém ver):
APP_URL, ALLOWED_ORIGIN, INTERNAL_PUSH_SECRET, CRIAPOST_CLEANUP_SECRET, CRON_SECRET, TREND_CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO, STRIPE_PRICE_ESSENCIAL, STRIPE_PRICE_AGENCY_SEAT, STRIPE_COLLAB_SEAT_PRICE_ID, STRIPE_CLIENT_PACK_PRICE_ID, BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_HOST, BUNNY_CRIAPOST_API_KEY, BUNNY_CRIAPOST_LIBRARY_ID, BUNNY_CRIAPOST_CDN_HOSTNAME, BUNNY_CRIAPOST_CDN_HOST, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_HOST, BUNNY_STORAGE_PULLZONE, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_PUBLISH_ALL, META_PIXEL_ID, META_CAPI_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_API_KEY, PERPLEXITY_API_KEY, APIFY_TOKEN, TWELVELABS_API_KEY, HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ELEVENLABS_API_KEY.

A função responde, na prévia, quais desses **não existem** na Lovable hoje. Esses entram no `cria-segredos.env`.

**Novas, no `cria-segredos.env`:** GEMINI_API_KEY, RESEND_API_KEY, STRIPE_WEBHOOK_SECRET (só no fim).

**Automáticas no projeto novo:** SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

**Deixam de existir:** LOVABLE_API_KEY, LOVABLE_SEND_URL.

**Fora das funções (painéis):** senha SMTP do Resend (Auth), Client Secret do Google (Auth → Providers).

## Endereços que apontam pro projeto velho

| Onde | O que trocar |
|---|---|
| Google Cloud (OAuth) | URL de retorno do login: `https://<novo>.supabase.co/auth/v1/callback` |
| Meta (app do Cria) | URL de retorno do `instagram-oauth` |
| Stripe | Webhook novo pro `stripe-webhook` novo |
| Banco (gatilhos e robôs) | Tudo que chama `exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/...` |
| Código | `client.ts`, `index.html`, `config.toml` |
| Cloudflare | DNS do `app.` pra Vercel |
