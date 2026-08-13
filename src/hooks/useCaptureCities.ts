import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// ── CIDADES ATENDIDAS PELA SOCIAL MÍDIA ───────────────────────────────────────
// Config do GESTOR (dono do tenant): a lista de cidades onde a agência faz
// captação (ex.: Itajaí, Balneário Camboriú, Navegantes). Guardada em
// profiles.capture_cities (text[]). Ver 20260813000001_cria_captacao.sql.
//
// LEITURA DEFENSIVA: se a coluna ainda não existe (migration pendente) ou o
// select falha, a função devolve [] em vez de derrubar a tela. Assim o Cria
// Captação abre normalmente e o gestor só não vê cidades até rodar o SQL.
//
// Sempre lê/grava no PERFIL DO DONO (agencyOwnerId), não no do colaborador: a
// lista é da agência. O colaborador logado como time enxerga as cidades do dono.

type ProfileCities = { capture_cities?: string[] | null };

// Normaliza: tira vazios, apara espaços e remove duplicadas (case-insensitive),
// preservando a primeira grafia digitada e a ordem.
function normalizeCities(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const c = (raw ?? "").trim();
    if (!c) continue;
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

export function useCaptureCities() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const queryKey = ["capture-cities", agencyOwnerId] as const;

  const query = useQuery<string[]>({
    queryKey,
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("capture_cities")
        .eq("id", agencyOwnerId!)
        .maybeSingle();
      // Coluna inexistente (migration não rodada) ou qualquer falha: lista vazia.
      if (error) return [];
      const cities = (data as ProfileCities | null)?.capture_cities;
      return Array.isArray(cities) ? normalizeCities(cities) : [];
    },
  });

  // Grava a lista inteira (o componente monta o array final: add/remove chips).
  const save = useMutation({
    mutationFn: async (cities: string[]) => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const clean = normalizeCities(cities);
      const { error } = await supabase
        .from("profiles")
        .update({ capture_cities: clean } as never)
        .eq("id", agencyOwnerId);
      if (error) throw error;
      return clean;
    },
    onSuccess: (clean) => {
      qc.setQueryData<string[]>(queryKey, clean);
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não consegui salvar as cidades."),
  });

  return { cities: query.data ?? [], isLoading: query.isLoading, save };
}

// ── TOMADAS PADRÃO DA SOCIAL MÍDIA ────────────────────────────────────────────
// Config do GESTOR (dono do tenant): a lista que o botão "Usar tomadas padrão"
// injeta numa captação (ex.: "1 Reels", "5 Fotos", "3 Stories"). Guardada em
// profiles.default_shot_list (text[]). Ver 20260813000004_default_shot_list.sql.
//
// LEITURA DEFENSIVA: se a coluna ainda não existe (migration pendente) ou o
// select falha, devolve [] em vez de derrubar a tela. Com [] o card cai na lista
// fixa de fallback (DEFAULT_SHOT_LIST), então nada quebra até rodar o SQL.
//
// A ordem IMPORTA aqui (é a ordem em que as tomadas entram na captação), então
// normaliza só apara/tira vazios/dedup, sem reordenar.
type ProfileShots = { default_shot_list?: string[] | null };

function normalizeShots(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = (raw ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function useDefaultShotList() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const queryKey = ["default-shot-list", agencyOwnerId] as const;

  const query = useQuery<string[]>({
    queryKey,
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("default_shot_list")
        .eq("id", agencyOwnerId!)
        .maybeSingle();
      if (error) return [];
      const shots = (data as ProfileShots | null)?.default_shot_list;
      return Array.isArray(shots) ? normalizeShots(shots) : [];
    },
  });

  const save = useMutation({
    mutationFn: async (shots: string[]) => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const clean = normalizeShots(shots);
      const { error } = await supabase
        .from("profiles")
        .update({ default_shot_list: clean } as never)
        .eq("id", agencyOwnerId);
      if (error) throw error;
      return clean;
    },
    onSuccess: (clean) => {
      qc.setQueryData<string[]>(queryKey, clean);
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não consegui salvar as tomadas padrão."),
  });

  return { shots: query.data ?? [], isLoading: query.isLoading, save };
}
