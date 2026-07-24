import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Um item dentro da pasta do Drive (subpasta ou arquivo).
export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  modifiedTime: string | null;
  isFolder: boolean;
};

export type DriveListResult = {
  folder_id: string;
  root_url: string;
  items: DriveItem[];
};

// Lê o corpo de erro que a edge devolve (mesmo padrão dos outros hooks).
async function erroDaEdge(error: { message: string; context?: Response }): Promise<string> {
  let detail = error.message;
  try {
    const ctx = error.context;
    if (ctx?.text) {
      const raw = await ctx.clone().text();
      const b = JSON.parse(raw);
      detail = b?.message || b?.error || detail;
    }
  } catch { /* ignore */ }
  return detail;
}

/**
 * Lista o conteúdo de uma pasta pública do Google Drive a partir do link salvo
 * no cliente. Chama a edge function `drive-list`, que usa a API key do Google.
 *
 * Só funciona com pastas compartilhadas como "qualquer pessoa com o link pode
 * ver"; caso contrário a edge devolve uma mensagem amigável no lugar dos itens.
 */
export function useDriveFolder(folderUrl: string | null | undefined) {
  return useQuery<DriveListResult>({
    queryKey: ["drive-folder", folderUrl ?? ""],
    enabled: !!folderUrl && folderUrl.trim().length > 0,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("drive-list", {
        body: { folder_url: folderUrl },
      });
      if (error) throw new Error((await erroDaEdge(error)) || "Falha ao listar a pasta do Drive.");
      // A edge devolve 200 com { error, message } pros casos "esperados"
      // (pasta privada, erro da Drive API). Aí a mensagem vira o erro da query.
      const err = (data as { error?: string })?.error;
      if (err) throw new Error((data as { message?: string })?.message || err);
      return data as DriveListResult;
    },
  });
}
