/**
 * Returns the base URL of the app:
 *  1. NEXT_PUBLIC_APP_URL  — set explicitly in Vercel env vars (highest priority)
 *  2. VERCEL_URL           — injected automatically by Vercel on every deployment
 *  3. http://localhost:3000 — local dev only
 *
 * This is server-side only. Client-side components use window.location.origin.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`
  }
  return 'http://localhost:3000'
}
