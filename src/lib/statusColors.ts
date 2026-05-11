export const STATUS_COLORS: Record<string, string> = {
  ideia: "bg-sky/10 text-sky border-sky/20",
  roteiro: "bg-amber/10 text-amber border-amber/20",
  gravando: "bg-coral/10 text-coral border-coral/20",
  editando: "bg-rose/10 text-rose border-rose/20",
  agendado: "bg-primary/10 text-primary border-primary/20",
  publicado: "bg-teal/10 text-teal border-teal/20",
};

export function getStatusClasses(status: string | null | undefined): string {
  if (!status) return "bg-muted text-muted-foreground border-border";
  return STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border";
}
