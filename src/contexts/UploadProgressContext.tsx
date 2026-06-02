import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  fileName: string;
  pct: number;
  status: UploadStatus;
}

type Ctx = {
  uploads: UploadItem[];
  hasActive: boolean;
  startUpload: (id: string, fileName: string) => void;
  updateUpload: (id: string, pct: number) => void;
  finishUpload: (id: string, status: "done" | "error") => void;
};

const UploadProgressContext = createContext<Ctx | null>(null);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const startUpload = useCallback((id: string, fileName: string) => {
    setUploads((prev) => {
      // Idempotente: se o id já existe, reseta
      const without = prev.filter((u) => u.id !== id);
      return [...without, { id, fileName, pct: 0, status: "uploading" }];
    });
  }, []);

  const updateUpload = useCallback((id: string, pct: number) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, pct: Math.max(u.pct, Math.round(pct)) } : u)),
    );
  }, []);

  const finishUpload = useCallback((id: string, status: "done" | "error") => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, pct: 100, status } : u)));
    // Limpa o item depois de 4s pra o indicador sumir.
    window.setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.id !== id));
    }, 4000);
  }, []);

  const hasActive = useMemo(() => uploads.some((u) => u.status === "uploading"), [uploads]);

  // Aviso ao fechar a aba enquanto há upload ativo (browser mostra prompt nativo).
  useEffect(() => {
    if (!hasActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasActive]);

  const value = useMemo<Ctx>(
    () => ({ uploads, hasActive, startUpload, updateUpload, finishUpload }),
    [uploads, hasActive, startUpload, updateUpload, finishUpload],
  );

  return <UploadProgressContext.Provider value={value}>{children}</UploadProgressContext.Provider>;
}

export function useUploadProgress(): Ctx {
  const c = useContext(UploadProgressContext);
  if (!c) throw new Error("useUploadProgress must be used inside UploadProgressProvider");
  return c;
}
