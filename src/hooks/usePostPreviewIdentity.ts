import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

// ═══════════════════════════════════════════════════════════════════════
// IDENTIDADE DA PRÉVIA DE POST (o "celularzinho" do PostPreviewModal)
//
// A prévia simula o que o PÚBLICO vê no Instagram/TikTok, então o nome, o @
// e o avatar são do DONO do post, nunca do usuário logado:
//   1. post de cliente (external_client_id) → nome/@/logo do cliente;
//   2. senão → perfil da CONTA ATIVA (no criador é ele mesmo; no kanban
//      escopado do gestor é o cliente gerenciado);
//   3. em último caso → neutro ("Criador" / "@usuario").
//
// Antes cada tela passava o perfil da SESSÃO (useProfile) e a gestora via o
// próprio nome em cima do post do cliente.
// ═══════════════════════════════════════════════════════════════════════

export type PreviewIdentity = { name: string; handle: string; avatarUrl: string | null };

// Handle salvo às vezes vem com "@" na frente; a prévia já renderiza o "@".
const limpaHandle = (h?: string | null): string => (h ? h.trim().replace(/^@+/, "") : "");

export function usePostPreviewIdentity(
  externalClientId?: string | null,
  // Fallback extra de handle (ex.: tiktok_handle da própria conta), usado
  // ANTES do neutro "usuario". Só passe dado que pertença ao dono do post.
  fallbackHandle?: string | null,
): PreviewIdentity {
  const { profile: activeProfile } = useActiveProfile();

  const { data: cliente } = useQuery({
    queryKey: ["post-preview-client", externalClientId],
    enabled: !!externalClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_clients")
        .select("name, instagram_handle, logo_url")
        .eq("id", externalClientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const name = (externalClientId ? cliente?.name : null) || activeProfile?.name || "Criador";
  const handle =
    limpaHandle(externalClientId ? cliente?.instagram_handle : null) ||
    limpaHandle(activeProfile?.instagram_handle) ||
    limpaHandle(fallbackHandle) ||
    "usuario";
  const avatarUrl = (externalClientId ? cliente?.logo_url : null) || activeProfile?.avatar_url || null;

  return { name, handle, avatarUrl };
}
