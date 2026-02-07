'use client'

import { motion } from 'framer-motion'
import { Logo } from './logo'

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center gap-10"
      >
        <motion.div
          animate={{
            opacity: [1, 0.7, 1],
            scale: [1, 1.05, 1],
            filter: ["blur(0px)", "blur(0.5px)", "blur(0px)"]
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="relative"
        >
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 animate-pulse" />

          <Logo size="lg" className="w-64 h-auto relative z-10" />
        </motion.div>

        {/* Minimal Progress Bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
          <motion.div
            className="absolute inset-y-0 left-0 bg-blue-500/80 rounded-full"
            initial={{ width: "0%", left: "0%" }}
            animate={{
              width: ["0%", "50%", "0%"],
              left: ["0%", "50%", "100%"]
            }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity
            }}
          />
        </div>
      </motion.div>
    </div>
  )
}


