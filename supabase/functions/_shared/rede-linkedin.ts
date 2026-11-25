// LinkedIn perfil pessoal: conexão (OpenID Connect + Share on LinkedIn) e
// publicação (Posts API, Images API, Videos API).
// Walter, 25/11/2026: "linkedin vamos implementar já que é rapido e adaptar o
// sistema pra isso?". Página de empresa fica em stand by.
// Fonte: learn.microsoft.com/linkedin, lida em 25/11/2026 (nota do cofre
// Anotacoes/2026-11-25-linkedin-e-google-meu-negocio).
//
// Regras que vêm do LinkedIn:
// - O acesso dura 60 dias e não renova: refresh token só pra parceiro
//   aprovado. Vencido, a pessoa reconecta (conexao_do_post bloqueia).
// - Sem agendamento na API: o robô do Cria publica na hora marcada.
// - Formatos: só texto, uma foto, carrossel de 2 a 20 fotos, ou um vídeo
//   (MP4, 3 s a 30 min, até 500 MB). Foto e vídeo juntos não pode.
// - Vídeo sobe em pedaços de 4 MB e fica PROCESSING no LinkedIn. O post só é
//   criado quando o vídeo fica AVAILABLE (o robô confere em redes_processando).
// - Caracteres reservados do texto (| { } @ [ ] ( ) < > # \ * _ ~) vão com
//   barra invertida, senão a API corta o texto. Hashtag vira o modelo
//   {hashtag|\#|palavra} pra continuar clicável.

import { ErroRede, type ResultadoPublicacao, type TokensDaConexao } from './redes.ts';
import type { ItemPreparado } from './ig-midia.ts';

const API = 'https://api.linkedin.com';
export const ESCOPOS_LINKEDIN = 'openid profile w_member_social';
export const TEXTO_MAX_LINKEDIN = 3000;
const FOTOS_MAX = 20;
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

function credenciais() {
  const id = Deno.env.get('LINKEDIN_CLIENT_ID')?.trim();
  const secret = Deno.env.get('LINKEDIN_CLIENT_SECRET')?.trim();
  if (!id || !secret) throw new ErroRede('LinkedIn ainda não configurado no Cria (falta LINKEDIN_CLIENT_ID/SECRET).', true);
  return { id, secret };
}

// Versão da API (formato AAAAMM). Cada versão vale pelo menos 1 ano; dá pra
// trocar pelo segredo LINKEDIN_VERSION sem publicar código.
const versao = () => Deno.env.get('LINKEDIN_VERSION')?.trim() || '202611';
const cabecalhos = (token: string, json = true): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'Linkedin-Version': versao(),
  'X-Restli-Protocol-Version': '2.0.0',
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

function erroLinkedIn(status: number, j: Record<string, unknown> | null, contexto: string): ErroRede {
  const msg = String(j?.message ?? '');
  if (status === 401) return new ErroRede('A conexão com o LinkedIn venceu. Reconecte o LinkedIn.', true, true);
  if (status === 403) return new ErroRede('Falta a permissão de publicar no LinkedIn. Reconecte e aceite todas as permissões.', true, true);
  if (status === 429) return new ErroRede('O LinkedIn pediu pra esperar um pouco. O Cria tenta de novo.');
  if (status >= 500 || status === 409) return new ErroRede(`O LinkedIn não respondeu (${contexto}). O Cria tenta de novo.`);
  if (/FIELD_LENGTH_TOO_LONG|too long/i.test(msg)) return new ErroRede(`O texto passou do limite do LinkedIn (${TEXTO_MAX_LINKEDIN} caracteres).`, true);
  // Foto ou vídeo ainda processando do lado deles: tentar de novo resolve.
  if (/WAITING_UPLOAD|PROCESSING/i.test(msg) && !/FAILED/i.test(msg)) return new ErroRede('O LinkedIn ainda está processando a mídia. O Cria tenta de novo.');
  return new ErroRede(`LinkedIn recusou (${contexto}): ${msg || status}`, status === 400 || status === 422);
}

async function chamar(caminho: string, token: string, corpo: unknown, contexto: string) {
  const r = await fetch(`${API}${caminho}`, { method: 'POST', headers: cabecalhos(token), body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => null) as Record<string, unknown> | null;
  if (!r.ok) throw erroLinkedIn(r.status, j, contexto);
  return { r, j };
}

async function token(form: Record<string, string>): Promise<TokensDaConexao> {
  const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || !j.access_token) {
    const morto = j.error === 'invalid_grant' || form.grant_type === 'refresh_token';
    throw new ErroRede(`Não deu pra ${form.grant_type === 'refresh_token' ? 'renovar' : 'conectar'} o LinkedIn: ${String(j.error_description ?? j.error ?? r.status)}`, morto, morto);
  }
  const agora = Date.now();
  return {
    accessToken: String(j.access_token),
    accessExpiraEm: j.expires_in ? new Date(agora + Number(j.expires_in) * 1000).toISOString() : null,
    // Só parceiro aprovado recebe; pra perfil comum vem vazio e a pessoa reconecta em 60 dias.
    refreshToken: j.refresh_token ? String(j.refresh_token) : null,
    refreshExpiraEm: j.refresh_token_expires_in ? new Date(agora + Number(j.refresh_token_expires_in) * 1000).toISOString() : null,
    // O LinkedIn devolve os escopos separados por vírgula ou espaço.
    escopos: String(j.scope ?? ESCOPOS_LINKEDIN).replace(/,/g, ' '),
  };
}

/** Texto no formato do LinkedIn: reservados escapados e hashtag clicável. */
export function textoLinkedIn(s: string): string {
  const esc = (t: string) => t.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  let out = '';
  let ult = 0;
  for (const m of s.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    out += esc(s.slice(ult, m.index));
    out += `{hashtag|\\#|${esc(m[1])}}`;
    ult = (m.index ?? 0) + m[0].length;
  }
  return out + esc(s.slice(ult));
}

export type FormatoLinkedIn = 'texto' | 'foto' | 'carrossel' | 'video';

/** Qual post sai com a mídia do post (ou o motivo de não dar). */
export function formatoLinkedIn(itens: ItemPreparado[]): { formato: FormatoLinkedIn } | { erro: string } {
  const fotos = itens.filter((i) => i.tipo === 'IMAGE');
  const videos = itens.filter((i) => i.tipo === 'VIDEO');
  if (videos.length && fotos.length) return { erro: 'No LinkedIn o post leva fotos ou um vídeo, não os dois juntos.' };
  if (videos.length > 1) return { erro: 'No LinkedIn o post leva um vídeo só.' };
  if (videos.length === 1) return { formato: 'video' };
  if (fotos.length > FOTOS_MAX) return { erro: `O carrossel do LinkedIn aceita até ${FOTOS_MAX} fotos. Este post tem ${fotos.length}.` };
  if (fotos.length > 1) return { formato: 'carrossel' };
  if (fotos.length === 1) return { formato: 'foto' };
  return { formato: 'texto' };
}

async function criarPost(accessToken: string, autor: string, texto: string, visibilidade: string, content?: Record<string, unknown>) {
  const { r } = await chamar('/rest/posts', accessToken, {
    author: autor,
    commentary: textoLinkedIn(texto),
    visibility: visibilidade,
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(content ? { content } : {}),
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }, 'criar o post');
  const urn = r.headers.get('x-restli-id') ?? '';
  if (!urn) throw new ErroRede('O LinkedIn publicou mas não devolveu o endereço. Confira no perfil antes de tentar de novo.', true);
  return { estado: 'publicado' as const, externalId: urn, permalink: `https://www.linkedin.com/feed/update/${urn}/` };
}

async function subirFoto(accessToken: string, autor: string, url: string): Promise<string> {
  const { j } = await chamar('/rest/images?action=initializeUpload', accessToken, { initializeUploadRequest: { owner: autor } }, 'preparar a foto');
  const v = (j?.value ?? {}) as { uploadUrl?: string; image?: string };
  if (!v.uploadUrl || !v.image) throw new ErroRede('O LinkedIn não devolveu o endereço da foto.');
  const arq = await fetch(url);
  if (!arq.ok) throw new ErroRede('Não deu pra ler a foto do post. Tenta de novo em alguns minutos.');
  const bytes = new Uint8Array(await arq.arrayBuffer());
  const up = await fetch(v.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: bytes });
  if (!up.ok) throw erroLinkedIn(up.status, null, 'enviar a foto');
  return v.image;
}

export const linkedin = {
  rede: 'linkedin' as const,

  urlDeConexao(state: string, redirectUri: string): string {
    const { id } = credenciais();
    const q = new URLSearchParams({ response_type: 'code', client_id: id, redirect_uri: redirectUri, state, scope: ESCOPOS_LINKEDIN });
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  },

  async trocarCodigo(code: string, redirectUri: string) {
    const { id, secret } = credenciais();
    const t = await token({ grant_type: 'authorization_code', code, client_id: id, client_secret: secret, redirect_uri: redirectUri });
    // userinfo (OpenID): sub é o id da pessoa; o autor do post é urn:li:person:{sub}.
    const r = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.accessToken}` } });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!r.ok || !j?.sub) throw erroLinkedIn(r.status, j, 'ler o perfil');
    return { ...t, contaId: `urn:li:person:${String(j.sub)}`, usuario: (j.name as string) ?? null, foto: (j.picture as string) ?? null };
  },

  async renovar(refreshToken: string): Promise<TokensDaConexao> {
    const { id, secret } = credenciais();
    return await token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: id, client_secret: secret });
  },

  /** Texto, foto e carrossel saem na hora; vídeo sobe e fica processando. */
  async publicar(args: {
    accessToken: string; autor: string; itens: ItemPreparado[]; texto: string; opcoes: Record<string, unknown>; limiteMs: number;
  }): Promise<ResultadoPublicacao> {
    const visibilidade = String(args.opcoes.visibility ?? '');
    if (!['PUBLIC', 'CONNECTIONS'].includes(visibilidade)) throw new ErroRede('Escolha quem pode ver o post no LinkedIn.', true);
    if (args.texto.length > TEXTO_MAX_LINKEDIN) throw new ErroRede(`O texto passou do limite do LinkedIn (${TEXTO_MAX_LINKEDIN} caracteres).`, true);
    const f = formatoLinkedIn(args.itens);
    if ('erro' in f) throw new ErroRede(f.erro, true);
    if (f.formato === 'texto' && !args.texto.trim()) throw new ErroRede('Post sem foto nem vídeo precisa de texto pro LinkedIn.', true);

    if (f.formato === 'texto') return await criarPost(args.accessToken, args.autor, args.texto, visibilidade);

    if (f.formato === 'foto' || f.formato === 'carrossel') {
      const ids: string[] = [];
      for (const it of args.itens) {
        if (Date.now() > args.limiteMs) throw new ErroRede('O envio pro LinkedIn passou do tempo. O Cria tenta de novo.');
        ids.push(await subirFoto(args.accessToken, args.autor, it.url!));
      }
      const content = ids.length === 1
        ? { media: { id: ids[0] } }
        : { multiImage: { images: ids.map((id) => ({ id })) } };
      return await criarPost(args.accessToken, args.autor, args.texto, visibilidade, content);
    }

    // Vídeo: inicia, manda cada pedaço guardando o ETag, finaliza.
    const v = args.itens[0];
    const head = await fetch(v.url!, { method: 'HEAD' });
    const total = Number(head.headers.get('content-length') ?? 0);
    if (!head.ok || !total) throw new ErroRede('Não deu pra ler o tamanho do vídeo. Tenta de novo em alguns minutos.');
    if (total > VIDEO_MAX_BYTES) throw new ErroRede('O vídeo passa de 500 MB, o limite do LinkedIn.', true);
    if (v.duracao && (v.duracao < 3 || v.duracao > 30 * 60)) throw new ErroRede('O LinkedIn aceita vídeo de 3 segundos a 30 minutos.', true);

    const { j } = await chamar('/rest/videos?action=initializeUpload', args.accessToken, {
      initializeUploadRequest: { owner: args.autor, fileSizeBytes: total, uploadCaptions: false, uploadThumbnail: false },
    }, 'preparar o vídeo');
    const val = (j?.value ?? {}) as { video?: string; uploadToken?: string; uploadInstructions?: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> };
    const partes = val.uploadInstructions ?? [];
    if (!val.video || !partes.length) throw new ErroRede('O LinkedIn não devolveu o endereço de envio do vídeo.');

    const etags: string[] = [];
    for (const p of partes) {
      if (Date.now() > args.limiteMs) throw new ErroRede('O envio pro LinkedIn passou do tempo. O Cria tenta de novo.');
      const pedaco = await fetch(v.url!, { headers: { Range: `bytes=${p.firstByte}-${p.lastByte}` } });
      if (pedaco.status !== 206 && !(pedaco.ok && partes.length === 1)) throw new ErroRede('O servidor do vídeo não entregou o pedaço pedido.');
      const bytes = new Uint8Array(await pedaco.arrayBuffer());
      // A doc pede o envio do pedaço SEM o token no cabeçalho.
      const up = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
      if (!up.ok) throw erroLinkedIn(up.status, null, 'enviar o vídeo');
      etags.push(String(up.headers.get('etag') ?? '').replace(/"/g, ''));
    }
    await chamar('/rest/videos?action=finalizeUpload', args.accessToken, {
      finalizeUploadRequest: { video: val.video, uploadToken: val.uploadToken ?? '', uploadedPartIds: etags },
    }, 'finalizar o vídeo');
    return { estado: 'processando', externalId: val.video };
  },

  /** Vídeo pronto no LinkedIn: cria o post. Ainda processando: devolve processando. */
  async conferirVideo(args: { accessToken: string; autor: string; video: string; texto: string; opcoes: Record<string, unknown> }): Promise<ResultadoPublicacao> {
    const r = await fetch(`${API}/rest/videos/${encodeURIComponent(args.video)}`, { headers: cabecalhos(args.accessToken, false) });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!r.ok) throw erroLinkedIn(r.status, j, 'status do vídeo');
    const st = String(j?.status ?? '');
    if (st === 'PROCESSING_FAILED') {
      return { estado: 'erro', erro: `O LinkedIn não aceitou o vídeo: ${String(j?.processingFailureReason ?? 'motivo não informado')}.`, tentarDeNovo: false };
    }
    if (st !== 'AVAILABLE') return { estado: 'processando', externalId: args.video };
    return await criarPost(args.accessToken, args.autor, args.texto, String(args.opcoes.visibility ?? 'PUBLIC'), { media: { id: args.video } });
  },
};
