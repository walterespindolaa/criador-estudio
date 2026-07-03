-- Vincula a arte gerada no Cria Estúdio ao post do kanban que a originou.
alter table public.higgsfield_jobs
  add column if not exists post_id uuid references public.posts(id) on delete set null;

create index if not exists idx_higgsfield_jobs_post_id on public.higgsfield_jobs(post_id);
