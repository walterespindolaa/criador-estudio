// Motor de publicação do TikTok e do YouTube (ciclo 2, 03/11/2026).
//
// Mesmas regras do Instagram (_shared/ig-publicar.ts):
// - post de cliente só sai aprovado, ou liberado na conferência com motivo;
// - quem publica precisa ter direito ao post (conexao_do_post barra estranho);
// - o robô tenta 3 vezes com espera crescente; erro definitivo avisa no sino.
// Diferenças: a linha de controle é post_publicacoes (uma por rede), e o
// TikTok fica "processando" até o status dizer que saiu.
// LinkedIn (Walter, 25/11/2026): aceita texto, foto e carrossel além de vídeo,
// então a regra "um vídeo por post" vale só pra TikTok e YouTube. Vídeo do
// LinkedIn também fica "processando" e o post nasce quando ele fica pronto.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { ErroRede, REDES, type ResultadoPublicacao } from './redes.ts';
import { tiktok } from './rede-tiktok.ts';
import { youtube } from './rede-youtube.ts';
import { linkedin } from './rede-linkedin.ts';
import { prepararMidiaDoPost } from './ig-midia.ts';

const MAX_TENTATIVAS = 3;
export type RedeNova = 'tiktok' | 'youtube' | 'linkedin';
export const PUBLICADORES = { tiktok, youtube, linkedin };

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

/** Redes liberadas pra todo mundo. Walter, 25/11/2026: "linkedin acho que ja
    da pra liberar pra todos". YouTube e TikTok seguem só pro master até o
    Google e o TikTok aprovarem os apps. Mesma regra do app (redeLiberada) e do
    banco (validar_publicacao_rede, migration 20261125000005). */
export const REDES_PRA_TODOS: RedeNova[] = ['linkedin'];
export async function podeUsarRede(admin: SupabaseClient, userId: string, rede: RedeNova): Promise<boolean> {
  return REDES_PRA_TODOS.includes(rede) || await ehMaster(admin, userId);
}

/** Conexão do post naquela rede + access token válido (renova se precisar). */
export async function conexaoComToken(admin: SupabaseClient, postId: string, rede: RedeNova, actor: string) {
  const { data, error } = await admin.rpc('conexao_do_post', { _post_id: postId, _rede: rede, _actor: actor });
  if (error) throw new ErroRede(error.message, true);
  const c = (data as Array<{ connection_id: string | null; external_account_id: string | null; username: string | null; pode_publicar: boolean; motivo: string | null }> | null)?.[0];
  if (!c?.connection_id || !c.pode_publicar) throw new ErroRede(c?.motivo ?? `O ${REDES[rede].nome} deste perfil não está conectado.`, true);
  const token = await tokenValido(admin, c.connection_id, rede);
  return { connectionId: c.connection_id, contaId: c.external_account_id, usuario: c.username, token };
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
    .select('id, user_id, title, caption, external_client_id, approval_status, publish_sem_aprovacao_motivo, youtube')
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
    // prep.erros traz as regras do Instagram; pro LinkedIn só importa se a
    // mídia está pronta (a regra de formato dele vem de formatoLinkedIn).
    const esperando = pub.rede === 'linkedin' ? prep.pendentes > 0 : prep.pendentes > 0 && prep.erros.length === 0;
    if (esperando) {
      await gravar({ status: doRobo ? 'na_fila' : 'erro', erro: 'Vídeo ainda processando no Cria. Tenta de novo em alguns minutos.',
        ...(doRobo ? { publicar_em: new Date(Date.now() + 5 * 60_000).toISOString() } : {}) });
      return { estado: 'aguardando', mensagem: 'Vídeo ainda processando no Cria.' };
    }
    const opcoes = (pub.opcoes ?? {}) as Record<string, unknown>;
    const texto = String(pub.texto ?? p.caption ?? '').trim();

    if (pub.rede === 'linkedin') {
      const ruim = (prep.itens ?? []).find((i) => i.estado === 'erro');
      if (ruim) throw new ErroRede(ruim.erro ?? 'Uma mídia do post não pôde ser preparada.', true);
      if (!cx.contaId) throw new ErroRede('Reconecte o LinkedIn pra publicar.', true, true);
      const itens = (prep.itens ?? []).filter((i) => i.url && (i.tipo === 'IMAGE' || i.tipo === 'VIDEO'));
      const r = await linkedin.publicar({ accessToken: cx.token, autor: cx.contaId, itens, texto, opcoes, limiteMs });
      return await aplicar(admin, pub, r, p, quem, link);
    }

    const videos = (prep.itens ?? []).filter((i) => i.tipo === 'VIDEO' && i.url);
    if (videos.length !== 1) throw new ErroRede(`O ${nome} pelo Cria publica um vídeo por post. Este post tem ${videos.length} vídeo(s).`, true);
    const v = videos[0];

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
      // Campos do post de YouTube (posts.youtube, 25/11/2026): título do vídeo, tags, categoria, idioma, miniatura.
      const yt = (p.youtube ?? {}) as { titulo?: string | null; tags?: unknown; categoria?: string | null; idioma?: string | null; miniatura_url?: string | null };
      const titulo = String(pub.titulo || yt.titulo || p.title || '').trim();
      const ehShort = !!(v.largura && v.altura && v.altura >= v.largura && (v.duracao ?? 0) <= 180);
      r = await youtube.publicar({
        accessToken: cx.token, midiaUrl: v.url!, titulo, texto, opcoes, ehShort, limiteMs,
        tags: Array.isArray(yt.tags) ? yt.tags.map(String) : [], categoria: yt.categoria, idioma: yt.idioma, miniaturaUrl: yt.miniatura_url,
      });
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
    await admin.from('post_publicacoes').update({ status: 'publicado', external_id: r.externalId, permalink: r.permalink ?? null, erro: r.aviso ?? null, publicado_em: agora, updated_at: agora } as never).eq('id', pub.id);
    // YouTube programado (publishAt): já subiu, mas só aparece na hora marcada.
    const quando = pub.rede === 'youtube' ? String((pub.opcoes ?? {}).publishAt ?? '') : '';
    const programado = quando && Date.parse(quando) > Date.now()
      ? new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : null;
    await avisar(admin, [String(p.user_id ?? ''), quem],
      programado ? `Programado no ${nome}` : `Publicado no ${nome}`,
      programado ? `"${String(p.title ?? 'Post').slice(0, 60)}" já subiu e sai sozinho em ${programado}.` : `"${String(p.title ?? 'Post').slice(0, 60)}" já está no ar.`,
      link);
    return { estado: 'publicado', ...(programado ? { mensagem: `Enviado. O YouTube publica sozinho em ${programado}.` } : {}) };
  }
  if (r.estado === 'processando') {
    await admin.from('post_publicacoes').update({ status: 'processando', external_id: r.externalId, ...(r.permalink ? { permalink: r.permalink } : {}), erro: null, updated_at: agora } as never).eq('id', pub.id);
    return { estado: 'processando', mensagem: pub.rede === 'youtube'
      ? 'O vídeo já está no YouTube. Falta só a miniatura, que entra quando o YouTube terminar de processar.'
      : `O ${nome} está processando o vídeo. Leva alguns minutos.` };
  }
  await admin.from('post_publicacoes').update({ status: 'erro', erro: r.erro, updated_at: agora } as never).eq('id', pub.id);
  await avisar(admin, [String(p.user_id ?? ''), quem], `Não deu pra publicar no ${nome}`, `"${String(p.title ?? 'Post').slice(0, 60)}": ${r.erro}`, link);
  return { estado: 'erro', mensagem: r.erro };
}

/* YouTube "processando" = o vídeo já subiu e falta a miniatura (25/11/2026).
   Espera o YouTube terminar de processar, põe a capa e fecha como publicado.
   Passou de 2 horas sem dar certo: fecha publicado com o aviso. */
async function conferirMiniatura(admin: SupabaseClient, pub: Pub, token: string, p: Record<string, unknown>, quem: string, link: string) {
  const { data: linha } = await admin.from('post_publicacoes').select('permalink, created_at').eq('id', pub.id).maybeSingle();
  const l = (linha ?? {}) as { permalink?: string | null; created_at?: string };
  const base = { estado: 'publicado' as const, externalId: pub.external_id!, permalink: l.permalink ?? `https://youtu.be/${pub.external_id}` };
  const url = ((p.youtube ?? {}) as { miniatura_url?: string | null }).miniatura_url;
  if (!url) { await aplicar(admin, pub, base, p, quem, link); return; }
  const velho = l.created_at ? Date.now() - new Date(l.created_at).getTime() > 2 * 3600_000 : false;
  if (!velho && await youtube.processando(token, pub.external_id!)) {
    await admin.from('post_publicacoes').update({ updated_at: new Date().toISOString() } as never).eq('id', pub.id);
    return;
  }
  const m = await youtube.definirMiniatura(token, pub.external_id!, url);
  if (m.ok) { await aplicar(admin, pub, base, p, quem, link); return; }
  if (m.definitivo || velho) {
    await aplicar(admin, pub, { ...base, aviso: m.definitivo ? m.erro : 'O vídeo saiu, mas a miniatura não entrou. Suba no YouTube Studio.' }, p, quem, link);
    return;
  }
  await admin.from('post_publicacoes').update({ updated_at: new Date().toISOString() } as never).eq('id', pub.id);
}

/** TikTok e vídeo do LinkedIn: consulta quem está "processando" e fecha como publicado ou erro. */
export async function conferirProcessando(admin: SupabaseClient, pubId: string) {
  const { data: row } = await admin.from('post_publicacoes')
    .select('id, post_id, rede, status, tentativas, titulo, texto, opcoes, external_id, criado_por').eq('id', pubId).maybeSingle();
  const pub = row as Pub | null;
  if (!pub || pub.status !== 'processando' || !pub.external_id) return;
  const { data: postRow } = await admin.from('posts').select('id, user_id, title, caption, external_client_id, youtube').eq('id', pub.post_id).maybeSingle();
  const p = (postRow ?? {}) as Record<string, unknown>;
  const quem = pub.criado_por ?? String(p.user_id ?? '');
  const link = p.external_client_id ? '/socialmidia/criapost/publicacoes' : '/app/criando';
  try {
    const cx = await conexaoComToken(admin, pub.post_id, pub.rede, quem);
    if (pub.rede === 'youtube') return await conferirMiniatura(admin, pub, cx.token, p, quem, link);
    const r = pub.rede === 'linkedin'
      ? await linkedin.conferirVideo({
        accessToken: cx.token, autor: cx.contaId ?? '', video: pub.external_id,
        texto: String(pub.texto ?? p.caption ?? '').trim(), opcoes: (pub.opcoes ?? {}) as Record<string, unknown>,
      })
      : await tiktok.consultarStatus(cx.token, pub.external_id, cx.usuario);
    if (r.estado === 'processando') {
      await admin.from('post_publicacoes').update({ updated_at: new Date().toISOString() } as never).eq('id', pub.id);
      return;
    }
    await aplicar(admin, pub, r, p, quem, link);
  } catch (e) {
    console.error('[redes-publicar] status', pub.id, String(e));
    // Erro que não se resolve sozinho (conexão vencida, post recusado): fecha
    // como erro em vez de ficar "processando" pra sempre.
    if (e instanceof ErroRede && e.definitivo) {
      await aplicar(admin, pub, { estado: 'erro', erro: e.message, tentarDeNovo: false }, p, quem, link);
    }
  }
}
