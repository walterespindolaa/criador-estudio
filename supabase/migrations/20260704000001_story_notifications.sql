-- Notificação por story: título/corpo e marca quando já foi disparada.
alter table public.story_slots
  add column if not exists notify_title text,
  add column if not exists notify_body text,
  add column if not exists notified_at timestamptz;

create index if not exists idx_story_slots_notify_pending
  on public.story_slots(slot_date)
  where notify_title is not null and notified_at is null;
