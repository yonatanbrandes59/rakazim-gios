/**
 * Mock Messaging Provider
 * ───────────────────────
 * Logs messages to console and database – no real sending.
 * Default provider when FREE_MODE=true or no API keys configured.
 */

import { createWhatsAppLink } from '@/lib/utils'

export interface SendResult {
  success: boolean
  status: 'mock_sent' | 'sent' | 'failed' | 'ready_for_manual_whatsapp' | 'blocked_paid_provider'
  messageId?: string
  error?: string
  whatsappManualLink?: string
}

export async function mockSendWhatsApp(phone: string, message: string): Promise<SendResult> {
  const link = createWhatsAppLink(phone, message)

  console.log('\n📱 MOCK WhatsApp ─────────────────────────────')
  console.log(`   To:      ${phone}`)
  console.log(`   Message: ${message.slice(0, 80)}...`)
  console.log(`   Link:    ${link}`)
  console.log('──────────────────────────────────────────────\n')

  return {
    success: true,
    status: 'mock_sent',
    whatsappManualLink: link,
  }
}

export async function mockSendEmail(
  email: string,
  subject: string,
  body: string
): Promise<SendResult> {
  console.log('\n📧 MOCK Email ────────────────────────────────')
  console.log(`   To:      ${email}`)
  console.log(`   Subject: ${subject}`)
  console.log(`   Body:    ${body.slice(0, 80)}...`)
  console.log('──────────────────────────────────────────────\n')

  return { success: true, status: 'mock_sent' }
}
