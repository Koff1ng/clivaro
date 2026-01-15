'use client'

import { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function ScrollReveal({ children, delay = 0, className = '' }: ScrollRevealProps) {
  const { ref, isVisible, mounted } = useScrollReveal({ threshold: 0.1, triggerOnce: true })

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        mounted && isVisible
          ? 'opacity-100 translate-y-0'
          : mounted
          ? 'opacity-0 translate-y-8'
          : 'opacity-100 translate-y-0'
      } ${className}`}
      style={{ transitionDelay: mounted ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

