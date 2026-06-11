import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { AuthUser } from './types'
import { getStore } from './store'

// In production at runtime, JWT_SECRET must be set. Skip during next build phase.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  !process.env.JWT_SECRET
) {
  throw new Error('[auth] JWT_SECRET env var must be set in production. Set it in your Vercel dashboard or .env.local.')
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'demo-jwt-secret-merakzim-2024'
)
const COOKIE_NAME = 'merakzim_auth'

export async function signToken(payload: AuthUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthUser
  } catch {
    return null
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
}

export function isAdmin(user: AuthUser | null): user is Extract<AuthUser, { role: 'admin' }> {
  return user?.role === 'admin'
}

export function isCoordinator(user: AuthUser | null): user is Extract<AuthUser, { role: 'coordinator' }> {
  return user?.role === 'coordinator'
}

export function isManager(user: AuthUser | null): user is Extract<AuthUser, { role: 'manager' }> {
  return user?.role === 'manager'
}

export function isSecretary(user: AuthUser | null): user is Extract<AuthUser, { role: 'secretary' }> {
  return user?.role === 'secretary'
}

/** Returns true for any user with admin-level access (admin + manager + secretary + dept heads) */
export function hasAdminAccess(user: AuthUser | null): boolean {
  if (!user) return false
  return ['admin', 'manager', 'secretary', 'education_dept', 'factories_dept', 'operations_dept', 'branches_dept', 'hagshama_dept'].includes(user.role)
}

// Verify admin credentials
// IMPORTANT: ADMIN_PASSWORD must be a strong secret (min 12 chars) in production.
// A weak or default password will be rejected.
export function verifyAdminCredentials(email: string, password: string): boolean {
  // In production, ADMIN_EMAIL and ADMIN_PASSWORD must be explicitly configured.
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error('[auth] ADMIN_EMAIL and ADMIN_PASSWORD env vars must be set in production.')
    }
  }
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@demo.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
  const minLength = 8
  if (adminPassword.length < minLength) {
    console.error('[auth] ADMIN_PASSWORD is too short — must be at least 8 characters')
    return false
  }
  return email === adminEmail && password === adminPassword
}

// Hash a plain-text password for storage
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify coordinator credentials (stored in the in-memory store or Supabase)
// password_hash === 'demo' is accepted only in demo/dev mode (USE_SUPABASE=false).
export async function verifyCoordinatorCredentials(email: string, password: string) {
  const store = getStore()
  const coord = store.regional_coordinators.find(c => c.email === email)
  if (!coord || !coord.password_hash) return null
  // Legacy demo sentinel — only valid in demo mode (no real Supabase configured)
  if (coord.password_hash === 'demo') return coord
  const match = await bcrypt.compare(password, coord.password_hash)
  if (!match) return null
  // Fallback: if role column not yet added to DB, derive from notes field (temporary)
  if (!coord.role && coord.notes) {
    const validRoles = ['coordinator','garin_coordinator','manager','secretary','education_dept','factories_dept','operations_dept','branches_dept','hagshama_dept']
    if (validRoles.includes(coord.notes)) {
      return { ...coord, role: coord.notes as any }
    }
  }
  return coord
}

// Middleware helper
export async function requireAuth(req: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 })
  }
  return user
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUserFromRequest(req)
  if (!user || !hasAdminAccess(user)) {
    return NextResponse.json({ error: 'אין הרשאת מנהל' }, { status: 403 })
  }
  return user
}
