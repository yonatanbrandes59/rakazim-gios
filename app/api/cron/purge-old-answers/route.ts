import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from '@/lib/db'
import { getStore, persistStoreToBlob } from '@/lib/store'

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

const ANSWERS_RETENTION_DAYS = parseInt(process.env.ANSWERS_RETENTION_DAYS ?? '730', 10)

// Vercel Cron calls POST — do NOT add a GET handler; GET would allow any browser to trigger purges
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - ANSWERS_RETENTION_DAYS * 86400000)
  let deleted = 0

  if (!isDemoMode) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
    )
    const { error, count } = await supabase
      .from('questionnaire_answers')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString())
    if (error) {
      console.error('[cron] purge-old-answers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deleted = count ?? 0
  } else {
    const store = getStore()
    const cutoffIso = cutoff.toISOString()
    const before = store.questionnaire_answers.length
    store.questionnaire_answers = store.questionnaire_answers.filter(
      a => a.created_at >= cutoffIso
    )
    deleted = before - store.questionnaire_answers.length
    await persistStoreToBlob()
  }

  console.log(
    `[cron] purge-old-answers: deleted ${deleted} rows older than ${cutoff.toISOString()} (retention: ${ANSWERS_RETENTION_DAYS} days)`
  )
  return NextResponse.json({ ok: true, deleted })
}

// Explicitly reject GET so browsers / crawlers cannot trigger cron logic
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
