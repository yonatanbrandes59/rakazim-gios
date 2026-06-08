import { NextRequest, NextResponse } from 'next/server'
import { checkStaleCandidates } from '@/services/automationEngine'

// Minimum length enforced so that a weak / default secret is rejected at request time
const MIN_SECRET_LENGTH = 32

function validateCronSecret(req: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET
  // Reject if secret is missing or too short (prevents accidental use of weak defaults)
  if (!configuredSecret || configuredSecret.length < MIN_SECRET_LENGTH) {
    return false
  }
  const provided = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  return provided === configuredSecret
}

// Vercel Cron calls POST — do NOT add a GET handler; GET would allow any browser to trigger
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await checkStaleCandidates()
    console.log('Cron stale-candidates completed successfully')
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron stale-candidates failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Explicitly reject GET so browsers / crawlers cannot trigger cron logic
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
