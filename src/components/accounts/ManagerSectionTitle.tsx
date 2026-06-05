export function ManagerSectionTitle({ t, s }: { t: string; s?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">{t}</h1>
      {s && <p className="text-sm text-muted-foreground font-body mt-1">{s}</p>}
    </div>
  );
}
