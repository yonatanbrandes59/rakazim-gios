'use client'
import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'green' | 'blue' | 'yellow' | 'red' | 'orange' | 'purple' | 'gray'
  className?: string
}

const VARIANTS = {
  default: 'bg-gray-100 text-gray-700',
  green:   'bg-green-100 text-green-800',
  blue:    'bg-blue-100 text-blue-800',
  yellow:  'bg-yellow-100 text-yellow-800',
  red:     'bg-red-100 text-red-800',
  orange:  'bg-orange-100 text-orange-800',
  purple:  'bg-purple-100 text-purple-800',
  gray:    'bg-gray-100 text-gray-600',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
