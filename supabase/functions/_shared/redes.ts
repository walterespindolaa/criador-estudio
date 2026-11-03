// Contrato comum das redes onde o Cria publica (02/11/2026, ciclo 2 em 03/11).
//
// O Instagram publica por _shared/ig-publicar.ts e se espelha em
// post_publicacoes por gatilho. TikTok e YouTube publicam por
// redes-publicar, lendo post_publicacoes.
//
// Regras que vêm das redes (doc "Publicar no TikTok e no YouTube pelo Cria",
// documentação oficial lida em 02/11/2026):
// - TikTok não agenda: o robô do Cria publica na hora. Depois do envio o post
//   fica "processando" até o status do publish_id dizer que saiu.
// - TikTok exige consultar creator_info antes de cada post, e a privacidade
//   vem SEM valor padrão: quem escolhe é a pessoa, na tela.
// - YouTube: vídeo vertical ou quadrado de até 3 min vira Short sozinho; não
//   existe campo "Short" na API. O Cria também publica na hora marcada pelo
//   robô (mesmo comportamento do TikTok e do Instagram).

export type Rede = 'instagram' | 'tiktok' | 'youtube';

export type StatusPublicacao =
  | 'rascunho' | 'na_fila' | 'publicando' | 'processando' | 'publicado' | 'erro' | 'cancelado';

export const REDES: Record<Rede, {
  nome: string;
  escopoPublicar: string;
  /** Depois do envio, a rede ainda processa e precisa ser consultada. */
  processaDepois: boolean;
  /** Tamanho máximo do título próprio da rede (null = não tem título separado). */
  tituloMax: number | null;
  textoMax: number;
}> = {
  instagram: { nome: 'Instagram', escopoPublicar: 'instagram_business_content_publish', processaDepois: false, tituloMax: null, textoMax: 2200 },
  tiktok: { nome: 'TikTok', escopoPublicar: 'video.publish', processaDepois: true, tituloMax: null, textoMax: 2200 },
  youtube: { nome: 'YouTube', escopoPublicar: 'youtube.upload', processaDepois: false, tituloMax: 100, textoMax: 5000 },
};

/** Erro com texto pronto pra pessoa ler. `definitivo`: tentar de novo não resolve. */
export class ErroRede extends Error {
  constructor(message: string, public definitivo = false, public reconectar = false) { super(message); }
}

/** Opções que a tela de publicar coleta por rede (post_publicacoes.opcoes). */
export type OpcoesTikTok = {
  privacy_level: string;            // um dos privacy_level_options do creator_info; sem padrão
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  brand_content_toggle: boolean;    // "Conteúdo de marca" (parceria paga)
  brand_organic_toggle: boolean;    // "Sua marca"
  is_aigc?: boolean;
};

export type OpcoesYouTube = {
  privacyStatus: 'public' | 'unlisted' | 'private';
  selfDeclaredMadeForKids: boolean;  // obrigatório perguntar
  containsSyntheticMedia?: boolean;
  /** O que a pessoa quer: Short (vertical/quadrado até 3 min) ou vídeo normal. */
  tipo?: 'short' | 'video';
};

export type CriadorTikTok = {
  usuario: string | null;
  nome: string | null;
  foto: string | null;
  privacidades: string[];
  comentarioDesligado: boolean;
  duetoDesligado: boolean;
  costuraDesligada: boolean;
  duracaoMaxSeg: number | null;
};

export type ResultadoPublicacao =
  | { estado: 'publicado'; externalId: string; permalink?: string | null }
  | { estado: 'processando'; externalId: string }
  | { estado: 'erro'; erro: string; tentarDeNovo: boolean };

export type TokensDaConexao = {
  accessToken: string;
  accessExpiraEm: string | null;
  refreshToken?: string | null;
  refreshExpiraEm?: string | null;
  escopos: string;
};
