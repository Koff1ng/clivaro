'use client'

import { motion } from 'framer-motion'
import { Plus, LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EmptyTableStateProps {
  /** Icon to display */
  icon: LucideIcon
  /** Title text */
  title: string
  /** Description text */
  description: string
  /** CTA button label */
  actionLabel: string
  /** Route to navigate on CTA click, OR callback function */
  onAction: string | (() => void)
  /** Optional secondary action */
  secondaryLabel?: string
  secondaryAction?: string | (() => void)
}

export function EmptyTableState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  secondaryAction,
}: EmptyTableStateProps) {
  const router = useRouter()

  const handlePrimary = () => {
    if (typeof onAction === 'string') {
      router.push(onAction)
    } else {
      onAction()
    }
  }

  const handleSecondary = () => {
    if (!secondaryAction) return
    if (typeof secondaryAction === 'string') {
      router.push(secondaryAction)
    } else {
      secondaryAction()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Icon container with gradient ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="relative mb-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-sm border border-slate-200/60 dark:border-slate-700/60">
          <Icon className="w-9 h-9 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center max-w-sm"
      >
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">
          {title}
        </h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          {description}
        </p>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={handlePrimary}
          className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </motion.button>

        {secondaryLabel && secondaryAction && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSecondary}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            {secondaryLabel}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  )
}
