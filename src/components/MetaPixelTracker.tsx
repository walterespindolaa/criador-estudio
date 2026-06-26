import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initMetaPixel, trackPageView } from "@/lib/metaPixel";

/** Inicializa o Meta Pixel e dispara PageView a cada mudança de rota (SPA). */
export default function MetaPixelTracker() {
  const location = useLocation();
  useEffect(() => { initMetaPixel(); }, []);
  useEffect(() => { trackPageView(); }, [location.pathname]);
  return null;
}
