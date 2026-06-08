/**
 * In-memory store (Demo Mode)
 * ─────────────────────────────
 * When SUPABASE_URL is not configured, all data lives here.
 * Data resets on server restart – perfect for demos and local dev.
 * Initialized with realistic seed data.
 */

import { v4 as uuidv4 } from 'uuid'
import {
  Candidate, RegionalCoordinator, OpenPosition,
  MessageTemplate, MessageQueueItem, ActivityLogItem,
  AdminSetting, QuestionnaireAnswer
} from './types'

export interface AppStore {
  candidates: Candidate[]
  questionnaire_answers: QuestionnaireAnswer[]
  regional_coordinators: RegionalCoordinator[]
  open_positions: OpenPosition[]
  message_templates: MessageTemplate[]
  message_queue: MessageQueueItem[]
  activity_log: ActivityLogItem[]
  admin_settings: AdminSetting[]
}

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedStore(): AppStore {
  const now = new Date().toISOString()
  const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0]

  const coordinators: RegionalCoordinator[] = [
    { id: 'coord-1', name: 'מיכל לוי',   region: 'north',         phone: '052-1111111', email: 'michal@demo.com',  password_hash: 'demo', settlements: ['קרית שמונה', 'מטולה', 'שלומי'], created_at: now, updated_at: now },
    { id: 'coord-2', name: 'נועה כהן',   region: 'center',        phone: '052-2222222', email: 'noa@demo.com',     password_hash: 'demo', settlements: ['פתח תקווה', 'רמת גן', 'בני ברק'], created_at: now, updated_at: now },
    { id: 'coord-3', name: 'יואב שפירא', region: 'hevel_modiin',  phone: '052-3333333', email: 'yoav@demo.com',    password_hash: 'demo', settlements: ['מודיעין', 'שוהם', 'אבן יהודה'], created_at: now, updated_at: now },
    { id: 'coord-4', name: 'שיר גולן',   region: 'eshkol',        phone: '052-4444444', email: 'shir@demo.com',    password_hash: 'demo', settlements: ['נתיבות', 'אופקים', 'שדרות'], created_at: now, updated_at: now },
  ]

  const candidates: Candidate[] = []

  const positions: OpenPosition[] = [
    { id: 'pos-1', settlement_name: 'פתח תקווה', region: 'center', coordinator_id: 'coord-2', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '100%', desired_start_date: days(30), requires_car: false, status: 'open', created_at: now, updated_at: now },
    { id: 'pos-2', settlement_name: 'רמת גן', region: 'center', coordinator_id: 'coord-2', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '100%', desired_start_date: days(45), requires_car: false, status: 'open', created_at: now, updated_at: now },
    { id: 'pos-3', settlement_name: 'קרית שמונה', region: 'north', coordinator_id: 'coord-1', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '100%', desired_start_date: days(60), requires_car: true, status: 'open', created_at: now, updated_at: now },
    { id: 'pos-4', settlement_name: 'מודיעין', region: 'hevel_modiin', coordinator_id: 'coord-3', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '80%', desired_start_date: days(30), requires_car: false, status: 'in_progress', created_at: now, updated_at: now },
    { id: 'pos-5', settlement_name: 'נתיבות', region: 'eshkol', coordinator_id: 'coord-4', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '100%', desired_start_date: days(90), requires_car: true, status: 'open', created_at: now, updated_at: now },
    { id: 'pos-6', settlement_name: 'אופקים', region: 'eshkol', coordinator_id: 'coord-4', position_type: 'רכז/ת נוער / רכז/ת סניף', job_scope: '100%', desired_start_date: days(60), requires_car: false, status: 'open', created_at: now, updated_at: now },
  ]

  const templates: MessageTemplate[] = [
    {
      id: 'tmpl-1', template_key: 'opening_to_candidate', name: 'הודעת פתיחה למועמד',
      channel: 'whatsapp',
      body: `היי {firstName}, מה קורה? 👋

פונה אליך כי היית בעבר בגרעין, ועכשיו כשאתה לקראת שחרור / אחרי שחרור מהצבא, אנחנו בודקים התאמות לתפקידי רכז/ת נוער / רכז/ת סניף.

זה שאלון קצר ולא מחייב שיעזור לנו להבין:
• אם זה מעניין אותך
• מתי נכון לדבר איתך
• איזה אזור בארץ רלוונטי לך

לשאלון:
{questionnaireLink}

אם זה לא רלוונטי, אפשר להשיב "לא מעוניין" או ללחוץ להסרה:
{optOutLink}`,
      active: true, created_at: now, updated_at: now,
    },
    {
      id: 'tmpl-2', template_key: 'reminder_to_candidate', name: 'תזכורת למילוי שאלון',
      channel: 'whatsapp',
      body: `היי {firstName} 😊

רק תזכורת קצרה – עדיין לא מילאת את השאלון שלנו לגבי תפקיד רכז/ת נוער / רכז/ת סניף.

זה לוקח בערך 5 דקות:
{questionnaireLink}

בכיף 🙏`,
      active: true, created_at: now, updated_at: now,
    },
    {
      id: 'tmpl-3', template_key: 'thank_you_candidate', name: 'תודה לאחר מילוי שאלון',
      channel: 'whatsapp',
      body: `תודה {firstName}! קיבלנו את הפרטים ✅

לפי מה שסימנת, אם תהיה התאמה לתפקיד רכז/ת נוער / רכז/ת סניף באזור שרלוונטי לך, רכז/ת האזור המתאים/ה יפנה אליך בזמן הנכון.

זה לא מחייב אותך לכלום 🙌`,
      active: true, created_at: now, updated_at: now,
    },
    {
      id: 'tmpl-4', template_key: 'alert_to_coordinator', name: 'התראה לרכז/ת אזור – מועמד חדש',
      channel: 'whatsapp',
      body: `היי {regionalCoordinatorName} 👋

נכנס מועמד/ת חדש/ה שמתעניין/ת בתפקיד רכז/ת נוער / רכז/ת סניף באזור שלך.

שם: {fullName}
גרעין: {garin}
אזור רצוי: {preferredRegion}
רמת עניין: {interestLevel}
ציון התאמה: {fitScore}/100
מתי נכון לפנות: {recommendedContactDate}

לצפייה במועמד:
{candidateAdminLink}`,
      active: true, created_at: now, updated_at: now,
    },
    {
      id: 'tmpl-5', template_key: 'reminder_to_coordinator', name: 'תזכורת לרכז/ת אזור לפנות',
      channel: 'whatsapp',
      body: `היי {regionalCoordinatorName} 🔔

תזכורת: היום נכון לפנות ל-{fullName} לגבי תפקיד רכז/ת נוער / רכז/ת סניף.

לצפייה בפרטים:
{candidateAdminLink}`,
      active: true, created_at: now, updated_at: now,
    },
  ]

  const messageQueue: MessageQueueItem[] = [
    {
      id: 'msg-1', candidate_id: 'cand-1', recipient_type: 'candidate',
      recipient_phone: '054-1234567', channel: 'whatsapp',
      message_type: 'opening_to_candidate',
      message_body: 'היי דן, מה קורה? פונה אליך כי היית בעבר בגרעין...',
      whatsapp_manual_link: `https://wa.me/972541234567?text=${encodeURIComponent('היי דן, מה קורה? פונה אליך לגבי תפקיד רכז/ת נוער')}`,
      scheduled_for: new Date(Date.now() - 86400000).toISOString(),
      sent_at: new Date(Date.now() - 86400000).toISOString(),
      status: 'mock_sent', retry_count: 0, provider: 'mock',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      updated_at: now,
    },
    {
      id: 'msg-2', candidate_id: 'cand-3', recipient_type: 'candidate',
      recipient_phone: '050-3456789', channel: 'whatsapp',
      message_type: 'reminder_to_candidate',
      message_body: 'היי אור, רק תזכורת קצרה...',
      whatsapp_manual_link: `https://wa.me/972503456789?text=${encodeURIComponent('היי אור, תזכורת לגבי שאלון רכז/ת נוער')}`,
      scheduled_for: new Date().toISOString(),
      status: 'ready_for_manual_whatsapp', retry_count: 0, provider: 'mock',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      updated_at: now,
    },
    {
      id: 'msg-3', candidate_id: 'cand-1', coordinator_id: 'coord-2', recipient_type: 'coordinator',
      recipient_phone: '052-2222222', channel: 'whatsapp',
      message_type: 'alert_to_coordinator',
      message_body: 'היי נועה, נכנס מועמד חדש – דן כהן, ציון 92...',
      whatsapp_manual_link: `https://wa.me/972522222222?text=${encodeURIComponent('היי נועה, נכנס מועמד חדש בדשבורד')}`,
      scheduled_for: new Date(Date.now() - 86400000).toISOString(),
      sent_at: new Date(Date.now() - 86400000).toISOString(),
      status: 'mock_sent', retry_count: 0, provider: 'mock',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: now,
    },
  ]

  return {
    candidates,
    questionnaire_answers: [],
    regional_coordinators: coordinators,
    open_positions: positions,
    message_templates: templates,
    message_queue: messageQueue,
    activity_log: [],
    admin_settings: [
      { id: 'setting-1', key: 'demo_mode', value: 'true', created_at: now, updated_at: now },
    ],
  }
}

// ── Module-level store ─────────────────────────────────────────────────────

let _store: AppStore | null = null
let _blobSaveTimer: ReturnType<typeof setTimeout> | null = null

const BLOB_PATH = 'merakzim-store/state.json'
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN

export function getStore(): AppStore {
  if (!_store) _store = buildSeedStore()
  return _store
}

export function resetStore(): void {
  _store = buildSeedStore()
}

/** Load persisted state from Vercel Blob (called once on cold-start) */
export async function initStoreFromBlob(): Promise<void> {
  if (!USE_BLOB) return
  try {
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: BLOB_PATH })
    const blob = blobs.find(b => b.pathname === BLOB_PATH)
    if (blob) {
      // Private blobs: pass BLOB_READ_WRITE_TOKEN as Bearer auth
      const res = await fetch(blob.downloadUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      })
      if (res.ok) {
        const data = await res.json() as AppStore
        _store = data
        return
      }
    }
  } catch (e) {
    console.warn('[store] Failed to load from blob:', e)
  }
  // First run or error: use seed data, persist it
  if (!_store) _store = buildSeedStore()
  void persistStoreToBlob()
}

/** Schedule a blob save (no-op — use persistStoreToBlob() directly in async contexts) */
export function scheduleBlobSave(): void {
  // In serverless environments setTimeout doesn't outlive the HTTP response.
  // Callers should use persistStoreToBlob() with await instead.
}

export async function persistStoreToBlob(): Promise<void> {
  if (!USE_BLOB || !_store) return
  try {
    const { put } = await import('@vercel/blob')
    await put(BLOB_PATH, JSON.stringify(_store), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    })
  } catch (e) {
    console.warn('[store] Failed to persist to blob:', e)
  }
}

// ── Generic CRUD helpers ───────────────────────────────────────────────────

export function storeGet<K extends keyof AppStore>(table: K): AppStore[K] {
  return getStore()[table]
}

export function storeFind<T>(table: keyof AppStore, id: string): T | null {
  const items = getStore()[table] as Array<{ id: string }>
  return (items.find(i => i.id === id) as T) ?? null
}

export function storeCreate<T extends { id: string; created_at: string; updated_at: string }>(
  table: keyof AppStore,
  data: Omit<T, 'id' | 'created_at' | 'updated_at'>
): T {
  const now = new Date().toISOString()
  const item = { ...data, id: uuidv4(), created_at: now, updated_at: now } as T
  ;(getStore()[table] as unknown as T[]).push(item)
  scheduleBlobSave()
  return item
}

export function storeUpdate<T extends { id: string; updated_at: string }>(
  table: keyof AppStore,
  id: string,
  data: Partial<T>
): T | null {
  const arr = getStore()[table] as unknown as T[]
  const idx = arr.findIndex(i => i.id === id)
  if (idx === -1) return null
  arr[idx] = { ...arr[idx], ...data, updated_at: new Date().toISOString() }
  scheduleBlobSave()
  return arr[idx]
}

export function storeDelete(table: keyof AppStore, id: string): boolean {
  const arr = getStore()[table] as Array<{ id: string }>
  const idx = arr.findIndex(i => i.id === id)
  if (idx === -1) return false
  arr.splice(idx, 1)
  scheduleBlobSave()
  return true
}
