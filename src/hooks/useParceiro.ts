import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PARCEIROS, o lado de quem produz

   O designer, o editor e o copy não enxergam a tabela de posts: tudo passa
   pelas RPCs `parceiro_*` (migration 20260828000001), que conferem o vínculo
   com a agência e devolvem só o que é da pessoa. O motivo está documentado na
   migration: a policy restritiva de `posts` depende de uma função que não
   existe no repositório, então mexer nela seria reescrever segurança no escuro.
   ═══════════════════════════════════════════════════════════════════════════ */

// As RPCs novas ainda não estão no types.ts gerado; mesmo padrão dos outros hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

/* ═══════════════════════════════════════════════════════════════════════════
   PARAR DE ENGOLIR ERRO (Walter, 14/09/2026)

   Este arquivo tinha onze consultas que faziam `return []` quando davam erro.
   Três engoliam QUALQUER erro, inclusive rede caída. As outras oito engoliam
   só "função não existe", que é o caso legítimo: a tela precisa abrir mesmo
   com a migration ainda não rodada.

   O problema é que as duas coisas viravam a MESMA imagem: tela vazia. Pro
   parceiro, tela vazia significa "nenhuma agência te mandou trabalho". Ele
   fecha o app e vai fazer outra coisa, sem saber que tinha entrega pra hoje.

   Agora só o erro de "ainda não existe no banco" devolve lista vazia. Todo o
   resto sobe, o react-query marca `isError`, e a tela mostra o aviso com o
   botão de tentar de novo (ErroAoCarregar). ═══════════════════════════════ */

/** Erro de objeto que ainda não existe no banco (migration pendente). É o
 *  único caso em que devolver vazio é honesto: a funcionalidade não existe. */
export const aindaNaoExisteNoBanco = (msg: string | undefined | null) =>
  /does not exist|schema cache|could not find the function/i.test(msg ?? "");

/* MENSAGEM QUE A PESSOA ENTENDE (Walter, 14/09/2026).

   Todo `onError` daqui fazia `toast.error(e.message || "...")`. O `e.message`
   do Supabase é inglês técnico: "new row violates row-level security policy for
   table posts", "JWT expired", "Failed to fetch". O designer lia isso no meio
   do trabalho e não tinha o que fazer com a informação, além de se assustar.

   Aqui os erros conhecidos viram frase em português com o PRÓXIMO PASSO junto.
   As mensagens que nós mesmos escrevemos ("Escreva o que precisa mudar...")
   passam intactas: já são humanas e são mais específicas que qualquer tradução
   genérica. */
export function mensagemHumana(e: unknown, padrao: string): string {
  const bruta = e instanceof Error ? e.message : String(e ?? "");
  if (!bruta) return padrao;
  // Nossa própria mensagem: sem inglês, sem jargão de banco. Passa direto.
  if (!/[a-z]+_[a-z]+|policy|violates|JWT|fetch|network|duplicate key|permission denied|payload|constraint/i.test(bruta)
      && /[áàâãéêíóôõúçA-ZÀ-Ú]/.test(bruta)) return bruta;

  if (/failed to fetch|network|networkerror|timeout|aborted/i.test(bruta))
    return "Sem conexão agora. Tente de novo quando a internet voltar: nada foi perdido.";
  if (/jwt|token|not authenticated|session/i.test(bruta))
    return "Sua sessão expirou. Entre de novo e refaça esta ação.";
  if (/row-level security|policy|permission denied|not authorized/i.test(bruta))
    return "Você não tem acesso a esta peça. Pode ser que a agência tenha pausado o seu vínculo.";
  if (/payload too large|body exceeded|413/i.test(bruta))
    return "O arquivo é grande demais pra subir aqui. Mande pelo link da pasta.";
  if (/duplicate key|already exists/i.test(bruta))
    return "Isso já estava salvo. Recarregue a tela pra ver como está agora.";
  if (aindaNaoExisteNoBanco(bruta))
    return "Esta parte ainda não está disponível na sua conta. Avise o suporte do Cria.";
  return padrao;
}

export type CardDaFila = {
  post_id: string;
  titulo: string;
  formato: string | null;
  plataforma: string | null;
  producao_status: "aguardando" | "em_producao" | "entregue" | "ajuste";
  prazo_producao: string | null;
  /** null = sem prazo · proposto = aguardando o aceite do parceiro ·
   *  negociando = parceiro sugeriu outra data · aceito = combinado. */
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  cache: number | null;
  publica_em: string | null;
  assigned_at: string | null;
  agencia_id: string;
  agencia_nome: string;
  cliente_nome: string;
  cliente_handle: string | null;
  cliente_cor: string | null;
  cliente_logo: string | null;
  etiquetas: string[];
  /** Id do cliente na carteira da agência: é o que casa o card com a ficha da
   *  marca (o "Infos Clientes" que a Gabriela mantém fixo no Trello). */
  external_client_id: string | null;
  /** Primeira mídia da peça (miniatura). É a capa do cartão no quadro por
   *  cliente: arte pronta aparecendo é o que faz o quadro ficar bonito de
   *  olhar, como no Trello (Walter, 09/09/2026). */
  capa: string | null;
};

/** Uma peça já entregue, do jeito que `parceiro_entregues()` devolve. */
export type EntregueDoParceiro = {
  post_id: string;
  titulo: string;
  formato: string | null;
  entregue_em: string;
  publica_em: string | null;
  agencia_id: string;
  agencia_nome: string;
  cliente_nome: string;
  cliente_cor: string | null;
  cliente_logo: string | null;
  aprovacao: string | null;
  cache: number | null;
  external_client_id: string | null;
  capa: string | null;
};

export type CardAberto = {
  id: string;
  titulo: string;
  formato: string | null;
  plataforma: string | null;
  gancho: string | null;
  roteiro: string | null;
  legenda: string | null;
  arte: unknown;
  blocos: unknown;
  notas: string | null;
  pasta_drive: string | null;
  referencia: string | null;
  etiquetas: string[];
  producao_status: string;
  prazo_producao: string | null;
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  publica_em: string | null;
  /** Eixo de aprovação do CLIENTE, só leitura pro parceiro: depois de
   *  entregar, ele vê onde a peça está (pendente, aprovado, postado...). */
  aprovacao: string | null;
  /** Valor combinado pela social mídia. Vira despesa no Caixa dela quando a
   *  peça é entregue; o parceiro precisa ver o que vai receber. */
  cache: number | null;
  agencia: string;
  /** O que já está anexado nesta peça (referência da agência ou arquivo que o
   *  próprio parceiro subiu). Ele mandava e nunca mais via. */
  midias?: { url: string | null; thumb: string | null; nome: string | null; tipo: string | null }[];
  /** Quantas vezes a peça voltou pra ajuste. Aparece no card dos dois lados:
   *  é o número que separa "cliente exigente" de "briefing ruim". */
  revisoes?: number;
  /** Quantos arquivos de entregas anteriores existem (o botão de histórico só
   *  aparece quando há o que mostrar). */
  versoes_antigas?: number;
  /** Elo com a ficha da marca: o card mostra os links do cliente por aqui. */
  external_client_id?: string | null;
  marca: {
    nome: string | null;
    handle: string | null;
    cor: string | null;
    logo: string | null;
    hashtags: string[] | null;
  };
  /** A conversa do card. Desde 15/09/2026 cada linha pode trazer um ALFINETE:
   *  o ponto exato da arte sobre o qual o recado foi escrito. */
  comentarios: {
    id: string; texto: string; papel: string; em: string;
    midia_indice?: number | null; ancora_x?: number | null;
    ancora_y?: number | null; ancora_seg?: number | null;
  }[];
};

export type Parceiro = { member_id: string; nome: string; email: string | null; role: string };

export const ROTULO_PAPEL: Record<string, string> = {
  designer: "Designer",
  editor_video: "Editor de vídeo",
  copy: "Copy",
  trafego: "Tráfego",
};

/* SINCRONIA ENTRE DOIS LADOS (auditoria 04/09): não há realtime no app, e o
   cache global fica 5 min sem revalidar e não refaz ao focar a janela. Quem
   delega de um lado e quem entrega do outro estão em sessões diferentes: sem
   isto, a demanda nova só aparecia com F5. Estas queries revalidam a cada 45s
   e ao voltar pra aba. */
const SINCRONIA = { staleTime: 20_000, refetchInterval: 45_000, refetchOnWindowFocus: true } as const;

/* ── A FILA DO PARCEIRO (todas as agências de uma vez) ──────────────────── */
export function useFilaDoParceiro() {
  const { user } = useAuth();
  return useQuery<CardDaFila[]>({
    queryKey: ["parceiro-fila", user?.id],
    enabled: !!user,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minha_fila");
      if (error) {
        // Migration ainda não rodou: fila vazia em vez de tela quebrada.
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as CardDaFila[];
    },
  });
}

/* ── O QUE JÁ SAIU DA MÃO DELE ──────────────────────────────────────────────
   Mesma chave que a tela Entregues usa desde a fase 1, de propósito: o quadro
   e a tela compartilham o cache em vez de consultar duas vezes. */
export function useEntreguesDoParceiro() {
  const { user } = useAuth();
  return useQuery<EntregueDoParceiro[]>({
    queryKey: ["parceiro-entregues", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_entregues");
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as EntregueDoParceiro[];
    },
  });
}

/* ── O HISTÓRICO DE VERSÕES ─────────────────────────────────────────────────
   Walter, 14/09/2026: "a parte de v1, v2, v3 do post poderia ter só uma opção
   de um botão de histórico pra ver as outras versões". Então a tela mostra a
   versão atual e nada mais; as antigas só são buscadas quando ele abre o
   histórico (enabled: !!postId). */
export type VersaoDaPeca = {
  id: string;
  rodada: number;
  nome: string | null;
  tipo: string | null;
  url: string | null;
  thumb: string | null;
  atual: boolean;
  em: string;
};

export function useVersoesDaPeca(postId: string | null) {
  return useQuery<VersaoDaPeca[]>({
    queryKey: ["parceiro-versoes", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_versoes_da_peca", { _post_id: postId });
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as VersaoDaPeca[];
    },
  });
}

/* ── O CARD ABERTO ──────────────────────────────────────────────────────── */
export function useCardDoParceiro(postId: string | null) {
  return useQuery<CardAberto | null>({
    queryKey: ["parceiro-card", postId],
    enabled: !!postId,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_abrir_card", { _post_id: postId });
      if (error) throw error;
      return (data ?? null) as CardAberto | null;
    },
  });
}

/* ── AÇÕES DO PARCEIRO ──────────────────────────────────────────────────── */
export function useAcoesDoParceiro(postId: string | null) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["parceiro-fila"] });
    // Entregou: o card sai da fila e ENTRA em Entregues; sem invalidar aqui ele
    // "sumia" até o cache vencer (auditoria 04/09).
    void qc.invalidateQueries({ queryKey: ["parceiro-entregues"] });
    void qc.invalidateQueries({ queryKey: ["parceiro-agencias"] });
    if (postId) void qc.invalidateQueries({ queryKey: ["parceiro-card", postId] });
  };

  const marcar = useMutation({
    // Entregar aceita o link da versão final: é o antídoto do "qual arquivo é
    // o final?" que apareceu em toda pesquisa de fluxo com freelancer.
    mutationFn: async (v: { status: "em_producao" | "entregue"; link?: string }) => {
      const { error } = await sbRpc("parceiro_marcar", {
        _post_id: postId, _status: v.status, _link: v.link?.trim() || null,
      });
      if (error) throw error;
      return v.status;
    },
    onSuccess: (status) => {
      invalidar();
      toast.success(status === "entregue"
        ? "Entregue! A social mídia recebeu o aviso."
        : "Marcado como em produção.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui atualizar.")),
  });

  const comentar = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await sbRpc("parceiro_comentar", { _post_id: postId, _texto: texto });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui comentar.")),
  });

  /* Responder ao prazo proposto: topar fecha o combinado; sugerir outra data
     manda a contraproposta pra social mídia, com o motivo na conversa do
     card. Negociar data não trava o trabalho: o card segue produzível. */
  const responderPrazo = useMutation({
    mutationFn: async (v: { aceita: boolean; sugestao?: string; motivo?: string }) => {
      const { error } = await sbRpc("parceiro_responder_prazo", {
        _post_id: postId, _aceita: v.aceita,
        _sugestao: v.sugestao || null, _motivo: v.motivo?.trim() || null,
      });
      if (error) throw error;
      return v.aceita;
    },
    onSuccess: (aceitou) => {
      invalidar();
      toast.success(aceitou ? "Prazo combinado!" : "Sugestão enviada. A social mídia recebe agora.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui responder o prazo.")),
  });

  /* ENTREGA COM ARQUIVO (fase 3). O parceiro não enxerga external_media_refs
     do dono (RLS), então: sobe no bucket `media` dentro da PRÓPRIA pasta (a
     policy do bucket permite) e registra o anexo no post do dono pela RPC
     security definer parceiro_anexar_entrega, que confere o card. */
  const anexar = useMutation({
    mutationFn: async (v: { arquivo: File; marcarEntregue?: boolean; naConversa?: boolean; legenda?: string }) => {
      if (!postId) throw new Error("Sem card.");
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Faça login de novo.");
      const MAX = 80 * 1024 * 1024;
      if (v.arquivo.size > MAX) throw new Error("Arquivo acima de 80 MB: entregue pelo link da pasta.");
      const safe = v.arquivo.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const caminho = `${uid}/entregas/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("media")
        .upload(caminho, v.arquivo, { contentType: v.arquivo.type || undefined, upsert: false, cacheControl: "31536000" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("media").getPublicUrl(caminho);
      const { error } = await sbRpc("parceiro_anexar_entrega", {
        _post_id: postId, _view_url: pub.publicUrl, _file_name: v.arquivo.name,
        _file_type: v.arquivo.type || null, _file_size: v.arquivo.size, _thumbnail_url: null,
      });
      if (error) throw error;
      if (v.marcarEntregue) {
        const { error: e2 } = await sbRpc("parceiro_marcar", { _post_id: postId, _status: "entregue", _link: null });
        if (e2) throw e2;
      }
      /* MANDAR A ARTE NA CONVERSA (Walter, 09/09/2026): no Trello a designer
         solta a imagem no próprio comentário e todo mundo vê a peça ali, sem
         abrir anexo. Aqui o arquivo continua indo pro card, e a URL vira um
         comentário: o chat renderiza imagem quando o texto é um link de
         imagem. */
      if (v.naConversa) {
        const legenda = v.legenda?.trim();
        const { error: e3 } = await sbRpc("parceiro_comentar", {
          _post_id: postId,
          _texto: legenda ? `${legenda}\n${pub.publicUrl}` : pub.publicUrl,
        });
        if (e3) throw e3;
      }
      return { entregou: v.marcarEntregue ?? false, naConversa: v.naConversa ?? false };
    },
    onSuccess: (r) => {
      invalidar();
      toast.success(r.entregou ? "Arquivo anexado e card entregue!"
        : r.naConversa ? "Enviado na conversa." : "Arquivo anexado ao card.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui anexar.")),
  });

  return { marcar, comentar, responderPrazo, anexar };
}

/* ── CACHÊS (fase 3) ─────────────────────────────────────────────────────── */
export type CacheDaAgencia = {
  manager_id: string; agencia: string; pendente: number; pago: number; pendente_qtd: number; ultimo_pago: string | null;
};

/** Lado parceiro: quanto cada agência deve e já pagou (fin_records ligado a mim). */
export function useMeusCaches() {
  const { user } = useAuth();
  return useQuery<CacheDaAgencia[]>({
    queryKey: ["parceiro-caches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_meus_caches");
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as CacheDaAgencia[];
    },
  });
}

export type CacheDoParceiro = {
  id: string; assignee_id: string; amount: number; status: string; date: string; description: string; post_id: string | null;
};

/** Lado social mídia: cachês lançados (despesas do Caixa ligadas a parceiro). */
export function useCachesDosParceiros(managerId: string | null) {
  return useQuery<CacheDoParceiro[]>({
    queryKey: ["caches-parceiros", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("fin_records")
        .select("id, assignee_id, amount, status, date, description, post_id")
        .eq("manager_id", managerId)
        .not("assignee_id", "is", null)
        .order("date", { ascending: false })
        .limit(300);
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as CacheDoParceiro[];
    },
  });
}

/* ── CONVERSA DO CARD (lado social mídia) ──────────────────────────────────
   O parceiro já conversa pela RPC. A dona lê e escreve direto na thread
   (post_approval_comments), que a RLS dela permite. Só os papéis do time
   entram aqui: o que é do cliente externo fica no portal dele. */
export type MensagemCard = { id: string; author_role: string; content: string; created_at: string };

export function useConversaDoCard(postId: string | null) {
  const qc = useQueryClient();
  const chave = ["conversa-card", postId] as const;
  const lista = useQuery<MensagemCard[]>({
    queryKey: chave,
    ...SINCRONIA,
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await sbFrom("post_approval_comments")
        .select("id, author_role, content, created_at")
        .eq("post_id", postId)
        .in("author_role", ["parceiro", "social_media"])
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as MensagemCard[];
    },
  });
  const enviar = useMutation({
    mutationFn: async (texto: string) => {
      const { data: sess } = await supabase.auth.getUser();
      const { error } = await sbFrom("post_approval_comments").insert({
        post_id: postId, author_id: sess.user?.id ?? null, author_role: "social_media", content: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: chave }); },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui enviar a mensagem. Ela continua escrita aqui: tente de novo.")),
  });
  return { mensagens: lista.data ?? [], carregando: lista.isLoading, enviar };
}

export type AgenciaDoParceiro = {
  agencia_id: string;
  agencia_nome: string;
  meu_papel: string;
  vinculo_status: string;
  abertos: number;
  entregues_30d: number;
};

/** As agências que me acoplaram, com quanto está na minha mão em cada uma e o
 *  que entreguei nos últimos 30 dias. A contagem de entregas é a semente do
 *  "quanto cada agência me deve" da fase 3. */
export function useMinhasAgencias() {
  const { user } = useAuth();
  return useQuery<AgenciaDoParceiro[]>({
    queryKey: ["parceiro-agencias", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minhas_agencias");
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as AgenciaDoParceiro[];
    },
  });
}

/* ── A FICHA DA MARCA ───────────────────────────────────────────────────── */

/** Uma marca que eu atendo, com tudo que serve pra PRODUZIR.
 *  A identidade vinha repetida dentro de cada card de peça; ela não é
 *  informação de peça, é de cliente (Walter, 09/09/2026, olhando o Trello da
 *  Gabriela: lá existe um card fixo "Infos Clientes" por cliente). */
export type MarcaDoParceiro = {
  external_client_id: string;
  nome: string;
  handle: string | null;
  logo: string | null;
  cor: string | null;
  hashtags: string[] | null;
  agencia_id: string;
  agencia_nome: string;
  abertos: number;
  entregues_30d: number;
  paleta: string | null;
  fontes: string | null;
  expressao_visual: string | null;
  tom_de_voz: string | null;
  personalidade: string | null;
  estilo_comunicacao: string | null;
  arquetipo: string | null;
  temas: string | null;
  ideia_central: string | null;
  promessa: string | null;
  publico: string | null;
  oferta: string | null;
  evitar: string | null;
  /** Sempre null desde 14/09/2026: nota interna da agência não sai daqui. */
  observacoes: string | null;
  segmento: string | null;
  /** Os links que a agência guarda na ficha: Drive, Pinterest, site, fotos. */
  links: { label: string; url: string }[] | null;
  referencias: { url: string; nota: string | null }[] | null;
};

/** As marcas de quem eu já peguei peça, com a identidade e as regras delas.
 *  Vínculo com a agência não basta pra aparecer aqui: seria abrir a carteira
 *  inteira do gestor pra quem foi contratado pra três posts. */
export function useMinhasMarcas() {
  const { user } = useAuth();
  return useQuery<MarcaDoParceiro[]>({
    queryKey: ["parceiro-marcas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minhas_marcas");
      if (error) {
        // Migration ainda não rodou: lista vazia em vez de tela quebrada.
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as MarcaDoParceiro[];
    },
  });
}

/** Uma linha de cachê: uma entrega que virou dinheiro a receber. */
export type CacheDetalhe = {
  id: string;
  valor: number;
  status: string;
  data: string;
  descricao: string | null;
  post_id: string | null;
  post_titulo: string | null;
  cliente_nome: string | null;
  cliente_logo: string | null;
  cliente_cor: string | null;
  agencia_id: string;
  agencia_nome: string;
};

/** O cachê PEÇA A PEÇA. O total por agência não respondia "de quais entregas
 *  vem esse valor", que é a pergunta que ele faz na hora de cobrar. */
export function useMeusCachesDetalhe() {
  const { user } = useAuth();
  return useQuery<CacheDetalhe[]>({
    queryKey: ["parceiro-caches-detalhe", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_meus_caches_detalhe");
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as CacheDetalhe[];
    },
  });
}

/* ── O CACHÊ QUE ELE LANÇA NA MÃO ───────────────────────────────────────── */

/** Anotação do próprio parceiro: pacote fechado, agência que não usa o Cria,
 *  valor combinado no WhatsApp. Não é o Caixa, é o caderninho dele. */
export type LancamentoDoParceiro = {
  id: string;
  cliente: string;
  descricao: string | null;
  valor: number;
  valor_pago: number;
  forma_pagamento: string | null;
  data: string;
};

export function useMeusLancamentos() {
  const { user } = useAuth();
  return useQuery<LancamentoDoParceiro[]>({
    queryKey: ["parceiro-lancamentos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("parceiro_lancamentos")
        .select("id, cliente, descricao, valor, valor_pago, forma_pagamento, data")
        .order("data", { ascending: false })
        .limit(300);
      if (error) {
        // Migration ainda não rodou: lista vazia em vez de tela quebrada.
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as LancamentoDoParceiro[];
    },
  });
}

export function useAcoesLancamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidar = () => void qc.invalidateQueries({ queryKey: ["parceiro-lancamentos", user?.id] });

  const salvar = useMutation({
    mutationFn: async (v: Partial<LancamentoDoParceiro> & { cliente: string }) => {
      const linha = {
        member_id: user?.id,
        cliente: v.cliente.trim(),
        descricao: v.descricao?.trim() || null,
        valor: Number(v.valor ?? 0),
        valor_pago: Number(v.valor_pago ?? 0),
        forma_pagamento: v.forma_pagamento?.trim() || null,
        data: v.data,
      };
      const { error } = v.id
        ? await sbFrom("parceiro_lancamentos").update(linha as never).eq("id", v.id)
        : await sbFrom("parceiro_lancamentos").insert(linha as never);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Cachê salvo."); },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui salvar este cachê. Tente de novo em instantes.")),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("parceiro_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Cachê excluído."); },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui excluir agora. Tente de novo em instantes.")),
  });

  return { salvar, excluir };
}

/* ── O LADO DA SOCIAL MÍDIA ─────────────────────────────────────────────── */

/** Os parceiros ativos da agência, pro botão "Enviar para". */
export function useMeusParceiros() {
  const { user } = useAuth();
  return useQuery<Parceiro[]>({
    queryKey: ["meus-parceiros", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("meus_parceiros");
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Parceiro[];
    },
  });
}

/* ── PRODUÇÃO EXTERNA (lado da social mídia) ────────────────────────────── */

export type PecaExterna = {
  id: string;
  title: string | null;
  format: string | null;
  producao_status: "aguardando" | "em_producao" | "entregue" | "ajuste" | null;
  prazo_producao: string | null;
  prazo_status: "proposto" | "negociando" | "aceito" | null;
  prazo_sugerido: string | null;
  approval_status: string | null;
  scheduled_date: string | null;
  assignee_id: string;
  external_client_id: string | null;
  updated_at: string | null;
  /** Valor combinado com o parceiro. Nulo = ninguém combinou, e a peça não
   *  entra no Caixa quando for entregue. */
  cache_parceiro: number | null;
  /** Quando a peça foi marcada como entregue. Coluna própria desde 14/09/2026:
   *  `updated_at` mudava a cada edição da agência e bagunçava a cobrança. */
  entregue_em: string | null;
  /** Quantas vezes esta peça voltou pra ajuste. Três ou mais é conversa de
   *  escopo, não de capricho. */
  revisoes: number | null;
};

/** Tudo que está na mão de parceiros: a matéria-prima do painel "Com
 *  parceiros". Ela é dona dos posts, então é consulta direta (a RLS dela já
 *  cobre, inclusive colaborador via acts_for). */
export function usePecasComParceiros(temParceiros: boolean) {
  const { user } = useAuth();
  return useQuery<PecaExterna[]>({
    queryKey: ["pecas-com-parceiros", user?.id],
    ...SINCRONIA,
    enabled: !!user && temParceiros,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id, title, format, producao_status, prazo_producao, prazo_status, prazo_sugerido, approval_status, scheduled_date, assignee_id, external_client_id, updated_at, cache_parceiro, entregue_em, revisoes")
        .not("assignee_id", "is", null)
        .order("prazo_producao", { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as PecaExterna[];
    },
  });
}

/** A social mídia responde à sugestão de prazo do parceiro. Aceitar fecha o
 *  combinado na data sugerida; ela também pode manter/propor outra data pelo
 *  "Enviar para" (que reabre como proposto). Dona do post = update direto. */
export function useResolverPrazoSugerido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; dataAceita: string }) => {
      const { data, error } = await sbFrom("posts").update({
        prazo_producao: v.dataAceita,
        prazo_status: "aceito",
        prazo_sugerido: null,
      } as never).eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui fechar o prazo. Recarregue e tente de novo.");
      const [a, m, d] = v.dataAceita.split("-");
      const { error: cErr } = await sbFrom("post_approval_comments").insert({
        post_id: v.postId, content: `Prazo combinado: ${d}/${m}/${a}`, author_role: "social_media",
      } as never);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      toast.success("Prazo combinado. O parceiro é avisado.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui fechar o prazo.")),
  });
}

/** Pedir ajuste (lado da social mídia). A pesquisa é unânime: rodada de
 *  revisão sem feedback CONSOLIDADO vira pingado de "aumenta a fonte" por
 *  áudio, e o freelancer perde a conta do que mudou. Por isso o motivo é
 *  obrigatório e entra na conversa do card, com a voz da social mídia. */
export function usePedirAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; motivo: string }) => {
      const motivo = v.motivo.trim();
      if (!motivo) throw new Error("Escreva o que precisa mudar, consolidado num texto só.");

      /* O COMENTÁRIO VEM PRIMEIRO (Walter, 14/09/2026).
         O gatilho `notify_parceiro_fluxo` monta o aviso de ajuste lendo o
         ÚLTIMO comentário da social mídia. Quando o status era gravado antes,
         esse último comentário ainda era o da rodada ANTERIOR: o parceiro
         recebia o motivo velho e refazia a coisa errada. Gravando o motivo
         primeiro, o gatilho lê o texto certo. */
      const { error: cErr } = await sbFrom("post_approval_comments").insert({
        post_id: v.postId, content: `Ajuste: ${motivo}`.slice(0, 4000), author_role: "social_media",
      } as never);
      if (cErr) throw cErr;
      const { data, error } = await sbFrom("posts")
        .update({ producao_status: "ajuste" } as never)
        .eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui pedir o ajuste. Recarregue e tente de novo.");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      toast.success("Ajuste pedido. O parceiro recebe o card de volta com o motivo.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui pedir o ajuste.")),
  });
}

/** Delegar um card: quem escreve é a DONA do post, então aqui é update direto
 *  na tabela (a RLS dela já permite). `assignee_id` null remove a delegação.
 *
 *  CORRIGIR O COMBINADO NÃO APAGA A ENTREGA (Walter, 14/09/2026).
 *  O mesmo popover que delega é o único lugar onde se ajusta o cachê. Antes ele
 *  reescrevia o fluxo inteiro em todo "Atualizar": a peça entregue voltava pra
 *  "aguardando", o prazo aceito virava proposto de novo e o parceiro via o card
 *  ressuscitar na fila. Ou seja, arrumar o valor custava a entrega.
 *
 *  Agora o estado da produção só é reiniciado quando o RESPONSÁVEL muda, que é
 *  quando faz sentido: outra pessoa, outro trabalho. Mesmo parceiro = só data e
 *  valor mudam, e o prazo volta a "proposto" apenas se a data mudou de fato,
 *  porque data nova é combinado novo. */
export function useDelegarPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; assigneeId: string | null; prazo: string | null; nomeParceiro?: string; cache?: number | null }) => {
      // Lê o estado atual em vez de confiar no que a tela achava que era: o
      // popover pode estar aberto desde antes do parceiro entregar.
      const { data: atual, error: lerErro } = await sbFrom("posts")
        .select("assignee_id, prazo_producao, producao_status")
        .eq("id", v.postId).maybeSingle();
      if (lerErro) throw lerErro;
      const anterior = (atual ?? null) as { assignee_id: string | null; prazo_producao: string | null; producao_status: string | null } | null;
      const mesmoParceiro = !!v.assigneeId && anterior?.assignee_id === v.assigneeId;
      const prazoMudou = (anterior?.prazo_producao ?? null) !== (v.prazo || null);

      const patch: Record<string, unknown> = {
        assignee_id: v.assigneeId,
        // Cachê combinado (fase 3): vira despesa no Caixa quando entregar, e o
        // gatilho corrige a despesa se o valor mudar antes da baixa.
        cache_parceiro: v.assigneeId ? (v.cache ?? null) : null,
        prazo_producao: v.assigneeId ? v.prazo : null,
        prazo_sugerido: null,
      };

      if (mesmoParceiro) {
        // Data nova pede aceite novo. Data igual não mexe em nada do prazo.
        if (prazoMudou) patch.prazo_status = v.prazo ? "proposto" : null;
        // producao_status e assigned_at ficam como estão: a entrega é dele.
      } else {
        // Prazo nasce PROPOSTO: o parceiro topa ou sugere outra data. Sem
        // data, não há o que aceitar (fica "a combinar").
        patch.prazo_status = v.assigneeId && v.prazo ? "proposto" : null;
        patch.producao_status = v.assigneeId ? "aguardando" : null;
        patch.assigned_at = v.assigneeId ? new Date().toISOString() : null;
      }

      const { data, error } = await sbFrom("posts").update(patch as never)
        .eq("id", v.postId).select("id").maybeSingle();
      if (error) throw error;
      // Bloqueio de RLS devolve zero linhas sem erro; sem isto a tela diria
      // "enviado" sem ter enviado.
      if (!data) throw new Error("Não consegui delegar. Recarregue e tente de novo.");
      return { ...v, mesmoParceiro };
    },
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ["external-posts"] });
      void qc.invalidateQueries({ queryKey: ["pecas-com-parceiros"] });
      if (!v.assigneeId) { toast.success("Delegação removida."); return; }
      toast.success(v.mesmoParceiro
        ? "Combinado atualizado. A entrega e o histórico continuam como estavam."
        : `Enviado pra ${v.nomeParceiro ?? "o parceiro"}. Ele recebe o aviso na hora.`);
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui delegar.")),
  });
}

/** Sou parceiro? Decide se o item "Minhas demandas" aparece e se o login cai
 *  direto na fila.
 *
 *  DUAS ORIGENS desde 09/09/2026. Antes só valia o VÍNCULO: papel de parceiro
 *  em algum manager_members ativo. Isso deixava de fora quem se cadastra como
 *  parceiro por conta própria e ainda não foi acoplado por ninguém, que caía na
 *  casca da gestão como se fosse uma agência vazia. Agora o tipo da conta
 *  (`account_type = 'parceiro'`) também vale, e o vínculo continua valendo
 *  sozinho pra não quebrar quem já entrou por convite. */
const PAPEIS_PARCEIRO = ["designer", "editor_video", "copy", "trafego"];

/** Vínculos de produção desta pessoa, ATIVOS E PAUSADOS, mais o tipo da conta.
 *  Base das duas perguntas que o app faz: "sou parceiro?" e "me pausaram?". */
export function useVinculosDeParceiro() {
  const { user } = useAuth();
  return useQuery<{ contaParceiro: boolean; ativos: number; pausados: number }>({
    queryKey: ["parceiro-vinculos", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [perfil, vinculos] = await Promise.all([
        sbFrom("profiles").select("account_type").eq("id", user!.id).maybeSingle(),
        sbFrom("manager_members").select("role, status").eq("member_id", user!.id),
      ]);
      /* ERRO AQUI NÃO PODE VIRAR "NÃO É PARCEIRO" (Walter, 14/09/2026).
         Antes era `if (error) return false`, e a resposta falsa desmontava a
         conta inteira dele: o menu de parceiro sumia e o ProtectedRoute mandava
         pra tela de assinar. Um piscar de internet transformava o designer em
         visitante. Deixando subir, o react-query tenta de novo e a tela segue
         em carregamento, que é a verdade. */
      if (vinculos.error && !aindaNaoExisteNoBanco(vinculos.error.message)) throw vinculos.error;
      const contaParceiro = (perfil.data as { account_type?: string | null } | null)?.account_type === "parceiro";
      const linhas = ((vinculos.data ?? []) as { role?: string | null; status?: string | null }[])
        .filter((v) => PAPEIS_PARCEIRO.includes(v.role ?? ""));
      return {
        contaParceiro,
        ativos: linhas.filter((v) => v.status === "ativo").length,
        pausados: linhas.filter((v) => v.status !== "ativo").length,
      };
    },
  });
}

/** Sou parceiro? Decide se o item "Minhas demandas" aparece e se o login cai
 *  direto na fila.
 *
 *  DUAS ORIGENS desde 09/09/2026: o tipo da conta (`account_type = 'parceiro'`)
 *  e o vínculo com papel de produção.
 *
 *  PAUSADO CONTINUA SENDO PARCEIRO (Walter, 14/09/2026). Antes só o vínculo
 *  'ativo' contava. Quando a última agência pausava o vínculo, ele deixava de
 *  ser parceiro aos olhos do app: perdia o menu, as entregas passadas e a tela
 *  de cachês, justo quando ainda tinha dinheiro a receber. Pausar é pausar o
 *  trabalho novo, não apagar o histórico de quem trabalhou. */
export function useSouParceiro() {
  const q = useVinculosDeParceiro();
  return { ...q, data: q.data ? q.data.contaParceiro || q.data.ativos > 0 || q.data.pausados > 0 : undefined };
}

/** Todas as agências pausaram o vínculo: ele não recebe demanda nova, mas o
 *  que já é dele continua no lugar. Merece tela própria, não silêncio. */
export function usePausadoEmTudo() {
  const { data } = useVinculosDeParceiro();
  return !!data && data.ativos === 0 && data.pausados > 0;
}
