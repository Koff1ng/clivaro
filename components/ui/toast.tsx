'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'

/* ─── Types ─── */
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  title?: string
  type: ToastType
  duration?: number
}

/* ─── Style Maps ─── */
const accentColors: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
}

const iconBgColors: Record<ToastType, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
}

const progressColors: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
}

const defaultTitles: Record<ToastType, string> = {
  success: '¡Éxito!',
  error: 'Error',
  info: 'Información',
  warning: 'Advertencia',
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

/* ─── Individual Toast ─── */
interface ToastItemProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const duration = toast.duration ?? 4000
  const Icon = icons[toast.type]

  useEffect(() => {
    if (duration === 0) return
    const timer = setTimeout(() => onClose(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onClose])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9, filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 80, scale: 0.9, filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-black/8 dark:shadow-black/30 pointer-events-auto max-w-sm w-full"
      role="alert"
    >
      {/* Left Accent Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColors[toast.type]} rounded-l-xl`} />

      {/* Content */}
      <div className="flex items-start gap-3 p-4 pl-5">
        {/* Icon */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconBgColors[toast.type]}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
            {toast.title || defaultTitles[toast.type]}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => onClose(toast.id)}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="h-[3px] bg-slate-100 dark:bg-slate-800">
          <motion.div
            className={`h-full ${progressColors[toast.type]} rounded-full`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  )
}

/* ─── Global Toast Store ─── */
let toastIdCounter = 0
const toastStore: Toast[] = []
const listeners: Set<(toasts: Toast[]) => void> = new Set()

function notify() {
  listeners.forEach(l => l([...toastStore]))
}

function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${++toastIdCounter}`
  const newToast = { ...toast, id }
  toastStore.push(newToast)
  notify()
  return id
}

function removeToast(id: string) {
  const index = toastStore.findIndex(t => t.id === id)
  if (index > -1) {
    toastStore.splice(index, 1)
    notify()
  }
}

/* ─── Hook ─── */
export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToastList(newToasts)
    listeners.add(listener)
    listener([...toastStore])
    return () => { listeners.delete(listener) }
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      return addToast({ message, type, duration })
    },
    []
  )

  return { toast, toasts: toastList }
}

/* ─── Container ─── */
export function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
