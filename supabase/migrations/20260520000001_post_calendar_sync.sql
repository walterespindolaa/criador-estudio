-- Calendar sync: store the Google Calendar event id linked to each post
-- so we can update / delete the event later (and avoid duplicates).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT NULL;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ DEFAULT NULL;
