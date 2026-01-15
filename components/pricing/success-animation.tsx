'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface SuccessAnimationProps {
  onClose: () => void
}

export function SuccessAnimation({ onClose }: SuccessAnimationProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setShow(true), 100)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4 transform transition-all duration-500 ${
          show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
          {/* Animated Checkmark */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Success Icon with Animation */}
            <div className="relative">
              {/* Outer ring animation */}
              <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/30 animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-0 rounded-full bg-green-200 dark:bg-green-800/30 animate-pulse" style={{ animationDuration: '2s' }}></div>
              
              {/* Minimalist animated checkmark */}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    className="animate-draw-check"
                    style={{
                      strokeDasharray: 24,
                      strokeDashoffset: 24,
                      animation: 'drawCheck 0.6s ease-out forwards',
                    }}
                  />
                </svg>
              </div>
            </div>

          {/* Success Message */}
          <div className="text-center space-y-3">
            <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
              ¡Solicitud Enviada!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
              En breve nos contactaremos contigo
            </p>
          </div>

          {/* Minimalist animated dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
            </div>
          </div>

          {/* Info Text */}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
            Revisa tu correo electrónico, te enviaremos más información pronto
          </p>

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold"
          >
            Entendido
          </Button>
        </div>

      </div>
    </div>
  )
}

