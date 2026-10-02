# Tutoriais do Cria

Versão 1 · 01/10/2026

## Como cada vídeo é feito

1. **Roteiro** (pasta `roteiros/`): cena por cena, com a tela, o que o cursor faz e o texto da voz.
2. **Telas:** capturadas no app, nas contas fake (criador, social mídia copiada da Gabriela com nomes trocados, parceiro). Nenhum cliente real aparece.
3. **Voz:** ElevenLabs, com a voz da Gabriela, gerada por uma função na Supabase (segredo `ELEVENLABS_API_KEY`; a chave não passa pelo chat).
4. **Montagem:** moldura do Cria (`tutorial-quadro-exemplo.png`), com a tela à esquerda e cursor animado, zoom na ação, o resumo "O que você vê aqui" e a lista "Neste vídeo" à direita, e a legenda sincronizada na faixa de baixo. 1920x1080.
5. **Onde fica:** área Tutoriais dentro do app, separada por criador, social mídia e parceiro. Cada módulo tem o manual em PDF e os vídeos, hospedados no Bunny.

## A série

| Roteiro | Público | Vídeos |
|---|---|---|
| 00 · Base da social mídia (grátis) | Social mídia | 5 |
| 01 · Cria Post | Social mídia | 7 |
| 02 · Cria Gestão | Social mídia | 6 |
| 03 · Cria Caixa | Social mídia | 6 |
| 04 · Cria Captação | Social mídia | 4 |
| 05 · Cria Radar | Social mídia | 4 |
| 10 · Criador de conteúdo | Criador | 10 |
| 20 · Parceiro | Designer, editor, filmmaker, copy | 3 |
| **Total** | | **45 vídeos** |

Cada módulo tem uma visão geral (1min30 a 2min) e vídeos curtos por função (30s a 1min10).

## Ordem de produção

1. Cria Post (piloto: valida voz, ritmo e montagem)
2. Base da social mídia
3. Criador
4. Cria Captação, Cria Caixa, Cria Gestão, Cria Radar
5. Parceiro

## Voz padrão (aprovada 01/10/2026, versão "C")

- Voz: **Gabriela 2** (ElevenLabs), modelo `eleven_multilingual_v2`, velocidade **1.04**.
- Ajustes: estabilidade **0.3**, similaridade **0.75**, estilo **0.45**.
- Sempre mandar o texto da cena anterior e da próxima (`ajustes.anterior` / `ajustes.proximo` na `tutorial-voz`), pra entonação não recomeçar a cada cena.
- A versão antiga (estabilidade 0.5, estilo 0.15, 1.08x, cenas isoladas) soava robótica.

## Pente fino (ajustes pra fazer depois que a série estiver toda montada)

- **01-cria-post-01, cena 3:** a voz tropeça em "legenda" (sai "legendia legenda") e estica o "cópia" em "copia num toque". Regerar a cena (exige login de admin), testando estabilidade mais alta ou outra frase.
- **01-cria-post-03, cena 2:** a voz diz "aprovou o tema e o conteúdo", a tela mostra três partes aprovadas (tema, conteúdo e mídia). Decidir: trocar a fala ou deixar.
- **01-cria-post-03, cena 3:** setinha cinza do mouse real aparece em duas capturas do card.
- ~~**01-cria-post-04:** conferir se "Vida Leve Suplementos" é marca real.~~ Resolvido: é cliente fictício da conta fake.
- **Conta fake, Canal da marca:** o recado fixo do Ateliê Flor de Sal (e outros clientes) tem links do Pinterest "kwkgabriela", copiados de dado real. O do Studio Lumen já foi trocado por texto neutro. Limpar os outros antes de gravar o módulo Parceiro.
- **01-cria-post-04, cena 2:** a tela já mostra "Usar" e "Descartar" marcados um instante antes do clique do cursor.
- **00-social-midia-04, cena 4:** tela provisória (quadro de produção sem entrega). Falta capturar "Pra você revisar / Tá ok": alguém entra como Bia (testetestado@gmail.com) e entrega a peça "Bastidores".
- **00-social-midia-00 cena 4 e 00-social-midia-01 cena 3:** a fala cita "vermelho", mas na conta fake só há bolinha verde e amarela.
- **00-social-midia-03, cena 2:** o "arrastar" é antes/depois com o cursor fazendo o gesto; o card não se move na tela.
- **10-criador-06 (Prompter):** o roteiro usado é curto e o texto quase não rola na captura; o modo voz e a câmera não aparecem ligados (pediriam permissão de microfone e câmera). Regravar com um roteiro longo, de preferência no celular.
- **10-criador-08 e 09:** a conta fake não tem Instagram conectado, então o Mídia Kit automático mostra "Conecte o Instagram" e os resultados do link na bio têm só 1 visita.
- **Conta fake de criador (Duda Reis), Prompter:** os roteiros "XPTO" (notícia de empresa real, com nome de jornalista) e "IA na prática: como eu uso pra escalar meus negócios" parecem dado real. Foram escondidos só na tela durante a gravação; apagar da conta.
