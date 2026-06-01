import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-validation";
import { compressImage } from "@/lib/image-compress";

const sanitizeStoragePath = (name: string): string => {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const clean = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "file";
  return `${clean}${ext.toLowerCase()}`;
};

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

const isVideoMime = (mime: string) => mime.startsWith("video/");

async function downloadDriveFileToBlob(fileId: string, accessToken: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`drive_download_${res.status}`);
  return await res.blob();
}

export function useGoogleDrive() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const [picking, setPicking] = useState(false);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const pickFromDeviceFallback = useCallback(async (postId?: string) => {
    if (!user) {
      toast.error("Faça login para enviar mídia.");
      return;
    }
    const userId = activeAccountId || user.id; // dono do CONTEÚDO (cliente, se gerenciando)

    return new Promise<void>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*";
      input.multiple = true;
      input.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none";

      const cleanup = () => {
        if (input.parentNode) input.parentNode.removeChild(input);
      };

      input.addEventListener("change", async () => {
        try {
          const files = input.files;
          if (!files || files.length === 0) return;
          try {
            setPicking(true);
            for (const file of Array.from(files)) {
              const validation = validateUpload(file, "postMedia");
              if (!validation.ok) {
                toast.error(validation.reason);
                continue;
              }
              const safeName = sanitizeStoragePath(file.name);
              const path = `${userId}/${Date.now()}-${safeName}`;
              const { error: upErr } = await supabase.storage
                .from("media")
                .upload(path, file, { upsert: true, contentType: file.type });
              if (upErr) {
                console.error("[device-fallback] storage error", upErr);
                toast.error(`Erro ao enviar ${file.name}: ${upErr.message}`);
                continue;
              }
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
              const publicUrl = urlData.publicUrl;
              await supabase.from("external_media_refs").insert({
                user_id: userId,
                post_id: postId || null,
                provider: "device",
                external_file_id: path,
                file_name: file.name,
                file_type: file.type,
                thumbnail_url: publicUrl,
                view_url: publicUrl,
              });
            }
            toast.success("Mídia adicionada!");
          } catch (err) {
            console.error(err);
            toast.error("Erro ao enviar mídia.");
          } finally {
            setPicking(false);
          }
        } finally {
          cleanup();
          resolve();
        }
      }, { once: true });

      input.addEventListener("cancel", () => { cleanup(); resolve(); }, { once: true });
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          cleanup();
          resolve();
        }
      }, 5 * 60 * 1000);

      document.body.appendChild(input);
      input.click();
    });
  }, [user, activeAccountId]);

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
        const allToDisable = Array.from(document.querySelectorAll("*")).filter((el) => {
          if (el.closest(".picker-dialog") || el.closest(".picker-dialog-bg")) return false;
          const style = window.getComputedStyle(el as HTMLElement);
          const position = style.position;
          const zIndex = parseInt(style.zIndex) || 0;
          if (style.display === "none") return false;
          return position === "fixed"
            || position === "sticky"
            || (position !== "static" && zIndex >= 40);
        });

        allToDisable.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.dataset.origPe = htmlEl.style.pointerEvents || "";
          htmlEl.dataset.origZ = htmlEl.style.zIndex || "";
          htmlEl.style.pointerEvents = "none";
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

  const saveExternalRefs = useCallback(async (files: PickedFile[], accessToken: string, postId?: string) => {
    if (!user || files.length === 0) return;
    const ownerId = activeAccountId || user.id; // dono do CONTEÚDO (cliente, se gerenciando)
    if (!ownerId) return;

    let imported = 0;
    let failed = 0;

    for (const f of files) {
      try {
        if (isVideoMime(f.mimeType)) {
          // VÍDEO: mantém como ref do Drive (preview iframe / link). Não baixa.
          const { error } = await supabase.from("external_media_refs").insert({
            user_id: ownerId,
            post_id: postId || null,
            provider: "google_drive",
            external_file_id: f.id,
            file_name: f.name,
            file_type: f.mimeType,
            file_size: f.sizeBytes || null,
            thumbnail_url: f.thumbnailUrl || null,
            view_url: f.url,
            download_url: `https://drive.google.com/uc?export=download&id=${f.id}`,
          });
          if (error) throw error;
        } else {
          // FOTO: baixa do Drive → comprime → upload pro bucket media → ref como 'device'
          const driveBlob = await downloadDriveFileToBlob(f.id, accessToken);
          const sourceFile = new File([driveBlob], f.name, { type: f.mimeType || driveBlob.type });
          const compressed = await compressImage(sourceFile);
          const safeName = sanitizeStoragePath(compressed.name);
          const path = `${ownerId}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from("media").upload(path, compressed, {
            upsert: true,
            contentType: compressed.type,
          });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          const publicUrl = urlData.publicUrl;
          const { error: insErr } = await supabase.from("external_media_refs").insert({
            user_id: ownerId,
            post_id: postId || null,
            provider: "device",
            external_file_id: path,
            file_name: f.name,
            file_type: compressed.type,
            file_size: compressed.size,
            thumbnail_url: publicUrl,
            view_url: publicUrl,
          });
          if (insErr) throw insErr;
        }
        imported++;
      } catch (err) {
        console.error(`[drive-import] ${f.name} failed:`, err);
        failed++;
      }
    }

    if (imported > 0) toast.success(`${imported} arquivo(s) vinculado(s)!`);
    if (failed > 0) toast.error(`${failed} arquivo(s) falharam ao importar.`);
  }, [user, activeAccountId]);

  const pickAndSave = useCallback(async (postId?: string) => {
    if (picking) return;

    if (isMobile) {
      await pickFromDeviceFallback(postId);
      return;
    }

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
      if (files.length > 0) await saveExternalRefs(files, token, postId);
    } catch (err: any) {
      if (!err?.message?.includes("popup_closed")) {
        toast.error("Erro ao abrir Google Drive.");
      }
      console.error(err);
    } finally {
      setPicking(false);
    }
  }, [picking, isMobile, pickFromDeviceFallback, loadGoogleScripts, getAccessToken, openPicker, saveExternalRefs]);

  return { pickAndSave, picking };
}
