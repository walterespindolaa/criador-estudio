-- Roteiro acompanha a gravação quando ela é remarcada (02/11/2026).
--
-- Causa provada: remarcar pela Agenda (arrastar o card ou editar a data) muda
-- só agenda_captures.capture_date. Os roteiros ligados (capture_scripts.capture_id)
-- ficavam com o month e o record_date antigos. A Cria Captação monta cada mês
-- com "gravações do mês" + "roteiros do mês": roteiro de outubro preso numa
-- gravação de novembro não aparece em mês nenhum. Nada foi apagado.
--
-- Correção: um gatilho no banco mantém month/record_date do roteiro iguais à
-- data da gravação, venha a remarcação de onde vier (Agenda, Captação, link).

create or replace function public.roteiros_acompanham_gravacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
after update of capture_date on public.agenda_captures
for each row execute function public.roteiros_acompanham_gravacao();

-- Conserta os que já ficaram para trás.
update public.capture_scripts s
   set record_date = a.capture_date,
       month = to_char(a.capture_date, 'YYYY-MM'),
       updated_at = now()
  from public.agenda_captures a
 where a.id = s.capture_id
   and a.capture_date is not null
   and (s.record_date is distinct from a.capture_date
        or s.month is distinct from to_char(a.capture_date, 'YYYY-MM'));
