/**
 * GET /api/brain/analyze/:candidateId
 * Returns the AI brain analysis for a single candidate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { candidatesDb } from '@/lib/db'
import { analyzeCandidateProfile } from '@/services/recruitmentBrain'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const { candidateId } = await params
  const candidate = await candidatesDb.findById(candidateId)

  if (!candidate) {
    return NextResponse.json({ error: 'מועמד לא נמצא' }, { status: 404 })
  }

  const analysis = analyzeCandidateProfile(candidate)

  return NextResponse.json({
    candidateId,
    ...analysis,
    // Expose reason as a flat field for the ConversationThread component
    reason: analysis.reasoning[0] ?? '',
  })
}
