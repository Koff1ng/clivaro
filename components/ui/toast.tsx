'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react'
import { Button } from './button'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onClose(toast.id)
      }, toast.duration || 3000)
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onClose])

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertCircle,
  }

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }

  const Icon = icons[toast.type]

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border shadow-lg animate-slide-in ${colors[toast.type]}`}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-transparent"
        onClick={() => onClose(toast.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

let toastIdCounter = 0
const toasts: Toast[] = []
const listeners: Set<(toasts: Toast[]) => void> = new Set()

function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${++toastIdCounter}`
  const newToast = { ...toast, id }
  toasts.push(newToast)
  listeners.forEach(listener => listener([...toasts]))
  return id
}

function removeToast(id: string) {
  const index = toasts.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.splice(index, 1)
    listeners.forEach(listener => listener([...toasts]))
  }
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToastList(newToasts)
    }
    listeners.add(listener)
    listener([...toasts])
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const toast = (message: string, type: ToastType = 'info', duration?: number) => {
    return addToast({ message, type, duration })
  }

  return { toast, toasts: toastList }
}

export function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto animate-slide-in">
          <ToastItem toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  )
}

