import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TOKEN_KEY = "gcal_access_token";
const TOKEN_EXP_KEY = "gcal_token_expires";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    google: any;
  }
}

export interface SyncablePost {
  id: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  caption?: string | null;
  notes?: string | null;
  platform?: string | null;
  format?: string | null;
  google_event_id?: string | null;
}

interface SyncResponse {
  ok?: boolean;
  code?: "token_expired" | "google_error";
  error?: string;
  eventId?: string;
  htmlLink?: string;
}

const getStoredToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expires = sessionStorage.getItem(TOKEN_EXP_KEY);
    if (token && expires && parseInt(expires) > Date.now()) return token;
  } catch {
    /* ignore */
  }
  return null;
};

const setStoredToken = (token: string, expiresInSeconds = 3600) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    // subtract 60s as a safety margin before real expiry
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresInSeconds * 1000 - 60000));
  } catch {
    /* ignore */
  }
};

const clearStoredToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
  } catch {
    /* ignore */
  }
};

const loadGsi = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.body.appendChild(s);
  });

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const getClientId = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("get-google-config");
    if (error || !data?.client_id) throw new Error("Google client_id indisponível");
    return data.client_id as string;
  }, []);

  const getAccessToken = useCallback(
    async (forceConsent = false): Promise<string> => {
      if (!forceConsent) {
        const cached = getStoredToken();
        if (cached) return cached;
      }
      await loadGsi();
      const clientId = await getClientId();

      return new Promise<string>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: CALENDAR_SCOPE,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (resp: any) => {
            if (resp.error) {
              reject(new Error(resp.error));
              return;
            }
            setStoredToken(resp.access_token, resp.expires_in || 3600);
            resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
      });
    },
    [getClientId],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callSync = useCallback(async (body: Record<string, any>): Promise<SyncResponse> => {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", { body });
    if (error) throw error; // auth / validation / network -> hard failure
    return (data || {}) as SyncResponse;
  }, []);

  const syncPost = useCallback(
    async (post: SyncablePost): Promise<string | undefined> => {
      if (!user) {
        toast.error("Faça login para conectar a agenda.");
        return;
      }
      if (!post.scheduled_date) {
        toast.error("Defina uma data de agendamento primeiro.");
        return;
      }

      setSyncing(true);
      try {
        let accessToken = await getAccessToken();

        const payload = {
          action: "upsert" as const,
          accessToken,
          eventId: post.google_event_id || null,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
          reminderMinutes: 60,
          durationMinutes: 30,
          post: {
            id: post.id,
            title: post.title,
            scheduledDate: post.scheduled_date,
            scheduledTime: post.scheduled_time ?? null,
            caption: post.caption ?? null,
            notes: post.notes ?? null,
            platform: post.platform ?? null,
            format: post.format ?? null,
          },
        };

        let result = await callSync(payload);

        if (result.code === "token_expired") {
          clearStoredToken();
          accessToken = await getAccessToken(true);
          result = await callSync({ ...payload, accessToken });
        }

        if (!result.ok || !result.eventId) {
          throw new Error(result.error || "Falha ao sincronizar");
        }

        const { error: upErr } = await supabase
          .from("posts")
          .update({
            google_event_id: result.eventId,
            calendar_synced_at: new Date().toISOString(),
          })
          .eq("id", post.id)
          .eq("user_id", user.id);
        if (upErr) throw upErr;

        toast.success(post.google_event_id ? "Agenda atualizada!" : "Adicionado à Google Agenda!");
        return result.eventId;
      } catch (err) {
        console.error("[useGoogleCalendar] sync", err);
        toast.error("Não foi possível sincronizar com a Google Agenda.");
        return undefined;
      } finally {
        setSyncing(false);
      }
    },
    [user, getAccessToken, callSync],
  );

  const removeFromCalendar = useCallback(
    async (post: SyncablePost): Promise<void> => {
      if (!user || !post.google_event_id) return;

      setSyncing(true);
      try {
        let accessToken = await getAccessToken();
        let result = await callSync({
          action: "delete",
          accessToken,
          eventId: post.google_event_id,
        });

        if (result.code === "token_expired") {
          clearStoredToken();
          accessToken = await getAccessToken(true);
          result = await callSync({
            action: "delete",
            accessToken,
            eventId: post.google_event_id,
          });
        }

        await supabase
          .from("posts")
          .update({ google_event_id: null, calendar_synced_at: null })
          .eq("id", post.id)
          .eq("user_id", user.id);

        toast.success("Removido da Google Agenda.");
      } catch (err) {
        console.error("[useGoogleCalendar] remove", err);
        toast.error("Não foi possível remover da Google Agenda.");
      } finally {
        setSyncing(false);
      }
    },
    [user, getAccessToken, callSync],
  );

  return { syncPost, removeFromCalendar, syncing };
}
