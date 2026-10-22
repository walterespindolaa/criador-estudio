-- Logo do cliente do CRM na página pública sem prazo de validade (22/10/2026).
-- Antes: a ficha guardava um link assinado de 1 ano (5 nos antigos) e a página
-- pública devolvia esse link; vencido, a logo sumia. Agora a página recebe o
-- endereço da edge function bio-logo-crm, que gera um link novo de 1 hora a
-- cada visita, e só para o arquivo que bio_logo_crm_caminho aprovar.

create or replace function public.bio_logo_crm_caminho(_slug text)
returns text
language sql stable security definer
set search_path to 'public'
as $$
  with p as (
    select c.id, c.manager_id,
           substring(c.logo from '/storage/v1/object/sign/crm/([^?#]+)') as caminho
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id
    where lower(bp.slug) = lower(btrim(_slug)) and c.deleted_at is null
    limit 1
  )
  select p.caminho from p
  where p.caminho ~ '^[0-9a-f-]{36}/(novo-)?[0-9a-f-]{36}/avatar-[0-9]+\.(png|jpe?g|webp|gif)$'
    and (split_part(p.caminho, '/', 2) = p.id::text or split_part(p.caminho, '/', 2) like 'novo-%')
    and (split_part(p.caminho, '/', 1) = p.manager_id::text
         or exists (select 1 from public.manager_members m
                    where m.manager_id = p.manager_id
                      and m.member_id::text = split_part(p.caminho, '/', 1)
                      and m.status = 'ativo'
                      and not public.eh_papel_parceiro(m.role)));
$$;
revoke all on function public.bio_logo_crm_caminho(text) from public, anon, authenticated;
grant execute on function public.bio_logo_crm_caminho(text) to service_role;

create or replace function public.get_public_bio_page_by_slug(_slug text)
returns table(id uuid, name text, bio text, avatar_url text, niche text, instagram_handle text, bio_settings jsonb, bio_slug text)
language sql stable security definer
set search_path to 'public'
as $$
  select bp.id, c.name::text, null::text,
         case
           when c.logo like '%/storage/v1/object/sign/crm/%' then
             case when public.bio_logo_crm_caminho(bp.slug) is not null
                  then 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/bio-logo-crm?slug=' || bp.slug
             end
           else c.logo::text
         end,
         c.segment::text, c.instagram::text, bp.settings, bp.slug::text
  from public.bio_pages bp
  join public.crm_clients c on c.id = bp.crm_client_id
  where lower(bp.slug) = lower(btrim(_slug))
    and c.deleted_at is null
  limit 1;
$$;
