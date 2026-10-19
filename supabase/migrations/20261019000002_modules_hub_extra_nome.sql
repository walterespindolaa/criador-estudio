-- O Pacote Extra ainda dizia "HUB CRIA" (nome antigo do Cria Radar).
-- Já aplicado em produção pelo conector Supabase; arquivo de registro.
update public.modules set description = replace(description, 'HUB CRIA', 'Cria Radar') where code = 'hub_extra';
