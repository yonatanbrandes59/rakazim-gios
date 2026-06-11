/**
 * WhatsApp Chatbot Engine
 * ───────────────────────
 * Runs the 20-question chatbot questionnaire directly inside WhatsApp.
 * Supports text, buttons (≤3 options), list (4-9 options), multiselect, date.
 *
 * Session state: stored in admin_settings KV via waSessionsDb.
 * Send functions: use sendWaChatbot* (free — customer-initiated 24h window).
 */

import { v4 as uuidv4 } from 'uuid'
import { QUESTIONS } from '@/components/chatbot/questions'
import { ChatStep, WaChatbotSession, Region } from '@/lib/types'
import { candidatesDb, answersDb, activityDb, waSessionsDb } from '@/lib/db'
import { scoreAndAssignCandidate } from '@/services/scoringService'
import { fireTrigger } from '@/services/automationEngine'
import {
  sendWaChatbotText,
  sendWaChatbotButtons,
  sendWaChatbotList,
  isWaChatbotReady,
} from '@/services/providers/whatsappCloudProvider'

// ── Phone normalization ────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? '972' + d.slice(1) : d
}

// ── Step navigation ────────────────────────────────────────────────────────

/**
 * Find the next question index after `current` that passes its condition
 * (or has no condition). Returns QUESTIONS.length when done.
 */
function getNextValidStep(current: number, answers: Record<string, string>): number {
  let next = current + 1
  while (next < QUESTIONS.length) {
    const q = QUESTIONS[next]
    if (!q.condition || q.condition(answers)) return next
    next++
  }
  return QUESTIONS.length
}

// ── Answer validation ──────────────────────────────────────────────────────

interface ValidateResult {
  ok: boolean
  value?: string
  error?: string
}

function validateAnswer(q: ChatStep, raw: string): ValidateResult {
  const trimmed = raw.trim()

  // Optional: allow "דלג" or "skip"
  if (q.optional && (trimmed === 'דלג' || trimmed.toLowerCase() === 'skip' || trimmed === '')) {
    return { ok: true, value: '' }
  }

  if (!trimmed && !q.optional) {
    return { ok: false, error: '⚠️ נא לשלוח תשובה' }
  }

  if (q.type === 'confirm' || q.type === 'options') {
    const opts = q.options ?? []
    // Exact id match (from interactive reply)
    if (opts.find(o => o.value === trimmed)) return { ok: true, value: trimmed }
    // Numeric match (fallback text list)
    const num = parseInt(trimmed)
    if (!isNaN(num) && num >= 1 && num <= opts.length) {
      return { ok: true, value: opts[num - 1].value }
    }
    // Label match (case-insensitive)
    const match = opts.find(o => o.label.toLowerCase() === trimmed.toLowerCase())
    if (match) return { ok: true, value: match.value }
    const optList = opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')
    return { ok: false, error: `⚠️ נא לבחור אחת מהאפשרויות:\n${optList}` }
  }

  if (q.type === 'multiselect') {
    const opts = q.options ?? []
    // Parse "1,3,5" or "1 3 5"
    const parts = trimmed.split(/[,\s]+/).map(p => parseInt(p.trim())).filter(n => !isNaN(n) && n >= 1 && n <= opts.length)
    if (parts.length === 0) {
      const optList = opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')
      return { ok: false, error: `⚠️ שלח/י מספרים מופרדים בפסיקים (למשל: 1,3):\n${optList}` }
    }
    const selected = Array.from(new Set(parts)).map(n => opts[n - 1].value)
    return { ok: true, value: selected.join(',') }
  }

  if (q.type === 'date') {
    // Accept DD/MM/YYYY, MM/YYYY, YYYY
    const cleaned = trimmed.replace(/[./\-]/g, '/')
    // Full date DD/MM/YYYY
    const fullMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (fullMatch) {
      const [, d, m, y] = fullMatch
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      if (!isNaN(date.getTime())) return { ok: true, value: date.toISOString().split('T')[0] }
    }
    // Month/Year MM/YYYY
    const monthMatch = cleaned.match(/^(\d{1,2})\/(\d{4})$/)
    if (monthMatch) {
      const [, m, y] = monthMatch
      return { ok: true, value: `${y}-${m.padStart(2, '0')}-01` }
    }
    // Just year YYYY
    const yearMatch = cleaned.match(/^(\d{4})$/)
    if (yearMatch) return { ok: true, value: `${yearMatch[1]}-01-01` }

    return { ok: false, error: '⚠️ פורמט תאריך לא תקין. שלח/י בפורמט DD/MM/YYYY (למשל: 15/06/2025)' }
  }

  // text / open
  return { ok: true, value: trimmed }
}

// ── Question sending ───────────────────────────────────────────────────────

/**
 * Build the question prompt text (adds "רשות" hint for optional questions).
 */
function buildQuestionText(q: ChatStep, stepIdx: number): string {
  const total = QUESTIONS.length
  const progress = `[${stepIdx + 1}/${total}] `
  let text = progress + q.questionText
  if (q.optional) text += '\n_(רשות – שלח/י "דלג" לדילוג)_'
  return text
}

/**
 * Build a numbered fallback text list when interactive messages aren't available.
 */
function buildNumberedList(opts: Array<{ value: string; label: string }>): string {
  return opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')
}

async function sendQuestion(phone: string, stepIdx: number): Promise<void> {
  const q = QUESTIONS[stepIdx]
  if (!q) return

  const questionText = buildQuestionText(q, stepIdx)

  if (q.type === 'multiselect' && q.options) {
    const list = buildNumberedList(q.options)
    await sendWaChatbotText(phone, `${questionText}\n\n${list}\n\n_שלח/י מספרים מופרדים בפסיקים (למשל: 1,3,5)_`)
    return
  }

  if (q.type === 'date') {
    await sendWaChatbotText(phone, `${questionText}\n\n_פורמט: DD/MM/YYYY (למשל: 15/06/2025)_`)
    return
  }

  if ((q.type === 'confirm' || q.type === 'options') && q.options) {
    const opts = q.options

    if (opts.length <= 3) {
      // Interactive buttons
      const result = await sendWaChatbotButtons(
        phone,
        questionText,
        opts.map(o => ({ id: o.value, title: o.label })),
      )
      if (result.success) return
      // Fallback: numbered text
    }

    if (opts.length >= 4) {
      // Interactive list (supports up to 10 in one section)
      const result = await sendWaChatbotList(
        phone,
        questionText,
        'בחר/י',
        opts.map(o => ({ id: o.value, title: o.label })),
      )
      if (result.success) return
      // Fallback: numbered text
    }

    // Fallback to numbered text (for when interactive fails or not supported)
    const list = buildNumberedList(opts)
    await sendWaChatbotText(phone, `${questionText}\n\n${list}`)
    return
  }

  // Plain text input (text, open)
  await sendWaChatbotText(phone, questionText)
}

// ── Session submission ─────────────────────────────────────────────────────

async function submitWaSession(
  candidateId: string,
  answers: Record<string, string>,
): Promise<void> {
  const candidate = await candidatesDb.findById(candidateId)
  if (!candidate) return

  // Map chatbot answers to candidate fields (same logic as web questionnaire)
  const updates: Partial<typeof candidate> = {
    garin:                   answers.garin || candidate.garin,
    garin_year:              answers.garin_year,
    army_role:               answers.army_role,
    release_date:            answers.release_date,
    looking_for_work:        answers.looking_for_work,
    interest_in_role:        answers.interest_in_role,
    role_attraction:         answers.role_attraction ? answers.role_attraction.split(',') : undefined,
    preferred_region:        answers.preferred_region as Region | undefined,
    has_driving_license:     answers.has_driving_license === 'true',
    has_car:                 answers.has_car === 'true',
    guidance_experience:     answers.guidance_experience === 'true',
    leadership_experience:   answers.leadership_experience === 'true',
    can_commit_full_year:    answers.can_commit_full_year === 'true',
    has_cv:                  answers.has_cv === 'true',
    preferred_contact_method: answers.preferred_contact_method,
    best_time_to_contact:    answers.best_time_to_contact,
    open_answer:             answers.open_answer,
    trip_return_date:        answers.trip_return_date,
    studies_end_date:        answers.studies_end_date,
    work_days_per_week:      answers.work_days_per_week ? parseInt(answers.work_days_per_week) : undefined,
    availability_text:       answers.looking_for_work,
    consent_given:           true,
    status:                  'questionnaire_completed' as const,
    questionnaire_completed_at: new Date().toISOString(),
  }

  // Score & assign
  const merged = { ...candidate, ...updates }
  const scoring = await scoreAndAssignCandidate(merged)
  Object.assign(updates, scoring)

  await candidatesDb.update(candidateId, updates)

  // Save individual answers
  const answerRows = QUESTIONS
    .filter(q => answers[q.key] !== undefined && answers[q.key] !== '')
    .map(q => ({
      candidate_id: candidateId,
      question_key: q.key,
      question_text: q.questionText,
      answer: answers[q.key],
    }))

  if (answerRows.length > 0) {
    await answersDb.createMany(answerRows)
  }

  await activityDb.log({
    candidate_id: candidateId,
    user_type: 'candidate',
    action: 'questionnaire_completed',
    details: { source: 'whatsapp_chatbot', fit_score: scoring.fit_score, interest_level: scoring.interest_level },
  })

  // Fire automation rules
  const updated = await candidatesDb.findById(candidateId)
  if (updated) {
    fireTrigger('questionnaire_completed', updated).catch(console.error)
    if (updated.interest_level === 'very_hot' || (updated.fit_score ?? 0) >= 70) {
      fireTrigger('fit_score_high', updated).catch(console.error)
    }
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Handle an incoming WhatsApp message from a candidate and run the chatbot.
 * Returns true if the chatbot handled the message, false if it should fall
 * through to the normal brain analysis flow.
 */
export async function handleWaChatbotMessage(
  phone: string,
  body: string,
  interactiveId?: string,
): Promise<boolean> {
  if (!isWaChatbotReady()) return false

  const normalized = normalizePhone(phone)

  // Look up candidate by normalized phone
  const allCandidates = await candidatesDb.findAll()
  const candidate = allCandidates.find(c => normalizePhone(c.phone) === normalized)

  if (!candidate) {
    // Unknown sender — send polite reply
    await sendWaChatbotText(
      normalized,
      'שלום! לא מצאנו את מספרך במערכת האיחוד החקלאי.\nכדי לקבל מידע על תפקיד רכז/ת נוער, פנה/י לרכז/ת האזורי/ת שלך. 🌾',
    )
    return true
  }

  if (candidate.opt_out) return false // Let caller handle opt-out

  // If already completed — no need to run chatbot
  if (candidate.questionnaire_completed_at) {
    const existing = await waSessionsDb.get(normalized)
    if (!existing) {
      // First message after completion — send a warm reply
      await sendWaChatbotText(
        normalized,
        `היי ${candidate.first_name}! 😊\nכבר מילאת את השאלון שלנו — תודה!\nנחזור אליך בהקדם לגבי תפקיד רכז/ת נוער. 🌾`,
      )
      return true
    }
    return false
  }

  // Get or create session
  let session = await waSessionsDb.get(normalized)

  // Fresh start (new or previously completed session)
  if (!session || session.completed) {
    session = {
      id: uuidv4(),
      phone: normalized,
      candidate_id: candidate.id,
      step: -1,
      answers: {},
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed: false,
    }

    // Greeting
    await sendWaChatbotText(
      normalized,
      `היי ${candidate.first_name}! 👋\n\nאני הבוט של *האיחוד החקלאי* 🌾\n\nרוצים לבדוק התאמה שלך לתפקיד *רכז/ת נוער / רכז/ת סניף*.\n\nיש לנו ${QUESTIONS.length} שאלות קצרות — ייקח כ-3 דקות.\n\nמוכן/ה? בואו נתחיל! 🚀`,
    )

    const firstStep = getNextValidStep(-1, session.answers)
    session.step = firstStep
    session.updated_at = new Date().toISOString()
    await waSessionsDb.set(session)
    await sendQuestion(normalized, firstStep)
    return true
  }

  // Existing in-progress session — process the answer
  const currentStep = session.step

  // Safety check
  if (currentStep < 0 || currentStep >= QUESTIONS.length) {
    // Shouldn't happen — reset
    await waSessionsDb.delete(normalized)
    return false
  }

  const q = QUESTIONS[currentStep]
  // Use interactiveId for option questions (more reliable than label text)
  const rawAnswer = interactiveId ?? body

  const validation = validateAnswer(q, rawAnswer)

  if (!validation.ok) {
    // Send error + re-ask
    if (validation.error) await sendWaChatbotText(normalized, validation.error)
    await sendQuestion(normalized, currentStep)
    return true
  }

  // Store answer
  if (validation.value !== undefined && validation.value !== '') {
    session.answers[q.key] = validation.value
  }
  session.updated_at = new Date().toISOString()

  // Immediate region assignment — as soon as the candidate picks a region,
  // stamp assigned_region_id so they're visible in the coordinator's view
  // even if they abandon the questionnaire mid-way.
  if (q.key === 'preferred_region' && validation.value) {
    const region = validation.value as Region
    candidatesDb.update(candidate.id, { assigned_region_id: region, preferred_region: region }).catch(console.error)
  }

  // Advance to next step
  const nextStep = getNextValidStep(currentStep, session.answers)

  if (nextStep >= QUESTIONS.length) {
    // All questions answered — submit!
    session.completed = true
    await waSessionsDb.set(session)

    // Submit and score
    try {
      await submitWaSession(candidate.id, session.answers)
    } catch (err) {
      console.error('[WA Chatbot] submitWaSession error:', err)
    }

    await sendWaChatbotText(
      normalized,
      `תודה ${candidate.first_name}! 🎉\n\nמילאת את השאלון בהצלחה ✅\n\nעברנו על כל הפרטים — אם תהיה התאמה לתפקיד רכז/ת נוער באזור שלך, רכז/ת האזור יצור איתך קשר בזמן הנכון.\n\nזה לא מחייב אותך לכלום. שיהיה לך יום נפלא! 🌟`,
    )

    // Clean up session after short delay is irrelevant in serverless — just mark completed
    return true
  }

  // More questions — advance
  session.step = nextStep
  await waSessionsDb.set(session)
  await sendQuestion(normalized, nextStep)
  return true
}

/**
 * Initiate the chatbot for a candidate (send opening message + first question).
 * Used when we want to proactively start the flow (e.g. from automation engine).
 */
export async function initiateWaChatbot(phone: string): Promise<boolean> {
  if (!isWaChatbotReady()) return false
  const normalized = normalizePhone(phone)

  // Simulate an incoming "start" message to kick off the flow
  return handleWaChatbotMessage(normalized, '__start__', undefined)
}
