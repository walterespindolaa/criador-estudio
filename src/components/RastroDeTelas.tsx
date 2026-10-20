import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/* RASTRO DE TELAS (Walter, 20/10/2026: "ver a última entrada, o que mais
   acessou"). Cada vez que a pessoa ENTRA num módulo do app (/app/<módulo> ou
   /socialmidia/<módulo>), soma 1 em uso_telas daquele dia. Trocar de aba dentro
   do mesmo módulo não conta de novo. É só contador por dia: não guarda URL,
   cliente, nem nada do que está na tela. Falha em silêncio. */
const BASES = ["/app/", "/socialmidia/"];

export function moduloDaRota(pathname: string): string | null {
  const base = BASES.find((b) => pathname.startsWith(b));
  if (!base) return null;
  const seg = pathname.slice(base.length).split("/")[0]?.trim().toLowerCase();
  if (!seg || seg === "obrigado" || seg === "trocar-senha") return null;
  return seg.slice(0, 40);
}

export function RastroDeTelas() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { ultimo.current = null; return; }
    const modulo = moduloDaRota(pathname);
    if (!modulo || modulo === ultimo.current) return;
    ultimo.current = modulo;
    // Promise.resolve: o retorno do rpc é "thenable", sem .catch próprio.
    void Promise.resolve(
      (supabase.rpc as unknown as (fn: string, args: unknown) => PromiseLike<unknown>)("registrar_tela", { _modulo: modulo }),
    ).catch(() => { /* contador não pode atrapalhar ninguém */ });
  }, [pathname, user]);

  return null;
}
