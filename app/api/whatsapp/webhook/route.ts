/**
 * WhatsApp Webhook Route
 * ──────────────────────
 * GET  — Meta webhook verification (hub challenge).
 * POST — Incoming message handler.
 *        Always returns 200 to Meta (retries otherwise).
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIncoming, verifyWebhookSignature } from '@/services/whatsappService'
import { conversationsDb, candidatesDb, activityDb } from '@/lib/db'
import { analyzeCandidateProfile } from '@/services/recruitmentBrain'

// Normalize phone: strip non-digits, replace leading 0 with 972
function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? '972' + d.slice(1) : d
}

// ── GET — webhook verification ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (mode === 'subscribe' && token === expected) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ── POST — incoming message handler ───────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch {
    return new Response('OK', { status: 200 })
  }

  // Verify Meta signature
  if (!verifyWebhookSignature(rawBody, req)) {
    console.warn('[webhook] Invalid signature — rejecting')
    return new Response('Forbidden', { status: 403 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('OK', { status: 200 })
  }

  const parsed = parseIncoming(payload)
  if (!parsed) {
    // Not a message event (e.g. status update) — acknowledge silently
    return new Response('OK', { status: 200 })
  }

  const { phone, messageId, body, timestamp } = parsed
  const normalizedIncoming = normalizePhone(phone)

  try {
    // Look up candidate by phone
    const allCandidates = await candidatesDb.findAll()
    const candidate = allCandidates.find(c => normalizePhone(c.phone) === normalizedIncoming)

    const candidateId = candidate?.id ?? 'unknown'
    const sentAt = timestamp
      ? new Date(timestamp * 1000).toISOString()
      : new Date().toISOString()

    // Persist incoming message
    await conversationsDb.create({
      candidate_id: candidateId,
      direction: 'in',
      body,
      sent_at: sentAt,
      status: 'received',
      wa_message_id: messageId,
    })

    if (candidate) {
      // Opt-out keyword detection
      const optOutKeywords = ['לא מעוניין', 'הסר', 'בטל', 'stop', 'STOP']
      const isOptOut = optOutKeywords.some(kw =>
        body.toLowerCase().includes(kw.toLowerCase()),
      )

      if (isOptOut) {
        await candidatesDb.update(candidate.id, { opt_out: true })
        await activityDb.log({
          candidate_id: candidate.id,
          user_type: 'system',
          action: 'opt_out_via_whatsapp',
          details: { message: body, phone },
        })
      } else {
        // Run brain analysis and log it
        const analysis = analyzeCandidateProfile(candidate)
        await activityDb.log({
          candidate_id: candidate.id,
          user_type: 'system',
          action: 'whatsapp_message_received',
          details: {
            message: body,
            phone,
            brain_priority: analysis.priority,
            brain_next_action: analysis.nextAction,
            brain_urgency: analysis.urgencyScore,
          },
        })
      }
    }
  } catch (err: unknown) {
    // Never let an error cause a non-200 response — Meta would retry
    console.error('[webhook] Error processing incoming message:', err)
  }

  return new Response('OK', { status: 200 })
}
