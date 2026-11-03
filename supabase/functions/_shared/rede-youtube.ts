// YouTube: conexão (OAuth do Google) e publicação (Data API v3, videos.insert).
// Fonte: developers.google.com/youtube, lida em 02/11/2026.
//
// Normal x Shorts: não existe campo de Short na API. Vídeo vertical ou
// quadrado de até 3 min é classificado como Short pelo próprio YouTube. O Cria
// só confere se o vídeo bate com o que a pessoa escolheu e avisa antes.
//
// Envio retomável em pedaços de 8 MB (múltiplo de 256 KB, exigência da API),
// lidos do CDN por Range: o arquivo nunca fica inteiro na memória.

import { ErroRede, type ResultadoPublicacao, type TokensDaConexao } from './redes.ts';

export const ESCOPOS_YOUTUBE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

function credenciais() {
  const id = Deno.env.get('YOUTUBE_CLIENT_ID')?.trim();
  const secret = Deno.env.get('YOUTUBE_CLIENT_SECRET')?.trim();
  if (!id || !secret) throw new ErroRede('YouTube ainda não configurado no Cria (falta YOUTUBE_CLIENT_ID/SECRET).', true);
  return { id, secret };
}

async function token(form: Record<string, string>): Promise<TokensDaConexao> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || !j.access_token) {
    const morto = j.error === 'invalid_grant';
    throw new ErroRede(`Não deu pra ${form.grant_type === 'refresh_token' ? 'renovar' : 'conectar'} o YouTube: ${String(j.error_description ?? j.error ?? r.status)}`, morto, morto);
  }
  return {
    accessToken: String(j.access_token),
    accessExpiraEm: j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000).toISOString() : null,
    refreshToken: j.refresh_token ? String(j.refresh_token) : null,
    refreshExpiraEm: null, // em produção o Google não dá prazo fixo
    escopos: String(j.scope ?? ''),
  };
}

function erroGoogle(status: number, j: Record<string, unknown> | null, contexto: string): ErroRede {
  const err = (j?.error ?? {}) as { message?: string; errors?: Array<{ reason?: string }> };
  const motivo = err.errors?.[0]?.reason ?? '';
  if (status === 401) return new ErroRede('A conexão com o YouTube venceu. Reconecte o YouTube.', true, true);
  if (motivo === 'quotaExceeded' || motivo === 'uploadLimitExceeded') {
    return new ErroRede('O YouTube atingiu o limite de envios do dia. O Cria tenta de novo amanhã.');
  }
  if (motivo === 'youtubeSignupRequired') return new ErroRede('Esta conta Google ainda não tem canal no YouTube. Crie o canal e reconecte.', true, true);
  if (status === 403 && /scope|insufficient/i.test(String(err.message))) {
    return new ErroRede('Falta a permissão de enviar vídeo. Reconecte o YouTube e marque todas as permissões.', true, true);
  }
  return new ErroRede(`YouTube recusou (${contexto}): ${err.message ?? status}`, status === 400);
}

export const youtube = {
  rede: 'youtube' as const,

  urlDeConexao(state: string, redirectUri: string): string {
    const { id } = credenciais();
    const q = new URLSearchParams({
      client_id: id, redirect_uri: redirectUri, response_type: 'code', scope: ESCOPOS_YOUTUBE,
      // offline + consent: garante o refresh token mesmo em reconexão.
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  },

  async trocarCodigo(code: string, redirectUri: string) {
    const { id, secret } = credenciais();
    const t = await token({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: 'authorization_code' });
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${t.accessToken}` } });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!r.ok) throw erroGoogle(r.status, j, 'ler o canal');
    const canal = ((j?.items as Array<Record<string, unknown>> | undefined) ?? [])[0];
    if (!canal) throw new ErroRede('Esta conta Google não tem canal no YouTube. Crie o canal e conecte de novo.', true);
    const sn = (canal.snippet ?? {}) as Record<string, unknown>;
    const thumb = ((sn.thumbnails as Record<string, { url?: string }> | undefined)?.default?.url) ?? null;
    return { ...t, contaId: String(canal.id), usuario: (sn.customUrl as string) ?? (sn.title as string) ?? null, foto: thumb };
  },

  async renovar(refreshToken: string): Promise<TokensDaConexao> {
    const { id, secret } = credenciais();
    return await token({ client_id: id, client_secret: secret, refresh_token: refreshToken, grant_type: 'refresh_token' });
  },

  /** Confere se o vídeo bate com o tipo escolhido (Short ou normal). */
  conferirTipo(tipo: 'short' | 'video' | undefined, largura: number | null, altura: number | null, duracao: number | null): string | null {
    if (!tipo || !largura || !altura) return null;
    const ehShort = altura >= largura && (duracao ?? 0) <= 180;
    if (tipo === 'short' && !ehShort) {
      return largura > altura
        ? 'Para sair como Short o vídeo precisa ser vertical ou quadrado. Este é horizontal: vai sair como vídeo normal.'
        : 'Short tem até 3 minutos. Este vídeo é mais longo: vai sair como vídeo normal.';
    }
    if (tipo === 'video' && ehShort) return 'Este vídeo é vertical e curto: o YouTube vai tratar como Short.';
    return null;
  },

  async publicar(args: {
    accessToken: string; midiaUrl: string; titulo: string; texto: string; opcoes: Record<string, unknown>;
    ehShort: boolean; limiteMs: number;
  }): Promise<ResultadoPublicacao> {
    const o = args.opcoes;
    if (!['public', 'unlisted', 'private'].includes(String(o.privacyStatus))) {
      throw new ErroRede('Escolha a visibilidade do vídeo no YouTube antes de publicar.', true);
    }
    if (typeof o.selfDeclaredMadeForKids !== 'boolean') {
      throw new ErroRede('Responda se o vídeo é feito para crianças antes de publicar no YouTube.', true);
    }
    const titulo = args.titulo.trim().slice(0, 100);
    if (!titulo) throw new ErroRede('O vídeo precisa de um título pro YouTube.', true);

    const head = await fetch(args.midiaUrl, { method: 'HEAD' });
    const total = Number(head.headers.get('content-length') ?? 0);
    if (!head.ok || !total) throw new ErroRede('Não deu pra ler o tamanho do vídeo. Tenta de novo em alguns minutos.');

    const ini = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(total),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify({
        snippet: { title: titulo, description: args.texto.slice(0, 5000), categoryId: '22' },
        status: {
          privacyStatus: o.privacyStatus,
          selfDeclaredMadeForKids: o.selfDeclaredMadeForKids,
          ...(typeof o.containsSyntheticMedia === 'boolean' ? { containsSyntheticMedia: o.containsSyntheticMedia } : {}),
        },
      }),
    });
    if (!ini.ok) throw erroGoogle(ini.status, await ini.json().catch(() => null), 'iniciar envio');
    const sessao = ini.headers.get('location');
    if (!sessao) throw new ErroRede('O YouTube não devolveu o endereço de envio.');

    const PEDACO = 32 * 256 * 1024; // 8 MB
    let enviado = 0;
    let video: Record<string, unknown> | null = null;
    while (enviado < total) {
      if (Date.now() > args.limiteMs) throw new ErroRede('O envio pro YouTube passou do tempo. O Cria tenta de novo.');
      const fim = Math.min(enviado + PEDACO, total) - 1;
      const parte = await fetch(args.midiaUrl, { headers: { Range: `bytes=${enviado}-${fim}` } });
      if (parte.status !== 206 && !(parte.ok && enviado === 0 && fim === total - 1)) {
        throw new ErroRede('O servidor do vídeo não entregou o pedaço pedido.');
      }
      const bytes = new Uint8Array(await parte.arrayBuffer());
      const up = await fetch(sessao, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${args.accessToken}`, 'Content-Length': String(bytes.length), 'Content-Range': `bytes ${enviado}-${fim}/${total}` },
        body: bytes,
      });
      if (up.status === 308) {
        // Incompleto: o YouTube diz até onde recebeu.
        const r = up.headers.get('range');
        enviado = r ? Number(r.split('-')[1]) + 1 : fim + 1;
        continue;
      }
      const j = await up.json().catch(() => null) as Record<string, unknown> | null;
      if (!up.ok) throw erroGoogle(up.status, j, 'enviar o vídeo');
      video = j;
      break;
    }
    const id = String(video?.id ?? '');
    if (!id) throw new ErroRede('O YouTube recebeu o vídeo mas não devolveu o endereço. Confira no canal antes de tentar de novo.', true);
    return { estado: 'publicado', externalId: id, permalink: args.ehShort ? `https://www.youtube.com/shorts/${id}` : `https://youtu.be/${id}` };
  },
};
