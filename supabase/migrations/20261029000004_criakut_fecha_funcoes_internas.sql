-- CRIAKUT: FUNÇÕES INTERNAS FECHADAS (teste de 29/10/2026).
-- criakut_avisar / criakut_avisar_link / criakut_msg_sistema e outras auxiliares
-- eram chamáveis direto pela API por qualquer pessoa logada: dava pra mandar
-- aviso (com link) pra qualquer usuária e enfiar "mensagem do sistema" numa
-- negociação alheia. Elas só servem por dentro das funções do Criakut (que rodam
-- como dono do banco), então tirar o acesso direto não quebra nada: o fluxo
-- inteiro foi refeito no teste depois do bloqueio e passou.
revoke execute on function
  public.criakut_avisar(uuid,text,text,uuid),
  public.criakut_avisar_link(uuid,text,text,text),
  public.criakut_msg_sistema(uuid,text),
  public.criakut_base(uuid),
  public.criakut_autor_json(uuid),
  public.criakut_link(uuid,uuid),
  public.criakut_lado(uuid),
  public.criakut_eh_destaque(uuid),
  public.criakut_tem_entrega(criakut_propostas),
  public.criakut_comunidade_pode(text),
  public.criakut_comunidade_visivel(criakut_comunidades),
  public.criakut_porta(text,integer),
  public.criakut_buscar(text,text[],text[],integer,text,text,integer,integer),
  public.criakut_comunidades_listar(),
  public.criakut_comunidades_ver()
from public, anon, authenticated;

-- FOTO DE PERFIL: o bucket avatars tem INSERT e UPDATE mas não SELECT pro dono.
-- Foi exatamente essa falta que quebrou o upload do Link na bio (o storage faz
-- o "substituir" com RETURNING e exige leitura). Mesma correção.
create policy "Users read own avatar"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]);
