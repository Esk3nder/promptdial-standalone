import { useState, useCallback } from 'react'
import type { ToastProps } from '@/components/Toast'

export interface ToastOptions {
  message: string
  type?: ToastProps['type']
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([])

  const addToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: Omit<ToastProps, 'onClose'> = {
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration !== undefined ? options.duration : 5000,
    }
    
    setToasts(prev => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'success', duration })
  }, [addToast])

  const error = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'error', duration })
  }, [addToast])

  const warning = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'warning', duration })
  }, [addToast])

  const info = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'info', duration })
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  }
}