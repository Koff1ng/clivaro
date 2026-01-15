export default function Loading() {
  return (
    <div className="min-h-screen p-6">
      <div className="space-y-6">
        <div className="h-8 w-56 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 bg-muted animate-pulse rounded" />
          <div className="h-28 bg-muted animate-pulse rounded" />
          <div className="h-28 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-80 bg-muted animate-pulse rounded" />
      </div>
    </div>
  )
}


