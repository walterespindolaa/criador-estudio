-- Link in bio: garantir que o slug (/bio/xxx) seja único entre todos os usuários,
-- e oferecer uma checagem de disponibilidade em tempo real.

-- 1) Unicidade case-insensitive (ignora nulos/vazios).
--    Obs: se já existirem slugs duplicados, este índice falha — resolver os duplicados antes.
create unique index if not exists idx_profiles_bio_slug_unique
  on public.profiles (lower(bio_slug))
  where bio_slug is not null and bio_slug <> '';

-- 2) RPC pública pra checar disponibilidade (não expõe nenhum dado — só true/false).
create or replace function public.bio_slug_available(_slug text, _exclude uuid default null)
returns boolean language sql security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles
     where lower(bio_slug) = lower(trim(_slug))
       and bio_slug is not null and bio_slug <> ''
       and (_exclude is null or id <> _exclude)
  );
$$;

grant execute on function public.bio_slug_available(text, uuid) to anon, authenticated;
