import { createContext, useContext, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isVideoMedia } from "@/lib/driveMedia";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO TIKTOK, NO YOUTUBE E NO LINKEDIN (só pro master por enquanto)
   TikTok e YouTube em 03/11/2026; LinkedIn perfil pessoal em 25/11/2026
   (Walter: "linkedin vamos implementar já que é rapido").

   Estado de UM post numa rede (linha de post_publicacoes) e as ações:
   conectar a conta, agendar na data do post, publicar agora e consultar a
   conta do TikTok (obrigatório pela regra de tela do TikTok). Token, envio
   do vídeo e API das redes ficam no servidor (redes-oauth, redes-publicar).
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type RedeNova = "tiktok" | "youtube" | "linkedin";
export const NOME_REDE: Record<RedeNova, string> = { tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn" };
// Walter, 25/11/2026: "linkedin acho que ja da pra liberar pra todos".
// LinkedIn liberado pra todo mundo; YouTube e TikTok seguem só pro master até
// o Google e o TikTok aprovarem os apps. A mesma regra vale no servidor
// (podeUsarRede em _shared/redes-publicar.ts) e no banco (migration 20261125000005).
export const REDES_PRA_TODOS: RedeNova[] = ["linkedin"];
export function redeLiberada(r: RedeNova, master: boolean): boolean {
  return master || REDES_PRA_TODOS.includes(r);
}

export type PublicacaoRede = {
  id: string;
  status: "rascunho" | "na_fila" | "publicando" | "processando" | "publicado" | "erro" | "cancelado";
  titulo: string | null;
  texto: string | null;
  opcoes: Record<string, unknown> | null;
  permalink: string | null;
  erro: string | null;
  publicado_em: string | null;
};

export type ConexaoRede = {
  connection_id: string | null;
  origem: string | null;
  username: string | null;
  pode_publicar: boolean;
  motivo: string | null;
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

async function erroDaFuncao(error: unknown, data: unknown): Promise<string> {
  const d = data as { error?: string } | null;
  if (d?.error) return d.error;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    const j = await ctx.json().catch(() => null) as { error?: string } | null;
    if (j?.error) return j.error;
  }
  return (error as Error | null)?.message ?? "Não deu certo. Tente de novo.";
}

export function useConexaoRede(postId: string | null | undefined, rede: RedeNova, ativo = true) {
  return useQuery<ConexaoRede | null>({
    queryKey: ["rede-conexao", postId, rede],
    enabled: !!postId && ativo,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("conexao_do_post", { _post_id: postId, _rede: rede });
      if (error) return null;
      return ((data as ConexaoRede[] | null) ?? [])[0] ?? null;
    },
  });
}

/** Quando a conexão vence. O LinkedIn não renova sozinho: a cada 60 dias a
    pessoa reconecta, e a tela avisa antes (Walter, 25/11/2026). */
export function useVencimentoRede(postId: string | null | undefined, rede: RedeNova, ativo = true) {
  return useQuery<string | null>({
    queryKey: ["rede-vencimento", postId, rede],
    enabled: !!postId && ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("conexao_vence_em", { _post_id: postId, _rede: rede });
      if (error) return null;
      return (data as string | null) ?? null;
    },
  });
}

export function usePublicacaoRede(postId: string | null | undefined, rede: RedeNova, ativo = true) {
  return useQuery<PublicacaoRede | null>({
    queryKey: ["rede-publicacao", postId, rede],
    enabled: !!postId && ativo,
    // Enquanto publica ou o TikTok processa, acompanha sozinho.
    refetchInterval: (q) => {
      const st = (q.state.data as PublicacaoRede | null)?.status;
      return st === "publicando" || st === "processando" ? 15_000 : false;
    },
    queryFn: async () => {
      const { data, error } = await sbFrom("post_publicacoes")
        .select("id, status, titulo, texto, opcoes, permalink, erro, publicado_em")
        .eq("post_id", postId!).eq("rede", rede).maybeSingle();
      if (error) return null;
      return (data as unknown as PublicacaoRede | null) ?? null;
    },
  });
}

/** O cliente do post (pra conectar a conta certa). Null = conta do próprio criador. */
export function useCrmDoPost(postId: string | null | undefined, ativo = true) {
  return useQuery<string | null>({
    queryKey: ["post-crm-cliente", postId],
    enabled: !!postId && ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await sbFrom("posts").select("external_client_id").eq("id", postId!).maybeSingle();
      const ext = (data as { external_client_id?: string | null } | null)?.external_client_id;
      if (!ext) return null;
      const { data: ec } = await sbFrom("external_clients").select("crm_client_id").eq("id", ext).maybeSingle();
      return (ec as { crm_client_id?: string | null } | null)?.crm_client_id ?? null;
    },
  });
}

export async function conectarRede(rede: RedeNova, crmClientId: string | null) {
  const returnTo = window.location.pathname + window.location.search;
  const { data, error } = await supabase.functions.invoke("redes-oauth", {
    body: { rede, crm_client_id: crmClientId, return_to: returnTo },
  });
  const url = (data as { url?: string } | null)?.url;
  if (error || !url) { toast.error(await erroDaFuncao(error, data)); return; }
  window.location.href = url;
}

export function useCriadorTikTok(postId: string | null | undefined, ativo: boolean) {
  return useQuery<CriadorTikTok | null>({
    queryKey: ["tiktok-criador", postId],
    enabled: !!postId && ativo,
    staleTime: 0, // a regra do TikTok pede a consulta a cada vez que a tela abre
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("redes-publicar", { body: { acao: "criador", post_id: postId } });
      if (error) throw new Error(await erroDaFuncao(error, data));
      return (data as { criador?: CriadorTikTok } | null)?.criador ?? null;
    },
  });
}

/* O CARD ANDA NO QUADRO (Walter, 25/11/2026: "eu publiquei e nao saiu da aba
   de ideias ali do Criando"). O banco e o redes-publicar já mudam a coluna do
   post quando a rede publicada é a rede do post. Aqui o editor fica sabendo,
   igual ao PublicarNoInstagram (onAgendou/onPublicou), pro próximo salvar não
   devolver o post pra coluna antiga. */
export type CardDoPost = { plataforma?: string | null; onAgendou?: (ligado: boolean) => void; onPublicou?: () => void };
export const CardDoPostCtx = createContext<CardDoPost | null>(null);

function useInvalidar(postId: string | null | undefined, rede: RedeNova) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: ["rede-publicacao", postId, rede] });
    qc.invalidateQueries({ queryKey: ["rede-conexao", postId, rede] });
    qc.invalidateQueries({ queryKey: ["rede-vencimento", postId, rede] });
  };
}

type Escolhas = { opcoes: Record<string, unknown>; titulo?: string | null; texto?: string | null };

export function useAgendarRede(postId: string | null | undefined, rede: RedeNova) {
  const inv = useInvalidar(postId, rede);
  const card = useContext(CardDoPostCtx);
  return useMutation({
    mutationFn: async (v: Escolhas & { ligar: boolean }) => {
      const { error } = await sbRpc("agendar_publicacao_rede", {
        _post_id: postId, _rede: rede, _ligar: v.ligar, _opcoes: v.opcoes, _titulo: v.titulo ?? null, _texto: v.texto ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast.success(v.ligar ? `Agendado no ${NOME_REDE[rede]} pra data do post.` : "Agendamento cancelado.");
      if (card?.plataforma === rede) card.onAgendou?.(v.ligar);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePublicarAgoraRede(postId: string | null | undefined, rede: RedeNova) {
  const inv = useInvalidar(postId, rede);
  const card = useContext(CardDoPostCtx);
  return useMutation({
    mutationFn: async (v: Escolhas) => {
      const { data: id, error } = await sbRpc("preparar_publicacao_rede", {
        _post_id: postId, _rede: rede, _opcoes: v.opcoes, _titulo: v.titulo ?? null, _texto: v.texto ?? null,
      });
      if (error) throw new Error(error.message);
      const { data, error: e2 } = await supabase.functions.invoke("redes-publicar", { body: { pub_id: id } });
      if (e2) throw new Error(await erroDaFuncao(e2, data));
      return data as { estado?: string; mensagem?: string; programado?: boolean };
    },
    onSuccess: (r) => {
      if (r?.estado === "publicado") toast.success(r.mensagem ?? `Publicado no ${NOME_REDE[rede]}.`);
      else if (r?.estado === "processando") toast.success(r.mensagem ?? `O ${NOME_REDE[rede]} está processando o vídeo.`);
      else if (r?.estado === "erro") toast.error(r.mensagem ?? "Não saiu.");
      else if (r?.mensagem) toast(r.mensagem);
      if (r?.estado === "publicado" && card?.plataforma === rede) {
        if (r.programado) card.onAgendou?.(true); else card.onPublicou?.();
      }
      inv();
    },
    onError: (e: Error) => { toast.error(e.message); inv(); },
  });
}

/* ── Mídia do post pro LinkedIn (Walter, 25/11/2026) ──────────────────────
   O formato do post no LinkedIn sai da mídia: só texto, foto, carrossel de
   2 a 20 fotos ou um vídeo. A tela mostra e trava antes de mandar; o servidor
   (rede-linkedin.ts, formatoLinkedIn) confere de novo na hora de publicar. */
export type MidiaDoPost = { fotos: number; videos: number };

export function useMidiaDoPost(postId: string | null | undefined, ativo = true) {
  return useQuery<MidiaDoPost>({
    queryKey: ["post-midia-contagem", postId],
    enabled: !!postId && ativo,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await sbFrom("external_media_refs")
        .select("file_type, provider, bunny_video_id, file_name, view_url, download_url, substituida")
        .eq("post_id", postId!);
      const refs = ((data ?? []) as Array<Record<string, unknown> & { substituida?: boolean | null }>)
        .filter((r) => !r.substituida);
      const videos = refs.filter((r) => isVideoMedia(r as never)).length;
      return { fotos: refs.length - videos, videos };
    },
  });
}

export type FormatoLinkedIn = "texto" | "foto" | "carrossel" | "video";

/** Mesma regra do servidor (formatoLinkedIn em _shared/rede-linkedin.ts). */
export function formatoLinkedInDaMidia(m: MidiaDoPost): { formato: FormatoLinkedIn; rotulo: string } | { erro: string } {
  if (m.videos && m.fotos) return { erro: `No LinkedIn o post leva fotos ou um vídeo, não os dois juntos. Este post tem ${m.fotos} foto(s) e ${m.videos} vídeo(s).` };
  if (m.videos > 1) return { erro: `No LinkedIn o post leva um vídeo só. Este post tem ${m.videos}.` };
  if (m.videos === 1) return { formato: "video", rotulo: "Vídeo" };
  if (m.fotos > 20) return { erro: `O carrossel do LinkedIn aceita até 20 fotos. Este post tem ${m.fotos}.` };
  if (m.fotos > 1) return { formato: "carrossel", rotulo: `Carrossel · ${m.fotos} fotos` };
  if (m.fotos === 1) return { formato: "foto", rotulo: "Foto" };
  return { formato: "texto", rotulo: "Só texto" };
}

/* ── Conexões da própria conta (Configurações > Conexões) ─────────────────
   Walter, 25/11/2026: não achava onde conectar o YouTube (só dava por dentro
   do post). As contas dos clientes continuam na ficha do cliente; aqui ficam
   só as da conta (crm_client_id vazio). O RLS de social_connections deixa o
   dono ler e apagar a própria linha. */
export type ConexaoPropria = {
  id: string;
  provider: RedeNova;
  username: string | null;
  profile_picture_url: string | null;
  token_expires_at: string | null;
  needs_reconnect: boolean | null;
};

export function useConexoesProprias(userId: string | null | undefined, ativo = true) {
  return useQuery<ConexaoPropria[]>({
    queryKey: ["redes-conexoes-proprias", userId],
    enabled: !!userId && ativo,
    // Walter, 25/11/2026: conectou o LinkedIn, viu o aviso de conectado mas a
    // linha só mudou depois do F5. Conexão muda fora do app (no login da
    // rede): sempre rebusca ao abrir e ao voltar pra aba.
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_connections")
        .select("id, provider, username, profile_picture_url, token_expires_at, needs_reconnect")
        .eq("user_id", userId!).is("crm_client_id", null).in("provider", ["tiktok", "youtube", "linkedin"]);
      if (error) return [];
      return (data ?? []) as unknown as ConexaoPropria[];
    },
  });
}

export function useDesconectarRede(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ConexaoPropria) => {
      const { error } = await sbFrom("social_connections").delete().eq("id", c.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, c) => {
      toast.success(`${NOME_REDE[c.provider]} desconectado.`);
      qc.invalidateQueries({ queryKey: ["redes-conexoes-proprias", userId] });
      qc.invalidateQueries({ queryKey: ["rede-conexao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Estado da conexão: o LinkedIn vence em 60 dias e não renova (aviso 7 dias antes). */
export function estadoConexaoRede(c: { provider: RedeNova; token_expires_at: string | null; needs_reconnect: boolean | null }) {
  const vence = c.token_expires_at ? new Date(c.token_expires_at).getTime() : null;
  const dias = vence ? Math.ceil((vence - Date.now()) / 86_400_000) : null;
  const venceSozinho = c.provider === "linkedin";
  const vencida = !!c.needs_reconnect || (venceSozinho && dias !== null && dias <= 0);
  const perto = !vencida && venceSozinho && dias !== null && dias <= 7;
  return { vencida, perto, dias, venceEm: c.token_expires_at };
}

/** Volta do login da rede (?rede=...&conexao=...): avisa, recarrega as
    conexões e limpa a URL. Recarrega de novo 1,5 s depois porque a volta pode
    chegar antes de a conexão gravada aparecer pra leitura (Walter, 25/11/2026:
    "tive que dar um f5 para ele mostrar"). */
export function useVoltaDoLoginDaRede() {
  const qc = useQueryClient();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("rede"); const c = q.get("conexao");
    if (!r || !c) return;
    if (c === "ok") toast.success(`${NOME_REDE[r as RedeNova] ?? "Rede"} conectado.`);
    else toast.error(`Não deu pra conectar: ${q.get("m") ?? "tente de novo"}`);
    q.delete("rede"); q.delete("conexao"); q.delete("m");
    window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : ""));
    const recarregar = () => {
      for (const k of ["redes-conexoes-proprias", "rede-conexao", "rede-vencimento", "tiktok-criador"]) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
    };
    recarregar();
    const t = window.setTimeout(recarregar, 1500);
    return () => window.clearTimeout(t);
  }, [qc]);
}

/** O que o painel do YouTube mostra em "Vai junto": lido do post salvo (25/11/2026). */
export type PostParaYouTube = {
  title: string | null; caption: string | null; youtube: unknown;
  scheduled_date: string | null; scheduled_time: string | null;
};
export function usePostParaYouTube(postId: string | null | undefined, ativo = true) {
  return useQuery<PostParaYouTube | null>({
    queryKey: ["post-para-youtube", postId],
    enabled: !!postId && ativo,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await sbFrom("posts").select("title, caption, youtube, scheduled_date, scheduled_time").eq("id", postId!).maybeSingle();
      return (data as unknown as PostParaYouTube | null) ?? null;
    },
  });
}
