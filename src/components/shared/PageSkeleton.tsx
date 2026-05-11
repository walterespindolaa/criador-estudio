export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div>
          <div className="h-6 w-48 bg-muted rounded-lg" />
          <div className="h-3 w-32 bg-muted/60 rounded-lg mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted/50" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-muted/40" />
    </div>
  );
}
