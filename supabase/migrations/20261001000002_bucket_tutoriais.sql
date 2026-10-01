-- Bucket privado dos áudios dos tutoriais (narração da ElevenLabs).
-- Só a edge tutorial-voz (service role) escreve e assina links.
insert into storage.buckets (id, name, public)
values ('tutoriais', 'tutoriais', false)
on conflict (id) do nothing;
