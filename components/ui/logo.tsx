'use client'

import React, { useState } from 'react'
import Image from 'next/image'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showByline?: boolean
}

export function Logo({ className = '', showText = true, size = 'md', showByline = false }: LogoProps) {
  const [imgError, setImgError] = useState(false)

  // Map size prop to dimensions suitable for the PNG (aspect ratio approx 3.33)
  const dimensions = {
    sm: { width: 120, height: 36 },
    md: { width: 160, height: 48 },
    lg: { width: 220, height: 66 },
    xl: { width: 280, height: 84 },
  }

  const { width, height } = dimensions[size]

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {!imgError ? (
        <Image
          src="/clivaro-gradient.png"
          alt="Clivaro"
          width={width}
          height={height}
          className="object-contain dark:brightness-200 dark:contrast-50"
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
        // Trying to center the "C" icon from the full logo using object-position
        // The logo is roughly: [Icon] [Text]
        // Icon takes up left ~25%
        <Image
          src="/clivaro-gradient.png"
          alt="Clivaro"
          width={iconSize * 4} // Load larger to crop
          height={iconSize}
          className="object-cover object-left dark:brightness-200 dark:contrast-50"
          style={{ objectPosition: 'left center' }}
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
