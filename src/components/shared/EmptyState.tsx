import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  gradient?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  gradient = "from-primary to-purple-600",
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl bg-gradient-to-br mx-auto mb-4 flex items-center justify-center",
          gradient
        )}
      >
        <Icon className="h-7 w-7 text-white" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-display font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground font-body max-w-xs mx-auto">{description}</p>
      {action && (
        <Button variant="hero" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
