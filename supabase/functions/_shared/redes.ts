// Contrato comum das redes onde o Cria publica (fundação de 02/11/2026).
//
// O Instagram já publica por _shared/ig-publicar.ts. TikTok e YouTube vão
// entrar implementando PublicadorDeRede, e o robô da fila passa a ler
// post_publicacoes e chamar o publicador da rede de cada linha.
//
// Regras que vêm das redes (fonte: doc "Publicar no TikTok e no YouTube pelo
// Cria", lida na documentação oficial em 02/11/2026):
// - TikTok não agenda: o nosso robô publica na hora. Depois do envio o post
//   fica "processando" até o status do publish_id dizer que saiu.
// - YouTube agenda sozinho (publishAt, com o vídeo enviado como privado).
// - TikTok exige consultar creator_info antes de cada post e a privacidade
//   vem SEM valor padrão: quem escolhe é a pessoa, na tela.

export type Rede = 'instagram' | 'tiktok' | 'youtube';

export type StatusPublicacao =
  | 'rascunho' | 'na_fila' | 'publicando' | 'processando' | 'publicado' | 'erro' | 'cancelado';

export const REDES: Record<Rede, {
  nome: string;
  escopoPublicar: string;
  agendaNativa: boolean;
  /** Depois do envio, a rede ainda processa e precisa ser consultada. */
  processaDepois: boolean;
  /** Tamanho máximo do título próprio da rede (null = não tem título separado). */
  tituloMax: number | null;
  textoMax: number;
}> = {
  instagram: { nome: 'Instagram', escopoPublicar: 'instagram_business_content_publish', agendaNativa: false, processaDepois: false, tituloMax: null, textoMax: 2200 },
  tiktok: { nome: 'TikTok', escopoPublicar: 'video.publish', agendaNativa: false, processaDepois: true, tituloMax: null, textoMax: 2200 },
  youtube: { nome: 'YouTube', escopoPublicar: 'youtube.upload', agendaNativa: true, processaDepois: false, tituloMax: 100, textoMax: 5000 },
};

/** Opções que a tela de publicar precisa coletar por rede (guardadas em post_publicacoes.opcoes). */
export type OpcoesTikTok = {
  privacy_level: string;            // um dos privacy_level_options do creator_info; sem padrão
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  brand_content_toggle: boolean;    // "Conteúdo de marca" (paga)
  brand_organic_toggle: boolean;    // "Sua marca"
  is_aigc?: boolean;
};

export type OpcoesYouTube = {
  privacyStatus: 'public' | 'unlisted' | 'private';
  selfDeclaredMadeForKids: boolean;  // obrigatório perguntar
  containsSyntheticMedia?: boolean;
};

export type ResultadoPublicacao =
  | { estado: 'publicado'; externalId: string; permalink?: string | null }
  | { estado: 'processando'; externalId: string }   // TikTok: publish_id, consultar depois
  | { estado: 'agendado'; externalId: string }      // YouTube com publishAt
  | { estado: 'erro'; erro: string; tentarDeNovo: boolean }
  | { estado: 'reconectar'; erro: string };

export type TokensDaConexao = {
  accessToken: string;
  accessExpiraEm: string | null;
  refreshToken?: string | null;
  refreshExpiraEm?: string | null;
  escopos: string;
};

export interface PublicadorDeRede {
  rede: Rede;
  /** URL de autorização (OAuth) com o state já gravado em oauth_states. */
  urlDeConexao(state: string, redirectUri: string): string;
  /** Troca o code do callback por tokens e devolve a conta conectada. */
  trocarCodigo(code: string, redirectUri: string): Promise<TokensDaConexao & { contaId: string; usuario: string | null }>;
  /** Renova o acesso. O TikTok pode devolver um refresh token novo: salvar sempre o que voltar. */
  renovar(refreshToken: string): Promise<TokensDaConexao>;
  /** Publica (ou agenda, no YouTube) a mídia de um post. */
  publicar(args: {
    accessToken: string;
    midiaUrl: string;
    titulo: string | null;
    texto: string;
    publicarEm: string | null;
    opcoes: Record<string, unknown>;
  }): Promise<ResultadoPublicacao>;
  /** Só para redes com processaDepois: consulta se o envio já virou post. */
  consultarStatus?(accessToken: string, externalId: string): Promise<ResultadoPublicacao>;
}
