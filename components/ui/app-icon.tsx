import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppIconProps {
  icon: LucideIcon
  size?: 16 | 18 | 20 | 24
  className?: string
}

export function AppIcon({ icon: Icon, size = 20, className }: AppIconProps) {
  const dimension = `${size}px`
  return (
    <Icon
      className={cn('flex-shrink-0 text-muted-foreground', className)}
      style={{ width: dimension, height: dimension }}
      strokeWidth={1.7}
    />
  )
}


