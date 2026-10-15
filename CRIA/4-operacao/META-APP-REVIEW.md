# Meta App Review — reenvio (instagram_business_basic + instagram_business_manage_insights)

---

## 1. Leia isto primeiro: você NÃO foi reprovado no mérito

O feedback da Meta diz, com todas as letras: *"Determinamos que o caso de uso do seu app é permitido, contudo, o screencast enviado não demonstra a experiência completa do caso de uso."*

- ✅ `public_profile` — **aprovado**
- ❌ `instagram_business_basic` — reprovado **por causa do vídeo**
- ❌ `instagram_business_manage_insights` — reprovado **por causa do vídeo**

**Não é problema de produto, nem de política, nem de código.** É o screencast. Refaz o vídeo e reenvia em "Solicitar novamente".

O erro clássico (e provavelmente o seu): o vídeo mostrou a **conexão** da conta, mas não mostrou o **dado da API sendo usado na tela**. A Meta quer ver o ciclo inteiro, do login ao valor entregue ao usuário.

---

## 2. O que já foi ajustado no sistema

- **Tela de Insights 100% em inglês** (i18n de verdade, não legenda): título, conexão, KPIs, gráficos, drivers, leitura da IA.
- **Menu lateral em inglês** — aparece em todos os frames do vídeo.
- Login e cadastro **já estavam** traduzidos.
- O seletor de idioma fica em **Configurações → Visual** (PT / EN).

⚠️ Antes de gravar: entre em **Configurações → Visual → English**. Confira que a tela de Insights e o menu estão em inglês.

---

## 3. Roteiro do screencast (grave nesta ordem, sem cortes)

> Duração alvo: 2 a 4 minutos. **Uma tomada contínua.** Cortes levantam suspeita de que algo foi escondido.

**00:00 — Contexto**
Tela de login do Cria (`app.criasocialclub.com.br/login`), já em inglês. Faça o login com e-mail e senha.

**00:20 — Estado inicial: SEM conta conectada**
Navegue pelo menu até **Results → Insights**. A tela tem que mostrar o card *"Connect your Instagram"*.
👉 Isso prova que o app não tem dado nenhum antes do consentimento. **Não pule esta parte.**

**00:35 — Início do fluxo de login da Meta**
Clique em **"Connect Instagram"**.
👉 **Mostre a barra de endereço**: tem que aparecer `facebook.com` / `instagram.com`. É o item 1 do feedback ("o fluxo de login completo da Meta").

**00:50 — Login e consentimento**
Faça o login na conta de teste do Instagram (Business ou Creator). Passe **devagar** pela tela de permissões — a Meta quer ver as permissões listadas e você clicando em **Allow / Permitir**.
👉 Item 2 do feedback ("um usuário fornecendo ao app acesso à permissão").

**01:20 — Volta pro app: o dado aparecendo**
De volta na tela de Insights, mostre **lentamente**, com o mouse parando em cada bloco:
- A barra da conta conectada (@usuário, "Connected")
- **Followers / Reach (30d) / Interactions (30d) / Profile views** ← isto é o `instagram_business_manage_insights`
- Os gráficos **Reach · last 30 days** e **Followers · last 30 days**
- A lista de **posts** com alcance, salvos e interações por post
- Clique em **"Refresh"** e mostre os dados atualizando

👉 Item 3 do feedback ("a experiência completa do caso de uso"). **É aqui que o vídeo anterior falhou.**

**02:30 — Encerramento**
Clique em **"Disconnect"** e mostre a tela voltando pro estado *"Connect your Instagram"*.
👉 Demonstra que o usuário controla o próprio dado. Ponto forte de confiança.

---

## 4. Como gravar (regras da Meta)

- **Interface em inglês** — já resolvido, é só trocar o idioma antes de gravar.
- **Uma tomada contínua**, sem cortes.
- **Mouse devagar.** O revisor precisa acompanhar. Pare 2–3 segundos em cada elemento importante.
- **Mostre a barra de endereço** durante todo o vídeo (não use tela cheia).
- **Sem borrar nada.** Se borrar as métricas, eles não conseguem ver o dado da API e reprovam de novo.
- **Sem música**. Narração em inglês é opcional; legendas em inglês ajudam.
- Grave em **1080p** no mínimo.
- Use a **conta de teste do Instagram** vinculada ao app (Business ou Creator), com posts e métricas reais — conta vazia não demonstra nada.

---

## 5. Texto pra colar nas observações do reenvio

Cole isto no campo de notas da submissão (em inglês):

```
CRIA is a content management platform for creators and social media managers.

Use case for the requested permissions:
Users connect their own Instagram Business/Creator account to see their
performance metrics inside CRIA and decide what content to produce next.

- instagram_business_basic: used to identify the connected account (username,
  account type, profile picture) and to list the user's own media so they can
  link each post to the content they planned inside CRIA.

- instagram_business_manage_insights: used to display the user's own account
  and media insights — followers, reach, interactions, profile views, and
  per-post reach/saves/interactions — in charts and KPI cards on our Insights
  screen. These metrics drive our "actions for next week" recommendations.

Important notes:
1. CRIA is READ-ONLY with respect to the Instagram API. We never publish,
   comment, message or modify anything on the user's behalf.
2. The OAuth token exchange and the periodic metrics sync are performed
   SERVER-TO-SERVER (Supabase Edge Functions). The user-facing login/consent
   flow with Meta is fully visible in the screencast; the token exchange itself
   happens on our backend and is therefore not visible in the front-end.
3. Users can disconnect their account at any time from the Insights screen,
   which deletes the stored token and metrics.
4. The app interface is available in English (Settings → Visual → English),
   which is the language used in the submitted screencast.

Privacy Policy: https://app.criasocialclub.com.br/privacidade
Data deletion: https://app.criasocialclub.com.br/excluir-dados
```

O **ponto 2 é obrigatório**: o feedback deles pede explicitamente que você declare se o app é servidor-a-servidor. O `instagram-oauth` do Cria é uma Edge Function, então parte da troca de token não aparece no front — se você não avisar, o revisor vai estranhar e pode reprovar de novo pelo mesmo motivo.

---

## 6. Checklist antes de clicar em "Solicitar novamente"

- [ ] App em **inglês** (Settings → Visual → English)
- [ ] Conta de teste do Instagram **Business ou Creator**, com posts e métricas reais
- [ ] Começar o vídeo com a conta **desconectada**
- [ ] `facebook.com` visível na barra de endereço durante o login
- [ ] Tela de **permissões** aparecendo e sendo aceita
- [ ] **KPIs, gráficos e posts** exibidos com dados reais, sem borrão
- [ ] Botão **Disconnect** demonstrado
- [ ] Uma tomada só, 1080p, sem cortes
- [ ] Texto das observações colado (com a **nota de servidor-a-servidor**)
- [ ] Política de Privacidade acessível na URL informada
