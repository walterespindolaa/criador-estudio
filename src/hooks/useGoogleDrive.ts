import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  thumbnailUrl?: string;
  url: string;
}

export function useGoogleDrive() {
  const { user } = useAuth();
  const [picking, setPicking] = useState(false);

  const loadGoogleScripts = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.google?.picker && window.gapi) { resolve(); return; }
      const loadApi = () => {
        const s = document.createElement("script");
        s.src = "https://apis.google.com/js/api.js";
        s.onload = () => { window.gapi.load("picker", () => resolve()); };
        document.body.appendChild(s);
      };
      if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = loadApi;
        document.body.appendChild(s);
      } else {
        loadApi();
      }
    });
  }, []);

  const getAccessToken = useCallback(async (clientId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (resp: any) => {
          if (resp.error) reject(resp.error);
          else resolve(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: "consent" });
    });
  }, []);

  const openPicker = useCallback(async (accessToken: string, clientId: string): Promise<PickedFile[]> => {
    return new Promise((resolve) => {
      const view = new window.google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false);
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES))
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_VIDEOS))
        .setOAuthToken(accessToken)
        .setDeveloperKey("")
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((data: any) => {
          if (data.action === "picked") {
            const files: PickedFile[] = data.docs.map((doc: any) => ({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
              thumbnailUrl: doc.iconUrl?.replace("/16/", "/512/"),
              url: doc.url,
            }));
            resolve(files);
          } else if (data.action === "cancel") {
            resolve([]);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }, []);

  const saveExternalRefs = useCallback(async (files: PickedFile[], postId?: string) => {
    if (!user || files.length === 0) return;
    const rows = files.map(f => ({
      user_id: user.id,
      post_id: postId || null,
      provider: "google_drive",
      external_file_id: f.id,
      file_name: f.name,
      file_type: f.mimeType,
      file_size: f.sizeBytes || null,
      thumbnail_url: f.thumbnailUrl || null,
      view_url: f.url,
      download_url: `https://drive.google.com/uc?export=download&id=${f.id}`,
    }));
    const { error } = await supabase.from("external_media_refs" as any).insert(rows);
    if (error) { toast.error("Erro ao salvar referências."); return; }
    toast.success(`${files.length} arquivo(s) vinculado(s)!`);
  }, [user]);

  const pickAndSave = useCallback(async (postId?: string) => {
    if (picking) return;
    setPicking(true);
    try {
      await loadGoogleScripts();
      const { data } = await supabase.functions.invoke("get-google-config");
      if (!data?.client_id) { toast.error("Google Drive não configurado."); return; }
      const token = await getAccessToken(data.client_id);
      const files = await openPicker(token, data.client_id);
      if (files.length > 0) await saveExternalRefs(files, postId);
    } catch (err) {
      toast.error("Erro ao abrir Google Drive.");
      console.error(err);
    } finally {
      setPicking(false);
    }
  }, [picking, loadGoogleScripts, getAccessToken, openPicker, saveExternalRefs]);

  return { pickAndSave, picking };
}
