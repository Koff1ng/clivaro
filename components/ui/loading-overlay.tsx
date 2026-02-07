'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Logo } from './logo'

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message = 'Enviando...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 min-w-[320px] border border-gray-200/50 dark:border-gray-800/50">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [1, 0.8, 1]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity
          }}
          className="relative flex items-center justify-center p-4"
        >
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
          <Logo size="md" className="relative z-10 w-48 h-auto" />
        </motion.div>

        <div className="text-center space-y-3">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-200">{message}</p>
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{
                  y: ["0%", "-50%", "0%"],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.15
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

