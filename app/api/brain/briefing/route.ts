/**
 * GET /api/brain/briefing
 * Returns a daily briefing with ranked priority candidates and their brain analyses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { candidatesDb } from '@/lib/db'
import { generateDailyBriefing, analyzeCandidateProfile, rankCandidates } from '@/services/recruitmentBrain'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const candidates = await candidatesDb.findAll()

  // Only include candidates who are not opted out and have an active status
  const active = candidates.filter(c => !c.opt_out && c.status !== 'not_relevant' && c.status !== 'not_interested')
  const ranked = rankCandidates(active)
  const briefing = generateDailyBriefing(ranked)

  // Build the rich response with per-candidate analysis for the UI table
  const rankedCandidates = ranked.slice(0, 20).map(candidate => {
    const analysis = analyzeCandidateProfile(candidate)
    return {
      candidate,
      analysis: {
        candidateId: candidate.id,
        score: candidate.fit_score ?? 0,
        priority: analysis.priority,
        recommendedAction: analysis.nextAction,
        suggestedMessage: analysis.suggestedMessage,
        urgencyScore: analysis.urgencyScore,
        nextAction: analysis.nextAction,
        reason: analysis.reasoning[0] ?? '',
      },
    }
  })

  return NextResponse.json({
    ...briefing,
    rankedCandidates,
    generatedAt: new Date().toISOString(),
  })
}
