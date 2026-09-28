// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE PUBLICAÇÃO NO INSTAGRAM (ciclo 4 do plano de publicar, 28/09/2026)
//
// Caminho da API (Instagram API with Instagram Login):
//   1. cria o contêiner (foto, Reels ou os filhos + o pai do carrossel);
//   2. espera o Instagram processar (vídeo demora);
//   3. media_publish; 4. busca o link (permalink).
// Tudo que dá errado vira mensagem em português no post (publish_error) e
// aviso no sino. O contêiner fica guardado: se o vídeo demorar mais que o
// tempo da função, a próxima tentativa continua dele em vez de recomeçar.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { prepararMidiaDoPost } from './ig-midia.ts';

const API = 'https://graph.instagram.com/v23.0';
const MAX_TENTATIVAS_ROBO = 3;

export type ResultadoPublicacao = {
  estado: 'publicado' | 'erro' | 'aguardando' | 'ocupado';
  mensagem: string;
  permalink?: string | null;
  erros?: string[];
};

class ErroIg extends Error {
  constructor(msg: string, public tokenMorto = false, public definitivo = false) { super(msg); }
}

// Traduz o erro da Meta pro que a pessoa consegue resolver.
function traduzir(err: Record<string, unknown> | undefined, contexto: string): ErroIg {
  const code = Number(err?.code ?? 0);
  const sub = Number(err?.error_subcode ?? 0);
  const msg = String(err?.error_user_msg ?? err?.message ?? 'erro desconhecido');
  if (code === 190) return new ErroIg('A conexão com o Instagram venceu. Reconecte o Instagram no Cria e tente de novo.', true, true);
  if (code === 10 || code === 200) return new ErroIg('O Instagram não deu permissão de publicar pra esta conta. Reconecte e aceite "publicar conteúdo".', true, true);
  if (code === 4 || code === 9 || sub === 2207042) return new ErroIg('Limite do Instagram atingido (até 100 publicações por dia pela API). Tente mais tarde.');
  if (sub === 2207026) return new ErroIg('O formato do vídeo não foi aceito pelo Instagram. Exporte em MP4 (H.264) e troque o vídeo.', false, true);
  if (sub === 2207004 || sub === 2207052 || code === 9004) return new ErroIg('O Instagram não conseguiu baixar a mídia. Clique em Checar mídia e tente de novo.');
  if (sub === 2207009) return new ErroIg('A proporção da imagem não é aceita pelo Instagram (de 4:5 a 1.91:1).', false, true);
  return new ErroIg(`${contexto}: ${msg.slice(0, 220)}`);
}

async function chamar(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>, token: string, contexto: string) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = metodo === 'GET'
    ? await fetch(`${API}/${caminho}?${qs}`)
    : await fetch(`${API}/${caminho}`, { method: 'POST', body: qs });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw traduzir(j?.error, contexto);
  return j as Record<string, unknown>;
}

// Espera o contêiner ficar pronto. Devolve false se o tempo acabou (continua depois).
async function esperarContainer(id: string, token: string, ateMs: number): Promise<boolean> {
  while (Date.now() < ateMs) {
    const s = await chamar('GET', id, { fields: 'status_code,status' }, token, 'Checando processamento');
    const code = String(s.status_code ?? '');
    if (code === 'FINISHED' || code === 'PUBLISHED') return true;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new ErroIg(code === 'EXPIRED'
        ? 'O Instagram descartou a mídia preparada (passou de 24 h). Tente de novo.'
        : `O Instagram recusou a mídia ao processar${s.status ? ` (${String(s.status).slice(0, 120)})` : ''}. Confira o formato do vídeo.`);
    }
    await new Promise((res) => setTimeout(res, 4000));
  }
  return false;
}

function validarLegenda(caption: string): string | null {
  if (caption.length > 2200) return `A legenda tem ${caption.length} caracteres. O Instagram aceita até 2.200.`;
  const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (hashtags > 30) return `A legenda tem ${hashtags} hashtags. O Instagram aceita até 30.`;
  const mencoes = caption.match(/@[\w.]+/g)?.length ?? 0;
  if (mencoes > 20) return `A legenda tem ${mencoes} marcações (@). O Instagram aceita até 20.`;
  return null;
}

async function avisar(admin: SupabaseClient, userIds: string[], titulo: string, descricao: string, link: string) {
  const unicos = [...new Set(userIds.filter(Boolean))];
  if (!unicos.length) return;
  await admin.from('notifications').insert(unicos.map((u) => ({
    user_id: u, type: 'publicacao_instagram', title: titulo, description: descricao, link, read: false,
  })) as never);
}

// ── Publica um post ─────────────────────────────────────────────────────────
// actor: quem mandou (clique) ou, no robô, quem ligou o automático.
// doRobo: tentativa automática (erro temporário volta pra fila com espera).
export async function publicarPost(admin: SupabaseClient, postId: string, actor: string, doRobo = false): Promise<ResultadoPublicacao> {
  const inicio = Date.now();
  const limite = inicio + 110_000; // folga antes do teto de tempo da função

  // Trava: só um publica por vez.
  const { data: trava, error: travaErr } = await admin.rpc('ig_travar_publicacao', { _post_id: postId, _actor: actor });
  if (travaErr) return { estado: 'erro', mensagem: travaErr.message };
  if (trava !== 'ok') {
    return { estado: 'ocupado', mensagem: trava === 'publicado' ? 'Este post já foi publicado.' : 'Este post já está sendo publicado.' };
  }

  const { data: post } = await admin.from('posts')
    .select('id, user_id, title, caption, format, external_client_id, approval_status, auto_publish, publish_attempts, ig_container_id, publish_by')
    .eq('id', postId).maybeSingle();
  const p = post as Record<string, unknown> | null;
  const linkPost = p?.external_client_id ? '/socialmidia/cria-post' : '/app/criando';
  const avisados = [String(p?.user_id ?? ''), actor];

  // Resultado que devolve o post pra fila (tentar depois) ou marca erro.
  const falhar = async (e: ErroIg, podeRetentar: boolean): Promise<ResultadoPublicacao> => {
    const tentativas = Number(p?.publish_attempts ?? 1);
    const volta = doRobo && podeRetentar && !e.definitivo && tentativas < MAX_TENTATIVAS_ROBO;
    await admin.from('posts').update({
      publish_status: volta ? 'na_fila' : 'erro',
      publish_error: e.message,
      // Espera crescente entre tentativas do robô: 10, 20 min.
      ...(volta ? { publicar_em: new Date(Date.now() + tentativas * 10 * 60_000).toISOString() } : {}),
    } as never).eq('id', postId);
    if (e.tokenMorto) {
      const { data: c } = await admin.rpc('ig_conexao_do_post', { _post_id: postId, _actor: actor });
      const conn = (c as Array<{ connection_id: string | null }> | null)?.[0];
      if (conn?.connection_id) await admin.from('social_connections').update({ needs_reconnect: true } as never).eq('id', conn.connection_id);
    }
    if (!volta) {
      await avisar(admin, avisados, 'Não deu pra publicar no Instagram',
        `"${String(p?.title ?? 'Post').slice(0, 60)}": ${e.message}`, linkPost);
    }
    return { estado: 'erro', mensagem: e.message };
  };

  try {
    if (!p) throw new ErroIg('Post não encontrado.', false, true);

    // Regra do ciclo 0: Cria Post só sai depois de aprovado pelo cliente.
    if (p.external_client_id && p.approval_status !== 'aprovado') {
      return await falhar(new ErroIg('O cliente ainda não aprovou este post.', false, true), false);
    }

    // Conexão e token (o token nunca sai do servidor).
    const { data: cx, error: cxErr } = await admin.rpc('ig_conexao_do_post', { _post_id: postId, _actor: actor });
    if (cxErr) throw new ErroIg(cxErr.message, false, true);
    const conn = (cx as Array<{ connection_id: string | null; ig_user_id: string | null; pode_publicar: boolean; motivo: string | null }>)?.[0];
    if (!conn?.connection_id || !conn.pode_publicar) {
      throw new ErroIg(conn?.motivo ?? 'O Instagram deste perfil não está conectado ao Cria.', false, true);
    }
    const { data: tk } = await admin.from('social_connections').select('access_token').eq('id', conn.connection_id).maybeSingle();
    const token = (tk as { access_token?: string } | null)?.access_token;
    if (!token) throw new ErroIg('Conexão sem token. Reconecte o Instagram.', true, true);
    const igUser = conn.ig_user_id!;

    const caption = String(p.caption ?? '').trim();
    const erroLegenda = validarLegenda(caption);
    if (erroLegenda) throw new ErroIg(erroLegenda, false, true);

    // Contêiner de uma tentativa anterior (vídeo que demorou): continua dele.
    let containerId = (p.ig_container_id as string | null) ?? null;
    if (containerId) {
      try {
        const pronto = await esperarContainer(containerId, token, Math.min(limite, Date.now() + 20_000));
        if (!pronto) {
          await admin.from('posts').update({ publish_status: doRobo ? 'na_fila' : 'erro',
            publish_error: 'O Instagram ainda está processando o vídeo. Tente de novo em alguns minutos.',
            ...(doRobo ? { publicar_em: new Date(Date.now() + 3 * 60_000).toISOString() } : {}) } as never).eq('id', postId);
          return { estado: 'aguardando', mensagem: 'O Instagram ainda está processando o vídeo. Tente de novo em alguns minutos.' };
        }
      } catch {
        containerId = null; // venceu ou deu erro: cria de novo
      }
    }

    if (!containerId) {
      // Mídia no formato certo (ciclo 3).
      const prep = await prepararMidiaDoPost(admin, postId, 60_000);
      if (prep.pendentes > 0 && prep.erros.length === 0) {
        await admin.from('posts').update({ publish_status: doRobo ? 'na_fila' : 'erro',
          publish_error: 'Vídeo ainda processando no Cria. Tente de novo em alguns minutos.',
          ...(doRobo ? { publicar_em: new Date(Date.now() + 5 * 60_000).toISOString() } : {}) } as never).eq('id', postId);
        return { estado: 'aguardando', mensagem: 'Vídeo ainda processando. Tente de novo em alguns minutos.' };
      }
      if (!prep.ok) {
        const e = new ErroIg(prep.erros[0] ?? 'Mídia com problema.', false, true);
        const r = await falhar(e, false);
        return { ...r, erros: prep.erros };
      }

      const formato = prep.formato === 'video' ? 'reels' : prep.formato;
      const itens = prep.itens;
      if (formato === 'foto') {
        const c = await chamar('POST', `${igUser}/media`, { image_url: itens[0].url!, caption }, token, 'Criando a publicação');
        containerId = String(c.id);
      } else if (formato === 'reels') {
        const c = await chamar('POST', `${igUser}/media`, { media_type: 'REELS', video_url: itens[0].url!, caption, share_to_feed: 'true' }, token, 'Criando o Reels');
        containerId = String(c.id);
      } else {
        // Carrossel: um contêiner por mídia, na ordem da tira, depois o pai.
        const filhos: string[] = [];
        for (const it of itens) {
          const params: Record<string, string> = it.tipo === 'VIDEO'
            ? { media_type: 'VIDEO', video_url: it.url!, is_carousel_item: 'true' }
            : { image_url: it.url!, is_carousel_item: 'true' };
          const c = await chamar('POST', `${igUser}/media`, params, token, `Criando a mídia ${it.posicao + 1} do carrossel`);
          filhos.push(String(c.id));
        }
        for (const f of filhos) {
          if (!(await esperarContainer(f, token, limite))) throw new ErroIg('O Instagram demorou demais processando o carrossel. Tente de novo.');
        }
        const pai = await chamar('POST', `${igUser}/media`, { media_type: 'CAROUSEL', children: filhos.join(','), caption }, token, 'Montando o carrossel');
        containerId = String(pai.id);
      }
      await admin.from('posts').update({ ig_container_id: containerId } as never).eq('id', postId);

      const pronto = await esperarContainer(containerId, token, limite);
      if (!pronto) {
        await admin.from('posts').update({ publish_status: doRobo ? 'na_fila' : 'erro',
          publish_error: 'O Instagram ainda está processando o vídeo. Tente de novo em alguns minutos.',
          ...(doRobo ? { publicar_em: new Date(Date.now() + 3 * 60_000).toISOString() } : {}) } as never).eq('id', postId);
        return { estado: 'aguardando', mensagem: 'O Instagram ainda está processando o vídeo. Tente de novo em alguns minutos.' };
      }
    }

    // Publica.
    const pub = await chamar('POST', `${igUser}/media_publish`, { creation_id: containerId! }, token, 'Publicando');
    const mediaId = String(pub.id);
    let permalink: string | null = null;
    try {
      const info = await chamar('GET', mediaId, { fields: 'permalink' }, token, 'Buscando o link');
      permalink = (info.permalink as string) ?? null;
    } catch { /* o post saiu; o link é só conforto */ }

    // Marca publicado nos DOIS sistemas de status (criador e Cria Post).
    const agora = new Date().toISOString();
    await admin.from('posts').update({
      publish_status: 'publicado', publish_error: null, ig_media_id: mediaId, ig_permalink: permalink,
      ig_container_id: null, published_at: agora, status: 'publicado',
      ...(p.external_client_id ? { approval_status: 'postado' } : {}),
    } as never).eq('id', postId);

    await avisar(admin, avisados, 'Publicado no Instagram',
      `"${String(p.title ?? 'Post').slice(0, 60)}" saiu no Instagram.`, permalink ?? linkPost);

    // Vídeo do Drive copiado pro Bunny só pra publicar: apaga a cópia.
    await limparCopiasBunny(admin, postId);

    return { estado: 'publicado', mensagem: 'Publicado no Instagram.', permalink };
  } catch (e) {
    const err = e instanceof ErroIg ? e : new ErroIg(e instanceof Error ? e.message : String(e));
    return await falhar(err, true);
  }
}

async function limparCopiasBunny(admin: SupabaseClient, postId: string) {
  try {
    const { data } = await admin.from('external_media_refs').select('id, ig_bunny_guid').eq('post_id', postId).not('ig_bunny_guid', 'is', null);
    const lib = Deno.env.get('BUNNY_CRIAPOST_LIBRARY_ID') ?? Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
    const key = Deno.env.get('BUNNY_CRIAPOST_API_KEY') ?? Deno.env.get('BUNNY_STREAM_API_KEY');
    if (!lib || !key) return;
    for (const r of (data ?? []) as Array<{ id: string; ig_bunny_guid: string }>) {
      const res = await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${r.ig_bunny_guid}`, { method: 'DELETE', headers: { AccessKey: key } });
      if (res.ok || res.status === 404) {
        await admin.from('external_media_refs').update({ ig_bunny_guid: null, ig_url: null, ig_preparado_em: null } as never).eq('id', r.id);
      }
    }
  } catch (e) { console.error('[ig-publicar] limpar cópias', String(e)); }
}
