import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount, type MeuPerfil } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { deriveTier } from "@/hooks/useTier";

/** Rótulo curto do plano do Meu perfil pro card da carteira. */
export function rotuloPlanoMeuPerfil(p: Pick<MeuPerfil, "plan" | "subscription_status" | "trial_ends_at"> | null): string {
  if (!p) return "";
  const ativo = ["active", "trialing", "past_due", "unpaid"].includes(p.subscription_status ?? "");
  if (ativo && p.plan === "studio") return "plano Studio";
  if (ativo && p.plan === "pro") return "plano Pro";
  if (ativo && p.plan === "essencial") return "plano Essencial";
  if (p.trial_ends_at) {
    const fim = new Date(p.trial_ends_at);
    if (fim.getTime() > Date.now()) {
      return `teste até ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    }
  }
  return "sem plano";
}

/** Abre o Meu perfil (mesmo caminho de abrir o Cria de uma conta). */
export function useAbrirMeuPerfil() {
  const { meuPerfil, setActiveAccount } = useActiveAccount();
  const navigate = useNavigate();
  return () => {
    if (!meuPerfil) return;
    setActiveAccount(meuPerfil.owner_id);
    navigate("/app");
  };
}

/**
 * Cria o Meu perfil (edge criar-meu-perfil) e já abre. A edge é idempotente:
 * dois cliques não criam dois perfis.
 */
export function useCriarMeuPerfil() {
  const { user } = useAuth();
  const { setActiveAccount } = useActiveAccount();
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (nome?: string) => {
      const { data, error } = await supabase.functions.invoke("criar-meu-perfil", { body: { nome: nome ?? null } });
      if (error) throw error;
      const id = (data as { id?: string } | null)?.id;
      if (!id) throw new Error("sem_id");
      return id;
    },
    onSuccess: async (id) => {
      // setActiveAccount só aceita conta que já está na lista: busca o perfil antes.
      await qc.refetchQueries({ queryKey: ["meu-perfil", user?.id] });
      setActiveAccount(id);
      navigate("/app");
      toast.success("Seu perfil está pronto. Agora conta pra gente sobre o seu conteúdo.");
    },
    onError: () => toast.error("Não consegui criar seu perfil agora. Tente de novo em instantes."),
  });
}

type PlanoCurto = { plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null };

/** Pílula curta do plano do lado criador: "Studio", "Pro", "teste · 5d". */
export function pilulaPlanoCriador(p: PlanoCurto): { texto: string; pago: boolean } {
  const ativo = ["active", "trialing", "past_due", "unpaid"].includes(p.subscription_status ?? "");
  if (ativo && p.plan === "studio") return { texto: "Studio", pago: true };
  if (ativo && p.plan === "pro") return { texto: "Pro", pago: true };
  if (ativo && p.plan === "essencial") return { texto: "Essencial", pago: true };
  const fim = p.trial_ends_at ? new Date(p.trial_ends_at).getTime() : 0;
  const dias = Math.max(1, Math.ceil((fim - Date.now()) / 86_400_000));
  return { texto: `teste · ${dias}d`, pago: false };
}

/**
 * ATALHO "MEU CRIA" NO MENU DA GESTÃO (Walter, 18/10/2026, mockup aprovado).
 * Só aparece pra quem tem o lado criador VALENDO (pago ou em teste): sem plano
 * o atalho levaria pra ferramentas trancadas, e o convite já mora no card da
 * tela Clientes ("sem plano não faz sentido mostrar o atalho").
 *   - social mídia com Meu perfil: abre o perfil (faixa de volta pros clientes);
 *   - parceira que entrou como criadora: abre a própria conta de criadora.
 * Colaboradora atuando no time de outra agência não vê: o perfil é da pessoa.
 */
export function useAtalhoMeuCria(): null | { nome: string; avatar: string | null; pilula: { texto: string; pago: boolean }; abrir: () => void } {
  const { meuPerfil, actingAsTeam, setActiveAccount } = useActiveAccount();
  const { profile } = useProfile();
  const abrirPerfil = useAbrirMeuPerfil();
  const navigate = useNavigate();
  if (actingAsTeam) return null;
  if (meuPerfil) {
    if (deriveTier(meuPerfil) === "none") return null;
    return { nome: meuPerfil.name ?? "Meu perfil", avatar: meuPerfil.avatar_url ?? null, pilula: pilulaPlanoCriador(meuPerfil), abrir: abrirPerfil };
  }
  if (profile && profile.account_type !== "manager" && deriveTier(profile) !== "none") {
    return {
      nome: profile.name ?? "Meu Cria",
      avatar: (profile as { avatar_url?: string | null }).avatar_url ?? null,
      pilula: pilulaPlanoCriador(profile),
      abrir: () => { setActiveAccount(null); navigate("/app"); },
    };
  }
  return null;
}

