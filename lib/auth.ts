import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AuthUser } from './types'
import { getStore } from './store'

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

// Verify admin credentials
export function verifyAdminCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@demo.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
  return email === adminEmail && password === adminPassword
}

// Verify coordinator credentials (stored in the in-memory store or Supabase)
export function verifyCoordinatorCredentials(email: string, password: string) {
  const store = getStore()
  const coord = store.regional_coordinators.find(
    c => c.email === email && (c.password_hash === password || c.password_hash === 'demo')
  )
  return coord ?? null
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
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'אין הרשאת מנהל' }, { status: 403 })
  }
  return user
}
