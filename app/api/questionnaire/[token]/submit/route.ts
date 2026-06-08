import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb, answersDb, activityDb } from '@/lib/db'
import { scoreAndAssignCandidate } from '@/services/scoringService'
import { sendThankYouToCandidate, alertCoordinator } from '@/services/messagingService'
import { Region } from '@/lib/types'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const candidate = await candidatesDb.findByToken(params.token)
  if (!candidate) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 404 })
  if (candidate.opt_out) return NextResponse.json({ error: 'הוסרת מהרשימה' }, { status: 410 })
  if (candidate.questionnaire_completed_at) {
    return NextResponse.json({ error: 'השאלון כבר הוגש' }, { status: 409 })
  }

  const body = await req.json()
  const { answers, consent, opt_out } = body as {
    answers: Array<{ question_key: string; question_text: string; answer: string }>
    consent: boolean
    opt_out?: boolean
  }

  // Handle opt-out
  if (opt_out) {
    await candidatesDb.update(candidate.id, { opt_out: true, status: 'not_interested' })
    await activityDb.log({ candidate_id: candidate.id, user_type: 'candidate', action: 'opt_out' })
    return NextResponse.json({ ok: true, opted_out: true })
  }

  if (!consent) {
    return NextResponse.json({ error: 'נדרש אישור' }, { status: 400 })
  }

  // Build candidate update from answers
  const answerMap: Record<string, string> = {}
  answers.forEach(a => { answerMap[a.question_key] = a.answer })

  const updates: Partial<typeof candidate> = {
    garin:                  answerMap.garin || candidate.garin,
    garin_year:             answerMap.garin_year,
    army_role:              answerMap.army_role,
    release_date:           answerMap.release_date,
    looking_for_work:       answerMap.looking_for_work,
    interest_in_role:       answerMap.interest_in_role,
    role_attraction:        answerMap.role_attraction ? [answerMap.role_attraction] : undefined,
    preferred_region:       answerMap.preferred_region as Region,
    blocked_regions:        answerMap.blocked_regions ? [answerMap.blocked_regions as Region] : undefined,
    has_driving_license:    answerMap.driving_license === 'כן',
    has_car:                answerMap.has_car === 'כן',
    guidance_experience:    answerMap.guidance_experience === 'כן',
    leadership_experience:  answerMap.leadership_experience === 'כן',
    can_commit_full_year:   answerMap.can_commit_full_year === 'כן',
    has_cv:                 answerMap.has_cv !== 'אין לי',
    preferred_contact_method: answerMap.contact_method,
    best_time_to_contact:   answerMap.best_time_to_contact,
    open_answer:            answerMap.open_answer,
    trip_return_date:       answerMap.trip_return_date,
    studies_end_date:       answerMap.studies_end_date,
    availability_text:      answerMap.looking_for_work,
    consent_given:          true,
    status:                 'questionnaire_completed',
    questionnaire_completed_at: new Date().toISOString(),
  }

  // Score & assign
  const merged = { ...candidate, ...updates }
  const scoring = await scoreAndAssignCandidate(merged)
  Object.assign(updates, scoring)

  await candidatesDb.update(candidate.id, updates)

  // Save all answers
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
    details: { fit_score: scoring.fit_score, interest_level: scoring.interest_level },
  })

  // Fire notifications (async, don't await to avoid timeout)
  const updatedCandidate = await candidatesDb.findById(candidate.id)
  if (updatedCandidate) {
    sendThankYouToCandidate(candidate.id).catch(console.error)
    alertCoordinator(updatedCandidate).catch(console.error)
  }

  return NextResponse.json({
    ok: true,
    fit_score: scoring.fit_score,
    interest_level: scoring.interest_level,
    recommended_contact_date: scoring.recommended_contact_date,
  })
}
