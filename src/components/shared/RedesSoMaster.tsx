import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";

/* Painel "Publicar também em" (LinkedIn, YouTube, TikTok). Nasceu só pro
   master (03/11/2026). Desde 25/11/2026 o LinkedIn é de todo mundo ("linkedin
   acho que ja da pra liberar pra todos"); YouTube e TikTok seguem só pro
   master, e quem filtra as abas é o próprio painel (redeLiberada). O código
   continua num pedaço separado, baixado só quando o editor abre. */
const Painel = lazy(() => import("@/components/shared/PublicarNasRedes").then((m) => ({ default: m.PublicarNasRedes })));

export function RedesSoMaster(props: { postId: string; legenda?: string | null; titulo?: string | null; plataforma?: string | null; aoVivo?: { data: string | null; hora: string | null }; antesDeAgir?: () => Promise<void> }) {
  const { profile } = useProfile();
  if (!profile) return null;
  return <Suspense fallback={null}><Painel {...props} /></Suspense>;
}
