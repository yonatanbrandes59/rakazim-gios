import { NextRequest, NextResponse } from 'next/server'
import {
  signToken, verifyAdminCredentials, verifyCoordinatorCredentials,
  getAuthUserFromRequest, setAuthCookie, clearAuthCookie
} from '@/lib/auth'

// ── In-memory brute-force protection ─────────────────────────────────────────
// Max 10 failed attempts per IP within a 15-minute window.
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

interface AttemptRecord { count: number; windowStart: number }
const loginAttempts = new Map<string, AttemptRecord>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (rec.count >= RATE_LIMIT_MAX) return false
  rec.count += 1
  return true
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip)
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות.' },
      { status: 429 }
    )
  }

  const { email, password } = await req.json()

  // Try admin — verifyAdminCredentials throws in production when env vars are missing
  let adminOk = false
  try {
    adminOk = verifyAdminCredentials(email, password)
  } catch (err) {
    console.error('[auth] verifyAdminCredentials threw:', err)
    return NextResponse.json({ error: 'שגיאת תצורת שרת' }, { status: 500 })
  }

  if (adminOk) {
    resetRateLimit(ip)
    const token = await signToken({ id: 'admin', email, role: 'admin' })
    const res = NextResponse.json({ ok: true, role: 'admin', email })
    setAuthCookie(res, token)
    return res
  }

  // Try coordinator
  const coord = await verifyCoordinatorCredentials(email, password)
  if (coord) {
    resetRateLimit(ip)
    const token = await signToken({ id: coord.id, name: coord.name, region: coord.region, role: 'coordinator' })
    const res = NextResponse.json({ ok: true, role: 'coordinator', name: coord.name, region: coord.region })
    setAuthCookie(res, token)
    return res
  }

  return NextResponse.json({ error: 'אימייל או סיסמה שגויים' }, { status: 401 })
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearAuthCookie(res)
  return res
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req)
  if (!user) return NextResponse.json({ loggedIn: false })
  return NextResponse.json({ loggedIn: true, ...user })
}
