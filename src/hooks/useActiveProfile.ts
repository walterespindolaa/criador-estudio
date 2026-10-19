import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile, type Profile } from "@/hooks/useProfile";

/**
 * Profile da CONTA ATIVA: a própria conta, a conta de uma cliente que a
 * social media opera, ou o "Meu perfil" (perfil_de = sessão).
 *
 * Inclui plano e status (subscription_status, trial_ends_at) porque as
 * ferramentas pagas seguem o plano de QUEM É A CONTA (decisão 18/10/2026:
 * quem paga é a cliente). NÃO inclui stripe_*, pix_key nem nada de cobrança.
 *
 * Continua sendo da SESSÃO (use useProfile direto): acesso ao app
 * (useSubscription/ProtectedRoute), role de admin, tema, checkout.
 */
export type ActiveProfile = Pick<
  Profile,
  | "id"
  | "name"
  | "avatar_url"
  | "niche"
  | "instagram_handle"
  | "tiktok_handle"
  | "youtube_handle"
  | "bio"
  | "weekly_goal"
  | "role"
  | "platforms"
  | "editorial_line"
  | "brand_logo_url"
  | "plan"
  | "subscription_status"
  | "trial_ends_at"
  | "access_expires_at"
  | "ai_ideas_used_month"
  | "ai_ideas_reset_at"
  | "storage_used_bytes"
  | "storage_quota_bytes"
  | "storage_retention_days"
> & {
  account_type?: string | null;
  media_kit_url?: string | null;
  perfil_de?: string | null;
  /** Meu perfil nasce sem onboarding: a dona passa pelo de criadora na 1ª vez. */
  onboarding_completed?: boolean | null;
  /** Só vem preenchida pra dona (ela mesma ou o Meu perfil dela). */
  pix_key?: string | null;
};

/** Campos que dá pra gravar na conta ativa (espelha a lista do RPC). */
export type PerfilAtivoPatch = Partial<{
  name: string;
  avatar_url: string | null;
  niche: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  bio: string | null;
  weekly_goal: number | null;
  editorial_line: Record<string, string> | null;
  platforms: string[] | null;
  brand_logo_url: string | null;
  media_kit_url: string | null;
  storage_retention_days: number | null;
  /** O servidor só aceita da dona (ela mesma ou o Meu perfil). */
  pix_key: string | null;
  /** Só a dona (fim do onboarding do Meu perfil). */
  onboarding_completed: boolean;
}>;

export type UseActiveProfileResult = {
  profile: ActiveProfile | null;
  isLoading: boolean;
  /** true quando a conta ativa não é a da sessão (cliente ou Meu perfil). */
  isOutraConta: boolean;
};

type RpcSolto = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
// bind: sem ele o rpc perde o `this` do client e quebra antes de ir pra rede.
const rpc = supabase.rpc.bind(supabase) as unknown as RpcSolto;

export function useContaAtivaId() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const ownerId = activeAccountId || user?.id || "";
  const isOwnAccount = !activeAccountId || activeAccountId === user?.id;
  return { ownerId, isOwnAccount, userId: user?.id ?? "" };
}

export function useActiveProfile(): UseActiveProfileResult {
  const { ownerId, isOwnAccount } = useContaAtivaId();
  const { profile: selfProfile, isLoading: selfLoading } = useProfile();

  const { data: managedProfile, isLoading: managedLoading } = useQuery<ActiveProfile | null>({
    queryKey: ["active-profile", ownerId],
    enabled: !!ownerId && !isOwnAccount,
    queryFn: async () => {
      // RPC SECURITY DEFINER: só devolve pra dono, membro ativo ou Meu perfil.
      const { data, error } = await rpc("get_perfil_ativo", { _owner: ownerId });
      if (error) throw error;
      return (data as ActiveProfile | null) ?? null;
    },
  });

  if (isOwnAccount) {
    return { profile: (selfProfile as ActiveProfile | null) ?? null, isLoading: selfLoading, isOutraConta: false };
  }
  return { profile: managedProfile ?? null, isLoading: managedLoading, isOutraConta: true };
}

/**
 * Grava na conta ATIVA. Própria conta: update direto (RLS do dono).
 * Outra conta: RPC que confere acesso e só aceita a lista de campos.
 */
export function useAtualizarPerfilAtivo() {
  const { ownerId, isOwnAccount, userId } = useContaAtivaId();
  const { updateProfile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: PerfilAtivoPatch): Promise<PerfilAtivoPatch> => {
      if (!ownerId) throw new Error("Not authenticated");
      if (isOwnAccount) {
        await updateProfile.mutateAsync(patch as never);
        return patch;
      }
      const { error } = await rpc("atualizar_perfil_ativo", { _owner: ownerId, _patch: patch });
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      if (!isOwnAccount) {
        queryClient.setQueryData<ActiveProfile | null>(["active-profile", ownerId], (prev) =>
          prev ? ({ ...prev, ...patch } as ActiveProfile) : prev,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["active-profile", ownerId] });
      queryClient.invalidateQueries({ queryKey: ["feed-profile", ownerId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

/**
 * Caminho de arquivo da conta no bucket "avatars". A policy só deixa gravar na pasta
 * da SESSÃO, então foto de outra conta vai numa subpasta própria dela dentro
 * da pasta de quem subiu. Nunca sobrescreve o avatar da própria sessão.
 */
export function caminhoDaConta(userId: string, ownerId: string, arquivo: string): string {
  return !ownerId || ownerId === userId ? `${userId}/${arquivo}` : `${userId}/contas/${ownerId}/${arquivo}`;
}

export function caminhoAvatar(userId: string, ownerId: string): string {
  return caminhoDaConta(userId, ownerId, "avatar.jpg");
}
