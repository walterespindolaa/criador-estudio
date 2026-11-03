// Motor de publicação do TikTok e do YouTube (ciclo 2, 03/11/2026).
//
// Mesmas regras do Instagram (_shared/ig-publicar.ts):
// - post de cliente só sai aprovado, ou liberado na conferência com motivo;
// - quem publica precisa ter direito ao post (conexao_do_post barra estranho);
// - o robô tenta 3 vezes com espera crescente; erro definitivo avisa no sino.
// Diferenças: a linha de controle é post_publicacoes (uma por rede), e o
// TikTok fica "processando" até o status dizer que saiu.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { ErroRede, REDES, type ResultadoPublicacao } from './redes.ts';
import { tiktok } from './rede-tiktok.ts';
import { youtube } from './rede-youtube.ts';
import { prepararMidiaDoPost } from './ig-midia.ts';

const MAX_TENTATIVAS = 3;
type RedeNova = 'tiktok' | 'youtube';
export const PUBLICADORES = { tiktok, youtube };

type Pub = {
  id: string; post_id: string; rede: RedeNova; status: string; tentativas: number;
  titulo: string | null; texto: string | null; opcoes: Record<string, unknown> | null;
  external_id: string | null; criado_por: string | null;
};

async function avisar(admin: SupabaseClient, ids: string[], titulo: string, descricao: string, link: string) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return;
  await admin.from('notifications').insert(unicos.map((user_id) => ({ user_id, type: 'cria_post', title: titulo, description: descricao, link, read: false })) as never);
}

/** TikTok e YouTube só pro master enquanto o fluxo é testado (Walter, 03/11/2026). */
export async function ehMaster(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data as { role?: string | null } | null)?.role === 'admin';
}

/** Conexão do post naquela rede + access token válido (renova se precisar). */
export async function conexaoComToken(admin: SupabaseClient, postId: string, rede: RedeNova, actor: string) {
  const { data, error } = await admin.rpc('conexao_do_post', { _post_id: postId, _rede: rede, _actor: actor });
  if (error) throw new ErroRede(error.message, true);
  const c = (data as Array<{ connection_id: string | null; username: string | null; pode_publicar: boolean; motivo: string | null }> | null)?.[0];
  if (!c?.connection_id || !c.pode_publicar) throw new ErroRede(c?.motivo ?? `O ${REDES[rede].nome} deste perfil não está conectado.`, true);
  const token = await tokenValido(admin, c.connection_id, rede);
  return { connectionId: c.connection_id, usuario: c.username, token };
}

export async function tokenValido(admin: SupabaseClient, connectionId: string, rede: RedeNova): Promise<string> {
  const { data: sc } = await admin.from('social_connections').select('access_token, token_expires_at').eq('id', connectionId).maybeSingle();
  const atual = sc as { access_token?: string; token_expires_at?: string | null } | null;
  if (atual?.access_token && atual.token_expires_at && new Date(atual.token_expires_at).getTime() > Date.now() + 5 * 60_000) {
    return atual.access_token;
  }
  const { data: tk } = await admin.from('social_connection_tokens').select('refresh_token').eq('connection_id', connectionId).maybeSingle();
  const refresh = (tk as { refresh_token?: string } | null)?.refresh_token;
  if (!refresh) {
    await admin.from('social_connections').update({ needs_reconnect: true } as never).eq('id', connectionId);
    throw new ErroRede(`A conexão com o ${REDES[rede].nome} venceu. Reconecte pra publicar.`, true, true);
  }
  try {
    const novo = await PUBLICADORES[rede].renovar(refresh);
    await admin.from('social_connections').update({
      access_token: novo.accessToken, token_expires_at: novo.accessExpiraEm, needs_reconnect: false, updated_at: new Date().toISOString(),
      ...(novo.escopos ? { scopes: novo.escopos } : {}),
    } as never).eq('id', connectionId);
    // O TikTok pode devolver um refresh novo: guarda sempre o que voltar.
    if (novo.refreshToken) {
      await admin.from('social_connection_tokens').upsert({
        connection_id: connectionId, refresh_token: novo.refreshToken, refresh_expires_at: novo.refreshExpiraEm ?? null, updated_at: new Date().toISOString(),
      } as never);
    }
    return novo.accessToken;
  } catch (e) {
    if (e instanceof ErroRede && e.reconectar) {
      await admin.from('social_connections').update({ needs_reconnect: true } as never).eq('id', connectionId);
    }
    throw e;
  }
}

/** Publica uma linha de post_publicacoes já travada (status = publicando). */
export async function publicarLinha(admin: SupabaseClient, pubId: string, actor: string | null, doRobo: boolean): Promise<{ estado: string; mensagem?: string }> {
  const limiteMs = Date.now() + 120_000;
  const { data: row } = await admin.from('post_publicacoes')
    .select('id, post_id, rede, status, tentativas, titulo, texto, opcoes, external_id, criado_por').eq('id', pubId).maybeSingle();
  const pub = row as Pub | null;
  if (!pub) return { estado: 'erro', mensagem: 'Publicação não encontrada.' };
  const { data: postRow } = await admin.from('posts')
    .select('id, user_id, title, caption, external_client_id, approval_status, publish_sem_aprovacao_motivo')
    .eq('id', pub.post_id).maybeSingle();
  const p = postRow as Record<string, unknown> | null;
  const quem = actor ?? pub.criado_por ?? String(p?.user_id ?? '');
  const nome = REDES[pub.rede].nome;
  const link = p?.external_client_id ? '/socialmidia/criapost/publicacoes' : '/app/criando';

  const gravar = (campos: Record<string, unknown>) =>
    admin.from('post_publicacoes').update({ ...campos, updated_at: new Date().toISOString() } as never).eq('id', pub.id);

  const falhar = async (e: ErroRede) => {
    const volta = doRobo && !e.definitivo && (pub.tentativas ?? 1) < MAX_TENTATIVAS;
    await gravar({
      status: volta ? 'na_fila' : 'erro', erro: e.message,
      ...(volta ? { publicar_em: new Date(Date.now() + (pub.tentativas ?? 1) * 10 * 60_000).toISOString() } : {}),
    });
    if (!volta) await avisar(admin, [String(p?.user_id ?? ''), quem], `Não deu pra publicar no ${nome}`, `"${String(p?.title ?? 'Post').slice(0, 60)}": ${e.message}`, link);
    return { estado: 'erro', mensagem: e.message };
  };

  try {
    if (!p) throw new ErroRede('Post não encontrado.', true);
    if (p.external_client_id && p.approval_status !== 'aprovado' && !p.publish_sem_aprovacao_motivo) {
      throw new ErroRede('O cliente ainda não aprovou este post.', true);
    }
    const cx = await conexaoComToken(admin, pub.post_id, pub.rede, quem);

    // Mídia: o mesmo preparo do Instagram devolve um MP4 público com medidas.
    const prep = await prepararMidiaDoPost(admin, pub.post_id, 45_000);
    if (prep.pendentes > 0 && prep.erros.length === 0) {
      await gravar({ status: doRobo ? 'na_fila' : 'erro', erro: 'Vídeo ainda processando no Cria. Tenta de novo em alguns minutos.',
        ...(doRobo ? { publicar_em: new Date(Date.now() + 5 * 60_000).toISOString() } : {}) });
      return { estado: 'aguardando', mensagem: 'Vídeo ainda processando no Cria.' };
    }
    const videos = (prep.itens ?? []).filter((i) => i.tipo === 'VIDEO' && i.url);
    if (videos.length !== 1) throw new ErroRede(`O ${nome} pelo Cria publica um vídeo por post. Este post tem ${videos.length} vídeo(s).`, true);
    const v = videos[0];
    const opcoes = (pub.opcoes ?? {}) as Record<string, unknown>;
    const texto = String(pub.texto ?? p.caption ?? '').trim();

    let r: ResultadoPublicacao;
    if (pub.rede === 'tiktok') {
      const criador = await tiktok.criador(cx.token);
      if (criador.duracaoMaxSeg && v.duracao && v.duracao > criador.duracaoMaxSeg) {
        throw new ErroRede(`Esta conta do TikTok aceita vídeos de até ${criador.duracaoMaxSeg} segundos.`, true);
      }
      if (!criador.privacidades.includes(String(opcoes.privacy_level))) {
        throw new ErroRede('A privacidade escolhida não está disponível pra esta conta. Escolha de novo no post.', true);
      }
      r = await tiktok.publicar({ accessToken: cx.token, midiaUrl: v.url!, texto, opcoes, limiteMs });
    } else {
      const titulo = String(pub.titulo ?? p.title ?? '').trim();
      const ehShort = !!(v.largura && v.altura && v.altura >= v.largura && (v.duracao ?? 0) <= 180);
      r = await youtube.publicar({ accessToken: cx.token, midiaUrl: v.url!, titulo, texto, opcoes, ehShort, limiteMs });
    }
    return await aplicar(admin, pub, r, p, quem, link);
  } catch (e) {
    return await falhar(e instanceof ErroRede ? e : new ErroRede(e instanceof Error ? e.message : 'Erro inesperado.'));
  }
}

async function aplicar(admin: SupabaseClient, pub: Pub, r: ResultadoPublicacao, p: Record<string, unknown>, quem: string, link: string) {
  const agora = new Date().toISOString();
  const nome = REDES[pub.rede].nome;
  if (r.estado === 'publicado') {
    await admin.from('post_publicacoes').update({ status: 'publicado', external_id: r.externalId, permalink: r.permalink ?? null, erro: null, publicado_em: agora, updated_at: agora } as never).eq('id', pub.id);
    await avisar(admin, [String(p.user_id ?? ''), quem], `Publicado no ${nome}`, `"${String(p.title ?? 'Post').slice(0, 60)}" já está no ar.`, link);
    return { estado: 'publicado' };
  }
  if (r.estado === 'processando') {
    await admin.from('post_publicacoes').update({ status: 'processando', external_id: r.externalId, erro: null, updated_at: agora } as never).eq('id', pub.id);
    return { estado: 'processando', mensagem: `O ${nome} está processando o vídeo. Leva alguns minutos.` };
  }
  await admin.from('post_publicacoes').update({ status: 'erro', erro: r.erro, updated_at: agora } as never).eq('id', pub.id);
  await avisar(admin, [String(p.user_id ?? ''), quem], `Não deu pra publicar no ${nome}`, `"${String(p.title ?? 'Post').slice(0, 60)}": ${r.erro}`, link);
  return { estado: 'erro', mensagem: r.erro };
}

/** TikTok: consulta quem está "processando" e fecha como publicado ou erro. */
export async function conferirProcessando(admin: SupabaseClient, pubId: string) {
  const { data: row } = await admin.from('post_publicacoes')
    .select('id, post_id, rede, status, tentativas, titulo, texto, opcoes, external_id, criado_por').eq('id', pubId).maybeSingle();
  const pub = row as Pub | null;
  if (!pub || pub.status !== 'processando' || pub.rede !== 'tiktok' || !pub.external_id) return;
  const { data: postRow } = await admin.from('posts').select('id, user_id, title, external_client_id').eq('id', pub.post_id).maybeSingle();
  const p = (postRow ?? {}) as Record<string, unknown>;
  const quem = pub.criado_por ?? String(p.user_id ?? '');
  const link = p.external_client_id ? '/socialmidia/criapost/publicacoes' : '/app/criando';
  try {
    const cx = await conexaoComToken(admin, pub.post_id, 'tiktok', quem);
    const r = await tiktok.consultarStatus(cx.token, pub.external_id, cx.usuario);
    if (r.estado === 'processando') {
      await admin.from('post_publicacoes').update({ updated_at: new Date().toISOString() } as never).eq('id', pub.id);
      return;
    }
    await aplicar(admin, pub, r, p, quem, link);
  } catch (e) {
    console.error('[redes-publicar] status', pub.id, String(e));
  }
}
