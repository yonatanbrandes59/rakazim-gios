import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb, answersDb, activityDb } from '@/lib/db'
import { scoreAndAssignCandidate } from '@/services/scoringService'
import { fireTrigger } from '@/services/automationEngine'
import { Region } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { answers, consent } = body as {
    answers: Array<{ question_key: string; question_text: string; answer: string }>
    consent: boolean
  }

  if (!consent) {
    return NextResponse.json({ error: 'נדרש אישור' }, { status: 400 })
  }

  const answerMap: Record<string, string> = {}
  answers.forEach(a => { answerMap[a.question_key] = a.answer })

  const firstName = answerMap.first_name?.trim()
  const lastName = answerMap.last_name?.trim()
  const phone = answerMap.phone?.trim()

  if (!firstName || !lastName || !phone) {
    return NextResponse.json({ error: 'שם ומספר טלפון הם שדות חובה' }, { status: 400 })
  }

  // Basic phone validation — must contain digits
  if (!/\d{7,}/.test(phone.replace(/[-\s]/g, ''))) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
  }

  const source = answerMap.source || 'public'
  const sourceLabel: Record<string, string> = {
    facebook: 'פייסבוק',
    friend: 'חבר/ה',
    instagram: 'אינסטגרם',
    google: 'גוגל',
    event: 'אירוע',
    other: 'אחר',
    public: 'שאלון ציבורי',
  }

  const candidate = await candidatesDb.create({
    first_name: firstName,
    last_name: lastName,
    phone,
    email: answerMap.email || undefined,
    army_role: answerMap.army_role || undefined,
    release_date: answerMap.release_date || undefined,
    notes: `הגיע דרך: ${sourceLabel[source] || source}`,
  })

  const updates: Parameters<typeof candidatesDb.update>[1] = {
    looking_for_work:        answerMap.looking_for_work,
    interest_in_role:        answerMap.interest_in_role,
    role_attraction:         answerMap.role_attraction ? [answerMap.role_attraction] : undefined,
    preferred_region:        answerMap.preferred_region as Region,
    has_driving_license:     answerMap.has_driving_license === 'true',
    has_car:                 answerMap.has_car === 'true',
    guidance_experience:     answerMap.guidance_experience === 'true',
    leadership_experience:   answerMap.leadership_experience === 'true',
    can_commit_full_year:    answerMap.can_commit_full_year === 'true',
    has_cv:                  answerMap.has_cv === 'true',
    preferred_contact_method: answerMap.preferred_contact_method,
    best_time_to_contact:    answerMap.best_time_to_contact,
    open_answer:             answerMap.open_answer,
    trip_return_date:        answerMap.trip_return_date,
    studies_end_date:        answerMap.studies_end_date,
    availability_text:       answerMap.looking_for_work,
    consent_given:           true,
    status:                  'questionnaire_completed',
    questionnaire_completed_at: new Date().toISOString(),
  }

  const merged = { ...candidate, ...updates }
  const scoring = await scoreAndAssignCandidate(merged)
  Object.assign(updates, scoring)

  await candidatesDb.update(candidate.id, updates)

  await answersDb.createMany(
    answers.map(a => ({
      candidate_id: candidate.id,
      question_key: a.question_key,
      question_text: a.question_text,
      answer: a.answer,
    }))
  )

  await activityDb.log({
    candidate_id: candidate.id,
    user_type: 'candidate',
    action: 'questionnaire_completed',
    details: { source, fit_score: scoring.fit_score, interest_level: scoring.interest_level },
  })

  const updatedCandidate = await candidatesDb.findById(candidate.id)
  if (updatedCandidate) {
    fireTrigger('questionnaire_completed', updatedCandidate).catch(console.error)
    if (updatedCandidate.interest_level === 'very_hot' || (updatedCandidate.fit_score ?? 0) >= 70) {
      fireTrigger('fit_score_high', updatedCandidate).catch(console.error)
    }
  }

  return NextResponse.json({
    ok: true,
    fit_score: scoring.fit_score,
    interest_level: scoring.interest_level,
  })
}
