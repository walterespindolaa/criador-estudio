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
import { normalizarFormato, prepararMidiaDoPost } from './ig-midia.ts';

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

// ── Opções do Instagram (ig_opcoes, gravadas por ig_salvar_opcoes) ─────────
type Opcoes = {
  collaborators: string[];
  user_tags: Array<{ username: string; x: number; y: number }>;
  alt_text: string | null;
  trial: 'MANUAL' | 'SS_PERFORMANCE' | null;
  share_to_feed: boolean | null;
  musica_celular: boolean;
  pelo_celular: boolean;
};

export function lerOpcoes(bruto: unknown): Opcoes {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const nomes = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x).replace(/^@/, '').trim()).filter((x) => /^[A-Za-z0-9._]{1,30}$/.test(x));
  const tags = (Array.isArray(o.user_tags) ? o.user_tags : []).map((t) => {
    const r = (t ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => Math.min(1, Math.max(0, Number(v ?? 0.5) || 0));
    return { username: String(r.username ?? '').replace(/^@/, '').trim(), x: n(r.x), y: n(r.y) };
  }).filter((t) => /^[A-Za-z0-9._]{1,30}$/.test(t.username));
  const trial = o.trial === 'MANUAL' || o.trial === 'SS_PERFORMANCE' ? o.trial : null;
  return {
    collaborators: nomes(o.collaborators).slice(0, 3),
    user_tags: tags.slice(0, 20),
    alt_text: typeof o.alt_text === 'string' && o.alt_text.trim() ? o.alt_text.trim().slice(0, 1000) : null,
    trial,
    share_to_feed: typeof o.share_to_feed === 'boolean' ? o.share_to_feed : null,
    musica_celular: o.musica_celular === true,
    pelo_celular: o.pelo_celular === true,
  };
}

// O que cada formato aceita (documentação da Meta, IG User Media, 10/2026):
// collab só em foto, Reels e carrossel (não em story); marcação com x/y em
// imagem, sem posição em vídeo/Reels, opcional em story.
export function extrasDe(op: Opcoes, formato: 'foto' | 'reels' | 'carrossel' | 'story'): Record<string, string> {
  const e: Record<string, string> = {};
  if (formato !== 'story' && op.collaborators.length) e.collaborators = JSON.stringify(op.collaborators);
  if (op.user_tags.length) {
    const tags = formato === 'reels'
      ? op.user_tags.map((t) => ({ username: t.username }))
      : op.user_tags;
    e.user_tags = JSON.stringify(tags);
  }
  return e;
}

// Cria o contêiner com collab/marcação; se a Meta recusar SÓ por causa deles
// (perfil que não existe, privado...), publica sem e avisa. Erro de conta,
// permissão ou limite não é engolido.
async function criarComExtras(igUser: string, token: string, corpo: Record<string, string>,
  extras: Record<string, string | undefined>, contexto: string, avisos: string[]) {
  const limpos = Object.fromEntries(Object.entries(extras).filter(([, v]) => !!v)) as Record<string, string>;
  if (!Object.keys(limpos).length) return await chamar('POST', `${igUser}/media`, corpo, token, contexto);
  try {
    return await chamar('POST', `${igUser}/media`, { ...corpo, ...limpos }, token, contexto);
  } catch (e) {
    if (e instanceof ErroIg && (e.tokenMorto || /Limite do Instagram/.test(e.message))) throw e;
    const c = await chamar('POST', `${igUser}/media`, corpo, token, contexto);
    const quais = [limpos.collaborators ? 'o convite de collab' : '', limpos.user_tags ? 'as marcações' : ''].filter(Boolean).join(' e ');
    avisos.push(`Saiu sem ${quais}: o Instagram recusou (${e instanceof Error ? e.message.slice(0, 120) : 'erro'}).`);
    return c;
  }
}

// Cota de publicações pela API nas últimas 24 h. Falhou a leitura: segue.
export async function lerCota(igUser: string, token: string): Promise<{ usado: number; total: number } | null> {
  try {
    const qs = new URLSearchParams({ fields: 'quota_usage,config', access_token: token });
    const r = await fetch(`${API}/${igUser}/content_publishing_limit?${qs}`);
    const j = await r.json().catch(() => ({}));
    const d = (j?.data ?? [])[0];
    if (!r.ok || !d) return null;
    return { usado: Number(d.quota_usage ?? 0), total: Number(d.config?.quota_total ?? 0) };
  } catch { return null; }
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
    .select('id, user_id, title, caption, format, external_client_id, approval_status, auto_publish, publish_attempts, ig_container_id, publish_by, publish_sem_aprovacao_motivo, ig_opcoes')
    .eq('id', postId).maybeSingle();
  const p = post as Record<string, unknown> | null;
  const linkPost = p?.external_client_id ? '/socialmidia/criapost/publicacoes' : '/app/criando';
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

    // Cria Post sai depois de aprovado pelo cliente OU liberado na conferência
    // com motivo ("publicar sem aprovação", Walter 28/10/2026).
    if (p.external_client_id && p.approval_status !== 'aprovado' && !p.publish_sem_aprovacao_motivo) {
      return await falhar(new ErroIg('O cliente ainda não aprovou este post.', false, true), false);
    }
    const op = lerOpcoes(p.ig_opcoes);
    // Música da biblioteca do Instagram não sai pela API: este post é pelo celular.
    if (op.musica_celular) {
      return await falhar(new ErroIg('Este post vai usar música do Instagram, que não sai pela API. Publique pelo celular.', false, true), false);
    }
    // Story com figurinha (enquete, caixinha, link...): a API não publica figurinha.
    if (op.pelo_celular) {
      return await falhar(new ErroIg('Este story tem figurinha, que não sai pela API do Instagram. Publique pelo celular.', false, true), false);
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

    // Cota de 24 h da conta (a Meta recusa no media_publish; melhor saber antes).
    const cota = await lerCota(igUser, token);
    if (cota && cota.total > 0 && cota.usado >= cota.total) {
      throw new ErroIg(`Esta conta já publicou ${cota.usado} de ${cota.total} posts pela API nas últimas 24 horas. O Cria tenta de novo mais tarde.`);
    }
    // O que a Meta deixou de fora ao criar (collab ou marcação recusados).
    const avisos: string[] = [];

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

      const formato = normalizarFormato(prep.formato);
      const itens = prep.itens;
      if (formato === 'foto') {
        const corpo: Record<string, string> = { image_url: itens[0].url!, caption };
        if (op.alt_text) corpo.alt_text = op.alt_text;
        const c = await criarComExtras(igUser, token, corpo, extrasDe(op, 'foto'), 'Criando a publicação', avisos);
        containerId = String(c.id);
      } else if (formato === 'story') {
        const it = itens[0];
        const corpo: Record<string, string> = it.tipo === 'VIDEO'
          ? { media_type: 'STORIES', video_url: it.url! }
          : { media_type: 'STORIES', image_url: it.url! };
        const c = await criarComExtras(igUser, token, corpo, extrasDe(op, 'story'), 'Criando o story', avisos);
        containerId = String(c.id);
      } else if (formato === 'reels') {
        /* CAPA DO REELS (28/09/2026): a que a social mídia escolheu no Cria
           Post vai junto. Leitura à parte e tolerante: se a coluna ainda não
           existir no banco, publica sem capa (primeiro frame), como antes. */
        let capa: string | null = null;
        {
          const { data: cv, error: cvErr } = await admin.from('posts').select('cover_url').eq('id', postId).maybeSingle();
          if (!cvErr) capa = String((cv as { cover_url?: string | null } | null)?.cover_url ?? '').trim() || null;
        }
        const corpo: Record<string, string> = { media_type: 'REELS', video_url: itens[0].url!, caption,
          share_to_feed: op.share_to_feed === false ? 'false' : 'true' };
        if (capa && /^https:\/\//i.test(capa)) corpo.cover_url = capa;
        // Reels de teste: mostra primeiro pra quem não segue (Walter, 28/10/2026).
        if (op.trial) corpo.trial_params = JSON.stringify({ graduation_strategy: op.trial });
        let c: Record<string, unknown>;
        try {
          c = await criarComExtras(igUser, token, corpo, extrasDe(op, 'reels'), 'Criando o Reels', avisos);
        } catch (e) {
          // Capa recusada não pode derrubar a publicação: tenta de novo sem ela.
          if (!corpo.cover_url) throw e;
          delete corpo.cover_url;
          c = await criarComExtras(igUser, token, corpo, extrasDe(op, 'reels'), 'Criando o Reels', avisos);
        }
        containerId = String(c.id);
      } else {
        // Carrossel: um contêiner por mídia, na ordem da tira, depois o pai.
        const filhos: string[] = [];
        // Texto alternativo e marcação vão na PRIMEIRA imagem (é o que a social
        // mídia vê na tela de opções); collab vai no carrossel inteiro.
        const primeiraImagem = itens.findIndex((i) => i.tipo !== 'VIDEO');
        for (let k = 0; k < itens.length; k++) {
          const it = itens[k];
          const params: Record<string, string> = it.tipo === 'VIDEO'
            ? { media_type: 'VIDEO', video_url: it.url!, is_carousel_item: 'true' }
            : { image_url: it.url!, is_carousel_item: 'true' };
          const ehPrimeira = k === primeiraImagem;
          if (ehPrimeira && op.alt_text) params.alt_text = op.alt_text;
          const c = await criarComExtras(igUser, token, params,
            ehPrimeira ? { user_tags: extrasDe(op, 'foto').user_tags } : {},
            `Criando a mídia ${it.posicao + 1} do carrossel`, avisos);
          filhos.push(String(c.id));
        }
        for (const f of filhos) {
          if (!(await esperarContainer(f, token, limite))) throw new ErroIg('O Instagram demorou demais processando o carrossel. Tente de novo.');
        }
        const pai = await criarComExtras(igUser, token, { media_type: 'CAROUSEL', children: filhos.join(','), caption },
          { collaborators: extrasDe(op, 'carrossel').collaborators }, 'Montando o carrossel', avisos);
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
    // Saiu, mas a Meta deixou algo de fora (config_issue): vira aviso no card.
    const ci = String(pub.config_issue ?? '');
    if (ci === 'CAPTION_NOT_ATTACHED') avisos.push('A legenda não entrou. Abra o post no Instagram e cole a legenda pela edição.');
    else if (ci === 'USER_TAGGING_FAILURE') avisos.push('As marcações de pessoas não entraram. Marque pelo app do Instagram.');
    else if (ci) avisos.push(`O Instagram publicou com um aviso (${ci.slice(0, 60)}).`);
    let permalink: string | null = null;
    try {
      const info = await chamar('GET', mediaId, { fields: 'permalink' }, token, 'Buscando o link');
      permalink = (info.permalink as string) ?? null;
    } catch { /* o post saiu; o link é só conforto */ }

    // Marca publicado nos DOIS sistemas de status (criador e Cria Post).
    const agora = new Date().toISOString();
    await admin.from('posts').update({
      publish_status: 'publicado', publish_error: null, ig_media_id: mediaId, ig_permalink: permalink,
      publish_aviso: avisos.length ? avisos.join(' ') : null,
      ig_container_id: null, published_at: agora, status: 'publicado',
      ...(p.external_client_id ? { approval_status: 'postado' } : {}),
    } as never).eq('id', postId);

    await avisar(admin, avisados, avisos.length ? 'Publicado, mas com aviso' : 'Publicado no Instagram',
      `"${String(p.title ?? 'Post').slice(0, 60)}" saiu no Instagram.${avisos.length ? ' ' + avisos.join(' ') : ''}`,
      avisos.length ? linkPost : (permalink ?? linkPost));

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
