import { clsx, type ClassValue } from 'clsx'
import { addDays, addWeeks, parseISO, format } from 'date-fns'
import { he } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date | undefined | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, fmt, { locale: he })
  } catch {
    return String(date)
  }
}

export function formatDateTime(date: string | Date | undefined | null): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm')
}

export function addBusinessDays(date: Date, days: number): Date {
  return addDays(date, days)
}

// Create a WhatsApp wa.me link with pre-filled message
export function createWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const intl = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : cleaned
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

// Fill template variables
export function fillTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined && val !== null ? String(val) : `{${key}}`
  })
}

// Generate a URL-safe token
export function generateToken(prefix = ''): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const random = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return prefix ? `${prefix}-${random}` : random
}

// Normalise Israeli phone number to display format
export function normalisePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('0')) {
    return `${d.slice(0, 3)}-${d.slice(3)}`
  }
  return phone
}

// Compute recommended contact date based on availability answers
export function computeContactDate(candidate: {
  looking_for_work?: string
  release_date?: string
  trip_return_date?: string
  studies_end_date?: string
  best_time_to_contact?: string
}): { date: string | null; interestLevel: string } {
  const today = new Date()
  const release = candidate.release_date ? parseISO(candidate.release_date) : null

  const lfw = candidate.looking_for_work

  if (lfw === 'now') {
    return { date: today.toISOString().split('T')[0], interestLevel: 'very_hot' }
  }

  if (lfw === 'one_two_months') {
    return { date: addWeeks(today, 5).toISOString().split('T')[0], interestLevel: 'interested' }
  }

  if (lfw === 'after_trip') {
    const tripReturn = candidate.trip_return_date ? parseISO(candidate.trip_return_date) : addDays(release ?? today, 30)
    return { date: addWeeks(tripReturn, 1).toISOString().split('T')[0], interestLevel: 'keep_warm' }
  }

  if (lfw === 'after_psychometric') {
    const studiesEnd = candidate.studies_end_date ? parseISO(candidate.studies_end_date) : addDays(today, 90)
    return { date: addWeeks(studiesEnd, 1).toISOString().split('T')[0], interestLevel: 'future' }
  }

  if (lfw === 'not_looking') {
    return { date: null, interestLevel: 'not_relevant_now' }
  }

  // Release-date based logic
  if (release) {
    const daysUntilRelease = Math.floor((release.getTime() - today.getTime()) / 86400000)

    if (daysUntilRelease <= 30) {
      return { date: today.toISOString().split('T')[0], interestLevel: 'very_hot' }
    }
    if (daysUntilRelease <= 90) {
      return { date: addDays(release, -30).toISOString().split('T')[0], interestLevel: 'keep_warm' }
    }
    if (daysUntilRelease <= 180) {
      return { date: addDays(release, -60).toISOString().split('T')[0], interestLevel: 'future' }
    }
    return { date: addDays(release, -90).toISOString().split('T')[0], interestLevel: 'future' }
  }

  // Fallback
  return { date: addWeeks(today, 2).toISOString().split('T')[0], interestLevel: 'needs_explanation' }
}

export function isWithinSendingHours(date: Date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= 9 && hour < 20
}

export function nextSendingWindow(date: Date = new Date()): Date {
  const hour = date.getHours()
  if (hour < 9) {
    const next = new Date(date)
    next.setHours(9, 0, 0, 0)
    return next
  }
  if (hour >= 20) {
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    next.setHours(9, 0, 0, 0)
    return next
  }
  return date
}
