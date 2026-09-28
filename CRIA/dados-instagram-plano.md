# Dados do Instagram · coleta, ligação, análise e planejamento

Feito em 28/09/2026. Cinco ciclos, com revisão de falhas no fim (subagente de revisão, 12 achados corrigidos).

| Ciclo | O que mudou | Onde |
|---|---|---|
| 1 · Coleta confiável | Robô a cada 20 min (contas mais desatualizadas primeiro, ~1 dia de atraso no máximo) e stories a cada 3 h. Reels identificado de verdade. Visitas ao perfil e seguidores por post. Métrica desligada pela Meta removida. Totais da conta por dia (antes o total de 30 dias ia em cada dia e o Media Kit multiplicava). Só marca "reconecte" quando o problema é o token. | `instagram-sync`, `000009` |
| 2 · Ligação automática | Liga sozinho quando é certeza (publicado pelo Cria ou legenda praticamente igual). O resto vira sugestão com "É esse / Não é". Números entram no próprio post. Desligar à mão é respeitado. | `000010`, `SugestoesVinculo` |
| 3 · Análise honesta | Alcance típico (mediana), post com menos de 3 dias fora, mínimo de 3 posts por grupo pra virar frase, linha editorial, gancho agrupado pelo começo, período certo nos números de 30 dias, melhor horário pelo desempenho real. | `insightsUtils`, `bestTimes`, `BestTimeToPost` |
| 4 · Fecha o ciclo | O que performou vai pro Autopilot (texto + horários reais) e pras sugestões de ideias. | `useResumoDesempenho` |
| 5 · Agência | Relatório e aba Instagram do cliente numa fonte só (`ig_relatorio_cliente`): funciona pro Instagram conectado pela agência, sem corte de 48 posts, com peças produzidas, gancho e linha editorial. Consentimento do cliente Cria respeitado. | `000011` |

## Validação (depois de subir)
1. No dia seguinte: `select * from cron_runs where job in ('instagram-sync','instagram-stories');` tem que ter rodado com `ok = true`.
2. `select username, ultimo_sync_em from social_connections order by ultimo_sync_em;` todas com data de hoje/ontem.
3. Insights: aparecem "Reels" (não "Vídeos"), a caixa de sugestões de ligação e os grupos com "posts" contados.
4. Relatório de um cliente conectado pela agência: agora com Instagram.

## Fica pra depois
- Plano do Hub Cria (cliente da agência) ainda usa horário por nicho, não o desempenho do cliente.
- "Publicado" nos Relatórios ainda conta pelo card movido no kanban, não pela hora real no Instagram.
