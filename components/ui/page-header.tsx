import { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type PageHeaderBreadcrumb = {
  label: ReactNode
  href?: string
}

export function PageHeader({
  title,
  description,
  icon,
  breadcrumbs,
  badges,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  breadcrumbs?: PageHeaderBreadcrumb[]
  badges?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4',
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {!!breadcrumbs?.length && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
              {breadcrumbs.map((b, idx) => (
                <li key={idx} className="flex items-center min-w-0">
                  {idx > 0 && <span className="mx-1 opacity-50">/</span>}
                  {b.href ? (
                    <Link href={b.href} className="hover:text-foreground transition-colors truncate">
                      {b.label}
                    </Link>
                  ) : (
                    <span className="text-foreground/80 truncate">{b.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm md:text-base mt-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {(badges || actions) && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end mt-4 md:mt-0">
          {badges}
          {actions}
        </div>
      )}
    </div>
  )
}


