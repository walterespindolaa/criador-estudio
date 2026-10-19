-- AGENDA DE CAPTAÇÃO V2 (Walter, 19/10/2026; mockup aprovado)
--
-- A mensagem pro grupo ganhou partes que ligam e desligam (ideias, roteiros,
-- checklist, link dos roteiros, assinatura) e um checklist "pra deixar pronto"
-- editável. Ficam na mesma config da agenda, por conta.

alter table public.captacao_agenda_config
  add column if not exists msg_opcoes jsonb not null default '{}'::jsonb,
  add column if not exists checklist jsonb not null default '[]'::jsonb;

comment on column public.captacao_agenda_config.msg_opcoes is
  'Partes da mensagem pro grupo: {ideias, roteiros, checklist, link_roteiros, assinatura} (bool). Ausente = padrão.';
comment on column public.captacao_agenda_config.checklist is
  'Itens do "Pra deixar pronto" da mensagem pro grupo (array de texto). Vazio = lista padrão.';
