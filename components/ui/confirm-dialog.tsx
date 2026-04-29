'use client'

import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  /** Visual style of the confirm button. */
  variant?: 'default' | 'danger'
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

/**
 * Hook providing an imperative replacement for the browser's `confirm()`.
 *
 * Usage:
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirm()
 * // ... render <ConfirmDialog /> once at the root of your component
 * const ok = await confirm({ title: '¿Eliminar?', variant: 'danger' })
 * if (ok) doDangerousThing()
 * ```
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  // Keep the latest resolver so the Dialog's onOpenChange can reject the
  // promise even if the consumer's component re-renders between calls.
  const pendingRef = useRef<PendingConfirm | null>(null)
  pendingRef.current = pending

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const handleResolve = useCallback((value: boolean) => {
    const current = pendingRef.current
    if (current) {
      current.resolve(value)
    }
    setPending(null)
  }, [])

  const ConfirmDialog = useCallback(() => {
    const open = pending !== null
    const variant = pending?.variant ?? 'default'

    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleResolve(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {variant === 'danger' && (
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle>{pending?.title ?? ''}</DialogTitle>
                {pending?.description && (
                  <DialogDescription className="mt-1">{pending.description}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleResolve(false)}>
              {pending?.cancelText ?? 'Cancelar'}
            </Button>
            <Button
              onClick={() => handleResolve(true)}
              className={cn(
                variant === 'danger' && 'bg-red-600 hover:bg-red-700 text-white',
              )}
            >
              {pending?.confirmText ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }, [pending, handleResolve])

  return { confirm, ConfirmDialog }
}
