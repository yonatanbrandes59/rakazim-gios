/**
 * Messaging Service
 * ──────────────────
 * Central hub for all outbound communications.
 * Respects FREE_MODE and ALLOW_PAID_MESSAGING.
 * Saves everything to message_queue for audit trail.
 */

import { messagesDb, candidatesDb, coordinatorsDb, templatesDb, activityDb } from '@/lib/db'
import { Candidate, RegionalCoordinator, MessageChannel } from '@/lib/types'
import { fillTemplate, createWhatsAppLink, nextSendingWindow } from '@/lib/utils'
import { REGION_LABELS } from '@/lib/types'
import { mockSendWhatsApp, mockSendEmail } from './providers/mockProvider'
import { resendSendEmail } from './providers/resendProvider'
import { whatsappCloudSend } from './providers/whatsappCloudProvider'
import { formatDate } from '@/lib/utils'

const FREE_MODE = process.env.FREE_MODE !== 'false'
const ALLOW_PAID = process.env.ALLOW_PAID_MESSAGING === 'true'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Build template variables for a candidate
function buildCandidateVars(candidate: Candidate, coordinator?: RegionalCoordinator | null) {
  return {
    firstName: candidate.first_name,
    lastName: candidate.last_name,
    fullName: candidate.full_name,
    garin: candidate.garin || '',
    releaseDate: formatDate(candidate.release_date),
    questionnaireLink: `${APP_URL}/questionnaire/${candidate.candidate_token}`,
    optOutLink: `${APP_URL}/questionnaire/${candidate.candidate_token}?action=optout`,
    preferredRegion: candidate.preferred_region ? REGION_LABELS[candidate.preferred_region] : '',
    recommendedContactDate: formatDate(candidate.recommended_contact_date),
    regionalCoordinatorName: coordinator?.name || '',
    regionalCoordinatorPhone: coordinator?.phone || '',
    fitScore: String(candidate.fit_score ?? 0),
    interestLevel: candidate.interest_level || '',
    candidateAdminLink: `${APP_URL}/admin/candidates/${candidate.id}`,
  }
}

// Core send dispatcher
async function dispatch(
  channel: MessageChannel,
  phone: string | undefined,
  email: string | undefined,
  subject: string,
  body: string
): Promise<{ status: string; whatsappManualLink?: string; error?: string }> {
  if (channel === 'whatsapp') {
    if (!phone) return { status: 'failed', error: 'No phone number' }
    const manualLink = createWhatsAppLink(phone, body)

    if (FREE_MODE || !ALLOW_PAID) {
      // Use mock, but also create the manual link
      const result = await mockSendWhatsApp(phone, body)
      return { ...result, status: 'mock_sent', whatsappManualLink: manualLink }
    }
    // Try real WhatsApp Cloud
    const result = await whatsappCloudSend(phone, body)
    return { ...result, whatsappManualLink: manualLink }
  }

  if (channel === 'email') {
    if (!email) return { status: 'failed', error: 'No email address' }
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      return resendSendEmail(email, subject, body)
    }
    return mockSendEmail(email, subject, body)
  }

  return { status: 'failed', error: 'Unknown channel' }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function sendOpeningToCandidates(candidateIds: string[]): Promise<void> {
  const template = await templatesDb.findByKey('opening_to_candidate')
  if (!template) throw new Error('Template not found: opening_to_candidate')

  for (const cid of candidateIds) {
    const candidate = await candidatesDb.findById(cid)
    if (!candidate || candidate.opt_out) continue

    const vars = buildCandidateVars(candidate)
    const body = fillTemplate(template.body, vars)
    const scheduledFor = nextSendingWindow().toISOString()

    const result = await dispatch('whatsapp', candidate.phone, candidate.email, 'הצטרפי לרכזים בדרך', body)

    await messagesDb.create({
      candidate_id: candidate.id,
      recipient_type: 'candidate',
      recipient_phone: candidate.phone,
      recipient_email: candidate.email,
      channel: 'whatsapp',
      message_type: 'opening_to_candidate',
      message_body: body,
      scheduled_for: scheduledFor,
      sent_at: new Date().toISOString(),
      status: result.status as any,
      error_message: result.error,
      retry_count: 0,
      provider: FREE_MODE ? 'mock' : (process.env.MESSAGING_PROVIDER || 'mock'),
      whatsapp_manual_link: result.whatsappManualLink,
    })

    await candidatesDb.update(candidate.id, { status: 'questionnaire_sent' })
    await activityDb.log({ candidate_id: candidate.id, user_type: 'system', action: 'questionnaire_sent', details: { channel: 'whatsapp' } })
  }
}

export async function sendThankYouToCandidate(candidateId: string): Promise<void> {
  const candidate = await candidatesDb.findById(candidateId)
  if (!candidate || candidate.opt_out) return

  const template = await templatesDb.findByKey('thank_you_candidate')
  if (!template) return

  const vars = buildCandidateVars(candidate)
  const body = fillTemplate(template.body, vars)

  const result = await dispatch('whatsapp', candidate.phone, candidate.email, 'תודה על מילוי השאלון', body)

  await messagesDb.create({
    candidate_id: candidate.id,
    recipient_type: 'candidate',
    recipient_phone: candidate.phone,
    channel: 'whatsapp',
    message_type: 'thank_you_candidate',
    message_body: body,
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: result.status as any,
    error_message: result.error,
    retry_count: 0,
    provider: 'mock',
    whatsapp_manual_link: result.whatsappManualLink,
  })
}

export async function alertCoordinator(candidate: Candidate): Promise<void> {
  if (!candidate.assigned_coordinator_id) return

  const coordinator = await coordinatorsDb.findById(candidate.assigned_coordinator_id)
  if (!coordinator) return

  const template = await templatesDb.findByKey('alert_to_coordinator')
  if (!template) return

  const vars = buildCandidateVars(candidate, coordinator)
  const body = fillTemplate(template.body, vars)

  const result = await dispatch('whatsapp', coordinator.phone, coordinator.email, 'מועמד חדש', body)

  await messagesDb.create({
    candidate_id: candidate.id,
    coordinator_id: coordinator.id,
    recipient_type: 'coordinator',
    recipient_phone: coordinator.phone,
    channel: 'whatsapp',
    message_type: 'alert_to_coordinator',
    message_body: body,
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: result.status as any,
    error_message: result.error,
    retry_count: 0,
    provider: 'mock',
    whatsapp_manual_link: result.whatsappManualLink,
  })
}

export async function sendReminderToCandidate(candidateId: string): Promise<void> {
  const candidate = await candidatesDb.findById(candidateId)
  if (!candidate || candidate.opt_out) return

  const template = await templatesDb.findByKey('reminder_to_candidate')
  if (!template) return

  const vars = buildCandidateVars(candidate)
  const body = fillTemplate(template.body, vars)

  const result = await dispatch('whatsapp', candidate.phone, candidate.email, 'תזכורת: שאלון רכז/ת נוער', body)

  await messagesDb.create({
    candidate_id: candidate.id,
    recipient_type: 'candidate',
    recipient_phone: candidate.phone,
    channel: 'whatsapp',
    message_type: 'reminder_to_candidate',
    message_body: body,
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: result.status as any,
    error_message: result.error,
    retry_count: 0,
    provider: 'mock',
    whatsapp_manual_link: result.whatsappManualLink,
  })
}

export async function processMessageQueue(): Promise<{ processed: number; errors: number }> {
  const pending = await messagesDb.findAll({ status: 'pending' })
  let processed = 0
  let errors = 0
  const now = new Date()

  for (const msg of pending) {
    // Check time window
    if (new Date(msg.scheduled_for) > now) continue

    const candidate = msg.candidate_id ? await candidatesDb.findById(msg.candidate_id) : null
    if (candidate?.opt_out) {
      await messagesDb.update(msg.id, { status: 'cancelled' })
      continue
    }

    try {
      const result = await dispatch(
        msg.channel,
        msg.recipient_phone,
        msg.recipient_email,
        msg.message_type,
        msg.message_body
      )
      await messagesDb.update(msg.id, {
        status: result.status as any,
        sent_at: new Date().toISOString(),
        whatsapp_manual_link: result.whatsappManualLink,
        error_message: result.error,
      })
      processed++
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      await messagesDb.update(msg.id, { status: 'failed', error_message: error, retry_count: msg.retry_count + 1 })
      errors++
    }
  }

  return { processed, errors }
}
