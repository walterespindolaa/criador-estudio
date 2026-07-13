import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { restaurarCache, iniciarPersistencia, limparCachePersistido } from "@/lib/queryPersist";

/**
 * Liga a persistência do cache ao ciclo de vida do login.
 * - logou     → reidrata o cache DAQUELE usuário e passa a salvar
 * - deslogou  → apaga o cache persistido (nada de dado de conta anterior no aparelho)
 */
export function CachePersistence() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const pararRef = useRef<(() => void) | null>(null);
  const usuarioRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    const id = user?.id ?? null;
    if (usuarioRef.current === id) return; // já configurado pra este usuário
    usuarioRef.current = id;

    pararRef.current?.();
    pararRef.current = null;

    if (!id) {
      void limparCachePersistido();
      return;
    }

    let cancelado = false;
    void restaurarCache(qc, id).then(() => {
      if (cancelado) return;
      pararRef.current = iniciarPersistencia(qc, id);
    });

    return () => {
      cancelado = true;
    };
  }, [qc, user?.id, loading]);

  useEffect(() => () => pararRef.current?.(), []);

  return null;
}
