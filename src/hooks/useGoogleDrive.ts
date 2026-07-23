import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import { uploadVideoFileToBunny, uploadFileToBunnyStream } from "@/lib/bunny-upload";

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

  const loadGoogleScripts = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.picker && window.gapi) { resolve(); return; }
      const fail = () => reject(new Error("google_script_load_failed"));

      const loadPicker = () => {
        if (!window.gapi) {
          const s = document.createElement("script");
          s.src = "https://apis.google.com/js/api.js";
          s.onload = () => { window.gapi.load("picker", () => resolve()); };
          s.onerror = fail;
          document.body.appendChild(s);
        } else {
          window.gapi.load("picker", () => resolve());
        }
      };

      if (!window.google?.accounts) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = loadPicker;
        s.onerror = fail;
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
          // Sem isto, fechar/cancelar o popup de permissão do Google NÃO dispara
          // callback nenhum e a Promise fica pendurada pra sempre → botão "travado
          // carregando". Aqui rejeitamos pra o fluxo destravar e o picking resetar.
          error_callback: (err: { type?: string }) => {
            reject(new Error(err?.type === "popup_closed" ? "popup_closed" : (err?.type || "oauth_error")));
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
        .addView(new window.google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false))
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
    let videoIngestFailed = 0;

    // Continua a numeração do carrossel a partir do que já existe no post,
    // pra a ordem não zerar (senão a mídia nova entra sem position/ordem).
    let basePos = 0;
    if (postId) {
      const { data: last } = await supabase.from("external_media_refs")
        .select("position").eq("post_id", postId)
        .order("position", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      basePos = (((last as { position?: number | null } | null)?.position) ?? -1) + 1;
    }

    for (const f of files) {
      try {
        if (isVideoMime(f.mimeType)) {
          // VÍDEO: em vez de manter no Drive (player /preview que algumas contas
          // bloqueiam), INGERE no Bunny Stream: baixa o arquivo do Drive como Blob,
          // vira File e sobe pro Bunny (transcodifica e toca sempre no nosso player).
          // Não precisa mais deixar público no Drive (permissions.create anyone).
          const toastId = `drive-video-${f.id}`;
          toast.loading(`Enviando vídeo do Drive: ${f.name}...`, { id: toastId });
          try {
            const driveBlob = await downloadDriveFileToBlob(f.id, accessToken);
            const videoFile = new File([driveBlob], f.name, { type: f.mimeType || driveBlob.type });

            if (postId) {
              // Post já existe: usa a MESMA lógica do upload de vídeo do aparelho
              // (create-video + TUS + criapost_add_media).
              await uploadVideoFileToBunny(videoFile, postId);
            } else {
              // Post novo (sem id ainda): sobe pro Bunny e insere a ref direto com
              // post_id null, pra ser reconciliada no save (igual mídia de foto).
              const bunny = await uploadFileToBunnyStream(videoFile);
              const { error } = await supabase.from("external_media_refs").insert({
                user_id: ownerId,
                post_id: null,
                provider: "bunny_stream",
                external_file_id: bunny.videoGuid,
                file_name: f.name,
                file_type: f.mimeType || "video/mp4",
                file_size: f.sizeBytes || null,
                thumbnail_url: bunny.thumbnail_url,
                view_url: bunny.view_url,
                bunny_video_id: bunny.videoGuid,
                position: basePos + imported,
              });
              if (error) throw error;
            }
            toast.success(`Vídeo pronto, processando: ${f.name}`, { id: toastId });
          } catch (verr) {
            console.error(`[drive-import] bunny ingest failed for ${f.name}:`, verr);
            toast.error(`Não consegui enviar o vídeo "${f.name}" pro player.`, { id: toastId });
            videoIngestFailed++;
            continue;
          }
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
            position: basePos + imported,
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
    // Vídeos que falharam já mostraram toast próprio por item; aqui só um resumo
    // se mais de um caiu, sem derrubar os outros itens importados.
    if (videoIngestFailed > 1) {
      toast.error(`${videoIngestFailed} vídeo(s) não puderam ser enviados pro player.`);
    }
  }, [user, activeAccountId]);

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
