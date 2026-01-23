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
        viewBox="0 0 200 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-slate-900 dark:text-white"
      >
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;500&display=swap');
            .logo-text { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; fill: #1B365D; }
            .tagline { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; fill: #64748B; }
          `}
        </style>
        <g transform="translate(5, 8) scale(0.85)">
          <path d="M30 0L10 15V45L30 60" stroke="#1B365D" strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M30 15L22 21V39L30 45" stroke="#1B365D" strokeWidth="3" strokeLinecap="butt" />
          <path d="M30 0H45L55 10" stroke="#374151" strokeWidth="8" strokeLinecap="square" />
          <path d="M30 60H45L55 50" stroke="#374151" strokeWidth="8" strokeLinecap="square" />
        </g>
        {showText && (
          <>
            <text x="65" y="38" className="logo-text" fontSize="32" letterSpacing="-0.8">clivaro</text>
            <text x="66" y="53" className="tagline" fontSize="10" letterSpacing="0.5">by clientum studio</text>
          </>
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
