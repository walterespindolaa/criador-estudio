# Análise da Meta · permissão `instagram_business_content_publish`

Material do ciclo 7 do plano de publicar. Use depois que os testes dos ciclos 2 a 6 passarem. **Não envie a análise antes disso.**

## 1. Texto "Como o app usa esta permissão" (colar no formulário)

> Cria Social Club is a content planning tool for Instagram creators and social media managers. Users plan posts in a calendar, attach the image, carousel or video, write the caption and, when applicable, get client approval. With instagram_business_content_publish, the user can publish that post to their own professional Instagram account directly from Cria, either immediately ("Publicar agora") or automatically at the date and time they scheduled ("Publicar automaticamente na data e hora"). We only publish content the account owner (or their authorized team) created and explicitly asked to publish. We never publish on our own, never change the caption or media, and the user can turn automatic publishing off at any time. After publishing we store the media ID and permalink to show the post's results inside Cria using instagram_business_manage_insights.

## 2. Roteiro do vídeo de tela (2 a 3 minutos, sem cortes no meio do fluxo)

Grave no computador, em inglês na legenda da tela ou com narração curta. Conta de teste: @walterespindola_.

1. **Login no Cria** (tela de entrada, mostrando o e-mail).
2. **Configurações → Conexões → Conectar Instagram.** Mostrar a tela da Meta listando as permissões, com "publicar conteúdo" visível. Aceitar. Voltar pro Cria mostrando "Publicação pelo Cria liberada".
3. **Criando → Novo post (formato Estático).** Subir uma imagem, escrever a legenda, pôr data de hoje e hora daqui 3 minutos. Salvar.
4. **Caixa "Publicar no Instagram" → Checar mídia** ("Mídia pronta pro Instagram").
5. **Publicar agora → confirmar.** Mostrar "Publicado no Instagram" e clicar em **Ver**: abre o post no Instagram.
6. **Segundo post (Carrossel com 3 imagens):** ligar "Publicar automaticamente na data e hora". Mostrar o selo "IG agendado" no card do quadro. Esperar a hora, atualizar a tela: selo "No Instagram" e o link.
7. **Mostrar no app do Instagram (celular ou web)** os dois posts publicados na conta.
8. **Desligar:** abrir um terceiro post agendado, desligar a publicação automática (mostrar que o usuário controla).

## 3. Instruções pro revisor (campo "notes for reviewer")

> Test user: [e-mail de uma conta Cria criada só pra análise] / password: [senha]. The test account already has an Instagram professional account connected that is registered as an Instagram Tester of this app. Steps: Criando → open the post "Meta review" → box "Publicar no Instagram" → "Publicar agora". The post appears on the connected Instagram account within seconds (videos may take up to 2 minutes).

Crie a conta de revisor no Cria e conecte nela um Instagram de teste que também esteja como testador no app. A senha você digita no formulário da Meta. Não passe por aqui.

## 4. Checklist antes de enviar

- [ ] Ciclos 2 a 6 validados (ver `publicar-instagram-plano.md`).
- [ ] Política de privacidade do site cita publicação no Instagram em nome do usuário.
- [ ] Vídeo gravado seguindo o roteiro, em 1080p, sem mostrar senha nem chave.
- [ ] Conta de revisor funcionando (faça o caminho completo logado nela).
- [ ] Depois da aprovação: segredo `INSTAGRAM_PUBLISH_ALL` = `true` nas Edge Functions e aviso pra base reconectar (ciclo 8).
