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
    sm: { width: 140, height: 42 },
    md: { width: 200, height: 60 },
    lg: { width: 260, height: 78 },
    xl: { width: 300, height: 90 },
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

            /* Dark mode overrides (applied if parent has 'dark' class or context) */
            .dark .logo-text { fill: #F8FAFC; }
            .dark .tagline { fill: #94A3B8; }
          `}
        </style>
        <g transform="translate(5, 8) scale(0.85)">
          <path d="M30 0L10 15V45L30 60" stroke="#1B365D" strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter" className="dark:stroke-white" />
          <path d="M30 15L22 21V39L30 45" stroke="#1B365D" strokeWidth="3" strokeLinecap="butt" className="dark:stroke-white" />

          <path d="M30 0H45L55 10" stroke="#374151" strokeWidth="8" strokeLinecap="square" className="dark:stroke-slate-400" />
          <path d="M30 60H45L55 50" stroke="#374151" strokeWidth="8" strokeLinecap="square" className="dark:stroke-slate-400" />
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
  const sizeClasses = {
    sm: 24,
    md: 32,
    lg: 48,
  }

  const width = sizeClasses[size]
  const height = width

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg width={width} height={height} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0, 0)">
          <path d="M30 0L10 15V45L30 60" stroke="#1B365D" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-white" />
          <path d="M30 15L22 21V39L30 45" stroke="#1B365D" strokeWidth="3" strokeLinecap="round" className="dark:stroke-white" />
          <path d="M30 0H45L55 10" stroke="#0EA5E9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 60H45L55 50" stroke="#0EA5E9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}
