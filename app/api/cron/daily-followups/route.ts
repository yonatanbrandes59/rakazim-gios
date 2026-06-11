/**
 * Cron: daily-followups
 * ─────────────────────
 * Reminds coordinators to contact candidates whose recommended_contact_date
 * has arrived. This is what turns recommended_contact_date from a stored field
 * into an actual workflow.
 *
 * Schedule: daily at 09:00 (see vercel.json). POST-only, secret-gated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyFollowups } from '@/services/automationEngine'

const MIN_SECRET_LENGTH = 32

function validateCronSecret(req: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret || configuredSecret.length < MIN_SECRET_LENGTH) return false
  const provided = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  return provided === configuredSecret
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailyFollowups()
    console.log('Cron daily-followups completed:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron daily-followups failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
