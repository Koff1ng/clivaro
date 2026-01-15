export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-40 bg-muted animate-pulse rounded" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="h-10 w-40 bg-muted animate-pulse rounded" />
        <div className="h-10 w-56 bg-muted animate-pulse rounded" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="h-12 bg-muted/60" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse border-t" />
        ))}
      </div>
    </div>
  )
}


