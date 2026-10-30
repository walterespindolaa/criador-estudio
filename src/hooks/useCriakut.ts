import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type {
  ComunidadeDados, ComunidadeItem, ComunidadeParecida, Conversa, FunilLinha, MeuDestaque, MinhasVisitas, PaginaCriakutDados, PainelAdminCriakut,
  PedidoMural, PerfilCriakut, RecadosDados, ResumoProposta, Servico, TopicoDados, Unidade,
} from "@/lib/criakut";

/* As tabelas criakut_* ainda não estão no types.ts (arquivo travado), então o
   acesso é pelo cliente sem tipo, como em useClientIntakes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);
type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

const slugOcupado = (msg?: string) => /criakut_perfis_slug_key|duplicate key/i.test(msg ?? "");

/** O MEU perfil (linha crua, publicado ou não). null = ainda não criei. */
export function useMeuPerfilCriakut() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-meu", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PerfilCriakut | null> => {
      const { data, error } = await sbFrom("criakut_perfis").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return (data as PerfilCriakut) ?? null;
    },
  });
}

/** A página montada (minha ou de outra pessoa), pelo endereço. */
export function usePaginaCriakut(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["criakut-pagina", slug],
    enabled: !!slug,
    staleTime: 0,
    queryFn: async (): Promise<PaginaCriakutDados | null> => {
      const { data, error } = await sbRpc("criakut_perfil", { _slug: slug });
      if (error) throw error;
      return (data as unknown as PaginaCriakutDados) ?? null;
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["criakut-meu"] });
  void qc.invalidateQueries({ queryKey: ["criakut-pagina"] });
  void qc.invalidateQueries({ queryKey: ["criakut-busca"] });
}

/** Cria ou atualiza o meu perfil (só os campos enviados). */
export function useSalvarPerfilCriakut() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campos: Partial<PerfilCriakut>) => {
      if (!user?.id) throw new Error("Entre de novo pra salvar.");
      /* Update primeiro: um upsert com só alguns campos (ex.: só a capa) falha
         no NOT NULL de nome/slug antes mesmo de achar o conflito. Sem linha
         ainda, é a criação da página: aí sim insert com tudo. */
      const { user_id: _ignora, ...resto } = campos;
      const up = await sbFrom("criakut_perfis").update(resto).eq("user_id", user.id).select("*").maybeSingle();
      if (up.error) throw up.error;
      if (up.data) return up.data as PerfilCriakut;
      const ins = await sbFrom("criakut_perfis").insert({ ...resto, user_id: user.id }).select("*").single();
      if (ins.error) throw ins.error;
      return ins.data as PerfilCriakut;
    },
    onSuccess: () => invalidar(qc),
    onError: (e: Error) => toast.error(slugOcupado(e.message)
      ? "Esse endereço já é de outra pessoa. Escolha outro."
      : "Não consegui salvar o perfil."),
  });
}

/** Troca a lista de serviços inteira (a lista é curta: apagar e regravar é mais simples e sem sobra). */
export function useSalvarServicos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lista: Servico[]) => {
      if (!user?.id) throw new Error("sem login");
      const { error: e1 } = await sbFrom("criakut_servicos").delete().eq("user_id", user.id);
      if (e1) throw e1;
      const limpos = lista.filter((s) => s.titulo.trim().length >= 2).map((s, i) => ({
        user_id: user.id, titulo: s.titulo.trim().slice(0, 80), detalhe: s.detalhe?.trim().slice(0, 160) || null,
        preco_centavos: s.preco_centavos, unidade: s.unidade, ordem: i,
      }));
      if (limpos.length) {
        const { error: e2 } = await sbFrom("criakut_servicos").insert(limpos);
        if (e2) throw e2;
      }
    },
    onSuccess: () => invalidar(qc),
    onError: () => toast.error("Não consegui salvar os serviços."),
  });
}

/** Sobe uma imagem pra pasta do Criakut da pessoa no bucket media (público). */
export async function subirImagemCriakut(userId: string, blob: Blob, nome: string): Promise<string> {
  const path = `${userId}/criakut/${nome}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export function useAdicionarPortfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ url, ordem }: { url: string; ordem: number }) => {
      const { error } = await sbFrom("criakut_portfolio").insert({ user_id: user!.id, media_url: url, ordem });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
    onError: () => toast.error("Não consegui adicionar a peça."),
  });
}

export function useRemoverPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("criakut_portfolio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
    onError: () => toast.error("Não consegui remover a peça."),
  });
}

export function useSeguir() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ alvo, seguir }: { alvo: string; seguir: boolean }) => {
      const r = seguir
        ? await sbFrom("criakut_seguir").insert({ seguidor: user!.id, seguido: alvo })
        : await sbFrom("criakut_seguir").delete().eq("seguidor", user!.id).eq("seguido", alvo);
      if (r.error) throw r.error;
    },
    onSuccess: () => invalidar(qc),
    onError: () => toast.error("Não consegui atualizar."),
  });
}

/* ═══ FASE 2 ═════════════════════════════════════════════════════════════════
   Tudo que escreve em proposta, mensagem, mural e avaliação passa por função
   do banco (criakut_*), que confere quem é quem e limita por minuto e por dia.
   O front nunca grava nessas tabelas direto (nem consegue: não tem permissão). */

/** O Criakut mora em dois lugares: /app/criakut (criadora) e
 *  /socialmidia/criakut (social mídia e prestador). Os links internos seguem
 *  a área onde a pessoa está. */
export function useBaseCriakut() {
  const { pathname } = useLocation();
  return pathname.startsWith("/app") ? "/app/criakut" : "/socialmidia/criakut";
}

/** Pode entrar? (admin, convidado ou Criakut aberto). Decide se o menu aparece. */
export function useAcessoCriakut() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["criakut-acesso", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sbRpc("criakut_tem_acesso");
      if (error) throw error;
      return data === true;
    },
  });
  return { temAcesso: q.data === true, carregando: q.isLoading };
}

const msgErro = (e: unknown, padrao: string) => {
  const m = (e as { message?: string })?.message ?? "";
  /* As funções do banco já falam português ("Quem aceita é a outra pessoa.").
     Erro técnico (constraint, rede) vira a mensagem padrão. */
  return m && !/violates|constraint|syntax|function|permission denied|JWT|fetch/i.test(m) ? m : padrao;
};

function invalidarFase2(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["criakut-propostas"] });
  void qc.invalidateQueries({ queryKey: ["criakut-conversa"] });
  void qc.invalidateQueries({ queryKey: ["criakut-mural"] });
  void qc.invalidateQueries({ queryKey: ["criakut-pagina"] });
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sbRpc(fn, args);
  if (error) throw error;
  return data as T;
}

export type DadosOrcamento = { contratado: string; titulo: string; escopo: string; valor_centavos: number | null; unidade: Unidade; prazo: string | null; recorrente: boolean };
export function usePedirOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DadosOrcamento) => rpc<string>("criakut_pedir_orcamento", {
      _contratado: d.contratado, _titulo: d.titulo, _escopo: d.escopo, _valor_centavos: d.valor_centavos,
      _unidade: d.unidade, _prazo: d.prazo, _recorrente: d.recorrente }),
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui mandar o pedido.")),
  });
}

export type DadosPedidoMural = {
  funcao: string; titulo: string; descricao: string; nicho: string | null; estilos: string[];
  valor_min: number | null; valor_max: number | null; unidade: Unidade; prazo_texto: string; tipo: "recorrente" | "avulso";
  presencial: boolean; cidade: string;
};
export function usePublicarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DadosPedidoMural) => rpc<string>("criakut_publicar_pedido", {
      _funcao: d.funcao, _titulo: d.titulo, _descricao: d.descricao || null, _nicho: d.nicho, _estilos: d.estilos,
      _valor_min: d.valor_min, _valor_max: d.valor_max, _unidade: d.unidade, _prazo_texto: d.prazo_texto || null,
      _tipo: d.tipo, _presencial: d.presencial, _cidade: d.cidade || null }),
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui pendurar o trabalho.")),
  });
}

export function useCancelarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpc<void>("criakut_cancelar_pedido", { _pedido: id }),
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui retirar o trabalho.")),
  });
}

export function useMural(filtro: { funcao: string | null; tipo: string | null; texto: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-mural", user?.id, filtro],
    enabled: !!user?.id,
    queryFn: () => rpc<PedidoMural[]>("criakut_mural", {
      _funcao: filtro.funcao, _tipo: filtro.tipo, _texto: filtro.texto.trim() || null, _limite: 60, _pular: 0 }).then((d) => d ?? []),
  });
}

export function usePropor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { pedido: string; escopo: string; valor_centavos: number | null; unidade: Unidade; prazo: string | null }) =>
      rpc<string>("criakut_propor", { _pedido: d.pedido, _escopo: d.escopo, _valor_centavos: d.valor_centavos, _unidade: d.unidade, _prazo: d.prazo }),
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui mandar a proposta.")),
  });
}

export function useMinhasPropostas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-propostas", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    queryFn: () => rpc<ResumoProposta[]>("criakut_minhas_propostas").then((d) => d ?? []),
  });
}

export function useConversa(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-conversa", user?.id, id],
    enabled: !!user?.id && !!id,
    refetchInterval: 15_000,
    queryFn: () => rpc<Conversa | null>("criakut_conversa", { _proposta: id }),
  });
}

export function useAcaoProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a:
      | { tipo: "aceitar"; id: string }
      | { tipo: "recusar"; id: string }
      | { tipo: "contrapropor"; id: string; valor_centavos: number | null; unidade: Unidade; prazo: string | null; escopo: string | null }
      | { tipo: "marcar"; id: string; acao: "concluir" | "paguei" | "recebi" }
      | { tipo: "avaliar"; id: string; nota: number; no_prazo: number; criatividade: number; comunicacao: number; depoimento: string }) => {
      switch (a.tipo) {
        case "aceitar": return rpc<{ ponte: string }>("criakut_aceitar", { _proposta: a.id });
        case "recusar": return rpc<void>("criakut_recusar", { _proposta: a.id });
        case "contrapropor": return rpc<void>("criakut_contrapropor", { _proposta: a.id, _valor_centavos: a.valor_centavos, _unidade: a.unidade, _prazo: a.prazo, _escopo: a.escopo });
        case "marcar": return rpc<void>("criakut_marcar", { _proposta: a.id, _acao: a.acao });
        case "avaliar": return rpc<void>("criakut_avaliar", { _proposta: a.id, _nota: a.nota, _no_prazo: a.no_prazo, _criatividade: a.criatividade, _comunicacao: a.comunicacao, _depoimento: a.depoimento });
      }
    },
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não deu certo. Tente de novo.")),
  });
}

/* Anexo e entrega: vão pra pasta criakut da própria pessoa no bucket media
   (o banco recusa qualquer outro endereço). Só tipos de arquivo de trabalho,
   até 200 MB. Nada de HTML/SVG/JS, que poderiam virar página falsa no link. */
const TIPOS_ANEXO = /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|quicktime|webm)|application\/(pdf|zip|x-zip-compressed)|audio\/(mpeg|mp4|wav|x-wav))$/;
const EXT_ANEXO = /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|pdf|zip|mp3|m4a|wav)$/i;
export const LIMITE_ANEXO_MB = 200;
export const ACEITA_ANEXO = "image/*,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,audio/*,.zip,.heic";

export function anexoPermitido(f: File): string | null {
  if (f.size > LIMITE_ANEXO_MB * 1024 * 1024) return `Arquivo maior que ${LIMITE_ANEXO_MB} MB. Mande um link de pasta na mensagem.`;
  if (!TIPOS_ANEXO.test(f.type) && !EXT_ANEXO.test(f.name)) return "Esse tipo de arquivo não vai. Use imagem, vídeo, PDF, áudio ou ZIP.";
  if (/\.(html?|svg|js|xml|xhtml)$/i.test(f.name)) return "Esse tipo de arquivo não vai.";
  return null;
}

export function useMandarMensagem() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: { proposta: string; texto: string; arquivo?: File | null; entrega?: boolean }) => {
      let url: string | null = null; let nome: string | null = null;
      if (d.arquivo) {
        const erro = anexoPermitido(d.arquivo);
        if (erro) throw new Error(erro);
        const ext = (d.arquivo.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "bin").toLowerCase();
        const path = `${user!.id}/criakut/conversas/${d.proposta}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const tipo = TIPOS_ANEXO.test(d.arquivo.type) ? d.arquivo.type : "application/octet-stream";
        const { error } = await supabase.storage.from("media").upload(path, d.arquivo, { contentType: tipo, upsert: false });
        if (error) throw new Error("O arquivo não subiu. Tente de novo.");
        url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        nome = d.arquivo.name.slice(0, 160);
      }
      return rpc<{ aviso_contato: boolean }>("criakut_mensagem", {
        _proposta: d.proposta, _texto: d.texto, _anexo_url: url, _anexo_nome: nome, _eh_entrega: !!d.entrega });
    },
    onSuccess: () => invalidarFase2(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui mandar.")),
  });
}

/* ═══ FASE 3 ═════════════════════════════════════════════════════════════════
   Recados, quem visitou, comunidades, Destaque e o painel do admin. Mesma
   regra: tudo por função do banco, nenhuma tabela nova aceita acesso direto. */

function invalidarFase3(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["criakut-recados"] });
  void qc.invalidateQueries({ queryKey: ["criakut-comunidades"] });
  void qc.invalidateQueries({ queryKey: ["criakut-comunidade"] });
  void qc.invalidateQueries({ queryKey: ["criakut-topico"] });
  void qc.invalidateQueries({ queryKey: ["criakut-pagina"] });
  void qc.invalidateQueries({ queryKey: ["criakut-admin"] });
}

export function useRecados(slug: string | null | undefined, limite = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-recados", user?.id, slug, limite],
    enabled: !!user?.id && !!slug,
    queryFn: () => rpc<RecadosDados | null>("criakut_recados", { _slug: slug, _limite: limite, _pular: 0 }),
  });
}

export function useEscreverRecado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { dono: string; texto: string }) => rpc<string>("criakut_recado_escrever", { _dono: d.dono, _texto: d.texto }),
    onSuccess: () => invalidarFase3(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui deixar o recado.")),
  });
}

export function useApagarRecado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpc<void>("criakut_recado_apagar", { _id: id }),
    onSuccess: () => invalidarFase3(qc),
    onError: (e) => toast.error(msgErro(e, "Não consegui apagar.")),
  });
}

export function useDenunciar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { tipo: "recado" | "topico" | "resposta" | "perfil"; alvo: string; motivo: string }) =>
      rpc<void>("criakut_denunciar", { _tipo: d.tipo, _alvo: d.alvo, _motivo: d.motivo }),
    onSuccess: () => { toast.success("Denúncia enviada. A gente olha."); invalidarFase3(qc); },
    onError: (e) => toast.error(msgErro(e, "Não consegui denunciar.")),
  });
}

/** Marca a visita na página de outra pessoa (uma vez por abertura). */
export async function registrarVisitaCriakut(slug: string) {
  await sbRpc("criakut_registrar_visita", { _slug: slug });
}

export function useMinhasVisitas(ativo: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-visitas", user?.id],
    enabled: !!user?.id && ativo,
    queryFn: () => rpc<MinhasVisitas | null>("criakut_minhas_visitas"),
  });
}

export function useComunidades() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-comunidades", user?.id],
    enabled: !!user?.id,
    queryFn: () => rpc<ComunidadeItem[]>("criakut_comunidades_ver2").then((d) => d ?? []),
  });
}

export function useComunidade(slug: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-comunidade", user?.id, slug],
    enabled: !!user?.id && !!slug,
    queryFn: () => rpc<ComunidadeDados | null>("criakut_comunidade", { _slug: slug }),
  });
}

export function useTopico(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-topico", user?.id, id],
    enabled: !!user?.id && !!id,
    refetchInterval: 30_000,
    queryFn: () => rpc<TopicoDados | null>("criakut_topico", { _id: id }),
  });
}

export function useAcaoComunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a:
      | { tipo: "entrar"; comunidade: string; entrar: boolean }
      | { tipo: "topico"; comunidade: string; titulo: string; texto: string }
      | { tipo: "responder"; topico: string; texto: string }
      | { tipo: "apagar"; alvo: "topico" | "resposta"; id: string }
      | { tipo: "sugerir"; nome: string; descricao: string; emoji: string; publico: string }) => {
      switch (a.tipo) {
        case "entrar": return rpc<unknown>("criakut_comunidade_entrar", { _comunidade: a.comunidade, _entrar: a.entrar });
        case "topico": return rpc<unknown>("criakut_topico_criar", { _comunidade: a.comunidade, _titulo: a.titulo, _texto: a.texto });
        case "responder": return rpc<unknown>("criakut_responder", { _topico: a.topico, _texto: a.texto });
        case "apagar": return rpc<unknown>("criakut_conteudo_apagar", { _tipo: a.alvo, _id: a.id });
        case "sugerir": return rpc<unknown>("criakut_comunidade_sugerir", { _nome: a.nome, _descricao: a.descricao, _emoji: a.emoji, _publico: a.publico });
      }
    },
    onSuccess: () => invalidarFase3(qc),
    onError: (e) => toast.error(msgErro(e, "Não deu certo. Tente de novo.")),
  });
}

/** Quem tem Destaque ativo (pra pôr o selo em qualquer lista que tenha o id). */
export function useDestaquesIds() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["criakut-destaques-ids", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => rpc<string[] | { criakut_destaques_ids: string }[]>("criakut_destaques_ids").then((d) =>
      new Set((d ?? []).map((x) => (typeof x === "string" ? x : x.criakut_destaques_ids)))),
  });
  return q.data ?? new Set<string>();
}

export function useMeuDestaque() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-meu-destaque", user?.id],
    enabled: !!user?.id,
    queryFn: () => rpc<MeuDestaque | null>("criakut_meu_destaque"),
  });
}

/** Abre o Checkout (comprar) ou o portal do Stripe (gerenciar). */
export function useDestaqueStripe() {
  const base = useBaseCriakut();
  return useMutation({
    mutationFn: async (acao: "comprar" | "gerenciar" | "pix") => {
      const { data, error } = await supabase.functions.invoke("criakut-destaque-checkout", { body: { acao, volta: base } });
      if (error) {
        /* Resposta não-2xx: o motivo (ja_ativo, desligado...) vem no corpo, não na mensagem. */
        const ctx = (error as { context?: Response }).context;
        const corpo = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        throw new Error((corpo as { error?: string } | null)?.error ?? error.message);
      }
      const url = (data as { url?: string; error?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error ?? "sem_url");
      window.location.href = url;
    },
    onError: (e) => {
      const m = (e as { message?: string })?.message ?? "";
      toast.error(/ja_ativo/.test(m) ? "Seu Destaque já está ativo." : /desligado/.test(m) ? "O Destaque ainda não está à venda."
        : /pagina_escondida/.test(m) ? "Deixe sua página visível na busca antes." : "Não consegui abrir o pagamento. Tente de novo.");
    },
  });
}

/* ── ADMIN ──────────────────────────────────────────────────────────────── */
export function usePainelAdminCriakut() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [painel, funil] = await Promise.all([
        rpc<PainelAdminCriakut>("criakut_admin_painel"),
        rpc<FunilLinha[]>("criakut_funil_admin"),
      ]);
      return { painel, funil: funil ?? [] };
    },
  });
}

export function useAcaoAdminCriakut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a:
      | { tipo: "config"; chave: "aberto" | "destaque_ativo"; ligar: boolean }
      | { tipo: "convidar"; email: string }
      | { tipo: "moderar"; alvo: string; qual: string; ocultar: boolean }
      | { tipo: "comunidade"; id: string | null; slug: string; nome: string; descricao: string; emoji: string; cor: string; ativa: boolean; ordem: number; publico: string }
      | { tipo: "fixar"; topico: string; fixo: boolean }
      | { tipo: "decidir"; id: string; aprovar: boolean; motivo: string }) => {
      switch (a.tipo) {
        case "config": return rpc<unknown>("criakut_admin_config", { _chave: a.chave, _ligar: a.ligar });
        case "convidar": return rpc<string>("criakut_admin_convidar", { _email: a.email });
        case "moderar": return rpc<unknown>("criakut_admin_moderar", { _tipo: a.qual, _alvo: a.alvo, _ocultar: a.ocultar });
        case "comunidade": return rpc<unknown>("criakut_admin_comunidade_salvar", { _id: a.id, _slug: a.slug, _nome: a.nome, _descricao: a.descricao, _emoji: a.emoji, _cor: a.cor, _ativa: a.ativa, _ordem: a.ordem, _publico: a.publico });
        case "fixar": return rpc<unknown>("criakut_admin_fixar", { _topico: a.topico, _fixo: a.fixo });
        case "decidir": return rpc<unknown>("criakut_admin_comunidade_decidir", { _id: a.id, _aprovar: a.aprovar, _motivo: a.motivo || null });
      }
    },
    onSuccess: () => { invalidarFase3(qc); void qc.invalidateQueries({ queryKey: ["criakut-acesso"] }); },
    onError: (e) => toast.error(msgErro(e, "Não deu certo.")),
  });
}

/** Comunidades parecidas com o nome digitado (antes de sugerir uma nova). */
export function useComunidadesParecidas(nome: string) {
  const { user } = useAuth();
  const [termo, setTermo] = useState(nome);
  useEffect(() => { const t = setTimeout(() => setTermo(nome.trim()), 350); return () => clearTimeout(t); }, [nome]);
  return useQuery({
    queryKey: ["criakut-parecidas", user?.id, termo],
    enabled: !!user?.id && termo.length >= 3,
    queryFn: () => rpc<ComunidadeParecida[]>("criakut_comunidades_parecidas", { _nome: termo }).then((d) => d ?? []),
  });
}
