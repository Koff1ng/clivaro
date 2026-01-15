export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-44 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-80 bg-muted animate-pulse rounded" />
        <div className="h-80 bg-muted animate-pulse rounded" />
      </div>
      <div className="h-72 bg-muted animate-pulse rounded" />
    </div>
  )
}


