import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PaginaCriakutDados, PerfilCriakut, Servico } from "@/lib/criakut";

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
