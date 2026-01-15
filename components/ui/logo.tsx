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
  
  // Tamaños ajustados para mejor visualización en el sidebar
  const logoDimensions = {
    sm: { width: 160, height: 60 },  // Sidebar: tamaño más compacto
    md: { width: 240, height: 160 },  // Header: 240 × 160
    lg: { width: 360, height: 240 },  // Login: 360 × 240
    xl: { width: 400, height: 267 },  // Extra large manteniendo 3:2
  }

  const dimensions = logoDimensions[size]

  return (
    <div className={`flex flex-col items-center justify-center ${className}`} style={{ padding: 0, margin: 0 }}>
      <div 
        className="relative flex-shrink-0" 
        style={{ 
          width: `${dimensions.width}px`, 
          height: `${dimensions.height}px`,
          minWidth: `${dimensions.width}px`,
          minHeight: `${dimensions.height}px`,
          padding: 0,
          margin: 0
        }}
      >
        {!imgError ? (
          <Image
            src="/clivaro-logo.webp"
            alt="Clivaro Logo"
            width={dimensions.width}
            height={dimensions.height}
            className="object-contain"
            priority
            unoptimized
            onError={() => setImgError(true)}
            style={{ 
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              maxWidth: `${dimensions.width}px`,
              maxHeight: `${dimensions.height}px`
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500">
            Logo
          </div>
        )}
      </div>
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
