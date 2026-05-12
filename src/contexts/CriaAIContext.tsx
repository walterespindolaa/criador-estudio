import { createContext, useContext, useState, type ReactNode } from "react";

type CriaAIContextValue = {
  open: boolean;
  openCria: (initialPrompt?: string) => void;
  closeCria: () => void;
  initialPrompt: string | null;
  consumeInitialPrompt: () => string | null;
};

const CriaAIContext = createContext<CriaAIContextValue | null>(null);

export function CriaAIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const openCria = (prompt?: string) => {
    if (prompt) setInitialPrompt(prompt);
    setOpen(true);
  };

  const closeCria = () => setOpen(false);

  const consumeInitialPrompt = () => {
    const p = initialPrompt;
    setInitialPrompt(null);
    return p;
  };

  return (
    <CriaAIContext.Provider value={{ open, openCria, closeCria, initialPrompt, consumeInitialPrompt }}>
      {children}
    </CriaAIContext.Provider>
  );
}

export function useCriaAI() {
  const ctx = useContext(CriaAIContext);
  if (!ctx) throw new Error("useCriaAI must be used inside CriaAIProvider");
  return ctx;
}
