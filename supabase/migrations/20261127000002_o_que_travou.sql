-- ═══════════════════════════════════════════════════════════════════════════
-- "O QUE TRAVOU?" (Walter, 27/11/2026: "Aprovado, constrói")
--
-- Quem volta depois de 3+ dias sem abrir o Cria vê uma folha curta com 5
-- respostas. Cada resposta (e o "Agora não") vira uma linha em motivos_saida
-- com origem 'volta'. A própria tabela guarda o "pergunta de novo só daqui a
-- 30 dias": se existe linha de volta nos últimos 30 dias, não pergunta.
--
-- motivos_saida já existia pro link do e-mail de cancelamento (origem
-- 'email'). Aqui ganha dias_fora, detalhe, origem e avisar (o "Me avisa
-- quando sair" da resposta "Faltou uma função").
--
-- Idempotente: pode rodar de novo sem quebrar.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.motivos_saida add column if not exists dias_fora int;
alter table public.motivos_saida add column if not exists detalhe text;
alter table public.motivos_saida add column if not exists origem text not null default 'email';
alter table public.motivos_saida add column if not exists avisar boolean not null default false;

alter table public.motivos_saida drop constraint if exists motivos_saida_motivo_check;
alter table public.motivos_saida add constraint motivos_saida_motivo_check check (motivo in (
  'caro', 'sem_tempo', 'faltou_funcao', 'outra_ferramenta', 'outro',
  'sem_ideia', 'nao_entendi', 'agora_nao'
));

alter table public.motivos_saida drop constraint if exists motivos_saida_origem_check;
alter table public.motivos_saida add constraint motivos_saida_origem_check check (origem in ('email', 'volta'));

create index if not exists motivos_saida_user_volta_idx on public.motivos_saida (user_id, criado_em desc) where origem = 'volta';

-- Último dia de uso ANTES de hoje (fuso de São Paulo) e se pode perguntar.
-- O dia de hoje fica de fora de propósito: a abertura de hoje já pode estar
-- registrada em uso_telas quando a folha consulta.
create or replace function public.volta_status()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'ultimo_dia', (
      select max(u.dia) from public.uso_telas u
       where u.user_id = auth.uid()
         and u.dia < (now() at time zone 'America/Sao_Paulo')::date
    ),
    'perguntou_recente', exists (
      select 1 from public.motivos_saida m
       where m.user_id = auth.uid() and m.origem = 'volta'
         and m.criado_em > now() - interval '30 days'
    )
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.volta_status() from public, anon;
grant execute on function public.volta_status() to authenticated;

create or replace function public.registrar_volta(_motivo text, _dias_fora int default null, _detalhe text default null, _avisar boolean default false)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'sem sessao'; end if;
  if _motivo is null or _motivo not in ('sem_ideia', 'sem_tempo', 'nao_entendi', 'faltou_funcao', 'outro', 'agora_nao') then
    raise exception 'motivo invalido';
  end if;
  -- Uma resposta por volta: a 2ª chamada no mesmo dia só completa o detalhe.
  update public.motivos_saida
     set detalhe = coalesce(nullif(left(btrim(coalesce(_detalhe, '')), 2000), ''), detalhe),
         avisar = avisar or coalesce(_avisar, false)
   where id = (
     select id from public.motivos_saida
      where user_id = auth.uid() and origem = 'volta' and motivo = _motivo
        and criado_em > now() - interval '1 day'
      order by criado_em desc limit 1
   );
  if found then return; end if;
  insert into public.motivos_saida (user_id, motivo, origem, dias_fora, detalhe, avisar)
  values (auth.uid(), _motivo, 'volta', greatest(0, least(coalesce(_dias_fora, 0), 3650)),
          nullif(left(btrim(coalesce(_detalhe, '')), 2000), ''), coalesce(_avisar, false));
end;
$$;
revoke execute on function public.registrar_volta(text, int, text, boolean) from public, anon;
grant execute on function public.registrar_volta(text, int, text, boolean) to authenticated;
