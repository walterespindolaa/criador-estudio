import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";

// Um link salvo pelo usuário final (rótulo + URL). Mesmo formato do gestor
// (crm_clients.useful_links), mas aqui é a conta do próprio criador.
export type UserLink = { label: string; url: string };

/**
 * Lê e grava os "links úteis" do usuário final na coluna jsonb
 * profiles.useful_links (default '[]'). Segue o padrão do gestor, que guarda o
 * array inteiro de uma vez. Escreve sempre na CONTA ATIVA (o dono dos arquivos),
 * consistente com o restante da página Arquivos.
 *
 * Requer a coluna profiles.useful_links (ver SQL no relatório). types.ts é
 * travado, então usamos cast onde necessário.
 */
export function useUserLinks() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const ownerId = activeAccountId || user?.id || "";
  const queryClient = useQueryClient();
  const queryKey = ["user-links", ownerId] as const;

  const { data: links = [], isLoading } = useQuery<UserLink[]>({
    queryKey,
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("useful_links")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      const raw = (data as { useful_links?: unknown } | null)?.useful_links;
      return Array.isArray(raw) ? (raw as UserLink[]) : [];
    },
  });

  const save = useMutation({
    mutationFn: async (next: UserLink[]): Promise<UserLink[]> => {
      if (!ownerId) throw new Error("Sem conta ativa.");
      const { error } = await supabase
        .from("profiles")
        .update({ useful_links: next } as never)
        .eq("id", ownerId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData<UserLink[]>(queryKey, next);
    },
  });

  return { links, isLoading, save };
}
