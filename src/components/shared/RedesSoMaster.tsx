import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";

/* Recurso em teste interno (Walter, 03/11/2026): só o master carrega.
   O código da tela vem num pedaço separado, baixado só pra conta admin;
   pra todo o resto do app este componente não renderiza nem baixa nada. */
const Painel = lazy(() => import("@/components/shared/PublicarNasRedes").then((m) => ({ default: m.PublicarNasRedes })));

export function RedesSoMaster(props: { postId: string; legenda?: string | null; titulo?: string | null; plataforma?: string | null }) {
  const { profile } = useProfile();
  if (profile?.role !== "admin") return null;
  return <Suspense fallback={null}><Painel {...props} /></Suspense>;
}
