import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { aindaNaoExisteNoBanco, mensagemHumana } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MATERIAL COM PARCEIRO (Gabriela, 29/09/2026: "preciso conseguir delegar
   materiais também pra designer: apresentação, cartão de visita, flyer")

   Espelho do circuito dos posts, do lado dos materiais (client_materials).
   A tabela não está no types.ts travado, então tudo passa pelos casts
   sbFrom/sbRpc, como no resto do módulo de parceiros.

   A agência escreve DIRETO na tabela (a RLS de time já deixa). O parceiro
   nunca encosta na tabela: só pelas RPCs `parceiro_*_material`, que conferem
   vínculo ativo e responsável. A conversa e o "abrir" são RPCs dos dois lados,
   pra tela ser uma só.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

const SINCRONIA = { staleTime: 20_000, refetchInterval: 45_000, refetchOnWindowFocus: true } as const;

export type EtapaProducao = "aguardando" | "em_producao" | "ajuste" | "entregue";

export type EntregaDoMaterial = {
  kind: "file" | "link";
  name: string;
  url: string;
  type?: string | null;
  size?: number | null;
  rodada?: number;
  em?: string;
};

export type MaterialDaFila = {
  material_id: string;
  titulo: string;
  tipo: string | null;
  producao_status: EtapaProducao;
  prazo_producao: string | null;
  assigned_at: string | null;
  entregue_em: string | null;
  agencia_id: string;
  agencia_nome: string;
  cliente_nome: string;
  cliente_cor: string | null;
  cliente_logo: string | null;
  cache: number | null;
  revisoes: number;
};

export type MaterialAberto = {
  id: string;
  papel: "agencia" | "parceiro";
  titulo: string;
  briefing: string | null;
  tipo: string | null;
  status: string;
  producao_status: EtapaProducao;
  prazo_producao: string | null;
  data_cliente: string | null;
  cache: number | null;
  revisoes: number;
  entregue_em: string | null;
  anexos: { kind: string; name: string; url: string }[];
  entregas: EntregaDoMaterial[];
  assignee_id: string | null;
  parceiro_nome: string | null;
  agencia_nome: string | null;
  cliente_nome: string;
  cliente_cor: string | null;
  cliente_logo: string | null;
  comentarios: { id: string; papel: "social_media" | "parceiro"; texto: string; em: string }[];
};

/** Rótulo dos tipos que o banco guarda em `kind`. */
export const TIPO_MATERIAL: Record<string, string> = {
  apresentacao: "Apresentação", flyer: "Flyer", arte_avulsa: "Arte avulsa",
  logo: "Logo", cartao_visita: "Cartão de visita", post_carrossel: "Carrossel", outro: "Material",
};

/* ── LADO DO PARCEIRO ─────────────────────────────────────────────────── */

export function useMateriaisDoParceiro() {
  const { user } = useAuth();
  return useQuery<MaterialDaFila[]>({
    queryKey: ["parceiro-materiais", user?.id],
    enabled: !!user,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_meus_materiais");
      if (error) {
        // Migration ainda não rodou: sem seção de materiais, sem tela quebrada.
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as MaterialDaFila[];
    },
  });
}

export function useMaterialAberto(id: string | null) {
  return useQuery<MaterialAberto>({
    queryKey: ["material-aberto", id],
    enabled: !!id,
    ...SINCRONIA,
    queryFn: async () => {
      const { data, error } = await sbRpc("material_abrir", { _id: id });
      if (error) throw error;
      return data as MaterialAberto;
    },
  });
}

function useInvalidarMaterial() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ["parceiro-materiais"] });
    void qc.invalidateQueries({ queryKey: ["client-materials"] });
    void qc.invalidateQueries({ queryKey: ["materiais-com-parceiros"] });
    if (id) void qc.invalidateQueries({ queryKey: ["material-aberto", id] });
  };
}

export function useComentarMaterial(id: string | null) {
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await sbRpc("material_comentar", { _id: id, _texto: texto });
      if (error) throw error;
    },
    onSuccess: () => invalidar(id ?? undefined),
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui mandar a mensagem.")),
  });
}

/** Parceiro sobe o arquivo na PRÓPRIA pasta do bucket `media` (a policy do
 *  storage só deixa cada um escrever em `<uid>/...`) e registra no material. */
export function useAnexarNoMaterial(id: string | null) {
  const { user } = useAuth();
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (v: { arquivo?: File; link?: string }) => {
      if (!id || !user) throw new Error("Sessão expirada. Entre de novo.");
      if (v.arquivo) {
        const f = v.arquivo;
        const limpo = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "arquivo";
        const caminho = `${user.id}/materiais/${id}/${Date.now()}-${limpo}`;
        const { error: upErr } = await supabase.storage.from("media").upload(caminho, f, {
          upsert: true, contentType: f.type || "application/octet-stream",
        });
        if (upErr) throw new Error(upErr.message || "Não consegui subir o arquivo.");
        const url = supabase.storage.from("media").getPublicUrl(caminho).data.publicUrl;
        const { error } = await sbRpc("parceiro_anexar_material", {
          _id: id, _url: url, _nome: f.name, _tipo: f.type || "application/octet-stream", _tamanho: f.size ?? null,
        });
        if (error) throw error;
        return;
      }
      let link = (v.link ?? "").trim();
      if (!link) throw new Error("Cole o link da entrega.");
      if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
      const { error } = await sbRpc("parceiro_anexar_material", { _id: id, _url: link, _nome: null, _tipo: null, _tamanho: null });
      if (error) throw error;
    },
    onSuccess: () => invalidar(id ?? undefined),
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui anexar.")),
  });
}

export function useRemoverAnexoDoMaterial(id: string | null) {
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (url: string) => {
      const { error } = await sbRpc("parceiro_remover_anexo_material", { _id: id, _url: url });
      if (error) throw error;
    },
    onSuccess: () => invalidar(id ?? undefined),
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui remover.")),
  });
}

export function useMarcarMaterial(id: string | null) {
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (status: "em_producao" | "entregue") => {
      const { error } = await sbRpc("parceiro_marcar_material", { _id: id, _status: status });
      if (error) {
        if ((error.message ?? "").includes("anexe_a_entrega")) throw new Error("Anexe o arquivo ou o link da entrega antes de marcar como entregue.");
        throw error;
      }
      return status;
    },
    onSuccess: (s) => {
      invalidar(id ?? undefined);
      toast.success(s === "entregue" ? "Entregue! A social mídia recebe o aviso na hora." : "Marcado como fazendo.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui atualizar.")),
  });
}

/* ── LADO DA AGÊNCIA ──────────────────────────────────────────────────── */

/** Delegar (ou trocar/tirar) o parceiro do material. Mesmo parceiro de novo
 *  só corrige prazo e cachê: a etapa e a entrega continuam (o gatilho só
 *  reinicia o fluxo quando o responsável MUDA). */
export function useDelegarMaterial() {
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (v: { id: string; assigneeId: string | null; prazo: string | null; cache: number | null; nome?: string }) => {
      const patch: Record<string, unknown> = {
        assignee_id: v.assigneeId,
        prazo_producao: v.assigneeId ? (v.prazo || null) : null,
        cache_parceiro: v.assigneeId && v.cache && v.cache > 0 ? Math.round(v.cache * 100) / 100 : null,
      };
      const { data, error } = await sbFrom("client_materials").update(patch).eq("id", v.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui salvar. Recarregue e tente de novo.");
      return v;
    },
    onSuccess: (v) => {
      invalidar(v.id);
      toast.success(v.assigneeId ? `Enviado pra ${v.nome ?? "o parceiro"}. Ele recebe o aviso na hora.` : "Delegação removida.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui delegar.")),
  });
}

/** Revisão da entrega. "Tá ok" leva o material pra coluna escolhida do
 *  quadro (Em aprovação, pra mostrar ao cliente, ou Finalizado). Pedir ajuste
 *  grava o motivo na conversa ANTES de mudar a etapa, pra o aviso do parceiro
 *  já encontrar o motivo lá. */
export function useRevisarMaterial() {
  const invalidar = useInvalidarMaterial();
  return useMutation({
    mutationFn: async (v: { id: string; acao: "aprovar"; destino: "em_aprovacao" | "finalizado" } | { id: string; acao: "ajuste"; motivo: string }) => {
      if (v.acao === "ajuste") {
        const motivo = v.motivo.trim();
        if (!motivo) throw new Error("Escreva o que precisa mudar.");
        const { error: cErr } = await sbRpc("material_comentar", { _id: v.id, _texto: `Ajuste: ${motivo}` });
        if (cErr) throw cErr;
        const { error } = await sbFrom("client_materials").update({ producao_status: "ajuste", status: "ajuste" }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("client_materials").update({ status: v.destino }).eq("id", v.id);
        if (error) throw error;
        await sbRpc("material_comentar", { _id: v.id, _texto: "Entrega aprovada ✅" });
      }
      return v;
    },
    onSuccess: (v) => {
      invalidar(v.id);
      toast.success(v.acao === "ajuste" ? "Ajuste pedido. O parceiro recebe o material de volta com o motivo." : "Aprovado.");
    },
    onError: (e: Error) => toast.error(mensagemHumana(e, "Não consegui salvar a revisão.")),
  });
}
