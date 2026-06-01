import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const LS_KEY = "cria_video_public_ok";

type ConfirmFn = () => Promise<boolean>;

const VideoPublicConfirmContext = createContext<ConfirmFn | null>(null);

export function VideoPublicConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(() => {
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "1") {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDontAsk(false);
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    if (dontAsk) {
      try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
    }
    resolveRef.current?.(true);
    resolveRef.current = null;
    setOpen(false);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setOpen(false);
  };

  return (
    <VideoPublicConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Tornar vídeo acessível?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Pra esse vídeo aparecer dentro do cria, ele vai ficar com link público no Google Drive — qualquer pessoa com o link consegue ver. Pode ser?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="dont-ask-video-public"
              checked={dontAsk}
              onCheckedChange={(v) => setDontAsk(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="dont-ask-video-public" className="text-xs font-body text-muted-foreground cursor-pointer">
              Não perguntar de novo
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VideoPublicConfirmContext.Provider>
  );
}

export function useVideoPublicConfirm(): ConfirmFn {
  const fn = useContext(VideoPublicConfirmContext);
  if (!fn) throw new Error("useVideoPublicConfirm must be used inside VideoPublicConfirmProvider");
  return fn;
}
