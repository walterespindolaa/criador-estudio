export function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="h-4 w-72 max-w-full rounded-lg bg-muted/70" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
