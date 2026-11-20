-- COMUNIDADE PRA TODO MUNDO (Walter, 19/11/2026, mockup do menu aprovado).
-- Antes: a faixa só aparecia pra quem deixou WhatsApp, e "Agora não" voltava
-- depois de 3 dias. Agora: faixa pra todos até "Entrar" ou "Agora não" (some de
-- vez), e o link volta SEMPRE, porque o item fixo do menu precisa dele.
create or replace function public.comunidade_banner()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_url text;
  v_entrou timestamptz;
  v_adiou int;
begin
  select comunidade_url into v_url from public.wa_config where id = 1;
  if v_url is null or v_url = '' then return jsonb_build_object('mostrar', false, 'url', null); end if;
  -- Variáveis soltas, não record: "record is not null" só é verdade se TODOS os
  -- campos estiverem preenchidos, e comunidade_entrou_em é vazio pra quem deve ver.
  select comunidade_entrou_em, comunidade_adiou_vezes into v_entrou, v_adiou
    from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'url', v_url,
    'mostrar', found and v_entrou is null and coalesce(v_adiou, 0) = 0
  );
end $function$;

update public.wa_config set comunidade_url = 'https://chat.whatsapp.com/BHcrv0BicjR4Hv7QYTbOJY' where id = 1;
