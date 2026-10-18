-- ═══════════════════════════════════════════════════════════════════════════
-- CRONOGRAMA: HISTÓRICO DE VISITAS DO CLIENTE (Walter, 18/10/2026: "quando o
-- cliente abre mais de 1x, nao fica o historico?"). JÁ APLICADA (registro).
-- Antes só existiam a primeira e a última visita (visto_em/ultimo_visto_em) e
-- um contador. Agora cada visita contada (1 a cada 30 min, ignorando a própria
-- agência, mesma regra de antes) vira uma linha. As visitas antigas viram até
-- 2 linhas (primeira e última), que é o que o banco sabia.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.cronograma_visitas (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronogramas(id) on delete cascade,
  visto_em timestamptz not null default now()
);
create index if not exists cronograma_visitas_crono_idx on public.cronograma_visitas (cronograma_id, visto_em);
alter table public.cronograma_visitas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cronograma_visitas' and policyname='cv_select_agencia') then
    create policy cv_select_agencia on public.cronograma_visitas for select to authenticated
      using (exists (select 1 from public.cronogramas c where c.id = cronograma_id and (c.manager_id = auth.uid() or public.acts_for(c.manager_id))));
  end if;
end $$;
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.get_cronograma_by_token(text)'::regprocedure);
  if position('cronograma_visitas' in _def) = 0 then
    _def := replace(_def, $x$visualizacoes = visualizacoes + 1 where id = $1' using _c.id;$x$,
      $x$visualizacoes = visualizacoes + 1 where id = $1' using _c.id;
      insert into public.cronograma_visitas (cronograma_id) values (_c.id);$x$);
    execute _def;
  end if;
end $d$;
insert into public.cronograma_visitas (cronograma_id, visto_em)
select c.id, c.visto_em from public.cronogramas c
 where c.visto_em is not null and not exists (select 1 from public.cronograma_visitas v where v.cronograma_id = c.id);
insert into public.cronograma_visitas (cronograma_id, visto_em)
select c.id, c.ultimo_visto_em from public.cronogramas c
 where c.ultimo_visto_em is not null and c.ultimo_visto_em > c.visto_em + interval '1 minute'
   and not exists (select 1 from public.cronograma_visitas v where v.cronograma_id = c.id and v.visto_em = c.ultimo_visto_em);
