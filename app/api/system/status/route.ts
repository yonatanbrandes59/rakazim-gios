/**
 * GET /api/system/status
 * ──────────────────────
 * Health checklist for every integration the app depends on.
 * Admin-level access only. Each check returns:
 *   ok      — configured and (where cheaply possible) live-verified
 *   warn    — works but in a degraded/demo mode
 *   missing — not configured
 *
 * Live verifications used (all free / metadata-only):
 *   - Anthropic: GET /v1/models/{id} (validates the API key, no tokens billed)
 *   - WhatsApp:  GET phone number metadata from Graph API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasAdminAccess } from '@/lib/auth'

type CheckState = 'ok' | 'warn' | 'missing'

interface Check {
  key: string
  label: string
  state: CheckState
  detail: string
  envVars: string[]
}

async function checkAi(): Promise<Check> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const base: Omit<Check, 'state' | 'detail'> = {
    key: 'ai',
    label: 'מוח AI (Claude / Gemini)',
    envVars: ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY'],
  }

  if (!anthropicKey && !geminiKey) {
    return { ...base, state: 'missing', detail: 'אין מפתח — המערכת רצה על המוח מבוסס-החוקים בלבד. שלח טוקן (Claude או Gemini) והכל יידלק.' }
  }

  // Claude takes precedence when both are configured
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models/claude-opus-4-8', {
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        return { ...base, state: 'ok', detail: 'Claude מחובר ומאומת — סיכומי AI, הודעות מותאמות ושיחה חופשית פעילים.' }
      }
      if (res.status === 401) {
        return { ...base, state: 'warn', detail: 'מפתח Claude קיים אך נדחה על ידי Anthropic (401) — בדוק שהטוקן תקין.' }
      }
      return { ...base, state: 'warn', detail: `מפתח Claude קיים אך האימות החזיר ${res.status}.` }
    } catch {
      return { ...base, state: 'warn', detail: 'מפתח Claude קיים אך לא הצלחנו לאמת מול Anthropic (timeout).' }
    }
  }

  // Gemini — validate with a free metadata GET
  try {
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${geminiKey}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (res.ok) {
      return { ...base, state: 'ok', detail: `Gemini מחובר ומאומת (${model}) — סיכומי AI, הודעות מותאמות ושיחה חופשית פעילים.` }
    }
    if (res.status === 400 || res.status === 403) {
      return { ...base, state: 'warn', detail: `מפתח Gemini קיים אך נדחה על ידי Google (${res.status}) — בדוק שהטוקן תקין.` }
    }
    if (res.status === 404) {
      return { ...base, state: 'warn', detail: `מפתח Gemini תקין אך המודל לא נמצא — בדוק את GEMINI_MODEL.` }
    }
    return { ...base, state: 'warn', detail: `מפתח Gemini קיים אך האימות החזיר ${res.status}.` }
  } catch {
    return { ...base, state: 'warn', detail: 'מפתח Gemini קיים אך לא הצלחנו לאמת מול Google (timeout).' }
  }
}

async function checkWhatsApp(): Promise<Check> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim()
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  const base: Omit<Check, 'state' | 'detail'> = {
    key: 'whatsapp',
    label: 'WhatsApp Business',
    envVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_CLOUD_API_TOKEN', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
  }
  const missing = [
    !phoneId && 'WHATSAPP_PHONE_NUMBER_ID',
    !token && 'WHATSAPP_CLOUD_API_TOKEN',
    !verifyToken && 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  ].filter(Boolean)
  if (missing.length > 0) {
    return { ...base, state: 'missing', detail: `חסרים: ${missing.join(', ')} — הצ'אטבוט בוואטסאפ כבוי, קישורי wa.me ידניים פעילים.` }
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) },
    )
    const data = await res.json() as { display_phone_number?: string }
    if (res.ok && data.display_phone_number) {
      return { ...base, state: 'ok', detail: `מחובר — ${data.display_phone_number}. הצ'אטבוט פעיל.` }
    }
    return { ...base, state: 'warn', detail: 'המשתנים קיימים אך Meta דחתה את האימות — בדוק את הטוקן.' }
  } catch {
    return { ...base, state: 'warn', detail: 'המשתנים קיימים אך לא הצלחנו לאמת מול Meta (timeout).' }
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin' && !hasAdminAccess(user)) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const checks: Check[] = []

  // Database
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  checks.push({
    key: 'database',
    label: 'בסיס נתונים',
    state: hasSupabase ? 'ok' : 'warn',
    detail: hasSupabase
      ? 'Supabase מחובר — הנתונים נשמרים לצמיתות.'
      : 'מצב דמו (זיכרון + Blob) — Supabase לא מוגדר.',
    envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  })

  // Blob persistence (relevant only in demo mode)
  if (!hasSupabase) {
    const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN
    checks.push({
      key: 'blob',
      label: 'גיבוי Blob (מצב דמו)',
      state: hasBlob ? 'ok' : 'warn',
      detail: hasBlob ? 'נתוני הדמו שורדים אתחולי שרת.' : 'ללא Blob — נתוני הדמו מתאפסים בכל אתחול.',
      envVars: ['BLOB_READ_WRITE_TOKEN'],
    })
  }

  // Live integrations (parallel)
  const [ai, wa] = await Promise.all([checkAi(), checkWhatsApp()])
  checks.push(ai, wa)

  // WhatsApp webhook signature
  checks.push({
    key: 'wa_signature',
    label: 'אימות חתימת Webhook',
    state: process.env.WHATSAPP_APP_SECRET ? 'ok' : 'warn',
    detail: process.env.WHATSAPP_APP_SECRET
      ? 'חתימות Meta מאומתות — מוגן מזיופים.'
      : 'WHATSAPP_APP_SECRET לא מוגדר — ה-webhook מקבל בקשות ללא אימות חתימה.',
    envVars: ['WHATSAPP_APP_SECRET'],
  })

  // Cron
  const cronOk = !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32
  checks.push({
    key: 'cron',
    label: 'אוטומציות מתוזמנות (Cron)',
    state: cronOk ? 'ok' : 'missing',
    detail: cronOk
      ? '4 משימות יומיות פעילות: הודעות, תזכורות, מועמדים רדומים, מעקבי רכזים.'
      : 'CRON_SECRET חסר או קצר מ-32 תווים — המשימות המתוזמנות לא ירוצו.',
    envVars: ['CRON_SECRET'],
  })

  // Admin phone
  checks.push({
    key: 'admin_phone',
    label: 'טלפון מנהל להתראות',
    state: process.env.ADMIN_PHONE ? 'ok' : 'missing',
    detail: process.env.ADMIN_PHONE
      ? 'התראות "מועמד חדש" יישלחו למנהל.'
      : 'ADMIN_PHONE לא מוגדר — התראות למנהל לא יישלחו.',
    envVars: ['ADMIN_PHONE'],
  })

  // Messaging mode (by design — free mode is a feature, not a fault)
  const freeMode = process.env.FREE_MODE !== 'false'
  const allowPaid = process.env.ALLOW_PAID_MESSAGING === 'true'
  checks.push({
    key: 'messaging_mode',
    label: 'מצב שליחת הודעות',
    state: 'ok',
    detail: freeMode || !allowPaid
      ? 'מצב חינמי 🔒 — אפס עלויות. הודעות יוצאות כקישורי wa.me ידניים; תשובות צ\'אטבוט (חלון 24ש) חינמיות.'
      : 'מצב בתשלום פעיל — הודעות יוצאות נשלחות אוטומטית דרך WhatsApp Cloud API.',
    envVars: ['FREE_MODE', 'ALLOW_PAID_MESSAGING'],
  })

  const summary = {
    ok: checks.filter(c => c.state === 'ok').length,
    warn: checks.filter(c => c.state === 'warn').length,
    missing: checks.filter(c => c.state === 'missing').length,
    total: checks.length,
  }

  return NextResponse.json({ checks, summary, generatedAt: new Date().toISOString() })
}
