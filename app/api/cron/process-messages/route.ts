import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb } from '@/lib/db'
import { processMessageQueue, sendReminderToCandidate } from '@/services/messagingService'

// Vercel Cron or manual trigger
// Protect with CRON_SECRET
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== (process.env.CRON_SECRET || 'demo-cron-secret')) {
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

  console.log('✅ Cron job completed:', results)
  return NextResponse.json({ ok: true, ...results })
}

// Also allow GET for Vercel Cron
export async function GET(req: NextRequest) {
  return POST(req)
}
