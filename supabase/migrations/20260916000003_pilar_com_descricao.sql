-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 13: O PILAR GANHA DESCRIÇÃO (16/09/2026) · pedido da Gabriela
--
-- No lado da social mídia, a linha editorial do cliente já tem observação desde
-- 09/09, e o motivo está escrito lá: "Autoridade" quer dizer coisas diferentes
-- em cada cliente. A palavra sozinha não é combinado, é rótulo. A observação é
-- o que alguém relê na hora de produzir pra saber o que entra e o que não entra.
--
-- Do lado do criador, o pilar era só nome e cor. Mesma palavra, mesmo problema:
-- "Minha História" pode ser vulnerabilidade, pode ser bastidor, pode ser
-- trajetória profissional. Quem escreve o post três semanas depois (ou a IA que
-- escreve por ele) não tem como adivinhar qual dos três.
--
-- E o pilar não é configuração: é ESTRATÉGIA. Ele sai da tela de Configurações
-- e vai pro Brandbook, junto da linha editorial da semana, que é onde essa
-- decisão é tomada. Esta migration só abre a coluna; a mudança de lugar é toda
-- no app.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pillars
  add column if not exists descricao text;

comment on column public.pillars.descricao is
  'O combinado do pilar: o que entra, o que evitar, exemplos. Mesmo papel da descricao da linha editorial do cliente (editorial_lines).';

-- ── O BRANDBOOK QUE A SOCIAL MÍDIA LÊ ─────────────────────────────────────
-- A RPC devolvia os pilares como uma lista de TEXTOS, então a ficha do cliente
-- mostrava sete etiquetas soltas e nada mais. Agora devolve objeto, com a
-- descrição e a cor: é o mesmo material que o criador escreveu, e é o que
-- permite a social mídia produzir no lugar dele sem perguntar.
--
-- O resto da função continua palavra por palavra como estava: mexer numa RPC
-- que já roda em produção pra trocar uma parte é onde nasce regressão.
drop function if exists public.manager_client_brandbook(uuid);
create function public.manager_client_brandbook(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _profile jsonb; _pillars jsonb; _items jsonb; _pers jsonb; _mood jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('profile', null, 'pillars', '[]'::jsonb,
      'brand_items', '[]'::jsonb, 'personas', '[]'::jsonb, 'moodboard', '[]'::jsonb);
  end if;

  select jsonb_build_object('name', p.name, 'niche', p.niche, 'avatar_url', p.avatar_url)
    into _profile from public.profiles p where p.id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', x.name, 'descricao', x.descricao, 'color', x.color)
           order by x.position nulls last), '[]'::jsonb) into _pillars
  from (select pi.name, pi.descricao, pi.color, pi.position
          from public.pillars pi where pi.user_id = client_owner_id) x;

  select coalesce(jsonb_agg(jsonb_build_object('type', b.type, 'name', b.name, 'value', b.value)
                            order by b.type, b.position nulls last), '[]'::jsonb) into _items
  from public.brand_items b where b.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', pe.name, 'age_range', pe.age_range, 'gender', pe.gender,
           'location', pe.location, 'pain_points', pe.pain_points,
           'desires', pe.desires, 'interests', pe.interests,
           'how_you_help', pe.how_you_help)), '[]'::jsonb) into _pers
  from public.personas pe where pe.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'section', me.section, 'question_key', me.question_key, 'answer', me.answer)
           order by me.section, me.question_key), '[]'::jsonb) into _mood
  from public.moodboard_entries me
  where me.user_id = client_owner_id and me.answer is not null and btrim(me.answer) <> '';

  return jsonb_build_object('profile', _profile, 'pillars', _pillars,
    'brand_items', _items, 'personas', _pers, 'moodboard', _mood);
end; $$;

revoke all on function public.manager_client_brandbook(uuid) from public, anon;
grant execute on function public.manager_client_brandbook(uuid) to authenticated;

-- Conferência:
-- select id, name, descricao from public.pillars limit 5;
-- select public.manager_client_brandbook('<id-da-conta-do-cliente>')->'pillars';
