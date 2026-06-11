/**
 * WhatsApp Webhook Route
 * ──────────────────────
 * GET  — Meta webhook verification (hub challenge).
 * POST — Incoming message handler.
 *        Always returns 200 to Meta (retries otherwise).
 *
 * Routing logic:
 *  1. Signature verification
 *  2. Parse message
 *  3. Persist to conversation_messages
 *  4. Handle opt-out keywords
 *  5. If candidate hasn't completed questionnaire → run chatbot
 *  6. Otherwise → run brain analysis (existing flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIncoming, verifyWebhookSignature } from '@/services/whatsappService'
import { conversationsDb, candidatesDb, activityDb } from '@/lib/db'
import { analyzeCandidateProfile } from '@/services/recruitmentBrain'
import { handleWaChatbotMessage } from '@/services/waChatbot'
import { isLlmEnabled, understandFreeText } from '@/services/llmBrain'
import { alertCoordinator } from '@/services/messagingService'
import { sendWaChatbotText } from '@/services/providers/whatsappCloudProvider'

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

  const { phone, messageId, body, interactiveId, timestamp } = parsed
  const normalizedIncoming = normalizePhone(phone)

  try {
    // Look up candidate by phone
    const allCandidates = await candidatesDb.findAll()
    const candidate = allCandidates.find(c => normalizePhone(c.phone) === normalizedIncoming)

    const candidateId = candidate?.id ?? 'unknown'
    const sentAt = timestamp
      ? new Date(timestamp * 1000).toISOString()
      : new Date().toISOString()

    // Persist incoming message (for all message types, including interactive)
    await conversationsDb.create({
      candidate_id: candidateId,
      direction: 'in',
      body: body || `[interactive: ${interactiveId ?? 'unknown'}]`,
      sent_at: sentAt,
      status: 'received',
      wa_message_id: messageId,
    })

    if (candidate) {
      // ── Opt-out keyword detection ──────────────────────────────────────
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
        return new Response('OK', { status: 200 })
      }

      // ── Route through chatbot if questionnaire not completed ───────────
      const chatbotHandled = await handleWaChatbotMessage(
        normalizedIncoming,
        body,
        interactiveId,
      )

      if (!chatbotHandled) {
        // ── Fallback for candidates who already completed the questionnaire ──
        // If the LLM is configured, hold a real conversation; otherwise just log
        // the message + rule-based brain analysis for the coordinator to review.
        let llmReplied = false
        if (isLlmEnabled() && body.trim()) {
          try {
            const history = await conversationsDb.findByCandidateId(candidate.id)
            const recent = history.slice(-6).map(m => ({ direction: m.direction, body: m.body }))
            const result = await understandFreeText(candidate, body, recent)
            if (result?.reply) {
              await sendWaChatbotText(normalizedIncoming, result.reply)
              await conversationsDb.create({
                candidate_id: candidate.id,
                direction: 'out',
                body: result.reply,
                sent_at: new Date().toISOString(),
                status: 'sent',
              })
              llmReplied = true

              if (result.shouldAlertCoordinator) {
                alertCoordinator(candidate).catch(console.error)
              }
              await activityDb.log({
                candidate_id: candidate.id,
                user_type: 'system',
                action: 'whatsapp_llm_reply',
                details: { message: body, intent: result.intent, alerted: result.shouldAlertCoordinator },
              })
            }
          } catch (err) {
            console.error('[webhook] LLM free-text handling failed:', err)
          }
        }

        if (!llmReplied) {
          // ── Rule-based fallback (no LLM, or LLM errored) ──────────────────
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
    }
  } catch (err: unknown) {
    // Never let an error cause a non-200 response — Meta would retry
    console.error('[webhook] Error processing incoming message:', err)
  }

  return new Response('OK', { status: 200 })
}
