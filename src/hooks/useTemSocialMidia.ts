import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";

/* A conta TEM social midia vinculada? (alguem com status active em
   account_members apontando pro dono da conta ativa).
   Usa a MESMA queryKey do Criando.tsx ("tem-social-midia"), entao o cache e
   compartilhado: menu, bolinha de aprovacao e afins fazem UMA consulta so.
   Serve pra esconder o que nao faz sentido pro criador solo, como a aba
   Aprovacoes (quem aprova por la e a social midia dele). */
export function useTemSocialMidia() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const donoDaConta = activeAccountId ?? user?.id ?? null;
  const { data: temSocialMidia = false, isLoading } = useQuery({
    queryKey: ["tem-social-midia", donoDaConta],
    enabled: !!donoDaConta,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("account_members")
        .select("id")
        .eq("owner_id", donoDaConta!)
        .eq("status", "active")
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });
  return { temSocialMidia, isLoading };
}
