import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb } from '@/lib/db'
import { processMessageQueue, sendReminderToCandidate } from '@/services/messagingService'

// Minimum length enforced so that a weak / default secret is rejected at startup
const MIN_SECRET_LENGTH = 32

// In production, CRON_SECRET must be explicitly set with sufficient length.
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < MIN_SECRET_LENGTH)
) {
  throw new Error(
    `[cron] CRON_SECRET env var must be set in production and be at least ${MIN_SECRET_LENGTH} characters. Set it in your Vercel dashboard.`
  )
}

function validateCronSecret(req: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET
  // Reject if secret is missing or too short (prevents accidental use of weak defaults)
  if (!configuredSecret || configuredSecret.length < MIN_SECRET_LENGTH) {
    return false
  }
  const provided = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  return provided === configuredSecret
}

// Vercel Cron calls POST — do NOT add a GET handler; GET would allow any browser to trigger sends
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { processedMessages: 0, errors: 0, reminders: 0 }

  // 1. Process pending message queue
  const queueResult = await processMessageQueue()
  results.processedMessages = queueResult.processed
  results.errors = queueResult.errors

  // 2. Send reminders to candidates who haven't opened questionnaire in 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const notOpened = await candidatesDb.findAll({ status: 'questionnaire_sent' })
  for (const c of notOpened) {
    if (c.created_at < threeDaysAgo) {
      await sendReminderToCandidate(c.id)
      results.reminders++
    }
  }

  // 3. Send reminders for candidates who started but didn't finish (24h)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
  const started = await candidatesDb.findAll({ status: 'questionnaire_started' })
  for (const c of started) {
    if ((c.questionnaire_started_at || '') < oneDayAgo) {
      await sendReminderToCandidate(c.id)
      results.reminders++
    }
  }

  console.log('Cron job completed:', results)
  return NextResponse.json({ ok: true, ...results })
}

// Explicitly reject GET so browsers / crawlers cannot trigger cron logic
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
