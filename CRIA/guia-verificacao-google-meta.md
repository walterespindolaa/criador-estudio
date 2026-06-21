# Guia de gravação e submissão — Verificação Google OAuth + Meta App Review (CRIA)

> Objetivo: regravar o vídeo do Google mostrando o **fluxo de consentimento OAuth** (motivo da reprovação de 16/jun/2026) e deixar pronto o **screencast do Meta** para o App Review do Instagram.
> Conta a usar: **conta nova, criada agora (não a sua)**. Isso é proposital e ajuda — força a tela de consentimento a aparecer inteira (uma conta que já autorizou pula o consentimento, que foi exatamente o que reprovou).

---

## PARTE 0 — Por que reprovou e o que muda

O e-mail do Google disse: *"Seu vídeo de demonstração não mostra o fluxo de consentimento do OAuth."*

Tradução prática: no vídeo anterior a tela onde o usuário **autoriza o app** (escolhe a conta Google → vê os escopos → clica em "Permitir") não apareceu, ou apareceu pulada/cortada. Causas comuns:

- A conta usada **já tinha autorizado** o CRIA antes → o Google pula o consentimento.
- A gravação começou **depois** do consentimento (já logado).
- A tela apareceu mas você não mostrou **os escopos** (Drive + Agenda) com clareza.

A correção é gravar do zero, com conta nova, mostrando **a tela de consentimento inteira, em inglês, com os escopos visíveis**, e depois **usando** cada permissão dentro do app.

---

## PARTE 1 — Antes de gravar (checklist de preparo)

Faça tudo isso **antes** de apertar REC:

1. **Conta Google nova** criada e logada no navegador (de preferência um **perfil/janela anônima limpa** do Chrome, sem extensões e sem outras contas Google logadas).
2. No app CRIA, **confirme que essa conta nunca conectou** Google (se já conectou, desconecte / revogue em https://myaccount.google.com/permissions com a conta nova).
3. Idioma da tela de consentimento em **inglês**. O Google exige que o seletor de idioma no canto inferior esquerdo da tela de consentimento esteja em **English**. Para garantir: acesse a tela de consentimento e force `&hl=en` na URL, ou ajuste o idioma da conta Google nova para inglês.
4. O app precisa estar rodando no **ambiente de produção** (o domínio real `app.criasocialclub.com.br`), não em localhost. O Google exige demonstração no ambiente live.
5. Tenha **um arquivo de teste no Drive** dessa conta nova e a **Agenda vazia/visível**, porque você vai mostrar o app *lendo o Drive* e *criando um evento na agenda* (a prova de uso de cada escopo).
6. Software de gravação com **áudio** (narração) OU legendas. Pode ser Loom, OBS, ou o próprio gravador do Mac (QuickTime). Resolução boa, tela cheia.
7. Deixe este roteiro aberto no celular ou numa segunda tela.

> Dica: o Google aceita o vídeo no **YouTube (não listado)**. É o jeito mais simples de fornecer o link na submissão.

---

## PARTE 2 — Roteiro do vídeo Google (o que FAZER e o que FALAR)

Duração ideal: **2 a 4 minutos**. Fale devagar e claro. **A tela do app/consentimento DEVE estar em inglês** e a **narração também em inglês** (ou legendas em inglês). Abaixo, cada cena tem a instrução em PT (**Mostrar**) e a **fala pronta em inglês** para você ler/legendar.

### Cena 1 — Identificação do app (10–15s)
**Mostrar:** a home/login do CRIA no domínio real, com a URL `app.criasocialclub.com.br` visível na barra.
**Fala (EN):**
> "This is CRIA, available at app.criasocialclub.com.br. I'll demonstrate the Google OAuth consent flow and how the app uses the Google Drive and Google Calendar scopes."

### Cena 2 — Início do fluxo OAuth (15–20s)
**Mostrar:** clicar no botão que inicia a conexão com o Google (ex.: "Connect Google" / "Sign in with Google" em Configurações → Integrações).
**Fala (EN):**
> "When the user clicks connect, the app starts the Google OAuth flow."

### Cena 3 — Seletor de conta (10s) ⬅️ CRÍTICO
**Mostrar:** a tela do Google "Choose an account" / "Sign in", e você **escolhendo a conta nova**.
**Fala (EN):**
> "The user chooses the Google account they want to authorize."

### Cena 4 — TELA DE CONSENTIMENTO (30–40s) ⬅️ O MAIS IMPORTANTE
**Mostrar, com calma e sem cortar:**
- O **nome do app** ("CRIA") no topo da tela de consentimento.
- O texto "**CRIA wants access to your Google Account**".
- **Role a tela mostrando CADA escopo pedido**: o acesso ao **Google Drive** e o acesso a **criar/gerenciar eventos no Google Calendar**.
- O seletor de idioma **English** no canto inferior esquerdo.
- O clique no botão **"Continue" / "Allow"**.

**Fala (EN) — enquanto rola os escopos:**
> "This is the OAuth consent screen. Google shows the app name, CRIA, and the requested scopes: access to the user's Google Drive and permission to create events in Google Calendar. The user reviews each permission and clicks Allow to grant access."

> ⚠️ Não pule, não acelere e não corte esta cena. É exatamente o que faltou da última vez. Se a tela de consentimento **não aparecer** (pular direto), pare a gravação — sinal de que a conta já tinha autorizado; revogue o acesso e recomece.

### Cena 5 — Uso do escopo Drive (30–40s)
**Mostrar:** de volta no CRIA, a funcionalidade que **usa o Drive** (ex.: listar/importar/salvar um arquivo do Drive). Mostre o arquivo real da conta nova aparecendo dentro do app.
**Fala (EN):**
> "With access granted, CRIA uses the Google Drive scope to [descreva o que faz — ex.: import and save the creator's files]. Here is the app accessing this account's Drive."

### Cena 6 — Uso do escopo Calendar (30–40s)
**Mostrar:** a funcionalidade que **cria um evento na agenda**. Crie um evento de teste pelo CRIA e depois **abra o Google Calendar** mostrando o evento que apareceu lá.
**Fala (EN):**
> "CRIA also uses the Google Calendar scope to add events to the user's calendar. I'll create an event here in the app… and here is that same event now visible in this account's Google Calendar."

### Cena 7 — Encerramento (5–10s)
**Fala (EN):**
> "This concludes the demonstration of the OAuth consent flow and the use of each scope requested by CRIA."

### Resumo do que o vídeo OBRIGATORIAMENTE precisa conter
- [ ] URL/domínio real do app visível
- [ ] Nome do app "CRIA" na tela de consentimento
- [ ] Seletor de idioma em **English** na tela de consentimento
- [ ] **Todos os escopos** (Drive + Calendar) visíveis na tela de consentimento
- [ ] O clique em **Allow/Permitir**
- [ ] Demonstração real de **cada escopo sendo usado** (Drive e Calendar)
- [ ] Narração em voz **ou** legendas explicando cada etapa

---

## PARTE 3 — Como subir o vídeo atualizado no Google

1. Suba o novo vídeo no **YouTube como "Não listado"** (ou outro link acessível) e copie o link.
2. Acesse o **Google Cloud Console** → https://console.cloud.google.com/ → selecione o projeto do CRIA.
3. Menu **APIs & Services → OAuth consent screen** (ou **Verification Center**, dependendo da versão da interface).
4. Você verá o status da verificação com a observação da reprovação. Procure o botão **"Edit app" / "Editar"** ou, no fluxo de verificação, a opção para **responder/reenviar** ("Make changes" / "Resubmit for verification").
5. No campo do **vídeo de demonstração (demo video link)**, **substitua o link antigo pelo novo**.
6. Reveja os outros campos exigidos (justificativa de uso de cada escopo / scope justification) — confirme que continuam coerentes com o vídeo.
7. Clique em **Submit for verification / Reenviar para verificação**.
8. Você recebe um e-mail confirmando o reenvio. O retorno costuma levar de **alguns dias a algumas semanas** (escopos sensíveis/restritos demoram mais; Drive restrito pode exigir avaliação de segurança adicional dependendo do escopo exato).

> Dica: ao reenviar, muitos formulários têm um campo de "comentário ao revisor". Use-o: *"Updated the demo video to fully show the OAuth consent flow (account selection, consent screen with all requested scopes — Drive and Calendar — language set to English, and the Allow step), followed by a demonstration of each scope in use."* Isso responde diretamente ao motivo da reprovação.

---

## PARTE 4 — Meta / Instagram App Review (app já criado, falta submeter)

O fluxo do Meta é parecido: para cada permissão **não-padrão** você escreve **como o app usa o dado** e grava um **screencast** mostrando o uso real. Permissões típicas para insights de Instagram: `instagram_basic`, `instagram_manage_insights`, `pages_show_list` e (dependendo) `pages_read_engagement` / `business_management`.

### 4.1 — Pré-requisitos antes de submeter
1. App no **Meta for Developers** (https://developers.facebook.com/apps/) já criado ✅.
2. Uma conta de **Instagram Business ou Creator** vinculada a uma **Página do Facebook** (requisito da Graph API de insights). Use a conta nova/de teste para isso.
3. **Business Verification** do Meta pode ser exigida para algumas permissões — confira em **App Settings → Basic** se há aviso de verificação de negócio pendente. Se exigir, faça a verificação do negócio antes (precisa de documento da empresa).
4. App configurado com a URL de privacidade e ícone (em **App Settings → Basic**: Privacy Policy URL, App Icon, Categoria).
5. Adicione o produto **Instagram Graph API** ao app.

### 4.2 — Onde submeter
No painel do app: **App Review → Permissions and Features**. Lá você localiza cada permissão (`instagram_basic`, `instagram_manage_insights`, `pages_show_list`...) e clica em **"Request" / "Request advanced access"**.

### 4.3 — O que escrever em cada permissão (use-case)
Para cada permissão, descreva objetivamente o uso. Modelos (escreva em inglês no formulário):

- **instagram_basic**
  > "CRIA uses instagram_basic to identify the user's connected Instagram Business/Creator account and read basic account info (username, account id) so the user can link their account inside CRIA's Insights page."
- **instagram_manage_insights**
  > "CRIA uses instagram_manage_insights to fetch read-only metrics (reach, impressions, engagement) for the user's own account and media, displayed back to the user on the /app/insights page. CRIA does not post or modify anything — insights only."
- **pages_show_list**
  > "CRIA uses pages_show_list to let the user select which Facebook Page (linked to their Instagram Business account) to connect, which is required to access the Instagram Graph API."

> Importante: deixe claro em todo lugar que é **somente leitura de insights** — não há publicação nem agendamento. Isso bate com a arquitetura do CRIA e reduz fricção na revisão.

### 4.4 — Roteiro do screencast Meta (parecido com o do Google)
Grave (com **conta de teste**), narração/legendas **em inglês**, mostrando o fluxo real:

1. **App e contexto** — mostre o CRIA e diga que vai conectar uma conta Instagram Business para ver insights.
   **Fala (EN):** "This is CRIA. I'll connect an Instagram Business account to display its insights inside the app."
2. **Login do Facebook / fluxo OAuth do Meta** — clique em conectar, mostre a **tela de permissões do Facebook** com as permissões sendo pedidas, escolha a Página e a conta Instagram, e clique em **autorizar**. (Igual ao Google: a tela de consentimento precisa aparecer.)
   **Fala (EN):** "The user starts the Facebook login flow, selects the Facebook Page linked to their Instagram Business account, reviews the requested permissions, and authorizes access."
3. **Uso de cada permissão** — mostre dentro do CRIA: a conta Instagram conectada (instagram_basic + pages_show_list) e a **página de insights exibindo as métricas** puxadas via API (instagram_manage_insights).
   **Fala (EN):** "Now the connected Instagram account appears in CRIA, and the Insights page displays read-only metrics — reach, impressions and engagement — fetched through the Instagram Graph API. CRIA only reads insights; it does not post or modify anything."
4. **Encerramento** — **Fala (EN):** "This concludes the demonstration of each requested permission in use."

> Como o app está em modo de **desenvolvimento**, adicione a conta de teste como **Tester/Role** (App Roles → Roles) para conseguir gravar o fluxo funcionando antes da aprovação.

### 4.5 — Submeter
1. Anexe o **link do screencast** (YouTube não listado ou upload direto, conforme o formulário pedir).
2. Preencha **Notes for reviewer** com passo a passo de como reproduzir (login de teste, onde clicar).
3. Se a permissão exigir, forneça **credenciais de uma conta de teste** para o revisor.
4. Clique em **Submit**. Prazo típico: **1 a 4 semanas** por rodada de revisão.

---

## PARTE 5 — Ordem recomendada de execução

1. Criar/limpar a conta nova e preparar Drive + Agenda de teste.
2. Gravar o vídeo do **Google** (Parte 2) → subir no YouTube não listado → reenviar no Cloud Console (Parte 3).
3. Em paralelo (não depende do Google): vincular Instagram Business + Página, gravar o **screencast do Meta** (Parte 4) → submeter o App Review.
4. Aguardar retornos e responder rápido se pedirem ajuste.

---

### Fontes
- [Google — Demo Video (Cloud Console Help)](https://support.google.com/cloud/answer/13804565?hl=en)
- [Google — Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Google — Verification requirements](https://support.google.com/cloud/answer/13464321?hl=en)
- [Google — Submitting your app for verification](https://support.google.com/cloud/answer/13461325?hl=en)
- [Meta — App Review (Instagram Platform)](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [Meta — Permissions Reference](https://developers.facebook.com/docs/permissions/)
