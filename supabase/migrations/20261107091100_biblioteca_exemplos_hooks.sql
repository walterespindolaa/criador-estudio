-- Exemplos de uso dos 59 hooks curados (07/11/2026). Idempotente.

-- Exemplos dos hooks curados, bloco 1 de 3
update public.reference_hooks as h set example = v.ex
from (values
  ('e22a9ce9-ffd2-47a9-a9d0-ed57b9f44a63'::uuid, 'Não perca essa dica essencial: responda os comentários na primeira hora do post.'),
  ('17b820e9-fee3-41eb-a4da-56656f4e65e5'::uuid, 'Pare de rolar e presta atenção: seu Reels perde gente nos 2 primeiros segundos.'),
  ('1697715f-c78e-426c-ad12-7fd58702acce'::uuid, 'Salve esse vídeo pra quando for montar o cardápio de Natal da sua confeitaria.'),
  ('3dde2c65-4c88-4994-a559-3c526b098346'::uuid, 'Depois de 5 anos atendendo noivas, aqui está o que aprendi sobre orçamento.'),
  ('0251fda7-f54a-458a-8ec1-37012808e5bc'::uuid, 'Essa é a técnica que uso pra gravar 10 vídeos em uma tarde.'),
  ('8e30090b-cadd-4d0a-b3cb-e6395b0ecc1e'::uuid, 'Se eu pudesse te dar um conselho sobre dinheiro, seria esse: pague você primeiro.'),
  ('73ec387e-dd7f-494d-b6fe-e33ba686d38e'::uuid, 'Como deixar seu feed com cara de marca sem gastar dinheiro.'),
  ('c9218772-b33c-4f36-95d6-9b2246470842'::uuid, 'Como fazer luz de estúdio de forma fácil, só com uma janela.'),
  ('4b99fb19-e933-48e6-a073-7356bac6c138'::uuid, 'O jeito mais simples de organizar a semana de posts num domingo à noite.'),
  ('c49de90b-6608-4fd1-a055-4351626978bd'::uuid, 'A diferença entre quem fecha publi e quem não fecha é o media kit.'),
  ('f840e6e5-b5db-41e8-bd94-fd16dad15e5d'::uuid, 'Antes vs depois de eu descobrir o roteiro em 3 partes.'),
  ('d9dc4323-e2ce-4358-8088-33822ffa4da7'::uuid, 'Postar todo dia parece certo. O que funciona é postar o que salva.'),
  ('e7847acd-76d2-422f-a531-9780a0753a60'::uuid, 'Todo mundo fala pra usar hashtag, mas ninguém fala que a legenda pesa mais.'),
  ('40fab731-c523-4f36-b1ae-adf71e942eb1'::uuid, 'Esse é o segredo que mudou meu engajamento: perguntar no começo, não no fim.'),
  ('b838ae12-ef59-460a-b387-be09ab40dacc'::uuid, 'Eu pensava que precisava de câmera cara, até descobrir isso no meu celular.'),
  ('d67de3d9-0852-4d33-b05a-e898ced5e5e5'::uuid, 'Isso muda tudo sobre como você precifica seu trabalho.'),
  ('4d221658-9693-49a6-83dd-56d1b913e2e1'::uuid, 'Nunca pensei que fosse tão fácil tirar o fundo de uma foto no próprio Instagram.'),
  ('6b69b45c-4fb1-4e50-a199-250b4af1126a'::uuid, 'O que ninguém te conta sobre viver de conteúdo: o mês sem publi chega.'),
  ('bd4c1f34-5659-4c32-b997-9fc94eb61bbc'::uuid, 'O que ninguém te conta sobre abrir MEI pra receber publi.'),
  ('c0e02da1-57e2-4b64-9d75-07179fac41ff'::uuid, 'Pouca gente sabe disso, mas o Instagram mostra seu post pra quem salvou o anterior.')
) as v(id, ex)
where h.id = v.id;

-- Exemplos dos hooks curados, bloco 2 de 3
update public.reference_hooks as h set example = v.ex
from (values
  ('3c3c4c61-74d8-40f2-b76f-d20ba33de67a'::uuid, 'Se eu soubesse disso antes, teria economizado 6 meses de post sem resultado.'),
  ('4c3b06f8-7782-4353-b740-cd4c0f2a2a57'::uuid, 'Você conhece essa dica simples pra legenda não cortar no meio da frase?'),
  ('9124e8c5-0b48-4db5-bc9e-a6a1611ff599'::uuid, 'Você já pensou por que seu melhor post foi o que você quase não postou?'),
  ('a95aaff4-1e0a-4065-afd3-90de2bcc930c'::uuid, 'Você sabia que um carrossel com 10 telas costuma ter mais salvamento que um de 3?'),
  ('552080ea-d45b-4a3c-8f2a-a96983d43370'::uuid, 'Acha que já sabe tudo sobre Reels? Pense de novo: a capa ainda decide o clique.'),
  ('ba4603b1-d42a-47f1-a376-45d31d6c7394'::uuid, 'Aposto que você nunca ouviu falar do agendamento de stories pelo computador.'),
  ('05ae9630-a24c-413c-8bf7-25b4af8a1c2d'::uuid, 'Duvido que você saiba quanto custa de verdade o seu bolo de pote.'),
  ('bd43417d-1b25-44d3-902f-06bfa1b3623a'::uuid, 'Cansado de cliente que some depois do orçamento? Eu também estava.'),
  ('5c990edd-a28d-4622-a9a7-8ca475f7b0b2'::uuid, 'Esse erro pode estar te impedindo de fechar a primeira publi.'),
  ('3ce494eb-9048-4b31-aa84-9e30ef5d3de2'::uuid, 'Se gravar falando pra câmera te trava, assiste isso até o final.'),
  ('c7529ed6-1102-4bcc-861a-ae1cf81a2dcb'::uuid, 'Você está fazendo stories de bastidor errado. Veja porquê.'),
  ('54fa1835-5924-4d48-88af-cd08e50ef462'::uuid, 'Eu também já passei por bloqueio criativo, e aqui está o que aprendi.'),
  ('962da6df-1467-4930-a143-791ba0f8ec66'::uuid, 'Se você posta todo dia e não cresce, esse vídeo é pra você.'),
  ('dceb1c01-ce7d-47e1-9ebf-17be6ce2d7bc'::uuid, 'Se você responde orçamento pelo WhatsApp, precisa ver isso.'),
  ('0f108078-92a8-4326-a595-ebbd06bad5f4'::uuid, 'Toda social mídia já recebeu um áudio de 4 minutos pra mudar uma vírgula.'),
  ('6d212fa2-d286-4431-ba0e-f463fc5e0667'::uuid, 'Nunca é tarde pra começar: abri meu perfil aos 42 e hoje vivo dele.'),
  ('0c118f2e-22d1-49c8-88d7-2f7a4e7088a3'::uuid, 'O maior limite está em não tentar: meu primeiro Reels teve 38 visualizações.'),
  ('d30f36e9-9390-4c94-99e3-856fa11c1e4a'::uuid, 'Se eu consegui sair da CLT com a confeitaria, você também consegue.'),
  ('827f721e-2a6a-4844-82eb-3ef5a8ae3e86'::uuid, 'A verdade que ninguém fala sobre seguidores comprados.'),
  ('9424152b-7504-40f1-8fc1-2216d333a3c8'::uuid, 'Me julga, mas eu gravo a semana inteira numa segunda e funciona.')
) as v(id, ex)
where h.id = v.id;

-- Exemplos dos hooks curados, bloco 3 de 3
update public.reference_hooks as h set example = v.ex
from (values
  ('4b66aaff-960c-4441-8729-e2fe21adc276'::uuid, 'Por que postar no horário de pico está ERRADO pro seu perfil.'),
  ('a5fb3e69-8c87-44ea-ae6e-570348c24e45'::uuid, 'Vou falar o que toda social mídia pensa: cliente que não aprova trava o mês inteiro.'),
  ('35affced-2ce8-4516-81e0-690c09fec077'::uuid, 'A maioria das pessoas falha no Reels porque começa se apresentando.'),
  ('b1b78460-fa2c-4243-864d-b3d48e6dd981'::uuid, 'A razão pela qual você ainda não fechou publi é o seu perfil não dizer o que você faz.'),
  ('5415e6d1-e863-4684-8555-168e25e73eec'::uuid, 'Cansado de post que ninguém salva? Eu também estava.'),
  ('6a841c73-8063-4530-8075-007f300e5ef7'::uuid, 'Esse erro pode estar te impedindo de avançar: falar com todo mundo ao mesmo tempo.'),
  ('ec006f7c-9264-4abb-83f3-a6a27bb3e251'::uuid, 'A fórmula que me ajudou a sair de 2 mil pra 10 mil seguidores em 6 meses.'),
  ('e699b72e-ad73-4d1d-b9d9-287a3c49c4bf'::uuid, 'Em 30 dias você vai ter um calendário de posts que anda sozinho com esse método.'),
  ('13656c6f-3528-40e4-9d05-a0b454199813'::uuid, 'O segredo que as grandes marcas não te contam sobre foto de produto.'),
  ('bc264845-8b90-4fd3-9b13-b211f1c5541f'::uuid, 'Você NÃO precisa de ring light pra gravar um Reels bonito.'),
  ('510edfba-0525-4ac2-8571-9876a8413811'::uuid, 'Consegui 3 clientes novos em apenas 2 semanas com isso.'),
  ('c1b1c77e-86ea-4bb5-9dbf-ab376b9cee52'::uuid, 'Foi assim que eu consegui minha primeira publi em 90 dias.'),
  ('eade2d17-b14e-4994-bf65-01c5a529e328'::uuid, 'Poucos sabem sobre essa dica: a primeira linha da legenda é o segundo gancho.'),
  ('fa7adfbb-a4ad-4a55-a376-884b97e21404'::uuid, 'Se eu soubesse disso antes, teria cobrado o dobro no meu primeiro cliente.'),
  ('670ca6d8-53df-4129-a7d4-295e43214354'::uuid, 'Você vai se surpreender com quanto tempo um roteiro pronto economiza.'),
  ('4d104934-c93d-43e5-9156-90667fafb2af'::uuid, 'Vou contar um segredo sobre o algoritmo: ele mede quem volta a ver.'),
  ('f89ade6b-02df-455f-a59e-92485fb4a1db'::uuid, 'Eu costumava pensar que era impossível viver de conteúdo no interior, até que...'),
  ('0c910007-11b5-470a-ba83-644520f5d27c'::uuid, 'Eu estava prestes a desistir do perfil, até que um vídeo de 15 segundos mudou tudo.'),
  ('49b2af68-e9a9-4fa7-88cd-b7e0e70f0bd3'::uuid, 'Tudo começou quando eu descobri que ninguém entendia o que eu vendia.')
) as v(id, ex)
where h.id = v.id;
