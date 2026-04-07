import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DriveConnection {
  id: string;
  google_email: string;
  google_name: string | null;
  connected_at: string;
}

export function useGoogleDriveConnection() {
  const { user, session } = useAuth();
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    try {
      const { data } = await supabase.functions.invoke("google-drive-connect", {
        body: { action: "status" },
      });
      setConnection(data?.connection || null);
    } catch { /* ignore */ }
    setLoading(false);
  }, [session]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const connect = async (accessToken: string) => {
    const { data } = await supabase.functions.invoke("google-drive-connect", {
      body: { action: "connect", access_token: accessToken },
    });
    if (data?.connection) setConnection(data.connection);
    return data?.connection;
  };

  const disconnect = async () => {
    await supabase.functions.invoke("google-drive-connect", {
      body: { action: "disconnect" },
    });
    setConnection(null);
  };

  return { connection, loading, connect, disconnect, refetch: fetchStatus };
}
