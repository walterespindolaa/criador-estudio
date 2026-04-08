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

const getStoredToken = (): string | null => {
  try {
    const token = sessionStorage.getItem("gd_access_token");
    const expires = sessionStorage.getItem("gd_token_expires");
    if (token && expires && parseInt(expires) > Date.now()) return token;
  } catch { /* ignore */ }
  return null;
};

const setStoredToken = (token: string, expiresInSeconds = 3600) => {
  try {
    sessionStorage.setItem("gd_access_token", token);
    sessionStorage.setItem("gd_token_expires", String(Date.now() + expiresInSeconds * 1000 - 60000));
  } catch { /* ignore */ }
};

export function useGoogleDrive() {
  const { user } = useAuth();
  const [picking, setPicking] = useState(false);

  const loadGoogleScripts = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.google?.picker && window.gapi) { resolve(); return; }

      const loadPicker = () => {
        if (!window.gapi) {
          const s = document.createElement("script");
          s.src = "https://apis.google.com/js/api.js";
          s.onload = () => { window.gapi.load("picker", () => resolve()); };
          document.body.appendChild(s);
        } else {
          window.gapi.load("picker", () => resolve());
        }
      };

      if (!window.google?.accounts) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = loadPicker;
        document.body.appendChild(s);
      } else {
        loadPicker();
      }
    });
  }, []);

  const getAccessToken = useCallback(async (clientId: string): Promise<string> => {
    const cached = getStoredToken();
    if (cached) return cached;

    const hint = localStorage.getItem("gd_hint") || undefined;

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }
          setStoredToken(resp.access_token, resp.expires_in || 3600);
          resolve(resp.access_token);
        },
        ...(hint ? { hint } : {}),
      });

      client.requestAccessToken({ prompt: "" });
    });
  }, []);

  const openPicker = useCallback(async (accessToken: string): Promise<PickedFile[]> => {
    return new Promise((resolve) => {
      const neutralize = () => {
      const allFixed = Array.from(document.querySelectorAll("*")).filter((el) => {
        if (el.closest(".picker-dialog") || el.closest(".picker-dialog-bg")) return false;

        const style = window.getComputedStyle(el as HTMLElement);
        return (style.position === "fixed" || style.position === "sticky") && style.display !== "none";
      });

        allFixed.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.dataset.origPe = htmlEl.style.pointerEvents || "";
          htmlEl.dataset.origZ = htmlEl.style.zIndex || "";
          htmlEl.style.pointerEvents = "none";
          htmlEl.style.zIndex = "0";
        });
      };

      const restore = () => {
        document.querySelectorAll("[data-orig-pe]").forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.pointerEvents = htmlEl.dataset.origPe || "";
          htmlEl.style.zIndex = htmlEl.dataset.origZ || "";
          htmlEl.removeAttribute("data-orig-pe");
          htmlEl.removeAttribute("data-orig-z");
        });
      };

      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsView().setIncludeFolders(false).setSelectFolderEnabled(false))
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES))
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_VIDEOS))
        .setOAuthToken(accessToken)
        .setDeveloperKey("")
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle("Selecionar do Google Drive")
        .setCallback((data: any) => {
          if (data.action === "picked" || data.action === "cancel") {
            restore();

            if (data.action === "picked") {
              const files: PickedFile[] = data.docs.map((doc: any) => ({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                sizeBytes: doc.sizeBytes,
                thumbnailUrl: `https://lh3.googleusercontent.com/d/${encodeURIComponent(doc.id)}=w400`,
                url: doc.url,
              }));
              resolve(files);
            } else {
              resolve([]);
            }
          }
        })
        .build();

      picker.setVisible(true);

      setTimeout(() => {
        const pickerDialog = document.querySelector(".picker-dialog") as HTMLElement | null;
        const pickerBg = document.querySelector(".picker-dialog-bg") as HTMLElement | null;

        if (pickerDialog) {
          pickerDialog.style.zIndex = "2147483647";
          pickerDialog.style.pointerEvents = "all";
        }

        if (pickerBg) {
          pickerBg.style.zIndex = "2147483646";
          pickerBg.style.pointerEvents = "all";
        }

        neutralize();

        document.querySelectorAll(".picker-dialog, .picker-dialog *, .picker-dialog-bg").forEach((el) => {
          (el as HTMLElement).style.pointerEvents = "all";
        });
      }, 200);
    });
  }, []);

  const saveExternalRefs = useCallback(async (files: PickedFile[], postId?: string) => {
    if (!user || files.length === 0) return;

    const rows = files.map((f) => ({
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

    const { error } = await supabase.from("external_media_refs").insert(rows);
    if (error) {
      toast.error("Erro ao salvar referências.");
      return;
    }

    toast.success(`${files.length} arquivo(s) vinculado(s)!`);
  }, [user]);

  const pickAndSave = useCallback(async (postId?: string) => {
    if (picking) return;
    setPicking(true);

    try {
      await loadGoogleScripts();
      const { data } = await supabase.functions.invoke("get-google-config");
      if (!data?.client_id) {
        toast.error("Google Drive não configurado.");
        return;
      }

      const token = await getAccessToken(data.client_id);

      try {
        const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.email) localStorage.setItem("gd_hint", info.email);
        }
      } catch { /* ignore */ }

      const files = await openPicker(token);
      if (files.length > 0) await saveExternalRefs(files, postId);
    } catch (err: any) {
      if (!err?.message?.includes("popup_closed")) {
        toast.error("Erro ao abrir Google Drive.");
      }
      console.error(err);
    } finally {
      setPicking(false);
    }
  }, [picking, loadGoogleScripts, getAccessToken, openPicker, saveExternalRefs]);

  return { pickAndSave, picking };
}
