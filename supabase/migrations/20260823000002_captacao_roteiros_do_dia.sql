-- ============================================================
-- CRIA CAPTAÇÃO v3.1: VÁRIOS roteiros dentro do MESMO dia de gravação
--
-- O erro do modelo anterior: a captação (o dia) tinha UM campo de roteiro
-- (agenda_captures.roteiro). Quem grava 5 vídeos numa tarde não tinha onde
-- colocar os outros 4, e o roteiro escrito ali não conversava com a biblioteca
-- do mês (aparecia numa lista separada, sem ordem, sem excluir, sem check).
--
-- Agora o roteiro é UMA COISA SÓ no sistema (capture_scripts) e ele pode estar:
--   · solto no mês (capture_id null)  -> pauta pronta, sem dia marcado ainda;
--   · preso a um dia (capture_id set) -> entra na lista daquela gravação.
-- Arrastar entre eles muda a ordem; o guia em PDF sai agrupado por dia.
--
-- O texto que já existia em agenda_captures.roteiro é MIGRADO pra cá como o
-- primeiro roteiro daquele dia, pra ninguém perder o que escreveu.
-- ============================================================

alter table public.capture_scripts
  add column if not exists capture_id uuid references public.agenda_captures(id) on delete set null;

create index if not exists idx_capture_scripts_captura
  on public.capture_scripts(capture_id, position);

-- ── Migração do roteiro que vivia dentro da captação ──
-- Só migra o que ainda não foi migrado (evita duplicar se rodar de novo).
insert into public.capture_scripts (
  manager_id, crm_client_id, client_name, month, title, content,
  source, capture_id, record_date, location, position, done
)
select
  c.manager_id,
  c.crm_client_id,
  c.client_name,
  to_char(c.capture_date, 'YYYY-MM'),
  'Roteiro da gravação',
  c.roteiro,
  'captacao',
  c.id,
  c.capture_date,
  c.location,
  0,
  (c.status = 'concluida')
from public.agenda_captures c
where coalesce(btrim(c.roteiro), '') <> ''
  and not exists (
    select 1 from public.capture_scripts s where s.capture_id = c.id
  );

-- O campo antigo fica no banco (histórico), mas a tela passa a ler daqui.
