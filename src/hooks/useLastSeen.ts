import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function useLastSeen() {
  const { user } = useAuth();
  const lastCallRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    const touch = async () => {
      const now = Date.now();
      if (now - lastCallRef.current < TOUCH_INTERVAL_MS) return;
      lastCallRef.current = now;

      const { error } = await supabase.rpc("touch_last_seen");
      if (error) {
        console.warn("[useLastSeen] touch_last_seen failed:", error.message);
      }
    };

    touch();

    const onVisibility = () => {
      if (document.visibilityState === "visible") touch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") touch();
    }, TOUCH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [user]);
}
