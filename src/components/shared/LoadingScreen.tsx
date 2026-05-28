import { Logo } from "@/components/shared/Logo";

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <Logo className="h-12 w-auto" />
      </div>
      {label && (
        <p className="text-sm text-muted-foreground font-body">{label}</p>
      )}
    </div>
  );
}
