import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function EditorialSection({ children }: Props) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Linha Editorial</h2>
          <p className="text-sm text-muted-foreground font-body">Defina a essência do seu conteúdo.</p>
        </div>
      </div>
      {children}
    </>
  );
}
