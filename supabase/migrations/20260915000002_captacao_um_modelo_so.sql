-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 7: CAPTAÇÃO COM UM MODELO SÓ (15/09/2026)
--
-- O Cria Captação carrega DOIS modelos de roteiro ao mesmo tempo:
--
--   1. `agenda_captures.roteiro`   um campo de texto livre por dia agendado.
--                                  É o modelo de agosto, de quando "captação"
--                                  era uma linha na agenda.
--   2. `capture_scripts`           vários roteiros por cliente e por mês, com
--                                  cenas (fala + direção), referência, formato,
--                                  ordem, marcação de gravado e link de
--                                  aprovação do cliente. É o modelo de setembro.
--
-- Os dois aparecem NO MESMO CARD. A pessoa abre um dia de gravação e encontra
-- duas caixas de roteiro, uma embaixo da outra, com botões parecidos. Ela
-- escreve numa e o contador do topo conta a outra. É daí que vem a sensação de
-- módulo "defasado e confuso": não é falta de recurso, é recurso demais
-- falando duas línguas.
--
-- ATENÇÃO, PONTO DELICADO: a migration 20260823000002 JÁ COPIOU o campo antigo
-- pra capture_scripts, com `source = 'captacao'`, mas NÃO esvaziou a coluna.
-- Por isso:
--   a) o `not exists` aqui é por `capture_id`, igual ao de lá, e não por
--      `source`. Filtrar por source faria esta migration copiar TUDO DE NOVO e
--      duplicar todo roteiro já migrado em agosto;
--   b) o que esta migration acrescenta de fato é (1) migrar o que foi escrito
--      no campo antigo DEPOIS de agosto e (2) ESVAZIAR a coluna, que é o que
--      faz a tela parar de mostrar dois roteiros pro mesmo dia.
--
-- A coluna não é apagada, de propósito: apagar é irreversível, e se sobrou
-- alguma leitura num canto que eu não encontrei, o erro aparece em produção sem
-- volta. Ela fica vazia e sem uso, e sai numa limpeza depois da poeira baixar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) O que ficou pra trás vira roteiro de verdade ───────────────────────
insert into public.capture_scripts (
  manager_id, crm_client_id, client_name, month, title, content,
  source, capture_id, record_date, location, position, done
)
select
  c.manager_id,
  c.crm_client_id,
  c.client_name,
  to_char(c.capture_date, 'YYYY-MM'),
  -- O modelo antigo não tinha título. A data é melhor que "Sem título" numa
  -- lista de roteiros do mês.
  'Roteiro de ' || to_char(c.capture_date, 'DD/MM'),
  btrim(c.roteiro),
  'captacao',
  c.id,
  c.capture_date,
  c.location,
  0,
  coalesce(c.status, '') in ('concluida', 'gravada')
from public.agenda_captures c
where coalesce(btrim(c.roteiro), '') <> ''
  and not exists (
    select 1 from public.capture_scripts s where s.capture_id = c.id
  );

-- ── 2) A coluna antiga fica vazia ─────────────────────────────────────────
/* CUIDADO QUE CUSTOU UMA REESCRITA: a condição aqui NÃO pode ser "existe algum
   roteiro pra esta captação". Uma captação pode ter o texto velho E um roteiro
   novo escrito na lista (são dois campos diferentes na mesma tela, é o bug que
   este circuito conserta). Nesse caso "existe algum" seria verdadeiro, o texto
   velho seria apagado, e ele NÃO estaria em lugar nenhum: o insert do passo 1
   também pulou essa captação, pela mesma razão.

   Então só esvazia quando existe um roteiro com EXATAMENTE aquele conteúdo, o
   que prova que o texto está guardado. O resto fica onde está, e aparece na
   conferência do fim do arquivo pra ser resolvido na mão. */
update public.agenda_captures c
   set roteiro = null
 where coalesce(btrim(c.roteiro), '') <> ''
   and exists (
     select 1 from public.capture_scripts s
      where s.capture_id = c.id
        and btrim(coalesce(s.content, '')) = btrim(c.roteiro)
   );

comment on column public.agenda_captures.roteiro is
  'APOSENTADO em 15/09/2026. O roteiro vive em capture_scripts (um por vídeo, com cenas). Coluna mantida vazia por segurança; remover numa limpeza futura.';

-- Conferência (o segundo select tem que voltar vazio):
-- select count(*) from public.capture_scripts where capture_id is not null;
-- select id, capture_date from public.agenda_captures where coalesce(btrim(roteiro),'') <> '';
