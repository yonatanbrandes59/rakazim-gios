import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isDemoMode, activityDb } from '@/lib/db'
import { getStore } from '@/lib/store'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  // Vercel Cron passes the secret as Bearer token; reject anything else when set.
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const retentionDays = parseInt(process.env.ANSWERS_RETENTION_DAYS ?? '730', 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffIso = cutoff.toISOString()

  let deletedCount = 0

  if (!isDemoMode) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from('questionnaire_answers')
      .delete()
      .lt('created_at', cutoffIso)
      .select('id')
    if (error) {
      console.error('[cron] purge-old-answers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deletedCount = data?.length ?? 0
  } else {
    // Demo mode: prune from the in-memory store
    const store = getStore()
    const kept = store.questionnaire_answers.filter(a => a.created_at >= cutoffIso)
    deletedCount = store.questionnaire_answers.length - kept.length
    store.questionnaire_answers.splice(0, store.questionnaire_answers.length, ...kept)
  }

  console.log(`[cron] purge-old-answers: deleted ${deletedCount} rows older than ${cutoffIso} (retention=${retentionDays}d)`)

  await activityDb.log({
    user_type: 'system',
    action: 'gdpr_purge_answers',
    details: { deleted: deletedCount, retention_days: retentionDays, cutoff: cutoffIso },
  })

  return NextResponse.json({ ok: true, deleted: deletedCount, cutoff: cutoffIso })
}
