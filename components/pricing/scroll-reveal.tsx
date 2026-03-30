'use client'

import { ReactNode, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right'
}

export function ScrollReveal({ children, delay = 0, className = '', direction = 'up' }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' })

  const directionMap = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
  }

  const offset = directionMap[direction]

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: offset.y,
        x: offset.x,
        filter: 'blur(6px)',
      }}
      animate={isInView ? {
        opacity: 1,
        y: 0,
        x: 0,
        filter: 'blur(0px)',
      } : {
        opacity: 0,
        y: offset.y,
        x: offset.x,
        filter: 'blur(6px)',
      }}
      transition={{
        duration: 0.65,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: delay / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
