import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { candidatesDb, answersDb, activityDb } from '@/lib/db'
import { Region, UpdateCandidateDto } from '@/lib/types'

// Israeli phone: starts with 05x or +9725x, 10 digits local / 12 with country code
const PHONE_REGEX = /^(\+972|0)(5[0-9])\d{7}$/

const REGION_VALUES: [Region, ...Region[]] = [
  'north',
  'afek_hayam',
  'afek_maayan',
  'center_north',
  'center',
  'hevel_modiin',
  'shfela_tamar',
  'merhavim',
  'eshkol',
]

const CANDIDATE_STATUS_VALUES = [
  'new',
  'questionnaire_sent',
  'questionnaire_opened',
  'questionnaire_started',
  'questionnaire_completed',
  'contact_pending',
  'contacted',
  'call_scheduled',
  'accepted',
  'not_relevant',
  'not_interested',
  'follow_up_later',
] as const

// Protected fields that callers must never be allowed to overwrite
const PROTECTED_FIELDS = ['id', 'candidate_token', 'created_at'] as const

const UpdateCandidateSchema: z.ZodType<UpdateCandidateDto> = z.object({
  first_name:               z.string().min(1).max(50).optional(),
  last_name:                z.string().min(1).max(50).optional(),
  full_name:                z.string().max(100).optional(),
  phone:                    z.string().regex(PHONE_REGEX, 'מספר טלפון לא תקין').optional(),
  email:                    z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  garin:                    z.string().max(100).optional(),
  garin_year:               z.string().max(10).optional(),
  army_role:                z.string().max(100).optional(),
  release_date:             z.string().optional(),
  notes:                    z.string().max(2000).optional(),
  status:                   z.enum(CANDIDATE_STATUS_VALUES).optional(),
  preferred_region:         z.enum(REGION_VALUES).optional(),
  blocked_regions:          z.array(z.enum(REGION_VALUES)).optional(),
  assigned_region_id:       z.enum(REGION_VALUES).optional(),
  assigned_coordinator_id:  z.string().uuid().optional(),
  opt_out:                  z.boolean().optional(),
  consent_given:            z.boolean().optional(),
  interest_level:           z.enum(['very_hot', 'interested', 'needs_explanation', 'keep_warm', 'future', 'not_relevant_now', 'not_interested']).optional(),
  fit_score:                z.number().min(0).max(100).optional(),
  fit_reason:               z.string().max(500).optional(),
  has_driving_license:      z.boolean().optional(),
  has_car:                  z.boolean().optional(),
  guidance_experience:      z.boolean().optional(),
  leadership_experience:    z.boolean().optional(),
  availability_text:        z.string().max(500).optional(),
  looking_for_work:         z.string().max(50).optional(),
  interest_in_role:         z.string().max(50).optional(),
  role_attraction:          z.array(z.string()).optional(),
  open_answer:              z.string().max(3000).optional(),
  preferred_contact_method: z.string().max(20).optional(),
  best_time_to_contact:     z.string().max(100).optional(),
  work_days_per_week:       z.number().min(1).max(7).optional(),
  can_commit_full_year:     z.boolean().optional(),
  recommended_contact_date: z.string().optional(),
  has_cv:                   z.boolean().optional(),
  cv_file_url:              z.string().url().optional(),
  trip_return_date:         z.string().optional(),
  studies_end_date:         z.string().optional(),
  questionnaire_completed_at: z.string().optional(),
  questionnaire_started_at:   z.string().optional(),
  updated_at:               z.string().optional(),
})

/**
 * Strips fields that must never be returned to coordinator-facing API consumers:
 *  - candidate_token   : server-side secret used to generate questionnaire links; leaking
 *                        it would let anyone submit or opt-out on behalf of the candidate.
 *
 * Admins receive the full object (token included) since they manage the system.
 *
 * GDPR Article 5(1)(e) — data minimisation / storage limitation:
 * TODO: implement automatic deletion of questionnaire_answers rows older than 2 years.
 *       Suggested approach: a Supabase cron (pg_cron) or a Vercel cron job at
 *       app/api/cron/purge-old-answers/route.ts that runs monthly and deletes rows where
 *       created_at < NOW() - INTERVAL '2 years'. The retention period should be
 *       configurable via an environment variable (e.g. ANSWERS_RETENTION_DAYS=730).
 */
function sanitizeCandidateForCoordinator<T extends { candidate_token?: unknown }>(candidate: T): Omit<T, 'candidate_token'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { candidate_token, ...safe } = candidate as T & { candidate_token?: unknown }
  return safe as Omit<T, 'candidate_token'>
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const candidate = await candidatesDb.findById(params.id)
  if (!candidate) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  // Coordinators may only view candidates explicitly assigned to them.
  // When assigned_coordinator_id is null the candidate is unassigned — coordinators
  // must not access unassigned records to avoid PII leakage (GDPR Art. 5(1)(f)).
  if (user.role === 'coordinator') {
    if (!candidate.assigned_coordinator_id || candidate.assigned_coordinator_id !== user.id) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }
  }

  const answers = await answersDb.findByCandidateId(candidate.id)
  const activity = await activityDb.findByCandidateId(candidate.id)

  // Admins get the full object; coordinators get a sanitized DTO without candidate_token.
  const responseBody = user.role === 'admin'
    ? { ...candidate, answers, activity }
    : { ...sanitizeCandidateForCoordinator(candidate), answers, activity }

  return NextResponse.json(responseBody)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const candidate = await candidatesDb.findById(params.id)
  if (!candidate) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  if (user.role === 'coordinator' && candidate.assigned_coordinator_id !== user.id) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const rawUpdates = await req.json()

  // Reject any attempt to overwrite protected fields
  for (const field of PROTECTED_FIELDS) {
    if (field in rawUpdates) {
      return NextResponse.json(
        { error: `שדה מוגן: לא ניתן לעדכן את השדה "${field}"` },
        { status: 400 }
      )
    }
  }

  const parseResult = UpdateCandidateSchema.safeParse(rawUpdates)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'שגיאת ולידציה', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const updates = parseResult.data
  const updated = await candidatesDb.update(params.id, updates)

  if (updates.status && updates.status !== candidate.status) {
    await activityDb.log({
      candidate_id: candidate.id,
      user_type: (user.role === 'manager' || user.role === 'secretary') ? 'admin' : user.role as 'admin' | 'coordinator' | 'candidate' | 'system',
      action: 'status_changed',
      details: { from: candidate.status, to: updates.status },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

  await candidatesDb.delete(params.id)
  return NextResponse.json({ ok: true })
}
