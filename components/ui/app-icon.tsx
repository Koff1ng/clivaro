import { cn } from '@/lib/utils'
import type { SVGProps, ComponentType } from 'react'

interface AppIconProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  size?: 16 | 18 | 20 | 24
  className?: string
}

export function AppIcon({ icon: Icon, size = 20, className }: AppIconProps) {
  const dimension = `${size}px`
  return (
    <Icon
      className={cn('flex-shrink-0 text-muted-foreground', className)}
      width={dimension}
      height={dimension}
      strokeWidth={1.7}
    />
  )
}


