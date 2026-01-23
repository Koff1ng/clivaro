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
  // Map size prop to SVG dimensions
  const dimensions = {
    sm: { width: 100, height: 26 },
    md: { width: 150, height: 40 },
    lg: { width: 200, height: 53 },
    xl: { width: 250, height: 66 },
  }

  const { width, height } = dimensions[size]

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 150 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-slate-900 dark:text-white" // Default colors
      >
        <path d="M30 20L25 11.34H15L10 20L15 28.66H25L30 20Z" stroke="#0EA5E9" strokeWidth="3" />
        <path d="M25 11.34L30 2.68H20L10 20L20 37.32H30L25 28.66" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {showText && (
          <text x="45" y="26" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="700" fill="currentColor">clivaro</text>
        )}
      </svg>
    </div>
  )
}

// Versión solo icono para favicon y uso compacto
export function LogoIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false)
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const iconSize = size === 'sm' ? 24 : size === 'md' ? 32 : 40

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0 relative`}>
      {!imgError ? (
        <Image
          src="/clivaro-logo.webp"
          alt="Clivaro"
          width={iconSize}
          height={iconSize}
          className="object-contain"
          priority
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 rounded" />
      )}
    </div>
  )
}
