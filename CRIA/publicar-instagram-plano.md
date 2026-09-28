# Publicar no Instagram direto do Cria · plano (modo deus)

Criado em 28/09/2026. Cada ciclo só começa quando o anterior passar no **portão de validação** (o que eu testo + o que você confere). No fim de cada ciclo eu faço uma **revisão de falhas** (outro olhar em cima do que foi feito, procurando regressão, segurança e caso de borda) antes de avançar.

---

## O que já existe (mapeado hoje)

- Login do Instagram (o oficial, sem página do Facebook) funcionando pra **3 caminhos**:
  1. criador conecta a própria conta;
  2. social mídia (ou alguém da equipe) conecta o Instagram do **cliente** pela ficha;
  3. cliente que tem conta Cria própria conecta o dele, e a agência lê via funções do servidor.
- Tokens guardados em `social_connections`, **invisíveis pro navegador** (só o servidor lê). Renovação diária automática.
- Robôs agendados (pg_cron) já rodam com o segredo interno; dá pra reaproveitar o padrão.
- Botão manual "Publicar" (copia legenda e abre o app) e "marcar como publicado".
- Números por post (insights) e vínculo post ↔ publicação do Instagram (hoje manual).

## O que falta (as lacunas que o mapa achou)

| # | Lacuna | Onde bate |
|---|--------|-----------|
| L1 | A permissão de **publicar** não é pedida em lugar nenhum; todo token atual não tem ela | login (3 arquivos) |
| L2 | O Cria grava as permissões "no chute", não as que a Meta realmente deu | `instagram-oauth` |
| L3 | Não existe onde registrar a publicação: id da mídia, link, status, erro, tentativas | tabela `posts` |
| L4 | Mídia do **Google Drive** não é um arquivo que o Instagram consegue baixar | `external_media_refs` |
| L5 | Vídeo no **Bunny** é página de player, não MP4; pode estar em 720p e sem MP4 ligado | Bunny |
| L6 | Imagem pode ser PNG/WebP; a API quer **JPEG** | upload |
| L7 | Mídia com prazo de validade (7/30 dias) e limpezas automáticas podem apagar o arquivo antes da data agendada | robôs de limpeza |
| L8 | Dois sistemas de status: criador (`agendado → publicado`) e Cria Post (`aprovado → postado`); "postado" nem grava a data | posts |
| L9 | Instagram do cliente conectado por **membro da equipe** fica no nome do membro; precisa achar pelo cliente, não por quem clicou | `social_connections` |
| L10 | Token morto não fica marcado; não dá pra avisar "reconecte" com segurança | `instagram-refresh` |
| L11 | Horário é texto livre, sem fuso; publicar na hora certa exige tratar como horário de Brasília | posts |
| L12 | Duas funções do banco existem só em produção (não estão nos arquivos) | `manager_publish_client_post`, `criapost_*` |

---

## Linha do tempo

### Ciclo 0 · Decisões e checagem da Meta (você + eu, 1 dia)
- Você confere no painel da Meta: negócio **Verificado**, app **publicado**, `instagram_business_basic` e `instagram_business_manage_insights` com **acesso avançado**.
- Você adiciona no app a permissão `instagram_business_content_publish` (ainda sem pedir análise) e cadastra suas contas de teste como **testadoras**.
- Decidimos: Stories na v1? Publicação automática no horário ou só botão "Publicar agora" primeiro? Cliente precisa ter aprovado antes de publicar?
- **Portão:** prints do painel + decisões registradas aqui.

**Decisões (28/09/2026, Walter):**
1. v1 tem **botão "Publicar agora" + publicação automática** na data e hora.
2. **Stories ficam pra depois.** v1 = foto, carrossel e Reels.
3. Cria Post: só publica post **aprovado pelo cliente** (botão travado antes disso).
4. Mídia só no Drive: o Cria **copia sozinho** pro armazenamento dele; se o arquivo não estiver aberto ("Qualquer pessoa com o link"), mostra o aviso.

**Status ciclo 0 (28/09):** negócio Verificado, verificação de acesso OK, app publicado, `instagram_business_basic` e `instagram_business_manage_insights` aprovados (23/07/2026). Pendente: adicionar `instagram_business_content_publish` e cadastrar testadores (necessário só a partir do ciclo 2).

### Ciclo 1 · Fundação no banco (sem mudar nada que o usuário vê) · ✅ validado em 28/09

**Resultado do portão:** fuso ok (14:30 BR = 17:30 UTC); busca da conexão ok nos 6 posts (@walterespindola_); estranho barrado com "sem permissão". Funções de produção capturadas em `20260928000003_captura_funcoes_producao.sql`.

**Achados da revisão (entram nos próximos ciclos):**
- A conexão do @walterespindola_ está com o token VENCIDO. A renovação diária não segurou: investigar no ciclo 2 (sem renovação confiável, post agendado falha).
- `criapost_reorder_media` e `criapost_touch_media` só aceitam o dono; colaborador fica de fora (corrigir no ciclo 3).
- Mídia do Cria Post nasce com validade de 7 dias (corrigir no ciclo 3, L7).

- Colunas novas em `posts`: `ig_media_id`, `ig_permalink`, `ig_container_id`, `publicar_em` (timestamp com fuso), `publish_status` (nada, na_fila, publicando, publicado, erro), `publish_error`, `publish_attempts`, `publish_by`, `auto_publish`.
- `social_connections`: `needs_reconnect` e permissões reais.
- Função do servidor que responde "qual token uso pra este post?" cobrindo os 3 caminhos (L9) e checando que quem pede tem direito (dono, equipe, agência do cliente).
- Trazer pros arquivos as duas funções que só existem em produção (L12), sem mudar comportamento.
- **Portão:** SQL roda sem erro; teste de acesso (dono vê, membro vê, estranho não vê); nada muda na tela.

### Ciclo 2 · Login com a permissão nova

**Passo 0 (28/09) ✅:** robôs religados (`000004`) e segredo interno movido pro cofre (`000005`). O segredo do gatilho não batia com o das funções: robôs e push no celular respondiam 401. Teste manual: 200.

**Feito (28/09):** `000006` (lista de testadores + needs_reconnect visível); `get-instagram-config` pede publicar só pra testador na conta própria (ou pra todos com `INSTAGRAM_PUBLISH_ALL=true` depois da aprovação); `instagram-oauth` grava as permissões reais; `instagram-refresh` marca token morto e tira da fila; aviso "Conexão vencida / Reconectar" em Insights e Configurações, e selo "Publicação pelo Cria liberada".
- Pedir `instagram_business_content_publish` no login (L1) e gravar as permissões que a Meta devolveu de verdade (L2).
- Renovação marca `needs_reconnect` quando o token morre (L10).
- Aviso "Reconecte o Instagram pra publicar pelo Cria" onde a conta não tem a permissão.
- **Portão:** você reconecta a sua conta e a de um cliente de teste; o Cria mostra "pode publicar" nas duas.

### Ciclo 3 · Preparar a mídia (a parte mais delicada)

**Código pronto (28/09), aguardando validar o ciclo 2:**
- `000007`: colunas `ig_*` em `external_media_refs` (URL pronta, tipo, tamanho, duração, erro); reordenar e renovar mídia passam a aceitar a equipe.
- `_shared/ig-midia.ts` + função `instagram-preparar-midia` (JWT ou segredo interno + actor): JPEG bom passa direto; PNG/WebP/GIF/JPEG > 8 MB vira JPEG 1440px no bucket `media/<dono>/ig/<post>/`; HEIC dá erro claro; Drive (só com link aberto) é copiado pro nosso bucket (foto) ou pro Bunny por stream (vídeo); Bunny devolve o MP4 direto (exige "MP4 Fallback" ligado na biblioteca). Valida regras por formato (foto 1 imagem, Reels 1 vídeo 3 s a 15 min, carrossel 2 a 10, vídeo de carrossel até 60 s, proporção 4:5 a 1.91:1). Resultado fica guardado; chamar de novo continua de onde parou.
- `criapost-media-cleanup`: não apaga mídia de post na fila ou com data de hoje em diante ainda não publicado (empurra a validade 2 dias).
- Achados pro ciclo 4: vídeo do Drive copiado pro Bunny (`ig_bunny_guid`) tem que ser apagado depois de publicar; as funções de status/apagar vídeo do Bunny usam a biblioteca antiga (STREAM) enquanto os vídeos novos nascem na CRIAPOST.

- Antes de publicar, o servidor garante um arquivo público e no formato certo:
  - imagem: converte pra JPEG, respeita proporção (4:5 a 1.91:1 no feed, 9:16 no story);
  - vídeo: pega o MP4 do Bunny (ou do nosso armazenamento); confere duração e proporção de Reels;
  - Drive: copia o arquivo pro nosso armazenamento (só funciona se o link estiver aberto); se não der, erro claro "deixe o arquivo como Qualquer pessoa com o link".
- Mídia de post agendado **não expira** até ser publicada (L7).
- **Portão:** teste com 1 foto PNG, 1 carrossel misto, 1 Reels do Bunny e 1 arquivo do Drive; todos viram URLs válidas.

### Ciclos 4, 5 e 6 · código pronto (28/09), testar depois do ciclo 3
- `000008`: trava contra duas publicações (`ig_travar_publicacao`), liga/desliga automático com as regras (`ig_agendar_publicacao`), horário acompanha mudança de data/hora, números do Instagram ligam sozinhos ao post publicado, robô `cria-ig-publicar-fila` a cada minuto (só chama a função quando há post vencido).
- `_shared/ig-publicar.ts` + função `instagram-publish`: foto, Reels e carrossel; espera o processamento; continua do contêiner guardado se o vídeo demorar; marca publicado nos dois status (criador e Cria Post); erro traduzido; token morto marca reconectar; aviso no sino e no celular; apaga a cópia do vídeo do Drive no Bunny depois de publicar. Robô tenta até 3 vezes com espera de 10 e 20 min.
- Tela: caixa "Publicar no Instagram" no editor do criador (abaixo da data) e no Cria Post (acima da mídia); selo nos cards do quadro do criador e do Cria Post. Só aparece pra conta que pode publicar.
- Material da análise da Meta (ciclo 7): `CRIA/meta-analise-publicar.md`.

### Ciclo 4 · Motor de publicação (servidor)
- Função `instagram-publish`: cria o contêiner, espera o processamento do vídeo, publica, grava `ig_media_id` + link, marca o post como publicado nos dois sistemas de status (L8) e liga automaticamente aos números (insights).
- Carrossel até 10 itens na ordem da tira; legenda até 2.200 caracteres e 30 hashtags (valida antes).
- Erro vira mensagem em português (token vencido, mídia inválida, limite de 100/dia) + registro no log.
- **Portão:** "Publicar agora" em conta de teste: foto, carrossel e Reels saem no Instagram; o post no Cria mostra o link.

### Ciclo 5 · Telas (criador e social mídia)
- Editor do criador e editor do Cria Post: botão **"Publicar no Instagram"** + opção **"Publicar automaticamente na data e hora"**.
- Selo no card (na fila / publicando / publicado / erro) no quadro, calendário e agenda.
- Checagem antes de agendar: conta conectada com permissão, mídia pronta, legenda dentro do limite.
- Social mídia: só publica em cliente com Instagram conectado e (se decidido no ciclo 0) post aprovado; registra quem publicou.
- **Portão:** você e a Gabriela fazem o caminho completo nas duas visões, no computador e no celular.

### Ciclo 6 · Agendamento automático
- Robô a cada minuto pega os posts com `publicar_em` vencido, publica, tenta de novo até 3 vezes com espera, e avisa no sino/e-mail se falhar.
- Trava contra publicar duas vezes (dois robôs pegando o mesmo post).
- Horário sempre em Brasília (L11).
- **Portão:** 3 posts agendados pra daqui a 5, 10 e 15 minutos saem sozinhos; 1 com mídia quebrada gera aviso.

### Ciclo 7 · Revisão geral + material pra Meta
- Revisão de falhas do conjunto (segurança, casos de borda, textos).
- Roteiro do vídeo de tela pra análise, contas de teste pro revisor, textos do "como usamos a permissão".
- **Portão:** você grava o vídeo seguindo o roteiro e enviamos a análise.

### Ciclo 8 · Liberação
- Aprovado pela Meta: aviso pra todos reconectarem, texto de ajuda, acompanhamento dos primeiros dias pelo relatório de saúde.

---

## Limites que valem pra sempre
- Até 100 publicações pela API a cada 24 h por conta.
- Sem música da biblioteca do Instagram e sem figurinhas interativas pela API.
- Só contas profissionais (empresa ou criador).
- Enquanto a Meta não aprovar, só publica nas contas cadastradas como testadoras.
