# Roteiro de gravação — Meta App Review

**Como usar:** a coluna "FALAR" está em inglês (é o que você narra). O resto é instrução pra você.
Se não quiser narrar, grave sem áudio e coloque esse mesmo texto como **legenda na tela**.

**Antes de apertar REC:**
- Configurações → Visual → **English**
- Faça **logout** do Cria
- Faça **logout do Facebook/Instagram** no navegador (senão ele pula a tela de consentimento — e é ela que a Meta quer ver)
- Se já tiver uma conta IG conectada no Cria, **desconecte antes**
- Janela do navegador **não maximizada em tela cheia** (a barra de endereço tem que aparecer)
- Grave em 1080p, **sem cortes**

---

## CENA 1 — Login (0:00 – 0:25)

**ONDE VOCÊ ESTÁ:** `app.criasocialclub.com.br/login`
**O QUE FAZER:** mostre a tela 3 segundos parado. Depois digite e-mail e senha, devagar, e entre.

> **FALAR:**
> "This is CRIA, a content management platform for creators and social media managers.
> I'm logging in with my CRIA account."

---

## CENA 2 — Estado inicial: SEM Instagram conectado (0:25 – 0:50)

**ONDE VOCÊ ESTÁ:** menu lateral → passe o mouse pra expandir → **Results → Insights**
**O QUE FAZER:** pare o mouse em cima de "Results", depois em "Insights", e clique. Na tela de Insights, deixe o card *"Connect your Instagram"* visível por 5 segundos. **Não clique em nada ainda.**

> **FALAR:**
> "Here is our Insights screen. Right now no Instagram account is connected,
> so the app has no data at all. To see any metric, the user must connect
> their own Instagram Business or Creator account and grant permission."

⚠️ **Não pule esta cena.** É ela que prova que o app não tem dado nenhum antes do consentimento.

---

## CENA 3 — Iniciando o login da Meta (0:50 – 1:05)

**ONDE VOCÊ ESTÁ:** ainda na tela de Insights
**O QUE FAZER:** passe o mouse em cima do botão **"Connect Instagram"**, pare 2 segundos, e clique. Assim que a página da Meta abrir, **mova o mouse até a barra de endereço** e deixe ali 3 segundos, pra ficar claro que é `facebook.com`.

> **FALAR:**
> "I click Connect Instagram. The app now redirects me to Meta's own login flow.
> You can see facebook dot com in the address bar."

---

## CENA 4 — Login e consentimento na Meta (1:05 – 1:45)

**ONDE VOCÊ ESTÁ:** página de login da Meta
**O QUE FAZER:** faça o login. Quando aparecer a tela de permissões, **role devagar** mostrando a lista de permissões. Pare o mouse em cima de cada uma. Depois clique em **Allow / Permitir**.

> **FALAR:**
> "I log in with the Instagram Business account. Meta now asks me to grant
> permission. Here you can see the permissions the app is requesting:
> basic account information and account insights.
> I'm the account owner and I'm granting access. I click Allow."

⚠️ **Não corte esta parte.** É o item 2 do feedback deles ("um usuário fornecendo ao app acesso à permissão").

---

## CENA 5 — De volta ao app: os dados aparecendo (1:45 – 3:00) ⭐

> **ESTA É A CENA QUE REPROVOU SEU VÍDEO ANTERIOR.** Não corra. Cada bloco abaixo é uma parada de 4–5 segundos com o mouse em cima.

**ONDE VOCÊ ESTÁ:** de volta em `/app/insights`, agora conectado.

**5.1 — Barra da conta** (mouse em cima do @usuário e do "Connected")
> **FALAR:**
> "I'm back in CRIA and my account is now connected.
> This is the instagram_business_basic permission in use: we read the username,
> the account type and the profile picture, only to identify the connected account."

**5.2 — Os 4 KPIs** (passe o mouse em cada um, um por um: Followers → Reach → Interactions → Profile views)
> **FALAR:**
> "And here are the account insights. These come from the
> instagram_business_manage_insights permission.
> Followers. Reach in the last thirty days. Interactions in the last thirty days.
> And profile views."

**5.3 — Os dois gráficos** (mouse sobre "Reach · last 30 days", depois sobre "Followers · last 30 days")
> **FALAR:**
> "We plot the reach and the follower evolution over the last thirty days,
> so the user can see whether their content is growing or losing traction."

**5.4 — A lista de posts** (role a página devagar até a lista; pare em 2 ou 3 posts mostrando alcance/salvos)
> **FALAR:**
> "Below, each of the user's own posts with its reach, saves and interactions.
> The user links each post to the content they planned inside CRIA,
> so they can see which planned idea actually performed."

**5.5 — Refresh** (clique em **"Refresh"** e espere os dados recarregarem na tela)
> **FALAR:**
> "The user can refresh the data at any time. We fetch it again from the Instagram API."

⚠️ **Não borre nenhum número.** Se você esconder as métricas, o revisor não vê o dado da API sendo usado — e reprova de novo pelo mesmo motivo.

---

## CENA 6 — Como isso vira valor pro usuário (3:00 – 3:20)

**ONDE VOCÊ ESTÁ:** role até o bloco **"Actions for next week"**
**O QUE FAZER:** pare o mouse na recomendação.

> **FALAR:**
> "Finally, CRIA turns those numbers into a recommendation:
> which format is performing best and what the user should prioritize next week.
> This is the complete use case: the user connects their own account,
> sees their own metrics, and decides what content to produce."

---

## CENA 7 — Controle do usuário: desconectar (3:20 – 3:40)

**ONDE VOCÊ ESTÁ:** volte ao topo, no botão **"Disconnect"**
**O QUE FAZER:** clique em Disconnect e mostre a tela voltando pro card *"Connect your Instagram"*.

> **FALAR:**
> "The user is always in control. Clicking Disconnect removes the access token
> and deletes the stored metrics. The app goes back to having no data.
> CRIA is read-only: we never publish, comment or message on the user's behalf.
> Thank you."

**FIM.** Pare a gravação.

---

## Erros que reprovam (não faça)

| ❌ Erro | Por quê |
|---|---|
| Começar com a conta já conectada | Não mostra o consentimento — foi isso que reprovou |
| Mostrar a conexão e não mostrar os dados | O revisor precisa ver a API sendo **usada** |
| Borrar as métricas | Sem dado visível, não há prova de uso |
| Cortar/editar o vídeo | Levanta suspeita de que algo foi omitido |
| Tela cheia (sem barra de endereço) | Não dá pra provar que passou pelo `facebook.com` |
| Interface em português | Item 4 do feedback deles |
| Mouse rápido demais | O revisor não acompanha e reprova por "não demonstrado" |

---

## Depois de gravar

1. Assista o vídeo inteiro fingindo que você é o revisor e **não conhece o app**. Deu pra entender o que cada botão faz? Deu pra ver o dado?
2. Suba o vídeo no reenvio ("Solicitar novamente").
3. Cole o texto das observações — **inclusive a nota de servidor-a-servidor** (está no arquivo `META-APP-REVIEW.md`). Sem ela, o revisor não vê toda a autenticação no front-end e pode reprovar pelo mesmo motivo.
