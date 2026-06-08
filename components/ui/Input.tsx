'use client'
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  ltr?: boolean
}

export function Input({ label, error, ltr, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <input
        {...props}
        dir={ltr ? 'ltr' : 'rtl'}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors',
          'border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          'placeholder-gray-400 bg-white',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        {...props}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors resize-none',
          'border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          'placeholder-gray-400 bg-white',
          error && 'border-red-400',
          className
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, error, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <select
        {...props}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors bg-white',
          'border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          error && 'border-red-400',
          className
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
