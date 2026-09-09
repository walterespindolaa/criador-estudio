-- ═══════════════════════════════════════════════════════════════════════════
-- TIRAR O TRAVESSÃO DAS DESCRIÇÕES DOS MÓDULOS (09/09/2026)
--
-- A regra de escrita do Cria não usa travessão, mas a descrição do Cria Post
-- estava gravada no BANCO com um: "Portal de aprovação por link — seus
-- clientes aprovam...". Como a vitrine da home lê `modules.description`, o
-- travessão aparecia na tela mesmo com o código limpo.
-- ═══════════════════════════════════════════════════════════════════════════

update public.modules
set description = btrim(regexp_replace(replace(description, ' — ', '. '), '\s*—\s*', ' ', 'g'))
where description like '%—%';

-- Conferência:
-- select code, description from public.modules order by sort_order;
