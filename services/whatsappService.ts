/**
 * WhatsApp Service
 * ─────────────────
 * Handles outbound WhatsApp sends, incoming webhook parsing, and signature
 * verification. Respects FREE_MODE and ALLOW_PAID_MESSAGING gates.
 * Always persists to both conversation_messages and message_queue for audit.
 */

import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { conversationsDb, messagesDb, templatesDb } from '@/lib/db'
import { MessageStatus } from '@/lib/types'
import { createWhatsAppLink, fillTemplate } from '@/lib/utils'
import { whatsappCloudSend } from './providers/whatsappCloudProvider'

const FREE_MODE = process.env.FREE_MODE !== 'false'
const ALLOW_PAID = process.env.ALLOW_PAID_MESSAGING === 'true'

// ── Public helpers ─────────────────────────────────────────────────────────

export function generateWaLink(phone: string, message: string): string {
  return createWhatsAppLink(phone, message)
}

// ── sendMessage ────────────────────────────────────────────────────────────

export async function sendMessage(
  candidateId: string,
  templateKey: string,
  vars: Record<string, string>,
  recipientPhone: string,
): Promise<{
  ok: boolean
  mode: 'manual' | 'auto'
  link?: string
  messageId?: string
  status: MessageStatus
}> {
  const template = await templatesDb.findByKey(templateKey)
  const body = template ? fillTemplate(template.body, vars) : vars.body || ''

  const link = createWhatsAppLink(recipientPhone, body)
  const now = new Date().toISOString()

  let status: MessageStatus
  let messageId: string | undefined
  let mode: 'manual' | 'auto'

  if (FREE_MODE || !ALLOW_PAID) {
    // Free/demo mode — return manual wa.me link
    status = FREE_MODE ? 'ready_for_manual_whatsapp' : 'blocked_paid_provider'
    mode = 'manual'
  } else {
    // Paid mode
    const result = await whatsappCloudSend(recipientPhone, body)
    if (result.success) {
      status = 'sent'
      messageId = result.messageId
      mode = 'auto'
    } else {
      status = (result.status as MessageStatus) ?? 'failed'
      mode = 'manual'
    }
  }

  // Persist to conversation_messages
  await conversationsDb.create({
    candidate_id: candidateId,
    direction: 'out',
    body,
    sent_at: now,
    status: status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'sent',
    wa_message_id: messageId,
    template_key: templateKey,
  })

  // Persist to message_queue for audit trail
  await messagesDb.create({
    candidate_id: candidateId,
    recipient_type: 'candidate',
    recipient_phone: recipientPhone,
    channel: 'whatsapp',
    message_type: templateKey,
    message_body: body,
    scheduled_for: now,
    sent_at: now,
    status,
    retry_count: 0,
    provider: FREE_MODE ? 'mock' : 'whatsapp_cloud',
    whatsapp_manual_link: link,
  })

  return { ok: status !== 'failed', mode, link, messageId, status }
}

// ── parseIncoming ──────────────────────────────────────────────────────────

export interface ParsedIncoming {
  phone: string
  messageId: string
  body: string          // text body OR the label of the selected interactive option
  interactiveId?: string // for interactive replies: the id of the chosen button/row
  timestamp: number
  type: 'text' | 'interactive' | 'other'
}

export function parseIncoming(webhookBody: unknown): ParsedIncoming | null {
  try {
    const payload = webhookBody as Record<string, unknown>
    const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown>
    const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value = changes?.value as Record<string, unknown>
    const messages = value?.messages as unknown[]
    const msg = messages?.[0] as Record<string, unknown>

    if (!msg) return null

    const phone = (msg.from as string) ?? ''
    const messageId = (msg.id as string) ?? ''
    const timestamp = Number(msg.timestamp ?? 0)
    const msgType = (msg.type as string) ?? 'other'

    if (!phone || !messageId) return null

    // ── Interactive replies (button_reply / list_reply) ──────────────────
    if (msgType === 'interactive') {
      const interactive = msg.interactive as Record<string, unknown> | undefined
      const interactiveType = interactive?.type as string | undefined

      if (interactiveType === 'button_reply') {
        const reply = interactive?.button_reply as Record<string, unknown>
        const id = (reply?.id as string) ?? ''
        const title = (reply?.title as string) ?? ''
        return { phone, messageId, body: title, interactiveId: id, timestamp, type: 'interactive' }
      }

      if (interactiveType === 'list_reply') {
        const reply = interactive?.list_reply as Record<string, unknown>
        const id = (reply?.id as string) ?? ''
        const title = (reply?.title as string) ?? ''
        return { phone, messageId, body: title, interactiveId: id, timestamp, type: 'interactive' }
      }

      // Unknown interactive sub-type
      return { phone, messageId, body: '', timestamp, type: 'other' }
    }

    // ── Plain text ────────────────────────────────────────────────────────
    if (msgType === 'text') {
      const text = msg.text as Record<string, unknown> | undefined
      const body = (text?.body as string) ?? ''
      return { phone, messageId, body, timestamp, type: 'text' }
    }

    // ── Other types (image, audio, document, etc.) ────────────────────────
    return { phone, messageId, body: '', timestamp, type: 'other' }
  } catch {
    return null
  }
}

// ── verifyWebhookSignature ─────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, req: NextRequest): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    // Dev/demo mode — skip signature check
    return true
  }
  const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  // Constant-time compare to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))
  } catch {
    return false
  }
}
