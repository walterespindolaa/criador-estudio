import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useManageSubscription() {
  const [isLoading, setIsLoading] = useState(false);

  const openPortal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("portal sem URL");
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e instanceof Error && e.message.includes("no_customer")
          ? "Você ainda não tem uma assinatura pra gerenciar."
          : "Não foi possível abrir o gerenciamento. Tente novamente.";
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return { openPortal, isLoading };
}
