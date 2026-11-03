// TikTok: conexão (Login Kit) e publicação (Content Posting API, Direct Post).
// Fonte: developers.tiktok.com, lida em 02/11/2026 (doc "Publicar no TikTok e
// no YouTube pelo Cria").
//
// Decisões:
// - FILE_UPLOAD em vez de PULL_FROM_URL: puxar por URL exige verificar o
//   domínio da mídia no portal do TikTok, e o vídeo vem do CDN do Bunny. Aqui
//   o servidor lê o MP4 em pedaços (Range) e manda pedaço por pedaço, sem
//   carregar o arquivo inteiro na memória.
// - Sem agendamento na API: o robô do Cria publica na hora marcada.
// - Depois do envio o TikTok processa; o post fica "processando" até o
//   status do publish_id virar PUBLISH_COMPLETE ou FAILED.

import { ErroRede, type CriadorTikTok, type ResultadoPublicacao, type TokensDaConexao } from './redes.ts';

const API = 'https://open.tiktokapis.com';
export const ESCOPOS_TIKTOK = 'user.info.basic,video.publish';

function credenciais() {
  const key = Deno.env.get('TIKTOK_CLIENT_KEY')?.trim();
  const secret = Deno.env.get('TIKTOK_CLIENT_SECRET')?.trim();
  if (!key || !secret) throw new ErroRede('TikTok ainda não configurado no Cria (falta TIKTOK_CLIENT_KEY/SECRET).', true);
  return { key, secret };
}

// Erro no formato { error: { code, message, log_id } }. code "ok" = sucesso.
function erroTikTok(j: Record<string, unknown> | null, contexto: string): ErroRede | null {
  const e = (j?.error ?? null) as { code?: string; message?: string } | null;
  if (!e || !e.code || e.code === 'ok') return null;
  const c = e.code;
  if (c === 'access_token_invalid' || c === 'scope_not_authorized' || c === 'scope_permission_missed') {
    return new ErroRede('A conexão com o TikTok venceu ou perdeu a permissão de publicar. Reconecte o TikTok.', true, true);
  }
  if (c === 'spam_risk_too_many_posts') return new ErroRede('Esta conta já publicou o máximo do dia no TikTok. O Cria tenta de novo mais tarde.');
  if (c === 'spam_risk_user_banned_from_posting') return new ErroRede('O TikTok bloqueou publicações desta conta por enquanto.', true);
  if (c === 'reached_active_user_cap') return new ErroRede('O Cria atingiu o limite diário de contas publicando no TikTok. Tenta de novo amanhã.');
  if (c === 'unaudited_client_can_only_post_to_private_accounts') {
    return new ErroRede('O app do Cria ainda está em análise no TikTok: por enquanto só publica em conta privada e como "só eu".', true);
  }
  if (c === 'privacy_level_option_mismatch') return new ErroRede('A privacidade escolhida não está disponível pra esta conta. Escolha de novo no post.', true);
  if (c === 'rate_limit_exceeded') return new ErroRede('O TikTok pediu pra esperar um pouco. O Cria tenta de novo.');
  return new ErroRede(`TikTok recusou (${contexto}): ${e.message || c}`);
}

async function postJson(caminho: string, token: string, corpo: unknown, contexto: string) {
  const r = await fetch(`${API}${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(corpo ?? {}),
  });
  const j = await r.json().catch(() => null) as Record<string, unknown> | null;
  const e = erroTikTok(j, contexto);
  if (e) throw e;
  if (!r.ok) throw new ErroRede(`TikTok respondeu ${r.status} (${contexto}).`);
  return (j?.data ?? {}) as Record<string, unknown>;
}

async function trocaToken(form: Record<string, string>): Promise<TokensDaConexao & { openId: string }> {
  const r = await fetch(`${API}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams(form),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || !j.access_token) {
    const msg = String(j.error_description ?? j.error ?? r.status);
    const morto = String(j.error ?? '').includes('invalid_grant');
    throw new ErroRede(`Não deu pra ${form.grant_type === 'refresh_token' ? 'renovar' : 'conectar'} o TikTok: ${msg}`, morto, morto);
  }
  const agora = Date.now();
  return {
    accessToken: String(j.access_token),
    accessExpiraEm: j.expires_in ? new Date(agora + Number(j.expires_in) * 1000).toISOString() : null,
    refreshToken: j.refresh_token ? String(j.refresh_token) : null,
    refreshExpiraEm: j.refresh_expires_in ? new Date(agora + Number(j.refresh_expires_in) * 1000).toISOString() : null,
    escopos: String(j.scope ?? ''),
    openId: String(j.open_id ?? ''),
  };
}

export const tiktok = {
  rede: 'tiktok' as const,

  urlDeConexao(state: string, redirectUri: string): string {
    const { key } = credenciais();
    const q = new URLSearchParams({ client_key: key, scope: ESCOPOS_TIKTOK, response_type: 'code', redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  },

  async trocarCodigo(code: string, redirectUri: string) {
    const { key, secret } = credenciais();
    const t = await trocaToken({ client_key: key, client_secret: secret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    // user.info.basic devolve open_id, nome de exibição e foto (o @ exige outro escopo).
    const r = await fetch(`${API}/v2/user/info/?fields=open_id,display_name,avatar_url`, { headers: { Authorization: `Bearer ${t.accessToken}` } });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    const u = ((j?.data as Record<string, unknown> | undefined)?.user ?? {}) as Record<string, unknown>;
    return { ...t, contaId: String(u.open_id ?? t.openId), usuario: (u.display_name as string) ?? null, foto: (u.avatar_url as string) ?? null };
  },

  async renovar(refreshToken: string): Promise<TokensDaConexao> {
    const { key, secret } = credenciais();
    return await trocaToken({ client_key: key, client_secret: secret, grant_type: 'refresh_token', refresh_token: refreshToken });
  },

  /** Obrigatório antes de cada post (regra de UX do TikTok). */
  async criador(accessToken: string): Promise<CriadorTikTok> {
    const d = await postJson('/v2/post/publish/creator_info/query/', accessToken, {}, 'dados da conta');
    return {
      usuario: (d.creator_username as string) ?? null,
      nome: (d.creator_nickname as string) ?? null,
      foto: (d.creator_avatar_url as string) ?? null,
      privacidades: Array.isArray(d.privacy_level_options) ? d.privacy_level_options as string[] : [],
      comentarioDesligado: !!d.comment_disabled,
      duetoDesligado: !!d.duet_disabled,
      costuraDesligada: !!d.stitch_disabled,
      duracaoMaxSeg: Number(d.max_video_post_duration_sec ?? 0) || null,
    };
  },

  async publicar(args: {
    accessToken: string; midiaUrl: string; texto: string; opcoes: Record<string, unknown>; limiteMs: number;
  }): Promise<ResultadoPublicacao> {
    const o = args.opcoes;
    if (typeof o.privacy_level !== 'string' || !o.privacy_level) {
      throw new ErroRede('Escolha a privacidade do post no TikTok antes de publicar.', true);
    }
    if (o.brand_content_toggle && o.privacy_level === 'SELF_ONLY') {
      throw new ErroRede('Conteúdo de marca não pode sair como "só eu" no TikTok.', true);
    }
    // Tamanho do arquivo (Range precisa dele).
    const head = await fetch(args.midiaUrl, { method: 'HEAD' });
    const total = Number(head.headers.get('content-length') ?? 0);
    if (!head.ok || !total) throw new ErroRede('Não deu pra ler o tamanho do vídeo. Tenta de novo em alguns minutos.');
    if (total > 4 * 1024 ** 3) throw new ErroRede('O vídeo passa de 4 GB, o limite do TikTok.', true);

    // Pedaços de 10 MB; abaixo de 5 MB vai inteiro. O último absorve o resto.
    const MB = 1024 * 1024;
    const pedaco = total < 5 * MB ? total : 10 * MB;
    const qtd = Math.max(1, Math.floor(total / pedaco));

    const init = await postJson('/v2/post/publish/video/init/', args.accessToken, {
      post_info: {
        title: args.texto.slice(0, 2200),
        privacy_level: o.privacy_level,
        disable_comment: !!o.disable_comment,
        disable_duet: !!o.disable_duet,
        disable_stitch: !!o.disable_stitch,
        brand_content_toggle: !!o.brand_content_toggle,
        brand_organic_toggle: !!o.brand_organic_toggle,
        is_aigc: !!o.is_aigc,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: total, chunk_size: pedaco, total_chunk_count: qtd },
    }, 'iniciar envio');
    const publishId = String(init.publish_id ?? '');
    const uploadUrl = String(init.upload_url ?? '');
    if (!publishId || !uploadUrl) throw new ErroRede('O TikTok não devolveu o endereço de envio.');

    for (let i = 0; i < qtd; i++) {
      if (Date.now() > args.limiteMs) throw new ErroRede('O envio pro TikTok passou do tempo. O Cria tenta de novo.');
      const ini = i * pedaco;
      const fim = i === qtd - 1 ? total - 1 : ini + pedaco - 1;
      const parte = await fetch(args.midiaUrl, { headers: { Range: `bytes=${ini}-${fim}` } });
      if (parte.status !== 206 && !(parte.ok && qtd === 1)) throw new ErroRede('O servidor do vídeo não entregou o pedaço pedido.');
      const bytes = new Uint8Array(await parte.arrayBuffer());
      const up = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length), 'Content-Range': `bytes ${ini}-${fim}/${total}` },
        body: bytes,
      });
      if (!up.ok && up.status !== 206) throw new ErroRede(`O TikTok recusou o pedaço ${i + 1} de ${qtd} (${up.status}).`);
    }
    return { estado: 'processando', externalId: publishId };
  },

  async consultarStatus(accessToken: string, publishId: string, usuario: string | null): Promise<ResultadoPublicacao> {
    const d = await postJson('/v2/post/publish/status/fetch/', accessToken, { publish_id: publishId }, 'status');
    const st = String(d.status ?? '');
    if (st === 'PUBLISH_COMPLETE') {
      const ids = (d.publicaly_available_post_id ?? d.publicly_available_post_id) as Array<string | number> | undefined;
      const id = ids?.[0] ? String(ids[0]) : null;
      return { estado: 'publicado', externalId: id ?? publishId, permalink: id && usuario ? `https://www.tiktok.com/@${usuario}/video/${id}` : null };
    }
    if (st === 'FAILED') return { estado: 'erro', erro: `O TikTok não publicou: ${String(d.fail_reason ?? 'motivo não informado')}.`, tentarDeNovo: false };
    return { estado: 'processando', externalId: publishId };
  },
};
