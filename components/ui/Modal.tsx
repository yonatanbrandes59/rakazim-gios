'use client'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

interface ModalProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const visible = open ?? isOpen ?? false
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', handler)
      return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={cn('relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto', SIZES[size])}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
