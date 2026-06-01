import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useVideoPublicConfirm } from "@/contexts/VideoPublicConfirmContext";
import { toast } from "sonner";
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

const REQUIRED_SCOPE = "drive.file";

const getStoredToken = (): string | null => {
  try {
    const token = sessionStorage.getItem("gd_access_token");
    const expires = sessionStorage.getItem("gd_token_expires");
    const scope = sessionStorage.getItem("gd_token_scope") || "";
    if (!token || !expires) return null;
    if (parseInt(expires) <= Date.now()) return null;
    // Cache antigo gravado quando o app pedia drive.readonly fica inválido:
    // só devolve token cacheado se o scope concedido inclui drive.file.
    if (!scope.includes(REQUIRED_SCOPE)) return null;
    return token;
  } catch { /* ignore */ }
  return null;
};

const setStoredToken = (token: string, scope: string, expiresInSeconds = 3600) => {
  try {
    sessionStorage.setItem("gd_access_token", token);
    sessionStorage.setItem("gd_token_scope", scope || "");
    sessionStorage.setItem("gd_token_expires", String(Date.now() + expiresInSeconds * 1000 - 60000));
  } catch { /* ignore */ }
};

const clearStoredToken = () => {
  try {
    sessionStorage.removeItem("gd_access_token");
    sessionStorage.removeItem("gd_token_scope");
    sessionStorage.removeItem("gd_token_expires");
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
  const confirmVideoPublic = useVideoPublicConfirm();
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

  const getAccessToken = useCallback(async (clientId: string, forceConsent = false): Promise<string> => {
    if (!forceConsent) {
      const cached = getStoredToken();
      if (cached) return cached;
    }

    const hint = localStorage.getItem("gd_hint") || undefined;
    const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

    const requestOnce = (prompt: "" | "consent"): Promise<{ token: string; scope: string; expires: number }> =>
      new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope,
          callback: (resp: { error?: string; access_token?: string; scope?: string; expires_in?: number }) => {
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error ?? "no_token"));
              return;
            }
            resolve({
              token: resp.access_token,
              scope: resp.scope ?? "",
              expires: resp.expires_in ?? 3600,
            });
          },
          ...(hint ? { hint } : {}),
        });
        client.requestAccessToken({ prompt });
      });

    let result = await requestOnce(forceConsent ? "consent" : "");
    // Se o consentimento cacheado pelo Google ainda é o antigo (drive.readonly), o silent
    // pode devolver token sem drive.file. Forçar re-consent pra obter o scope novo.
    if (!result.scope.includes(REQUIRED_SCOPE)) {
      result = await requestOnce("consent");
    }
    setStoredToken(result.token, result.scope, result.expires);
    return result.token;
  }, []);

  const openPicker = useCallback(async (accessToken: string, clientId: string): Promise<PickedFile[]> => {
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

      // appId = NÚMERO DO PROJETO Google Cloud (prefixo numérico do client_id).
      // Sem isso, com scope drive.file o Picker não concede acesso (read+manage)
      // aos arquivos escolhidos → permissions.create cai em "appNotAuthorizedToFile".
      const appId = clientId.split("-")[0];

      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsView().setIncludeFolders(false).setSelectFolderEnabled(false))
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES))
        .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_VIDEOS))
        .setOAuthToken(accessToken)
        .setAppId(appId)
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
    let blockedByPolicy = 0;
    let scopeIssue = 0;

    for (const f of files) {
      try {
        if (isVideoMime(f.mimeType)) {
          // VÍDEO: SEMPRE fica no Drive (codec/tamanho variam — player do Drive transcodifica).
          // Storage não é usado pra vídeo: HEVC/.mov não toca em <video> e estoura quota.
          const ok = await confirmVideoPublic();
          if (!ok) { failed++; continue; }

          const permRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}/permissions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ role: "reader", type: "anyone" }),
            },
          );
          if (!permRes.ok) {
            const status = permRes.status;
            const errText = await permRes.text().catch(() => "");
            console.error(`[drive-import] permissions.create failed for ${f.name}:`, status, errText);

            // Classifica o 403 — scope/auth NÃO é igual a policy de Workspace
            const isScopeError =
              (status === 401 || status === 403) &&
              /scope|insufficient[_ ]?authentication|access[_ ]?token[_ ]?scope|insufficientpermissions/i.test(errText);
            const isPolicyError =
              status === 403 &&
              /sharingratelimitexceeded|domainpolicy|cannotshare|domain/i.test(errText);

            if (isScopeError) {
              // Token velho (drive.readonly) ainda em cache — derruba e força re-consent na próxima.
              clearStoredToken();
              scopeIssue++;
              continue;
            }
            if (isPolicyError) {
              blockedByPolicy++;
              continue;
            }
            throw new Error(`permissions_${status}`);
          }

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
    if (scopeIssue > 0) {
      toast.error("Reconecte seu Google Drive pra atualizar a permissão e tente de novo.");
    }
    if (blockedByPolicy > 0) {
      toast.error(
        `Sua conta do Google bloqueia compartilhamento público. Pra ${blockedByPolicy} vídeo(s), use o upload direto (Galeria / PC).`,
      );
    }
  }, [user, activeAccountId, confirmVideoPublic]);

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

      const files = await openPicker(token, data.client_id);
      if (files.length > 0) await saveExternalRefs(files, token, postId);
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
