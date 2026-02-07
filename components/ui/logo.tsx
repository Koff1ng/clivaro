'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showByline?: boolean
}

export function Logo({ className = '', showText = true, size = 'md', showByline = false }: LogoProps) {
  const [imgError, setImgError] = useState(false)

  // Map size prop to dimensions suitable for the new logo (Optimized Brand Prominence)
  const dimensions = {
    sm: { width: 140, height: 48 },
    md: { width: 220, height: 80 },
    lg: { width: 1000, height: 320 }, // Optimized for clarity
    xl: { width: 1400, height: 450 },
  }

  const { width, height } = dimensions[size]

  return (
    <div className={cn(
      "flex items-center",
      size === 'sm' && !className.includes('h-') && "h-12",
      size === 'md' && !className.includes('h-') && "h-16",
      size === 'lg' && !className.includes('h-') && "h-40",
      size === 'xl' && !className.includes('h-') && "h-56",
      className
    )}>
      {!imgError ? (
        <Image
          src="/LOGO FINAL.svg"
          alt="Clivaro"
          width={width}
          height={height}
          className="object-contain max-h-full w-auto"
          priority
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-bold text-xl">clivaro</span>
      )}
    </div>
  )
}

// Versión solo icono para favicon y uso compacto
export function LogoIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false)
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  }

  const iconSize = size === 'sm' ? 32 : size === 'md' ? 40 : 56

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0 relative overflow-hidden flex items-center justify-center`}>
      {!imgError ? (
        <Image
          src="/clivaro-logo-new.png"
          alt="Clivaro"
          width={iconSize * 2} // Slightly larger to allow some focus on the "C"
          height={iconSize * 2}
          className="object-contain max-h-full w-auto"
          priority
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-blue-500 rounded-full" />
      )}
    </div>
  )
}
