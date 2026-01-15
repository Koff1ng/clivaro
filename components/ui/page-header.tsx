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
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4', className)}>
      <div className="min-w-0">
        {!!breadcrumbs?.length && (
          <nav aria-label="Breadcrumb" className="mb-2">
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

        <div className="flex items-center gap-3">
          {icon && (
            <div className="h-10 w-10 rounded-xl border bg-background/80 shadow-sm flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
      </div>

      {(badges || actions) && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {badges}
          {actions}
        </div>
      )}
    </div>
  )
}


