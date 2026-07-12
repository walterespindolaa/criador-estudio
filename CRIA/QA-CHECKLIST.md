# Checklist de teste — o que mudou nesta rodada

Atualizado: 2026-07-12

---

## ⚠️ ANTES DE TESTAR — sem isso nada funciona

### SQL (rodar no Supabase)
- [ ] `20260711000001_crm_client_fields_tags.sql` — campos do cliente, status, etiquetas
- [ ] `20260711000002_post_draft_and_token_period.sql` — rascunho de post + link por período (⚠️ o `get_token_period` é **text**, não uuid)
- [ ] `20260712000001_fin_monthly.sql` — mensalidade como instância do mês

### Redeploy de edge (Lovable)
- [ ] **`apify-scrape`** — correção do bug reels = posts
- [ ] **`crm-sync-from-cria`** — sync da foto
- [ ] **`daily-notifications`** — notificação de aniversário
- [ ] `manager-member-invite`, `collab-seats-checkout`, `stripe-webhook` (se ainda não subiram)

### Push do frontend
- [ ] `git push` de tudo

---

## 1. HUB Criativo

- [ ] Rode **"Posts do feed"** e **"Reels"** no mesmo @ → os resultados agora têm que ser **diferentes** (reels só vídeo, com views). *Apague as análises antigas antes.*
- [ ] Anúncios (Meta): cada anúncio mostra **miniatura** + link **"ver na Ads Library"**
- [ ] As **ideias aparecem dentro de cada análise** (não mais numa pilha global no fim)
- [ ] O rótulo do campo de quantidade muda por tipo ("Quantos anúncios", "Quantos reels"); "desde a data" some para anúncios/perfil/comentários/stories

## 2. Cliente / Cria Gestão

- [ ] **Dinheiro:** digite `1197` ou `1.197,50` no valor mensal → tem que salvar certo (antes virava R$ 1,20). Campo vazio fica **vazio** (sem o zero preso). ⚠️ *Valores já salvos errados precisam ser reeditados.*
- [ ] **Autosave:** digite algo, saia da ficha e volte → tem que estar lá (aparece "Salvando… / Salvo ✓")
- [ ] **Foto:** troque a foto do cliente → tem que persistir ao voltar
- [ ] **Foto do Cria:** cliente que usa o Cria trocou a foto lá → reflete no Cria Gestão
- [ ] **Campos novos:** razão social, CNPJ, responsável, WhatsApp, endereço, aniversário, plano, dia de pagamento
- [ ] **Status** (Ativo/Pausado/Inativo) e **etiquetas** coloridas — aparecem na ficha **e na lista** de clientes
- [ ] **Personas:** crie 2–3 personas, salve, volte → nenhuma pode sumir

## 3. Pipeline / Leads

- [ ] **Kanban fluido:** arraste um lead de coluna → move **na hora** (antes voltava e só pulava depois de ~2s)
- [ ] **Novo lead:** não tem mais "Próxima ação" nem "Próximos passos"; **"Tarefas deste lead" aparece já no cadastro** — adicione 2 tarefas e salve → têm que ser criadas junto
- [ ] **Contratos:** aparece o disclaimer jurídico

## 4. Agenda

- [ ] Clique no **"+"** de um dia → escolhe o tipo: **Criação / Tarefa / Captação**, com cliente, hora, local, prioridade, notas
- [ ] Alterne **Semana / Mês** — as duas arrastáveis (a preferência fica salva)
- [ ] **Tarefa de lead sai azul** ("Lead · nome"); tarefa de cliente âmbar; captação teal
- [ ] Captação: tem **notas**; clicar no card abre a edição / excluir

## 5. Cria Post

- [ ] **Novo post:** a área de **mídia já funciona na hora** (não precisa mais salvar antes)
- [ ] **Cancelar** um post novo → o rascunho é apagado (não fica lixo no kanban)
- [ ] Formulário tem **data e horário** de publicação
- [ ] Alterne **Kanban / Calendário**; arraste um post entre dias → a data muda na hora e reflete no card
- [ ] Card do kanban tem **campo de data** direto
- [ ] **"Link dos posts"** abre um dialog: **link completo** OU **link de um período** (só os posts daquele intervalo aparecem pro cliente)

## 6. Cronograma

- [ ] Itens viraram **caixinhas separadas** (tipo · data · status, copy, descrição em bloco próprio)
- [ ] **Arraste pela alça** → o número acompanha (#4 vira #1) e salva
- [ ] **Parágrafos** da descrição aparecem na **aprovação do cliente** (antes viravam texto corrido)
- [ ] Só sobrou **um** botão de envio ("Enviar pra aprovação", que já copia o link)
- [ ] **"Lista anual"**: aparecem chips de **segmento**; o do cliente vem **sugerido** (ex.: "Assessor de Investimentos" → Finanças). Feriados nacionais no "Geral".

## 7. Cria Caixa (financeiro)

- [ ] **Previsão do mês** em destaque: bruto (recebido + a receber) e líquido (menos despesas)
- [ ] **Mensalidades:** marque uma como recebida → aparece **Desfazer**. Clique → volta pra pendente e o lançamento some. ← *era o seu problema*
- [ ] **Pular mensalidade** com motivo → fica "Pulado", não conta na previsão; dá pra **reverter**
- [ ] Mensalidade vencida e não paga ganha badge **Atrasado** sozinha
- [ ] **Status do lançamento** (pendente/pago/atrasado) é editável **direto na lista**
- [ ] **Calendário de recebimentos e pagamentos**: cada cliente cai no seu **dia de vencimento** (preencha o "Dia de pagamento" na ficha do cliente antes)
- [ ] **Relatório por período**: De/Até + atalhos (este mês / 12 meses / este ano), evolução mês a mês e **Exportar CSV**

## 8. Equipe / Colaborador

- [ ] `/socialmidia/equipe`: convidar colaborador abre um **popup** onde você escolhe **módulos e clientes** antes de enviar
- [ ] Assentos: 1 grátis; o 2º pede compra (R$ 29,90/mês)
- [ ] Colaborador loga → cai **direto na conta da agência**, vê só os módulos liberados, e o que ele cria aparece pra você

## 9. Cadastro de social mídia (novo)

- [ ] `/signup` tem o seletor **"Criador" / "Social mídia / agência"**
- [ ] `/cadastro/agencia` já entra com "agência" marcado
- [ ] Confirmando o e-mail → cai em `/comecar-agencia` → escolhe assentos → checkout
- [ ] ⚠️ Precisa do secret `STRIPE_PRICE_AGENCY_SEAT` configurado, senão dá `price_not_configured`

---

## Ainda pendente pro lançamento

- [ ] **Stripe em produção** (modo live, price IDs, webhook secret, compra real de ponta-a-ponta)
- [ ] Colaborador **Fase 2** (RLS por cliente no banco — hoje o escopo por cliente é controlado na UI)
- [ ] Meta app review (Insights do Instagram) — pós-lançamento
- [ ] Verificação Google/OAuth — pós-lançamento
