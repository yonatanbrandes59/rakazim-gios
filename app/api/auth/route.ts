import { NextRequest, NextResponse } from 'next/server'
import {
  signToken, verifyAdminCredentials, verifyCoordinatorCredentials,
  getAuthUserFromRequest, setAuthCookie, clearAuthCookie
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  // Try admin
  if (verifyAdminCredentials(email, password)) {
    const token = await signToken({ id: 'admin', email, role: 'admin' })
    const res = NextResponse.json({ ok: true, role: 'admin', email })
    setAuthCookie(res, token)
    return res
  }

  // Try coordinator
  const coord = verifyCoordinatorCredentials(email, password)
  if (coord) {
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
