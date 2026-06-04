import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'warning'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutHandles = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const clearToastTimeout = useCallback((id: string) => {
    const timeoutHandle = timeoutHandles.current.get(id)

    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandles.current.delete(id)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    clearToastTimeout(id)
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
  }, [clearToastTimeout])

  const showToast = useCallback((message: string, tone: ToastTone) => {
    const id = `${Date.now().toString()}-${Math.random().toString(36).slice(2, 6)}`
    const nextToast: ToastItem = { id, message, tone }

    setToasts((currentToasts) => {
      const toastsToKeep = currentToasts.length >= 3 ? currentToasts.slice(1) : currentToasts
      return [...toastsToKeep, nextToast]
    })

    const timeoutHandle = setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
      timeoutHandles.current.delete(id)
    }, 4000)

    timeoutHandles.current.set(id, timeoutHandle)
  }, [])

  useEffect(() => {
    return () => {
      timeoutHandles.current.forEach((timeoutHandle) => clearTimeout(timeoutHandle))
      timeoutHandles.current.clear()
    }
  }, [])

  return { toasts, showToast, dismissToast }
}
