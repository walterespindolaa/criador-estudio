// ═══════════════════════════════════════════════════════════════════════════
// PREPARAR A MÍDIA PRO INSTAGRAM (ciclo 3 do plano de publicar, 28/09/2026)
//
// A API de publicação do Instagram não recebe arquivo: ela BAIXA de uma URL
// pública, e só aceita JPEG (foto) e MP4/MOV (vídeo). A mídia do Cria mora em
// lugares diferentes (bucket media, Drive, Bunny), então aqui cada mídia do
// post vira uma URL pública no formato certo, e o resultado fica guardado na
// própria linha de external_media_refs (ig_url...) pra não refazer.
//
// Usado por: instagram-preparar-midia (botão/teste) e, no ciclo 4, pelo motor
// de publicação. Roda com service role.
//
// Limite de CPU da Edge Function (~2 s): JPEG que já está bom NÃO é
// decodificado (só lemos o tamanho no cabeçalho). Converter só acontece com
// PNG/WebP/GIF ou JPEG acima de 8 MB, que é raro porque o upload do Cria já
// comprime pra JPEG no navegador.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

export type ItemPreparado = {
  ref_id: string;
  posicao: number;
  tipo: 'IMAGE' | 'VIDEO' | null;
  url: string | null;
  largura: number | null;
  altura: number | null;
  duracao: number | null;
  estado: 'pronto' | 'processando' | 'erro';
  erro: string | null;
};

export type ResultadoPreparo = {
  ok: boolean;               // tudo pronto e válido pro formato
  formato: string;
  itens: ItemPreparado[];
  pendentes: number;         // vídeo ainda processando no Bunny: tentar de novo
  erros: string[];           // mensagens em português pra tela
};

type Ref = {
  id: string; provider: string | null; external_file_id: string | null; file_name: string | null;
  file_type: string | null; view_url: string | null; download_url: string | null;
  bunny_video_id: string | null; position: number | null;
  ig_url: string | null; ig_tipo: string | null; ig_largura: number | null; ig_altura: number | null;
  ig_duracao: number | null; ig_bunny_guid: string | null; ig_preparado_em: string | null; ig_erro: string | null;
};

const MAX_JPEG = 8 * 1024 * 1024;       // limite da API pra foto
const LARGURA_MAX = 1440;                 // o Instagram reduz acima disso; converter já no tamanho final
const DRIVE = new Set(['gdrive', 'drive', 'google_drive']);
const BUNNY = new Set(['bunny', 'bunny_stream']);

// ── Bunny: as duas bibliotecas (o Cria criou vídeo nas duas ao longo do tempo) ──
function bibliotecas() {
  const libs: Array<{ id: string; key: string; cdn: string }> = [];
  const cpId = Deno.env.get('BUNNY_CRIAPOST_LIBRARY_ID'), cpKey = Deno.env.get('BUNNY_CRIAPOST_API_KEY');
  if (cpId && cpKey) libs.push({ id: cpId, key: cpKey, cdn: Deno.env.get('BUNNY_CRIAPOST_CDN_HOST') || 'vz-86788381-03e.b-cdn.net' });
  const stId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID'), stKey = Deno.env.get('BUNNY_STREAM_API_KEY');
  if (stId && stKey) libs.push({ id: stId, key: stKey, cdn: Deno.env.get('BUNNY_STREAM_CDN_HOST') || 'vz-4f7de422-7aa.b-cdn.net' });
  return libs;
}

type InfoBunny = { status: number; length: number; width: number; height: number; lib: { id: string; key: string; cdn: string } };

async function infoBunny(guid: string): Promise<InfoBunny | null> {
  for (const lib of bibliotecas()) {
    const r = await fetch(`https://video.bunnycdn.com/library/${lib.id}/videos/${guid}`, { headers: { AccessKey: lib.key } });
    if (!r.ok) continue;
    const v = await r.json();
    return { status: Number(v.status), length: Number(v.length ?? 0), width: Number(v.width ?? 0), height: Number(v.height ?? 0), lib };
  }
  return null;
}

// MP4 direto do vídeo (o "MP4 fallback" da biblioteca). Tenta do maior pro menor.
async function mp4DoBunny(guid: string, cdn: string): Promise<string | null> {
  for (const res of ['1080p', '720p', '480p', '360p']) {
    const url = `https://${cdn}/${guid}/play_${res}.mp4`;
    const r = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (r?.ok) return url;
  }
  return null;
}

// ── Drive: download público (só funciona com "Qualquer pessoa com o link") ──
function urlDownloadDrive(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}
const AVISO_DRIVE = 'O arquivo do Drive não está aberto. No Drive: Compartilhar, Acesso geral, "Qualquer pessoa com o link", e tente de novo.';

async function baixarDrive(fileId: string): Promise<Response> {
  const r = await fetch(urlDownloadDrive(fileId));
  const ct = r.headers.get('content-type') ?? '';
  if (!r.ok || ct.includes('text/html')) { await r.body?.cancel(); throw new Error(AVISO_DRIVE); }
  return r;
}

// ── Imagem: tipo e tamanho lidos do cabeçalho (sem decodificar) ──
function tipoImagem(b: Uint8Array): 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  const txt = new TextDecoder().decode(b.subarray(0, 12));
  if (txt.startsWith('RIFF') && txt.slice(8, 12) === 'WEBP') return 'webp';
  if (txt.slice(4, 8) === 'ftyp') return 'heic';
  return null;
}

function tamanhoJpeg(b: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    // SOF0..SOF15 menos DHT(C4), JPG(C8), DAC(CC): é aqui que está o tamanho.
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

async function paraJpeg(bytes: Uint8Array): Promise<{ jpeg: Uint8Array; w: number; h: number }> {
  let img: Image;
  try {
    const d = await decode(bytes);
    img = (Array.isArray(d) ? d[0] : d) as Image; // GIF: primeiro quadro
  } catch {
    throw new Error('Não consegui converter esta imagem pra JPG. Exporte em JPG ou PNG e troque a mídia.');
  }
  if (img.width > LARGURA_MAX) img = img.resize(LARGURA_MAX, Image.RESIZE_AUTO);
  const jpeg = await img.encodeJPEG(90);
  return { jpeg, w: img.width, h: img.height };
}

// ── Guarda o resultado na linha da mídia ──
async function gravar(admin: SupabaseClient, refId: string, campos: Record<string, unknown>) {
  await admin.from('external_media_refs').update(campos as never).eq('id', refId);
}

function publicUrl(caminho: string) {
  return `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/media/${caminho}`;
}

async function subirJpeg(admin: SupabaseClient, caminho: string, jpeg: Uint8Array) {
  const { error } = await admin.storage.from('media').upload(caminho, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Falha ao guardar a imagem convertida: ${error.message}`);
  return publicUrl(caminho);
}

// ── Uma mídia ──
async function prepararUma(admin: SupabaseClient, dono: string, postId: string, ref: Ref): Promise<ItemPreparado> {
  const base: ItemPreparado = {
    ref_id: ref.id, posicao: ref.position ?? 0, tipo: null, url: null,
    largura: null, altura: null, duracao: null, estado: 'erro', erro: null,
  };
  const prov = (ref.provider ?? '').toLowerCase();
  const mime = (ref.file_type ?? '').toLowerCase();
  const ehVideo = BUNNY.has(prov) || mime.startsWith('video/') || !!ref.bunny_video_id;

  // Já preparada antes e sem erro: reaproveita.
  if (ref.ig_url && ref.ig_preparado_em && !ref.ig_erro) {
    return { ...base, tipo: ref.ig_tipo as 'IMAGE' | 'VIDEO', url: ref.ig_url, largura: ref.ig_largura,
      altura: ref.ig_altura, duracao: ref.ig_duracao, estado: 'pronto' };
  }

  try {
    if (ehVideo) {
      // Vídeo: precisa estar no Bunny (Drive é copiado pra lá) e ter o MP4 direto.
      let guid = ref.bunny_video_id ?? ref.ig_bunny_guid;
      if (!guid && DRIVE.has(prov) && ref.external_file_id) {
        guid = await copiarDriveParaBunny(ref.external_file_id, ref.file_name ?? 'video');
        await gravar(admin, ref.id, { ig_bunny_guid: guid });
      }
      if (!guid && (prov === 'device' || prov === 'storage') && ref.view_url) {
        // Vídeo no nosso bucket público: MP4/MOV já é aceito como está.
        await gravar(admin, ref.id, { ig_url: ref.view_url, ig_tipo: 'VIDEO', ig_preparado_em: new Date().toISOString(), ig_erro: null });
        return { ...base, tipo: 'VIDEO', url: ref.view_url, estado: 'pronto' };
      }
      if (!guid) throw new Error('Não achei o arquivo deste vídeo. Suba o vídeo de novo no post.');

      const info = await infoBunny(guid);
      if (!info) throw new Error('O vídeo não foi encontrado no Bunny. Suba o vídeo de novo no post.');
      if (info.status === 5 || info.status === 6) throw new Error('O Bunny não conseguiu processar este vídeo. Suba de novo (MP4 ou MOV).');
      if (info.status !== 4) return { ...base, tipo: 'VIDEO', estado: 'processando', erro: 'Vídeo ainda processando. Tente de novo em alguns minutos.' };

      const mp4 = await mp4DoBunny(guid, info.lib.cdn);
      if (!mp4) throw new Error('O vídeo está no Bunny mas sem o MP4 direto. Na biblioteca do Bunny, ative "MP4 Fallback" e reprocesse o vídeo.');
      const campos = { ig_url: mp4, ig_tipo: 'VIDEO', ig_largura: info.width || null, ig_altura: info.height || null,
        ig_duracao: info.length || null, ig_preparado_em: new Date().toISOString(), ig_erro: null };
      await gravar(admin, ref.id, campos);
      return { ...base, tipo: 'VIDEO', url: mp4, largura: campos.ig_largura, altura: campos.ig_altura, duracao: campos.ig_duracao, estado: 'pronto' };
    }

    // Imagem: baixa os bytes (bucket público, Bunny Storage ou Drive).
    let bytes: Uint8Array;
    if (DRIVE.has(prov) && ref.external_file_id) {
      bytes = new Uint8Array(await (await baixarDrive(ref.external_file_id)).arrayBuffer());
    } else {
      const origem = ref.view_url || ref.download_url;
      if (!origem) throw new Error('Não achei o arquivo desta imagem. Suba de novo no post.');
      const r = await fetch(origem);
      if (!r.ok) throw new Error('A imagem não está mais disponível no armazenamento. Suba de novo no post.');
      bytes = new Uint8Array(await r.arrayBuffer());
    }

    const t = tipoImagem(bytes);
    if (t === 'heic') throw new Error('Foto em HEIC (iPhone) não é aceita pelo Instagram. Exporte em JPG e troque a mídia.');
    if (!t) throw new Error('Formato de imagem não reconhecido. Use JPG ou PNG.');

    const caminho = `${dono}/ig/${postId}/${ref.id}.jpg`;
    let url: string, w: number, h: number;
    const dim = t === 'jpeg' ? tamanhoJpeg(bytes) : null;
    if (t === 'jpeg' && dim && bytes.length <= MAX_JPEG) {
      // JPEG bom: usa como está. Do nosso bucket público nem copia; do Drive,
      // copia pro nosso bucket (o link do Drive não serve pra API).
      w = dim.w; h = dim.h;
      url = (prov === 'device' || prov === 'storage') && ref.view_url ? ref.view_url : await subirJpeg(admin, caminho, bytes);
    } else {
      const c = await paraJpeg(bytes);
      w = c.w; h = c.h;
      url = await subirJpeg(admin, caminho, c.jpeg);
    }
    await gravar(admin, ref.id, { ig_url: url, ig_tipo: 'IMAGE', ig_largura: w, ig_altura: h, ig_duracao: null,
      ig_preparado_em: new Date().toISOString(), ig_erro: null });
    return { ...base, tipo: 'IMAGE', url, largura: w, altura: h, estado: 'pronto' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await gravar(admin, ref.id, { ig_erro: msg, ig_preparado_em: null });
    return { ...base, tipo: ehVideo ? 'VIDEO' : 'IMAGE', erro: msg };
  }
}

// Drive → Bunny sem passar pela memória da função: o corpo do download vai
// direto (stream) pro upload do Bunny.
async function copiarDriveParaBunny(fileId: string, titulo: string): Promise<string> {
  const lib = bibliotecas()[0];
  if (!lib) throw new Error('Bunny não configurado no servidor.');
  const criado = await fetch(`https://video.bunnycdn.com/library/${lib.id}/videos`, {
    method: 'POST', headers: { AccessKey: lib.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `ig-${titulo}`.slice(0, 120) }),
  });
  const v = await criado.json().catch(() => ({}));
  if (!criado.ok || !v.guid) throw new Error('Não consegui preparar o vídeo do Drive (Bunny recusou).');
  const drive = await baixarDrive(fileId);
  const up = await fetch(`https://video.bunnycdn.com/library/${lib.id}/videos/${v.guid}`, {
    method: 'PUT', headers: { AccessKey: lib.key, 'Content-Type': 'application/octet-stream' },
    body: drive.body, // stream
    // deno-lint-ignore no-explicit-any
    ...({ duplex: 'half' } as any),
  });
  if (!up.ok) throw new Error('Falha ao copiar o vídeo do Drive pro Bunny. Tente de novo.');
  return v.guid as string;
}

// ── Regras do Instagram por formato ──
function validar(formato: string, itens: ItemPreparado[]): string[] {
  const erros: string[] = [];
  const f = formato === 'video' ? 'reels' : formato;
  const prontos = itens.filter((i) => i.estado === 'pronto');
  const proporcaoRuim = (i: ItemPreparado) => {
    if (i.tipo !== 'IMAGE' || !i.largura || !i.altura) return false;
    const r = i.largura / i.altura;
    return r < 0.79 || r > 1.92; // 4:5 até 1.91:1 (com folga de arredondamento)
  };

  if (f === 'story') erros.push('Stories ficam pra uma próxima versão. Por enquanto: foto, carrossel e Reels.');
  else if (!['foto', 'carrossel', 'reels'].includes(f)) erros.push(`O formato "${formato}" não é publicado no Instagram pelo Cria.`);
  if (itens.length === 0) erros.push('O post não tem mídia.');

  if (f === 'foto') {
    if (itens.length > 1) erros.push('Post Estático com mais de uma mídia: mude o formato pra Carrossel.');
    if (prontos[0] && prontos[0].tipo !== 'IMAGE') erros.push('Post Estático precisa ser uma foto. Vídeo sai como Reels.');
  }
  if (f === 'reels') {
    if (itens.length !== 1) erros.push('Reels precisa de exatamente 1 vídeo.');
    const v = prontos[0];
    if (v && v.tipo !== 'VIDEO') erros.push('Reels precisa ser um vídeo.');
    if (v?.duracao && (v.duracao < 3 || v.duracao > 900)) erros.push('Reels precisa ter entre 3 segundos e 15 minutos.');
  }
  if (f === 'carrossel') {
    if (itens.length < 2) erros.push('Carrossel precisa de pelo menos 2 mídias.');
    if (itens.length > 10) erros.push(`Carrossel aceita até 10 mídias (este tem ${itens.length}).`);
    prontos.forEach((i) => {
      if (i.tipo === 'VIDEO' && i.duracao && i.duracao > 60) erros.push(`O vídeo da posição ${i.posicao + 1} passa de 60 segundos (limite no carrossel).`);
    });
  }
  if (f === 'foto' || f === 'carrossel') {
    prontos.filter(proporcaoRuim).forEach((i) => {
      erros.push(`A imagem da posição ${i.posicao + 1} está em ${i.largura}x${i.altura}. O Instagram aceita de 4:5 (vertical) até 1.91:1 (horizontal).`);
    });
  }
  itens.filter((i) => i.estado === 'erro' && i.erro).forEach((i) => erros.push(`Mídia ${i.posicao + 1}: ${i.erro}`));
  return erros;
}

// ── Post inteiro ──
export async function prepararMidiaDoPost(admin: SupabaseClient, postId: string, prazoMs = 100_000): Promise<ResultadoPreparo> {
  const inicio = Date.now();
  const { data: post, error } = await admin.from('posts').select('id, user_id, format').eq('id', postId).maybeSingle();
  if (error || !post) throw new Error('post não encontrado');
  const { user_id: dono, format } = post as { user_id: string; format: string };

  const { data: refs } = await admin.from('external_media_refs')
    .select('id, provider, external_file_id, file_name, file_type, view_url, download_url, bunny_video_id, position, ig_url, ig_tipo, ig_largura, ig_altura, ig_duracao, ig_bunny_guid, ig_preparado_em, ig_erro')
    .eq('post_id', postId)
    // Versão trocada (revisão do parceiro) não entra; linha antiga pode ter nulo.
    .or('substituida.is.null,substituida.eq.false')
    .order('position', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true });

  const itens: ItemPreparado[] = [];
  const lista = (refs ?? []) as Ref[];
  for (let i = 0; i < lista.length; i++) {
    if (Date.now() - inicio > prazoMs) {
      // Sem tempo pra esta: devolve como processando (próxima chamada continua).
      itens.push({ ref_id: lista[i].id, posicao: i, tipo: null, url: null, largura: null, altura: null, duracao: null, estado: 'processando', erro: null });
      continue;
    }
    const item = await prepararUma(admin, dono, postId, lista[i]);
    itens.push({ ...item, posicao: i });
  }

  const erros = validar(format, itens);
  const pendentes = itens.filter((i) => i.estado === 'processando').length;
  return { ok: erros.length === 0 && pendentes === 0, formato: format, itens, pendentes, erros };
}
