-- ============================================================
-- CRIA CAPTAÇÃO v3: o ROTEIRO vira documento de gravação
--
-- O que existia: um campo de texto solto por roteiro (`content`), sem ordem,
-- sem cenas, sem referência, sem data/local. Na prática a social mídia
-- continuava montando o guia da gravação FORA do Cria (no Canva/Docs, como o
-- "Roteiros Laura") e o módulo não ajudava em nada.
--
-- O que a gravação real precisa (tirado do guia que a Gabriela usa com a
-- Laura, e do que faltou nele):
--   · TÍTULO do vídeo e SOBRE O VÍDEO (a ideia, em uma frase)
--   · DATA da gravação e LOCAL
--   · REFERÊNCIA: link do reel/tiktok que serve de exemplo (clicável)
--   · CENAS numeradas, e cada cena com FALA + DIREÇÃO (o que fazer/filmar).
--     A direção é exatamente o que faltava no guia dela.
--   · ORDEM: a social mídia decide o que grava primeiro.
--
-- `content` continua existindo (roteiro em texto corrido) pra não quebrar o que
-- já foi escrito: quando não há cenas, ele é a fonte; ao editar em cenas, ele é
-- regravado como texto legível (teleprompter e "virar post" seguem funcionando).
-- ============================================================

alter table public.capture_scripts
  add column if not exists position       integer,
  add column if not exists about          text,
  add column if not exists reference_url  text,
  add column if not exists record_date    date,
  add column if not exists location       text,
  add column if not exists format         text,
  -- [{ "fala": "...", "direcao": "..." }]
  add column if not exists scenes         jsonb not null default '[]'::jsonb;

-- Ordem inicial = ordem de criação (o que a tela já mostrava).
update public.capture_scripts s
   set position = sub.rn
  from (
    select id, row_number() over (
             partition by manager_id, month, coalesce(crm_client_id::text, client_name)
             order by created_at
           ) as rn
    from public.capture_scripts
  ) sub
 where sub.id = s.id and s.position is null;

create index if not exists idx_capture_scripts_ordem
  on public.capture_scripts(manager_id, month, position);
