import { Logo } from "@/components/shared/Logo";

type LoadingScreenProps = {
  label?: string;
  /** Dentro do app (entre uma página e outra) o loading não ocupa a tela
      inteira: fica na área de conteúdo. No boot inicial, sim. */
  compact?: boolean;
};

export function LoadingScreen({ label, compact = false }: LoadingScreenProps) {
  return (
    <div
      className={
        (compact ? "min-h-[55vh]" : "min-h-screen") +
        " bg-background flex flex-col items-center justify-center gap-4"
      }
    >
      <div className="animate-pulse">
        <Logo className="h-12 w-auto" />
      </div>
      {label && (
        <p className="text-sm text-muted-foreground font-body">{label}</p>
      )}
    </div>
  );
}
