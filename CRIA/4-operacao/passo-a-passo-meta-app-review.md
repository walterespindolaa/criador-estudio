# Passo a passo — Aprovação do Instagram no Meta (App Review)

Guia para leigos. Objetivo: liberar o "Conectar Instagram" do CRIA para **clientes reais**
(hoje só funciona pra você e contas de teste).

- **App ID:** 1265228662356289
- **Site:** https://app.criasocialclub.com.br
- **Política de privacidade:** https://app.criasocialclub.com.br/privacidade
- **Termos:** https://app.criasocialclub.com.br/termos
- **Permissões que vamos aprovar:** `instagram_business_basic` e `instagram_business_manage_insights`

> Observação: o Meta muda nomes de menus de vez em quando. Se o nome no seu painel
> estiver um pouco diferente, procure pela palavra-chave em **negrito** de cada passo.

---

## Visão geral (a ordem das coisas)

1. Deixar as **Configurações básicas** do app completas.
2. Fazer a **Verificação de Negócio** (a parte mais demorada — comece já).
3. Colocar o app em **modo Live (ativo)**.
4. Gravar o **vídeo de demonstração** (roteiro pronto abaixo).
5. Enviar o **App Review** pedindo Acesso Avançado nas 2 permissões.
6. Enquanto espera: testar usando contas com "função" no app.

Tempo realista: verificação de negócio leva de 1 a 7 dias; o review da permissão,
de alguns dias a 2 semanas.

---

## Fase 1 — Configurações básicas do app

1. Entre em **developers.facebook.com** → **Meus Apps** → abra o app do CRIA.
2. Menu esquerdo: **Configurações → Básico**.
3. Preencha/contfira:
   - **Ícone do app** (faça upload do logo do CRIA, 1024×1024).
   - **Categoria** do app.
   - **URL da Política de Privacidade:** `https://app.criasocialclub.com.br/privacidade`
   - **URL dos Termos de Serviço:** `https://app.criasocialclub.com.br/termos`
   - **E-mail de contato.**
   - **Instruções/URL de exclusão de dados (Data Deletion):**
     use `https://app.criasocialclub.com.br/privacidade` (a política precisa ter um
     trecho explicando como o usuário apaga os dados — ver nota no fim).
4. Clique em **Salvar alterações**.

---

## Fase 2 — Verificação de Negócio (comece por aqui, é o gargalo)

1. Entre em **business.facebook.com**.
2. Vá em **Configurações do Negócio** (Business Settings) → **Central de Segurança**
   (Security Center) ou **Informações do negócio**.
3. Clique em **Iniciar verificação** e preencha os dados da empresa:
   - Nome legal (igual ao do CNPJ/MEI), endereço, telefone, site.
4. Envie um **documento** que comprove a empresa (ex.: cartão CNPJ, conta de luz/água
   no nome da empresa, etc.).
5. Confirme um meio de contato (telefone/e-mail/carta) se pedir.
6. **Aguarde a aprovação.** Você recebe por e-mail. Pode continuar as outras fases
   enquanto isso.

> Se você não tem CNPJ, dá pra verificar como pessoa/empresa individual em alguns casos,
> mas ter o CNPJ facilita muito.

---

## Fase 3 — Modo Live (ativo)

1. No painel do app (developers.facebook.com), no topo tem uma chave/seletor
   **"Em desenvolvimento"** → mude para **"Ativo" / "Live"**.
2. Se pedir, conclua os campos obrigatórios que faltarem (geralmente é só a política
   de privacidade, que já preenchemos).

---

## Fase 4 — Gravar o vídeo de demonstração (screencast)

O revisor precisa **ver o fluxo funcionando**. Grave a tela do computador (pode ser com
QuickTime no Mac) mostrando, nesta ordem, **sem cortes que escondam etapas**:

1. (5s) Abra `https://app.criasocialclub.com.br` e mostre que é o CRIA.
2. Faça **login** numa conta do CRIA.
3. Vá até a tela de **Insights / conectar Instagram**.
4. Clique em **Conectar Instagram** → aparece a tela de login/permissão do Instagram.
5. **Conceda as permissões** (vai mostrar acesso ao perfil business e aos insights).
6. Volte pro CRIA e mostre os **dados aparecendo**: número de seguidores, alcance,
   desempenho dos posts (é aqui que você prova o uso das 2 permissões).
7. (Opcional) Mostre onde dá pra **desconectar**.

Suba o vídeo no **YouTube como "Não listado"** e guarde o link — você vai colar no review.

### Narração/legendas do vídeo (em inglês — pode falar ou colocar como legenda)

> "This is CRIA, a content-planning tool for social media creators.
> The user logs in, goes to the Insights page, and connects their Instagram
> professional account. We request `instagram_business_basic` to read the account's
> basic profile and media, and `instagram_business_manage_insights` to show the user
> their own reach and post performance. After granting access, the app displays the
> creator's followers, reach, and per-post insights. The user can disconnect at any time."

---

## Fase 5 — Enviar o App Review

1. No painel do app → **Revisão do app** (App Review) → **Permissões e recursos**
   (Permissions and Features).
2. Encontre **`instagram_business_basic`** → clique em **Solicitar** / **Get advanced access**.
3. Encontre **`instagram_business_manage_insights`** → mesma coisa.
4. Para cada permissão, o Meta vai pedir:
   - **Como você usa a permissão** (cole os textos abaixo).
   - **Vídeo** (cole o link do YouTube).
   - **Instruções passo a passo + login de teste** pro revisor (cole o texto abaixo).
5. Revise e clique em **Enviar para análise**.

### Texto para `instagram_business_basic` (cole no campo de justificativa)

> CRIA is a content-planning app for social media creators. We use
> `instagram_business_basic` to let the logged-in user connect their own Instagram
> professional account and read its basic profile information and media, so we can
> display their content and account data inside their own CRIA workspace. The data is
> only shown to the account owner and is never sold or shared.

### Texto para `instagram_business_manage_insights` (cole no campo de justificativa)

> We use `instagram_business_manage_insights` to retrieve the insights of the user's own
> Instagram professional account (followers, reach, and per-post performance) and display
> them in the user's CRIA dashboard. This helps the creator understand how their content
> performs. Insights are only shown to the account owner and are not shared with third parties.

### Instruções de teste pro revisor (cole no campo "instruções")

> Test credentials:
> - URL: https://app.criasocialclub.com.br
> - Email: [coloque aqui um e-mail de teste]
> - Password: [coloque aqui a senha]
>
> Steps:
> 1. Open the URL and log in with the test credentials above.
> 2. In the left menu, open "Insights".
> 3. Click "Connect Instagram" and complete the Instagram login + permission grant.
> 4. After granting, the page shows the connected account's followers, reach, and
>    per-post insights.
> 5. You can disconnect from the same screen.

> **Importante:** crie uma conta de teste real no CRIA e conecte um Instagram profissional
> de teste, e deixe esses dados prontos pro revisor conseguir reproduzir. Sem isso, o
> review é recusado.

---

## Fase 6 — Enquanto não aprova (testar agora)

Com acesso padrão (sem review aprovado), o Instagram só funciona pra contas com **função
no app**:

1. Painel do app → **Funções do app** (App Roles) → **Funções** ou **Testadores**.
2. Adicione seu usuário (e de quem for testar) como **Administrador/Desenvolvedor/Testador**.
3. Essas contas já conseguem conectar o Instagram e ver os insights normalmente.

---

## Nota sobre exclusão de dados (Data Deletion)

O Meta exige que o usuário saiba como apagar os dados. A forma mais simples: ter na
**Política de Privacidade** um trecho tipo:

> "Para excluir seus dados, vá em Configurações → Conta → Excluir conta, ou escreva para
> [seu e-mail de suporte] e apagamos tudo em até X dias."

Se a sua política ainda não tem isso, me avisa que eu adiciono o trecho no código da
página `/privacidade`.

---

## Checklist rápido

- [ ] Configurações básicas completas (ícone, categoria, privacidade, termos, data deletion)
- [ ] Verificação de Negócio enviada
- [ ] App em modo Live
- [ ] Conta de teste do CRIA criada + Instagram de teste conectado
- [ ] Vídeo gravado e subido no YouTube (não listado)
- [ ] App Review enviado pras 2 permissões
