/* ═══════════════════════════════════════════════════════════════════════════
   TUTORIAIS EM VÍDEO (Walter, 02/10/2026)

   Catálogo em public.tutoriais (só os prontos chegam aqui, a RLS cuida) e o
   progresso de cada pessoa em public.tutoriais_progresso. Os vídeos moram na
   library própria do Bunny (cria-tutoriais), que não expira e não conta na
   cota de ninguém. Quem sobe é o script CRIA/tutoriais/subir-bunny.mjs.

   As tabelas são novas e o types.ts é travado: daí o sbFrom com cast.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => any;

export type Trilha = "social_midia" | "criador" | "parceiro";

export const TRILHA_NOME: Record<Trilha, string> = {
  social_midia: "Social mídia",
  criador: "Criador de conteúdo",
  parceiro: "Parceiro",
};

export type Tutorial = {
  id: string;
  slug: string;
  publico: Trilha;
  modulo: string;
  modulo_nome: string;
  modulo_ordem: number;
  ordem: number;
  titulo: string;
  descricao: string | null;
  duracao_s: number | null;
  rota: string | null;
  bunny_library_id: string | null;
  bunny_video_id: string | null;
};

export type Progresso = { tutorial_id: string; segundos: number; pct: number; visto: boolean; atualizado_em: string };

export type ModuloTutoriais = { modulo: string; nome: string; publico: Trilha; videos: Tutorial[] };

const CAMPOS = "id, slug, publico, modulo, modulo_nome, modulo_ordem, ordem, titulo, descricao, duracao_s, rota, bunny_library_id, bunny_video_id";

export function useCatalogoTutoriais() {
  const { user } = useAuth();
  return useQuery<Tutorial[]>({
    queryKey: ["tutoriais", "catalogo"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sbFrom("tutoriais")
        .select(CAMPOS)
        .eq("status", "pronto")
        .order("publico").order("modulo_ordem").order("ordem");
      if (error) throw error;
      return (data ?? []) as Tutorial[];
    },
  });
}

export function useProgressoTutoriais() {
  const { user } = useAuth();
  return useQuery<Record<string, Progresso>>({
    queryKey: ["tutoriais", "progresso", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("tutoriais_progresso")
        .select("tutorial_id, segundos, pct, visto, atualizado_em")
        .eq("user_id", user!.id);
      if (error) throw error;
      const mapa: Record<string, Progresso> = {};
      for (const p of (data ?? []) as Progresso[]) mapa[p.tutorial_id] = p;
      return mapa;
    },
  });
}

/** Grava onde a pessoa parou. "visto" nunca volta pra falso sozinho: só o botão desmarca. */
export function useSalvarProgresso() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { tutorial_id: string; segundos: number; pct: number; visto?: boolean; forcarVisto?: boolean }) => {
      if (!user) return;
      const chave = ["tutoriais", "progresso", user.id];
      const atual = qc.getQueryData<Record<string, Progresso>>(chave)?.[p.tutorial_id];
      const visto = p.forcarVisto !== undefined ? p.forcarVisto : (atual?.visto || !!p.visto);
      const linha = {
        user_id: user.id,
        tutorial_id: p.tutorial_id,
        segundos: Math.max(0, Math.round(p.segundos)),
        pct: Math.min(100, Math.max(0, Math.round(p.pct))),
        visto,
        atualizado_em: new Date().toISOString(),
      };
      qc.setQueryData<Record<string, Progresso>>(chave, (prev) => ({ ...(prev ?? {}), [p.tutorial_id]: linha }));
      const { error } = await sbFrom("tutoriais_progresso").upsert(linha as never, { onConflict: "user_id,tutorial_id" });
      if (error) throw error;
    },
  });
}

/** Agrupa por módulo, na ordem do catálogo. */
export function agruparPorModulo(lista: Tutorial[]): ModuloTutoriais[] {
  const mapa = new Map<string, ModuloTutoriais>();
  for (const t of lista) {
    const k = `${t.publico}:${t.modulo}`;
    if (!mapa.has(k)) mapa.set(k, { modulo: t.modulo, nome: t.modulo_nome, publico: t.publico, videos: [] });
    mapa.get(k)!.videos.push(t);
  }
  return [...mapa.values()];
}

/** O vídeo desta tela, pro botão "?": a rota cadastrada mais específica que bate com o endereço. */
export function tutorialDaRota(lista: Tutorial[] | undefined, pathname: string): Tutorial | null {
  if (!lista) return null;
  let melhor: Tutorial | null = null;
  for (const t of lista) {
    if (!t.rota) continue;
    const casa = pathname === t.rota || pathname.startsWith(t.rota.endsWith("/") ? t.rota : `${t.rota}/`);
    if (casa && (!melhor || t.rota.length > (melhor.rota?.length ?? 0))) melhor = t;
  }
  return melhor;
}

export function duracaoTexto(s: number | null | undefined) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export const thumbDoTutorial = (slug: string) => `/tutoriais/${slug}.jpg`;
