-- Gravação cancelada solta os roteiros (02/11/2026).
--
-- Causa provada: a Cria Captação esconde gravação cancelada, mas o roteiro
-- continua com capture_id apontando pra ela. Como não é "sem dia", também não
-- cai em "Sem dia ainda": some da tela. Apagar a gravação já soltava (FK on
-- delete set null); cancelar não.
--
-- Correção: ao virar "cancelada", os roteiros saem da gravação e vão pra
-- "Sem dia ainda" do mesmo mês. Remarcar continua levando os roteiros junto.

create or replace function public.roteiros_acompanham_gravacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelada' and old.status is distinct from 'cancelada' then
    update public.capture_scripts
       set capture_id = null, record_date = null, updated_at = now()
     where capture_id = new.id;
    return new;
  end if;
  if new.capture_date is distinct from old.capture_date and new.capture_date is not null then
    update public.capture_scripts
       set record_date = new.capture_date,
           month = to_char(new.capture_date, 'YYYY-MM'),
           updated_at = now()
     where capture_id = new.id
       and (record_date is distinct from new.capture_date
            or month is distinct from to_char(new.capture_date, 'YYYY-MM'));
  end if;
  return new;
end;
$$;

revoke all on function public.roteiros_acompanham_gravacao() from public, anon, authenticated;

drop trigger if exists trg_roteiros_acompanham_gravacao on public.agenda_captures;
create trigger trg_roteiros_acompanham_gravacao
after update of capture_date, status on public.agenda_captures
for each row execute function public.roteiros_acompanham_gravacao();

-- Solta os que já estão presos em gravação cancelada.
update public.capture_scripts s
   set capture_id = null, record_date = null, updated_at = now()
  from public.agenda_captures a
 where a.id = s.capture_id and a.status = 'cancelada';
