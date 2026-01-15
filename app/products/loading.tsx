export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      </div>
      <div className="h-10 w-full max-w-md bg-muted animate-pulse rounded" />
      <div className="border rounded-lg overflow-hidden">
        <div className="h-12 bg-muted/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse border-t" />
        ))}
      </div>
    </div>
  )
}


