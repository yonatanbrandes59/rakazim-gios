/**
 * GET /api/brain/summary/:candidateId
 * ────────────────────────────────────
 * Returns an LLM-generated one-line Hebrew summary of the candidate.
 *
 * - No ANTHROPIC_API_KEY → 200 with { enabled: false } (UI hides the feature).
 * - Cached per candidate, keyed by candidate.updated_at — Claude is only
 *   called again when the candidate's data actually changed. Keeps the modal
 *   instant on repeat opens and avoids paying for identical analyses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { candidatesDb, answersDb, kvDb } from '@/lib/db'
import { isLlmEnabled, summarizeCandidate } from '@/services/llmBrain'

interface CachedSummary {
  summary: string
  candidateUpdatedAt: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  if (!isLlmEnabled()) {
    return NextResponse.json({ enabled: false, summary: null })
  }

  const { candidateId } = await params
  const candidate = await candidatesDb.findById(candidateId)
  if (!candidate) {
    return NextResponse.json({ error: 'מועמד לא נמצא' }, { status: 404 })
  }

  // Serve from cache when the candidate hasn't changed since last analysis
  const cacheKey = `ai_summary_${candidateId}`
  try {
    const raw = await kvDb.get(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw) as CachedSummary
      if (cached.candidateUpdatedAt === candidate.updated_at && cached.summary) {
        return NextResponse.json({ enabled: true, summary: cached.summary, cached: true })
      }
    }
  } catch { /* cache miss/corrupt — fall through to fresh generation */ }

  const answers = await answersDb.findByCandidateId(candidateId)
  const summary = await summarizeCandidate(candidate, answers)

  if (summary) {
    const entry: CachedSummary = { summary, candidateUpdatedAt: candidate.updated_at }
    kvDb.set(cacheKey, JSON.stringify(entry)).catch(console.error)
  }

  return NextResponse.json({ enabled: true, summary, cached: false })
}
