import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { messagesDb, templatesDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const candidateId = req.nextUrl.searchParams.get('candidate_id') ?? undefined
  const messages = await messagesDb.findAll({ status, candidate_id: candidateId })
  return NextResponse.json(messages)
}
